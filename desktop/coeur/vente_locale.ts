/**
 * Vente du poste : une seule transaction pour la vente, ses sorties de stock, ses paiements,
 * son numéro et son événement (et la caisse ouverte automatiquement si besoin). Après une
 * coupure de courant, tout existe ou rien n'existe. Règles reprises de back_medconnect :
 * vente.service.ts, vente-regles.ts (allouerLignes) et synchro/rejeu-regles.ts.
 */
import type {
  AllocationVente,
  AnnulationPiece,
  CorpsCreationVente,
  LigneVente,
  PaiementVente,
  UniteVente,
  Vente,
  VenteResume,
  VentesDuJour,
} from "@/lib/api_ventes";
import { CODE_ESPECES } from "@/lib/caisse/regles/caisse";
import { formaterNumeroTicket, numeroSecours } from "@/lib/caisse/regles/numeros";
import { preparerPaiements } from "@/lib/caisse/regles/paiements";
import { calculerLigne, type LigneCalculee } from "@/lib/caisse/regles/prix";
import { reliquatLot } from "@/lib/caisse/regles/quantites";
import { selectionnerLots, type LotCandidat, type LotPerimeDisponible } from "@/lib/caisse/regles/selection_lots";
import { calculerStockLocal } from "@/lib/caisse/regles/stock_local";
import { ajouterMouvementLocal, lireSurcouche } from "./stock_surcouche";
import { creerSession, lireSession, sessionOuverteLigne } from "./caisse_session";
import type { Contexte } from "./contexte";
import {
  MESSAGE_LOT_INTROUVABLE,
  MESSAGE_MODE_EN_DOUBLE,
  MESSAGE_MONTANT_RECU_INSUFFISANT,
  MESSAGE_MOTIF_SORTIE_REQUIS,
  MESSAGE_ORDONNANCE_NON_CONFIRMEE,
  MESSAGE_PANIER_DOUBLON,
  MESSAGE_STOCK_LOT_INSUFFISANT,
  MESSAGE_TOTAL_TROP_ELEVE,
  messageModeInconnu,
  messagePaiementsIncoherents,
  messagePrixManquant,
  messagePrixUniteManquant,
  messageSessionAutreUtilisateur,
  messageSortieManuelleRequise,
  messageStockIntrouvable,
  messageVenteUniteInterdite,
} from "./messages";
import { consommerNumeroPlage, prochainNumeroPlage } from "./plages_locales";
import { RefusCaisse, exigerUuid, refusValidation } from "./refus";
import type { Utilisateur } from "./types_caisse";
import type { FicheSynchro } from "./types_synchro";

/** Plus grand montant enregistrable (colonne Int du serveur). */
const PRIX_MAX = 2147483647;

/** Facultatif, comme au serveur : chiffres, espaces, tirets, + en tête, 6 à 20 chiffres. */
function telephonePrescripteurLocalValide(t: string): boolean {
  if (t.length > 30 || !/^\+?[\d\s-]+$/.test(t)) return false;
  const chiffres = t.replace(/\D/g, "").length;
  return chiffres >= 6 && chiffres <= 20;
}

const entier = (v: unknown, min: number, max: number): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;

interface AllocationPrevue {
  lot: LotCandidat;
  quantite: number;
  sortieManuelle: boolean;
  motif: string | null;
}

interface LigneAllouee {
  allocations: AllocationPrevue[];
  resteProvisoire: number;
  lotsPerimesDisponibles: LotPerimeDisponible[];
  quantiteAllouee: number;
  ouvertureConditionnement: boolean;
}

/** Allocation de toutes les lignes dans l'ordre reçu, soldes diminués en mémoire d'une ligne à l'autre. */
function allouerLignes(
  jour: string,
  lignes: { stockId: string; unite: UniteVente; quantiteUm: number; sortieManuelle: { lotId: string; motif: string } | null }[],
  lotsParFiche: Map<string, LotCandidat[]>,
): LigneAllouee[] {
  const soldes = new Map<string, number>();
  for (const lots of lotsParFiche.values()) for (const lot of lots) soldes.set(lot.id, lot.solde);

  return lignes.map((ligne) => {
    const lots = (lotsParFiche.get(ligne.stockId) ?? []).map((l) => ({ ...l, solde: soldes.get(l.id) ?? l.solde }));
    let reste = ligne.quantiteUm;
    const allocations: AllocationPrevue[] = [];
    let ouverture = false;
    const noter = (lot: LotCandidat, quantite: number, avant: number) => {
      if (ligne.unite === "UNITE") {
        ouverture ||=
          reliquatLot(avant, lot.coefficientReception) === 0 &&
          reliquatLot(avant - quantite, lot.coefficientReception) !== 0;
      }
    };

    if (ligne.sortieManuelle) {
      const lot = lots.find((l) => l.id === ligne.sortieManuelle?.lotId);
      if (lot) {
        const prise = Math.min(lot.solde, reste);
        if (prise > 0) {
          noter(lot, prise, lot.solde);
          allocations.push({ lot, quantite: prise, sortieManuelle: true, motif: ligne.sortieManuelle.motif });
          soldes.set(lot.id, lot.solde - prise);
          lot.solde -= prise;
          reste -= prise;
        }
      }
    }

    let resteProvisoire = 0;
    let lotsPerimesDisponibles: LotPerimeDisponible[] = [];
    if (reste > 0) {
      const r = selectionnerLots({ jour, unite: ligne.unite, quantiteUm: reste, lots });
      for (const a of r.allocations) {
        const lot = lots.find((l) => l.id === a.lotId) as LotCandidat;
        noter(lot, a.quantite, soldes.get(a.lotId) ?? lot.solde);
        allocations.push({ lot, quantite: a.quantite, sortieManuelle: false, motif: null });
        soldes.set(a.lotId, (soldes.get(a.lotId) ?? 0) - a.quantite);
      }
      resteProvisoire = r.resteProvisoire;
      lotsPerimesDisponibles = ligne.sortieManuelle ? [] : r.lotsPerimesDisponibles;
    }
    return {
      allocations,
      resteProvisoire,
      lotsPerimesDisponibles,
      quantiteAllouee: allocations.reduce((s, a) => s + a.quantite, 0),
      ouvertureConditionnement: ouverture,
    };
  });
}

export function enregistrerVente(c: Contexte, corps: CorpsCreationVente, cle: string, u: Utilisateur): Vente {
  return c.stockage.transaction(() => {
    // 1. Clé déjà vue : la vente existante, sans nouvel événement.
    exigerUuid(cle, "de la vente");
    const deja = lireVente(c, cle);
    if (deja) return { ...deja, rejeu: true };

    const ref = c.referentielsRequis();
    const etat = c.etat();

    // 2. Forme du panier, fiches connues.
    const demandees = corps.lignes;
    if (!Array.isArray(demandees) || demandees.length < 1 || demandees.length > 50) {
      throw refusValidation("Une vente contient de 1 à 50 lignes.");
    }
    for (const l of demandees) {
      if (!entier(l.quantite, 1, 10_000)) {
        throw refusValidation("La quantité d'une ligne doit être comprise entre 1 et 10 000.");
      }
      if (l.unite !== undefined && l.unite !== "BOITE" && l.unite !== "UNITE") {
        throw refusValidation("L'unité d'une ligne doit être la boîte ou l'unité.");
      }
    }
    const cles = demandees.map((l) => `${l.stockId}|${l.unite ?? "BOITE"}`);
    if (new Set(cles).size !== cles.length) throw refusValidation(MESSAGE_PANIER_DOUBLON);

    const ids = [...new Set(demandees.map((l) => l.stockId))];
    const fiches = new Map<string, FicheSynchro>();
    for (const id of ids) {
      const ligne = c.stockage.lireUn<{ document: string }>("SELECT document FROM fiches WHERE stockId = ?", [id]);
      if (ligne) fiches.set(id, JSON.parse(ligne.document) as FicheSynchro);
    }
    const introuvables = ids.filter((id) => !fiches.has(id));
    if (introuvables.length > 0) {
      throw new RefusCaisse(
        404,
        "STOCK_INTROUVABLE",
        messageStockIntrouvable(introuvables.length),
        introuvables.map((stockId) => ({ stockId })),
      );
    }

    // 3. Prix de la fiche, jamais du client.
    const calculees = demandees.map((l) => {
      const fiche = fiches.get(l.stockId) as FicheSynchro;
      const unite: UniteVente = l.unite ?? "BOITE";
      const resultat = calculerLigne({
        unite,
        nombre: l.quantite,
        coefficientBoite: fiche.coefficientBoite,
        prixBoite: fiche.prixUnitaire,
        prixUnite: fiche.prixUnite,
        deconditionnable: fiche.deconditionnable,
      });
      return { l, fiche, unite, resultat };
    });
    const refusees = (code: string) => {
      const vus = new Set<string>();
      const liste: { stockId: string; nom: string }[] = [];
      for (const x of calculees) {
        if (x.resultat.ok || x.resultat.code !== code || vus.has(x.fiche.stockId)) continue;
        vus.add(x.fiche.stockId);
        liste.push({ stockId: x.fiche.stockId, nom: x.fiche.nom });
      }
      return liste;
    };
    const interdites = refusees("VENTE_UNITE_INTERDITE");
    if (interdites.length > 0) {
      throw new RefusCaisse(400, "VENTE_UNITE_INTERDITE", messageVenteUniteInterdite(interdites.map((i) => i.nom)), interdites);
    }
    const sansPrixUnite = refusees("PRIX_UNITE_MANQUANT");
    if (sansPrixUnite.length > 0) {
      throw new RefusCaisse(400, "PRIX_UNITE_MANQUANT", messagePrixUniteManquant(sansPrixUnite.map((i) => i.nom)), sansPrixUnite);
    }
    const sansPrix = refusees("PRIX_MANQUANT");
    if (sansPrix.length > 0) {
      throw new RefusCaisse(400, "PRIX_MANQUANT", messagePrixManquant(sansPrix.map((i) => i.nom)), sansPrix);
    }
    const lignes = calculees.map((x) => {
      if (!x.resultat.ok) throw new RangeError("Ligne refusée non traitée.");
      return { l: x.l, fiche: x.fiche, unite: x.unite, calcul: x.resultat as LigneCalculee };
    });

    // 4. Motifs des sorties manuelles.
    const motifs = new Map<number, string>();
    demandees.forEach((l, index) => {
      if (!l.sortieManuelle) return;
      const motif = (l.sortieManuelle.motif ?? "").trim();
      if (motif.length < 3 || motif.length > 300) {
        throw new RefusCaisse(400, "MOTIF_REQUIS", MESSAGE_MOTIF_SORTIE_REQUIS);
      }
      motifs.set(index, motif);
    });

    // 5. Ordonnance.
    if (corps.ordonnanceVerifiee !== true) {
      const surOrdonnance = [...new Map(lignes.filter((x) => x.fiche.ordonnanceRequise).map((x) => [x.fiche.stockId, x.fiche])).values()];
      if (surOrdonnance.length > 0) {
        throw new RefusCaisse(
          400,
          "ORDONNANCE_NON_CONFIRMEE",
          MESSAGE_ORDONNANCE_NON_CONFIRMEE,
          surOrdonnance.map((f) => ({ stockId: f.stockId, nom: f.nom })),
        );
      }
    }

    // Client et total.
    const clientNom = (corps.clientNom ?? "").trim();
    const clientTelephone = (corps.clientTelephone ?? "").trim();
    if (clientNom.length > 100) throw refusValidation("Le nom du client ne doit pas dépasser 100 caractères.");
    if (clientTelephone.length > 30) throw refusValidation("Le téléphone du client ne doit pas dépasser 30 caractères.");
    const telephonePrescripteur = (corps.telephonePrescripteur ?? "").trim();
    if (telephonePrescripteur !== "" && !telephonePrescripteurLocalValide(telephonePrescripteur)) {
      throw refusValidation("Le téléphone du prescripteur n'est pas valide (chiffres, espaces, + et tirets ; 6 à 20 chiffres).");
    }
    const total = lignes.reduce((somme, x) => somme + x.calcul.montantLigne, 0);
    if (total > PRIX_MAX) throw refusValidation(MESSAGE_TOTAL_TROP_ELEVE);

    // 6. Paiements.
    if (corps.paiements !== undefined) {
      if (!Array.isArray(corps.paiements) || corps.paiements.length < 1 || corps.paiements.length > 5) {
        throw refusValidation("Une vente a de 1 à 5 paiements.");
      }
      for (const p of corps.paiements) {
        if (!entier(p.montant, 1, PRIX_MAX)) throw refusValidation("Chaque paiement doit être supérieur à zéro.");
        if (p.montantRecu !== undefined && !entier(p.montantRecu, 0, PRIX_MAX)) {
          throw refusValidation("La somme reçue est invalide.");
        }
        if (p.reference !== undefined && p.reference.length > 100) {
          throw refusValidation("La référence d'un paiement ne doit pas dépasser 100 caractères.");
        }
      }
    }
    const prepares = preparerPaiements(
      total,
      corps.paiements,
      ref.modesPaiement.map((m) => ({ ...m, id: m.code })),
    );
    if (!prepares.ok) {
      switch (prepares.code) {
        case "MODE_PAIEMENT_INCONNU":
          throw new RefusCaisse(400, "MODE_PAIEMENT_INCONNU", messageModeInconnu(prepares.mode));
        case "MODE_EN_DOUBLE":
          throw refusValidation(MESSAGE_MODE_EN_DOUBLE);
        case "MONTANT_RECU_INSUFFISANT":
          throw refusValidation(MESSAGE_MONTANT_RECU_INSUFFISANT);
        case "PAIEMENTS_INCOHERENTS":
          throw new RefusCaisse(400, "PAIEMENTS_INCOHERENTS", messagePaiementsIncoherents(prepares.somme, total));
      }
    }
    const libellesModes = new Map(ref.modesPaiement.map((m) => [m.code, m.libelle]));

    // 7. Caisse du poste.
    const ouverte = sessionOuverteLigne(c);
    if (ouverte && ouverte.utilisateurId !== u.id) {
      throw new RefusCaisse(
        409,
        "SESSION_AUTRE_UTILISATEUR",
        messageSessionAutreUtilisateur(ouverte.utilisateurNom ?? "un autre vendeur"),
      );
    }
    const sessionId = ouverte?.id ?? c.outils.genererId();
    const jourSession = ouverte?.jourMetier ?? c.jour();

    // Stock local de chaque fiche : photographie moins les sorties déjà faites sur le poste.
    const jour = c.jour();
    const lotsParFiche = new Map<string, LotCandidat[]>();
    const lotsDeLaPhoto = new Map<string, Set<string>>();
    for (const [id, fiche] of fiches) {
      const surcouche = lireSurcouche(c.stockage, etat.sequenceAppliquee, id);
      const stock = calculerStockLocal(fiche, surcouche.mouvements.get(id) ?? [], jour, surcouche.lotsLocaux.get(id) ?? []);
      lotsParFiche.set(id, stock.lots.map((l) => ({ ...l, coutUnitaire: 0 })));
      lotsDeLaPhoto.set(id, new Set(fiche.lots.map((l) => l.id)));
    }

    // 8 (lot). Lot d'une sortie manuelle.
    for (const l of demandees) {
      if (!l.sortieManuelle) continue;
      if ((lotsParFiche.get(l.stockId) ?? []).some((x) => x.id === l.sortieManuelle?.lotId)) continue;
      if (!lotsDeLaPhoto.get(l.stockId)?.has(l.sortieManuelle.lotId)) {
        throw new RefusCaisse(404, "LOT_INTROUVABLE", MESSAGE_LOT_INTROUVABLE);
      }
      throw new RefusCaisse(409, "STOCK_LOT_NEGATIF", MESSAGE_STOCK_LOT_INSUFFISANT);
    }

    // 8-9. Allocation : jamais de refus de stock, le reste non couvert est provisoire (D713.2).
    const allouees = allouerLignes(
      jour,
      lignes.map((x, index) => ({
        stockId: x.fiche.stockId,
        unite: x.unite,
        quantiteUm: x.calcul.quantiteUm,
        sortieManuelle: x.l.sortieManuelle ? { lotId: x.l.sortieManuelle.lotId, motif: motifs.get(index) as string } : null,
      })),
      lotsParFiche,
    );

    // 8. Périmé seul (D737) : un choix à faire, jamais un périmé pris tout seul (CA13).
    const aChoisir: { stockId: string; nom: string; disponible: number; demande: number; lots: LotPerimeDisponible[] }[] = [];
    for (const id of ids) {
      const indices = lignes.map((x, i) => (x.fiche.stockId === id ? i : -1)).filter((i) => i >= 0);
      const restes = indices.reduce((s, i) => s + allouees[i].resteProvisoire, 0);
      const alloue = indices.reduce((s, i) => s + allouees[i].quantiteAllouee, 0);
      const manuelle = indices.some((i) => lignes[i].l.sortieManuelle);
      const avecPerimes = indices.find((i) => allouees[i].lotsPerimesDisponibles.length > 0);
      if (restes > 0 && alloue === 0 && !manuelle && avecPerimes !== undefined) {
        aChoisir.push({
          stockId: id,
          nom: (fiches.get(id) as FicheSynchro).nom,
          disponible: alloue,
          demande: lignes[avecPerimes].calcul.quantiteUm,
          lots: allouees[avecPerimes].lotsPerimesDisponibles,
        });
      }
    }
    if (aChoisir.length > 0) {
      throw new RefusCaisse(409, "SORTIE_MANUELLE_REQUISE", messageSortieManuelleRequise(aChoisir.map((a) => a.nom)), aChoisir);
    }

    // 11. Numéro : plage entamée à la plus petite borne libre, sinon numéro de secours (D424).
    const libre = prochainNumeroPlage(c);
    const numeroTicket = libre ? libre.numero : null;
    const secours = libre ? null : etat.prochainSecours;
    const numero = libre
      ? formaterNumeroTicket(ref.ordre, libre.numero)
      : numeroSecours(ref.ordre, ref.posteCode, etat.prochainSecours);

    // Réponse (forme du serveur) et corps de l'événement.
    const horodatage = c.maintenant();
    const provisoire = allouees.some((a) => a.resteProvisoire > 0);
    const lignesReponse: LigneVente[] = lignes.map((x, index) => {
      const a = allouees[index];
      const allocations: AllocationVente[] = a.allocations.map((al) => ({
        lotId: al.lot.id,
        numeroLot: al.lot.numeroLot,
        dateExpiration: al.lot.dateExpiration,
        quantite: al.quantite,
        statut: "DEFINITIVE",
        sortieManuelle: al.sortieManuelle,
        motif: al.motif,
        lotTechnique: al.lot.lotTechnique,
      }));
      if (a.resteProvisoire > 0) {
        allocations.push({
          lotId: null,
          numeroLot: null,
          dateExpiration: null,
          quantite: a.resteProvisoire,
          statut: "PROVISOIRE",
          sortieManuelle: false,
          motif: null,
          lotTechnique: false,
        });
      }
      return {
        id: `${cle}:${index}`,
        stockId: x.fiche.stockId,
        medicamentId: x.fiche.medicamentId,
        nomMedicament: x.fiche.nom,
        prixUnitaire: x.calcul.prixAppliqueParUm,
        quantite: x.calcul.quantiteUm,
        sousTotal: x.calcul.montantLigne,
        uniteAffichee: x.calcul.uniteAffichee,
        nombreAffiche: x.calcul.nombreAffiche,
        coefficientApplique: x.calcul.coefficientApplique,
        allocations,
        uniteMinimale: x.fiche.uniteMinimale,
      };
    });
    const paiementsReponse: PaiementVente[] = prepares.paiements.map((p, index) => ({
      id: `${cle}:paiement:${index}`,
      mode: p.code,
      libelle: libellesModes.get(p.code) ?? p.code,
      montant: p.montant,
      reference: p.referenceExterne,
      montantRecu: p.montantRecu,
      rendu: p.code === CODE_ESPECES && p.montantRecu !== null ? Math.max(0, p.montantRecu - p.montant) : null,
    }));

    const corpsEvenement = {
      venteId: cle,
      sessionId,
      ...(numeroTicket !== null ? { numeroTicket } : { numeroSecours: secours as number }),
      lignes: lignes.map((x, index) => {
        const a = allouees[index];
        const prixTicket = x.unite === "BOITE" ? x.fiche.prixUnitaire : x.fiche.prixUnite;
        return {
          stockId: x.fiche.stockId,
          unite: x.unite,
          nombre: x.l.quantite,
          prixUnitaire: prixTicket as number,
          ...(a.resteProvisoire > 0 ? { quantiteProvisoireLocale: a.resteProvisoire } : {}),
          ...(a.ouvertureConditionnement ? { ouvertureConditionnement: true } : {}),
          ...(x.l.sortieManuelle ? { sortieManuelle: { lotId: x.l.sortieManuelle.lotId, motif: motifs.get(index) as string } } : {}),
        };
      }),
      paiements: prepares.paiements.map((p) => ({
        mode: p.code,
        montant: p.montant,
        ...(p.referenceExterne !== null ? { reference: p.referenceExterne } : {}),
        ...(p.montantRecu !== null ? { montantRecu: p.montantRecu } : {}),
      })),
      total,
      ...(clientNom !== "" ? { clientNom } : {}),
      ...(clientTelephone !== "" ? { clientTelephone } : {}),
      ordonnanceVerifiee: corps.ordonnanceVerifiee === true,
      ...(telephonePrescripteur !== "" ? { telephonePrescripteur } : {}),
    };

    const vente: Vente = {
      id: cle,
      numero,
      statut: "VALIDEE",
      createdAt: horodatage,
      total,
      ordonnanceVerifiee: corps.ordonnanceVerifiee === true,
      clientNom: clientNom !== "" ? clientNom : null,
      clientTelephone: clientTelephone !== "" ? clientTelephone : null,
      telephonePrescripteur: telephonePrescripteur !== "" ? telephonePrescripteur : null,
      vendeur: { id: u.id, nom: u.nom },
      annuleeLe: null,
      annuleeParId: null,
      motifAnnulation: null,
      lignes: lignesReponse,
      pharmacie: ref.pharmacie,
      typePiece: "VENTE",
      numeroTicket,
      jourMetier: jourSession,
      provisoire,
      ...(provisoire ? { aRegulariserLocal: true } : {}),
      poste: { id: ref.posteId, code: ref.posteCode },
      session: { id: sessionId, ouverteAutomatiquement: ouverte === undefined },
      paiements: paiementsReponse,
      annulation: null,
      venteOrigine: null,
      motif: null,
    };

    // 12. Écriture : tout ou rien. L'événement de la vente, dernier, prend la séquence réservée ici.
    if (!ouverte) creerSession(c, sessionId, u, true);
    const sequence = c.etat().prochaineSequence;
    c.stockage.executer(
      "INSERT INTO ventes (id, sequence, sessionId, jourMetier, numero, total, document, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [cle, sequence, sessionId, jourSession, numero, total, JSON.stringify(vente), horodatage],
    );
    lignesReponse.forEach((ligne) => {
      for (const al of ligne.allocations) {
        ajouterMouvementLocal(c.stockage, {
          sequence,
          stockId: ligne.stockId,
          lotId: al.lotId,
          quantiteUm: -al.quantite,
          type: "VENTE",
          reference: cle,
        });
      }
    });
    for (const p of prepares.paiements) {
      c.stockage.executer("INSERT INTO paiements_locaux (venteId, sessionId, mode, montant) VALUES (?, ?, ?, ?)", [
        cle,
        sessionId,
        p.code,
        p.montant,
      ]);
    }
    if (libre) consommerNumeroPlage(c, libre.plageId, libre.numero);
    else c.stockage.executer("UPDATE etat_poste SET prochainSecours = prochainSecours + 1 WHERE id = 1");
    c.ajouterEvenement("VENTE", u.id, corpsEvenement);
    return vente;
  });
}

export function lireVente(c: Contexte, id: string): Vente | null {
  const ligne = c.stockage.lireUn<{ document: string }>("SELECT document FROM ventes WHERE id = ?", [id]);
  return ligne ? (JSON.parse(ligne.document) as Vente) : null;
}

/** Ventes du poste pour un jour métier, la plus récente d'abord. */
export function listerVentes(c: Contexte, jour: string): VentesDuJour {
  const ventes = c.stockage
    .lire<{ document: string }>("SELECT document FROM ventes WHERE jourMetier = ? ORDER BY createdAt DESC, sequence DESC", [jour])
    .map((l) => JSON.parse(l.document) as Vente);
  const resumes: VenteResume[] = ventes.map((v) => ({
    id: v.id,
    numero: v.numero,
    createdAt: v.createdAt,
    statut: v.statut,
    total: v.total,
    nombreArticles: v.lignes.reduce((s, l) => s + l.quantite, 0),
    vendeur: v.vendeur,
    clientNom: v.clientNom,
    telephonePrescripteur: v.telephonePrescripteur ?? null,
    typePiece: v.typePiece,
    numeroTicket: v.numeroTicket,
    jourMetier: v.jourMetier,
    venteOrigine: v.venteOrigine,
    annulation: v.annulation ? { id: v.annulation.id, numero: v.annulation.numero } : null,
  }));
  return {
    date: jour,
    // Comme le web : total signé des pièces du jour. Une vente reste comptée à son jour,
    // son annulation est une pièce négative à son propre jour.
    totalJour: ventes.reduce((s, v) => s + v.total, 0),
    nombre: resumes.length,
    page: 1,
    parPage: Math.max(50, resumes.length),
    totalPages: 1,
    ventes: resumes,
  };
}

/**
 * Réponse du serveur à une annulation faite depuis ce poste. Le serveur y ajoute à
 * `annulation` le poste et la caisse de la pièce d'annulation (ceux de l'auteur, là où le
 * remboursement est enregistré), alors que `session` reste la caisse de la vente d'origine.
 */
export type ReponseAnnulation = Omit<Vente, "annulation"> & {
  annulation: AnnulationPiece & Required<Pick<AnnulationPiece, "posteId" | "sessionCaisseId" | "jourMetier">>;
};

const MESSAGE_ANNULATION_AUTRE_POSTE =
  "Cette annulation a été enregistrée pour un autre poste de caisse. Rien n'a été modifié sur ce poste : rechargez le catalogue pour repartir de l'état du serveur.";
const MESSAGE_ANNULATION_AUTRE_CAISSE =
  "Le serveur a enregistré le remboursement dans une autre caisse que celle ouverte sur ce poste. Rien n'a été modifié ici : fermez la caisse de ce poste, puis resynchronisez avant de continuer.";
const MESSAGE_ANNULATION_CAISSE_FERMEE =
  "La caisse du remboursement est déjà fermée sur ce poste. Rien n'a été modifié ici : resynchronisez ce poste avant de continuer.";

/**
 * Annulation faite en ligne depuis ce poste (D745), sans événement : le serveur a déjà tout
 * enregistré, dans la caisse de l'AUTEUR (`annulation.sessionCaisseId`), pas dans celle de
 * la vente d'origine. Trois issues, en une transaction :
 * - la caisse est la caisse ouverte du poste : le remboursement y est imputé ;
 * - aucune caisse n'est ouverte ici : on adopte celle du serveur (en ouvrir une autre ferait
 *   fermer la sienne d'office au rejeu, D647) ;
 * - tout autre cas (autre poste, autre caisse ouverte, caisse déjà fermée) : rien n'est
 *   écrit et une erreur claire remonte, le serveur a la vérité.
 * Garde aussi la pièce d'annulation (liste des ventes) et marque la vente locale annulée.
 * Rejouable.
 */
export function enregistrerAnnulationServeur(c: Contexte, reponse: ReponseAnnulation): void {
  const annulation = reponse.annulation as ReponseAnnulation["annulation"] | null;
  if (!annulation) throw new RangeError("La réponse du serveur ne porte pas d'annulation.");
  c.stockage.transaction(() => {
    const etat = c.etat();
    if (annulation.posteId !== etat.posteId) {
      throw new RefusCaisse(409, "ANNULATION_AUTRE_POSTE", MESSAGE_ANNULATION_AUTRE_POSTE);
    }
    const sessionId = annulation.sessionCaisseId;
    const ouverte = sessionOuverteLigne(c);
    let jourSession: string;
    let aAdopter = false;
    if (ouverte?.id === sessionId) {
      jourSession = ouverte.jourMetier;
    } else if (ouverte) {
      throw new RefusCaisse(409, "ANNULATION_AUTRE_CAISSE", MESSAGE_ANNULATION_AUTRE_CAISSE);
    } else if (lireSession(c, sessionId)) {
      throw new RefusCaisse(409, "ANNULATION_CAISSE_FERMEE", MESSAGE_ANNULATION_CAISSE_FERMEE);
    } else {
      // Jour de la caisse donné par le serveur : il peut différer du jour de `le` (D753).
      if (!/^\d{4}-\d{2}-\d{2}$/.test(annulation.jourMetier)) {
        throw new RangeError("La réponse du serveur ne donne pas le jour de la caisse.");
      }
      jourSession = annulation.jourMetier;
      aAdopter = true;
    }

    if (!c.stockage.lireUn("SELECT id FROM ventes WHERE id = ?", [annulation.id])) {
      if (aAdopter) {
        c.stockage.executer(
          "INSERT INTO sessions (id, utilisateurId, utilisateurNom, statut, jourMetier, ouverteLe, adoptee) VALUES (?, ?, ?, 'OUVERTE', ?, ?, 1)",
          [sessionId, annulation.par.id, annulation.par.nom, jourSession, annulation.le],
        );
      }
      for (const p of reponse.paiements) {
        c.stockage.executer("INSERT INTO paiements_locaux (venteId, sessionId, mode, montant) VALUES (?, ?, ?, ?)", [
          `annulation:${annulation.id}`,
          sessionId,
          p.mode,
          -p.montant,
        ]);
      }
      // Pièce d'annulation : montants opposés, listée à son propre jour comme sur le web.
      const piece: Vente = {
        ...reponse,
        id: annulation.id,
        numero: annulation.numero,
        statut: "VALIDEE",
        createdAt: annulation.le,
        total: -reponse.total,
        vendeur: annulation.par,
        annuleeLe: null,
        annuleeParId: null,
        motifAnnulation: null,
        lignes: reponse.lignes.map((l) => ({
          ...l,
          quantite: -l.quantite,
          sousTotal: -l.sousTotal,
          allocations: l.allocations.map((a) => ({ ...a, quantite: -a.quantite })),
        })),
        typePiece: "ANNULATION",
        numeroTicket: null,
        jourMetier: jourSession,
        provisoire: false,
        poste: { id: annulation.posteId, code: etat.posteCode ?? "" },
        session: { id: sessionId, ouverteAutomatiquement: false },
        paiements: reponse.paiements.map((p) => ({ ...p, montant: -p.montant, montantRecu: null, rendu: null })),
        annulation: null,
        venteOrigine: { id: reponse.id, numero: reponse.numero },
        motif: annulation.motif,
      };
      c.stockage.executer(
        "INSERT INTO ventes (id, sequence, sessionId, jourMetier, numero, total, document, createdAt, typePiece) VALUES (?, 0, ?, ?, ?, ?, ?, ?, 'ANNULATION')",
        [piece.id, sessionId, jourSession, piece.numero, piece.total, JSON.stringify(piece), piece.createdAt],
      );
    }

    const locale = lireVente(c, reponse.id);
    if (locale) {
      const annulee: Vente = {
        ...locale,
        statut: "ANNULEE",
        annulation: {
          id: annulation.id,
          numero: annulation.numero,
          motif: annulation.motif,
          le: annulation.le,
          par: annulation.par,
          posteId: annulation.posteId,
          sessionCaisseId: annulation.sessionCaisseId,
          jourMetier: annulation.jourMetier,
        },
        annuleeLe: annulation.le,
        annuleeParId: annulation.par.id,
        motifAnnulation: annulation.motif,
      };
      c.stockage.executer("UPDATE ventes SET document = ? WHERE id = ?", [JSON.stringify(annulee), reponse.id]);
    }
  });
}
