/**
 * Inventaire fait sur le poste, sans réseau. Une seule transaction par opération : événement `INVENTAIRE_ENREGISTRE`,
 * lots locaux à identifiant stable pour les lots trouvés, et un mouvement local par lot égal à (compté - théorique local),
 * pour que le stock affiché soit aussitôt exactement ce qui a été compté.
 *
 * Le comptage fait foi (décision Q5) : au rejeu, le serveur remet le lot à la quantité comptée, calcule l'écart contre son
 * propre théorique et prévient le responsable si un autre mouvement a eu lieu entre-temps (anomalie THEORIQUE_DIVERGENT).
 * Le théorique que le poste affichait part donc dans l'événement.
 *
 * Aucun coût ne descend sur le poste (Q8) : l'historique lu ici (inventaires des 30 derniers jours de la photographie, plus
 * ceux faits sur ce poste) n'en a pas. Les règles de ciblage du lot et les messages sont ceux de
 * back_medconnect : src/pharmacie/inventaires/inventaires.service.ts et domaine/inventaire.ts.
 */
import type { AvertissementInventaire, CorpsInventaire, Inventaire, InventaireResume, LigneInventaireDemandee, LigneInventaireEcrite, PageInventaires } from "@/lib/api_pharmacie";
import type { Contexte } from "./contexte";
import { fichesLocales, type FicheEtStock } from "./fiche_locale";
import { idLotDeterministe } from "./ids_stables";
import { exigerUuid, RefusCaisse, refusValidation } from "./refus";
import { ajouterLotLocal, ajouterMouvementLocal, lireSurcouche } from "./stock_surcouche";
import type { Utilisateur } from "./types_caisse";
import type { InventaireSynchro } from "./types_synchro";

export const PAR_PAGE_INVENTAIRES = 20;
export const JOURS_HISTORIQUE_INVENTAIRES = 30;
const ENTIER_MAX = 2_147_483_647;
const BOITES_MAX = 1_000_000;
const UNITES_MAX = 1_000_000_000;
const LIGNES_MAX = 500;
const JOUR = /^\d{4}-\d{2}-\d{2}$/;

// Messages repris à la lettre de back_medconnect : src/pharmacie/inventaires/inventaires.service.ts.
export const MESSAGE_QUANTITE_COMPTEE_REQUISE = "Indiquez la quantité comptée : un nombre d'unités, ou un nombre de boîtes (et les unités en plus d'une boîte entamée).";
export const MESSAGE_UNITES_SANS_BOITES = "Les unités en plus s'ajoutent à un nombre de boîtes : indiquez aussi le nombre de boîtes (0 si aucune boîte entière).";
export const MESSAGE_QUANTITE_COMPTEE_TROP_GRANDE = "La quantité comptée est trop grande pour être enregistrée. Vérifiez la quantité.";
export const MESSAGE_DATE_INVALIDE_INVENTAIRE = "La date de péremption n'existe pas : vérifiez-la (format AAAA-MM-JJ).";
export const MESSAGE_STOCK_INTROUVABLE_INVENTAIRE = "Un médicament de l'inventaire est introuvable dans le stock de cette pharmacie.";
export const MESSAGE_LOT_INTROUVABLE_INVENTAIRE = "Ce lot est introuvable pour ce médicament.";
export const MESSAGE_INVENTAIRE_LOT_REQUIS = "Ce médicament a plusieurs lots en stock : précisez le lot compté (numéro ou date de péremption), une ligne par lot.";
export const MESSAGE_INVENTAIRE_DATE_REQUISE = "Ces boîtes ne correspondent à aucun lot en stock : indiquez leur date de péremption, ou précisez que ce médicament n'en a pas.";
export const MESSAGE_LOT_INCONNU_VIDE = "Ce lot n'est pas dans votre stock : une quantité comptée de 0 n'a rien à enregistrer. Retirez la ligne ou vérifiez le numéro de lot.";
export const MESSAGE_LOT_COMPTE_DEUX_FOIS = "Ce lot est compté deux fois dans l'inventaire : gardez une seule ligne par lot.";
export const MESSAGE_INVENTAIRE_INTROUVABLE = "Cet inventaire est introuvable.";
export const MESSAGE_INVENTAIRE_REJOUE = "Cet inventaire était déjà enregistré.";
export const MESSAGE_FICHE_NON_QUALIFIEE = "Le nombre d'unités par boîte de ce médicament n'est pas encore confirmé : vérifiez sa fiche avant de compter en boîtes.";
export const MESSAGE_INVENTAIRE_SANS_LOT = "Saisissez au moins un comptage, et la date de péremption des lots ajoutés.";

export function messageInventaireEnregistre(nombreLignes: number, nombreEcarts: number): string {
  const debut = nombreLignes === 1 ? "Inventaire enregistré sur ce poste : 1 ligne." : `Inventaire enregistré sur ce poste : ${nombreLignes} lignes.`;
  if (nombreEcarts === 0) return debut;
  return nombreEcarts === 1
    ? `${debut} 1 écart dépasse la tolérance : il sera signalé dans les anomalies dès le retour du réseau.`
    : `${debut} ${nombreEcarts} écarts dépassent la tolérance : ils seront signalés dans les anomalies dès le retour du réseau.`;
}

function entier(v: unknown, min: number, max: number): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
}

function jourValide(jour: string): boolean {
  if (!JOUR.test(jour)) return false;
  const [a, m, j] = jour.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1, j));
  return d.getUTCFullYear() === a && d.getUTCMonth() === m - 1 && d.getUTCDate() === j;
}

// ----------------------------------------------------------------------------------------------- lecture

/** Inventaire local gardé pour la lecture : sans aucun coût. */
type InventaireLocal = Omit<Inventaire, "cree" | "avertissements">;

function lireLocal(c: Contexte, id: string): InventaireLocal | null {
  const ligne = c.stockage.lireUn<{ document: string }>("SELECT document FROM inventaires_locales WHERE id = ?", [id]);
  return ligne === undefined || ligne === null ? null : (JSON.parse(ligne.document) as InventaireLocal);
}

function inventaireDepuisPhoto(i: InventaireSynchro): InventaireLocal {
  return {
    id: i.id,
    createdAt: i.createdAt,
    commentaire: i.commentaire,
    auteurId: i.auteur.id,
    auteur: i.auteur,
    lignes: i.lignes.map((l) => ({ ...l, lotId: l.lotId ?? "" })),
  };
}

function creeApres(c: Contexte): string {
  return new Date(c.outils.horloge().getTime() - JOURS_HISTORIQUE_INVENTAIRES * 86_400_000).toISOString();
}

/** Inventaires faits ici pas encore appliqués, puis ceux des 30 derniers jours de la photographie, les plus récents d'abord. */
function tousLesInventaires(c: Contexte): InventaireLocal[] {
  const sequence = c.etat().sequenceAppliquee;
  const minimum = creeApres(c);
  const locaux = c.stockage
    .lire<{ document: string }>("SELECT document FROM inventaires_locales WHERE sequence > ? ORDER BY sequence", [sequence])
    .map((l) => JSON.parse(l.document) as InventaireLocal);
  const ids = new Set(locaux.map((i) => i.id));
  const photo = c.stockage
    .lire<{ document: string }>("SELECT document FROM inventaires_photo ORDER BY rang")
    .map((l) => inventaireDepuisPhoto(JSON.parse(l.document) as InventaireSynchro))
    .filter((i) => !ids.has(i.id) && i.createdAt >= minimum);
  return [...locaux, ...photo].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0) || (a.id < b.id ? 1 : -1));
}

export function listerInventairesLocaux(c: Contexte, page = 1): PageInventaires {
  const toutes = tousLesInventaires(c);
  const p = Math.max(1, page);
  const debut = (p - 1) * PAR_PAGE_INVENTAIRES;
  const inventaires: InventaireResume[] = toutes.slice(debut, debut + PAR_PAGE_INVENTAIRES).map((i) => ({
    id: i.id,
    createdAt: i.createdAt,
    commentaire: i.commentaire,
    auteur: i.auteur ?? { id: i.auteurId, nom: "" },
    nombreLignes: i.lignes.length,
    nombreEcarts: i.lignes.filter((l) => l.ecart !== 0).length,
    nombreAnomalies: new Set(i.lignes.map((l) => l.anomalieId).filter((a) => a !== null)).size,
  }));
  return {
    inventaires,
    page: p,
    parPage: PAR_PAGE_INVENTAIRES,
    total: toutes.length,
  };
}

export function lireInventaireLocal(c: Contexte, id: string): Inventaire {
  const i = tousLesInventaires(c).find((x) => x.id === id);
  if (i === undefined) throw new RefusCaisse(404, "INVENTAIRE_INTROUVABLE", MESSAGE_INVENTAIRE_INTROUVABLE);
  return i;
}

// ----------------------------------------------------------------------------------------------- écriture

interface LotConnu {
  id: string;
  numeroLot: string | null;
  dateExpiration: string | null;
  coefficientReception: number;
  /** Solde local : photographie plus mouvements locaux, jamais négatif. */
  solde: number;
}

/** Tous les lots de la fiche connus du poste, solde nul compris (photographie et lots créés ici). */
function lotsConnus(c: Contexte, f: FicheEtStock): LotConnu[] {
  const soldes = new Map(f.stock.lots.map((l) => [l.id, l.solde]));
  const lots = new Map<string, LotConnu>();
  for (const l of f.source.lots) {
    lots.set(l.id, {
      id: l.id,
      numeroLot: l.numeroLot,
      dateExpiration: l.dateExpiration,
      coefficientReception: l.coefficientReception,
      solde: soldes.get(l.id) ?? 0,
    });
  }
  for (const l of lireSurcouche(c.stockage, c.etat().sequenceAppliquee, f.source.stockId).lotsLocaux.get(f.source.stockId) ?? []) {
    if (!lots.has(l.id))
      lots.set(l.id, {
        id: l.id,
        numeroLot: l.numeroLot,
        dateExpiration: l.dateExpiration,
        coefficientReception: l.coefficientReception,
        solde: soldes.get(l.id) ?? 0,
      });
  }
  return [...lots.values()];
}

type Cible = { type: "LOT"; lot: LotConnu } | { type: "NOUVEAU"; dateExpiration: string | null } | { type: "SANS_LOT" };

function ordreFefo(a: LotConnu, b: LotConnu): number {
  if (a.dateExpiration !== b.dateExpiration) {
    if (a.dateExpiration === null) return -1;
    if (b.dateExpiration === null) return 1;
    return a.dateExpiration < b.dateExpiration ? -1 : 1;
  }
  return a.id < b.id ? -1 : 1;
}

/** Lot visé par une ligne (mêmes règles que le serveur : identifiant, date, lot unique, nouveau lot). */
function ciblerLot(f: FicheEtStock, l: LigneInventaireDemandee, lots: LotConnu[], quantiteNulle: boolean): Cible {
  const date = typeof l.dateExpiration === "string" && l.dateExpiration.trim() !== "" ? l.dateExpiration.trim() : null;
  const dateVisee = date !== null || l.sansPeremption === true;
  const requis = (): never => {
    const enStock = lots.filter((x) => x.solde > 0);
    const proposes = (enStock.length > 0 ? enStock : lots).slice().sort(ordreFefo);
    throw new RefusCaisse(409, "LOT_REQUIS", MESSAGE_INVENTAIRE_LOT_REQUIS, [
      {
        stockId: f.source.stockId,
        nom: f.source.nom,
        lots: proposes.map((x) => ({
          lotId: x.id,
          numeroLot: x.numeroLot,
          dateExpiration: x.dateExpiration,
          quantite: x.solde,
        })),
      },
    ]);
  };

  if (l.lotId !== undefined) {
    const lot = lots.find((x) => x.id === l.lotId);
    if (lot === undefined) throw new RefusCaisse(404, "LOT_INTROUVABLE", MESSAGE_LOT_INTROUVABLE_INVENTAIRE);
    return { type: "LOT", lot };
  }
  if (dateVisee) {
    const memeDate = lots.filter((x) => x.dateExpiration === date);
    if (memeDate.length === 1) return { type: "LOT", lot: memeDate[0] };
    if (memeDate.length > 1) {
      const enStock = memeDate.filter((x) => x.solde > 0);
      return enStock.length === 1 ? { type: "LOT", lot: enStock[0] } : requis();
    }
  } else {
    const enStock = lots.filter((x) => x.solde > 0);
    if (enStock.length === 1) return { type: "LOT", lot: enStock[0] };
    if (enStock.length > 1) return requis();
    if (lots.length === 1) return { type: "LOT", lot: lots[0] };
    if (quantiteNulle) return { type: "SANS_LOT" };
    throw new RefusCaisse(400, "DATE_PEREMPTION_REQUISE", MESSAGE_INVENTAIRE_DATE_REQUISE, [{ stockId: f.source.stockId, nom: f.source.nom }]);
  }
  if (quantiteNulle) throw refusValidation(MESSAGE_LOT_INCONNU_VIDE);
  return { type: "NOUVEAU", dateExpiration: date };
}

interface LignePreparee {
  index: number;
  fiche: FicheEtStock;
  cible: Exclude<Cible, { type: "SANS_LOT" }>;
  lotId: string;
  compte: number;
  theorique: number;
  parBoites: boolean;
}

function controlerForme(l: LigneInventaireDemandee): void {
  const boites = l.nombreBoites;
  const unites = l.unitesEnPlus;
  if (boites === undefined) throw refusValidation(MESSAGE_QUANTITE_COMPTEE_REQUISE);
  if (!entier(boites, 0, BOITES_MAX)) throw refusValidation(MESSAGE_QUANTITE_COMPTEE_REQUISE);
  if (unites !== undefined && !entier(unites, 0, UNITES_MAX)) throw refusValidation(MESSAGE_UNITES_SANS_BOITES);
  if (typeof l.dateExpiration === "string" && l.dateExpiration.trim() !== "" && !jourValide(l.dateExpiration.trim())) {
    throw refusValidation(MESSAGE_DATE_INVALIDE_INVENTAIRE);
  }
}

export function enregistrerInventaireLocal(c: Contexte, corps: CorpsInventaire, u: Utilisateur): Inventaire {
  return c.stockage.transaction(() => {
    const id = corps.id;
    exigerUuid(id, "de l'inventaire");
    const deja = lireLocal(c, id as string);
    if (deja !== null) return { ...deja, cree: false, avertissements: [] };

    if (!Array.isArray(corps.lignes) || corps.lignes.length < 1 || corps.lignes.length > LIGNES_MAX) {
      throw refusValidation(MESSAGE_QUANTITE_COMPTEE_REQUISE);
    }
    const commentaire = typeof corps.commentaire === "string" && corps.commentaire.trim() !== "" ? corps.commentaire.trim() : null;
    if (commentaire !== null && commentaire.length > 500) throw refusValidation("Le commentaire est trop long (500 caractères au plus).");
    corps.lignes.forEach(controlerForme);

    // Lecture unique des fiches et de leurs lots.
    const fiches = new Map<string, FicheEtStock>();
    const lotsParFiche = new Map<string, LotConnu[]>();
    for (const l of corps.lignes) {
      if (fiches.has(l.stockId)) continue;
      const f = fichesLocales(c, l.stockId)[0];
      if (f === undefined) throw new RefusCaisse(404, "STOCK_INTROUVABLE", MESSAGE_STOCK_INTROUVABLE_INVENTAIRE, [{ stockId: l.stockId }]);
      fiches.set(l.stockId, f);
      lotsParFiche.set(l.stockId, lotsConnus(c, f));
    }

    const vus = new Set<string>();
    const preparees: LignePreparee[] = [];
    corps.lignes.forEach((l, index) => {
      const fiche = fiches.get(l.stockId) as FicheEtStock;
      const lots = lotsParFiche.get(l.stockId) as LotConnu[];
      const boites = l.nombreBoites as number;
      const nul = boites + (l.unitesEnPlus ?? 0) === 0;
      const cible = ciblerLot(fiche, l, lots, nul);
      if (cible.type === "SANS_LOT") {
        const cle = `${l.stockId}|sans-lot`;
        if (vus.has(cle)) throw refusValidation(MESSAGE_LOT_COMPTE_DEUX_FOIS);
        vus.add(cle);
        return;
      }
      const coefficient = cible.type === "LOT" ? cible.lot.coefficientReception : fiche.source.coefficientBoite;
      const compte = boites * coefficient + (l.unitesEnPlus ?? 0);
      const cle = cible.type === "LOT" ? `${l.stockId}|lot|${cible.lot.id}` : `${l.stockId}|nouveau|${cible.dateExpiration ?? ""}`;
      if (vus.has(cle)) throw refusValidation(MESSAGE_LOT_COMPTE_DEUX_FOIS);
      vus.add(cle);
      if (compte > ENTIER_MAX) throw refusValidation(MESSAGE_QUANTITE_COMPTEE_TROP_GRANDE);
      preparees.push({
        index,
        fiche,
        cible,
        lotId: cible.type === "LOT" ? cible.lot.id : idLotDeterministe(id as string, index),
        compte,
        theorique: cible.type === "LOT" ? cible.lot.solde : 0,
        parBoites: true,
      });
    });
    if (preparees.length === 0) throw refusValidation(MESSAGE_INVENTAIRE_SANS_LOT);

    // Plafond du stock par fiche : le total (autres lots plus comptés) reste enregistrable côté serveur.
    const comptesParFiche = new Map<string, number>();
    for (const p of preparees) comptesParFiche.set(p.fiche.source.stockId, (comptesParFiche.get(p.fiche.source.stockId) ?? 0) + p.compte);
    for (const [stockId, total] of comptesParFiche) {
      const ciblesIds = new Set(preparees.filter((p) => p.fiche.source.stockId === stockId).map((p) => p.lotId));
      const autres = (lotsParFiche.get(stockId) as LotConnu[]).filter((x) => !ciblesIds.has(x.id)).reduce((s, x) => s + x.solde, 0);
      if (total + autres > ENTIER_MAX) throw refusValidation(MESSAGE_QUANTITE_COMPTEE_TROP_GRANDE);
    }

    // Tolérance par fiche : somme des écarts des lots comptés (D591).
    const ecartParFiche = new Map<string, number>();
    for (const p of preparees) ecartParFiche.set(p.fiche.source.stockId, (ecartParFiche.get(p.fiche.source.stockId) ?? 0) + (p.compte - p.theorique));
    const sousTolerance = (stockId: string): boolean => Math.abs(ecartParFiche.get(stockId) ?? 0) <= ((fiches.get(stockId) as FicheEtStock).source.toleranceInventaire ?? 0);

    const maintenant = c.maintenant();
    const sequence = c.etat().prochaineSequence;
    const lignes: LigneInventaireEcrite[] = [];
    const corpsLignes: Record<string, unknown>[] = [];
    for (const p of preparees) {
      const stockId = p.fiche.source.stockId;
      const nouveau = p.cible.type === "NOUVEAU";
      if (p.cible.type === "NOUVEAU") {
        ajouterLotLocal(c.stockage, {
          lotId: p.lotId,
          stockId,
          sequence,
          numeroLot: null,
          dateExpiration: p.cible.dateExpiration,
          dateReception: maintenant,
          coefficientReception: p.fiche.source.coefficientBoite,
        });
        corpsLignes.push({
          stockId,
          nouveauLot: {
            id: p.lotId,
            ...(p.cible.dateExpiration !== null ? { dateExpiration: p.cible.dateExpiration } : { sansPeremption: true }),
          },
          quantiteComptee: p.compte,
          theoriqueLocal: 0,
        });
      } else {
        corpsLignes.push({
          stockId,
          lotId: p.lotId,
          quantiteComptee: p.compte,
          theoriqueLocal: p.theorique,
        });
      }
      // Le stock du lot devient exactement le compté : mouvement local = compté - théorique local.
      const mouvement = p.compte - p.theorique;
      if (mouvement !== 0)
        ajouterMouvementLocal(c.stockage, {
          sequence,
          stockId,
          lotId: p.lotId,
          quantiteUm: mouvement,
          type: "INVENTAIRE",
          reference: id as string,
        });
      lignes.push({
        id: `${id as string}:${p.index}`,
        stockId,
        nom: p.fiche.source.nom,
        lotId: p.lotId,
        numeroLot: p.cible.type === "LOT" ? p.cible.lot.numeroLot : null,
        dateExpiration: p.cible.type === "LOT" ? p.cible.lot.dateExpiration : p.cible.dateExpiration,
        lotTechnique: false,
        quantiteTheorique: p.theorique,
        quantiteARegulariser: 0,
        quantiteComptee: p.compte,
        ecart: p.compte - p.theorique,
        sousTolerance: sousTolerance(stockId),
        anomalieId: null,
      });
      void nouveau;
    }

    const lisible: InventaireLocal = {
      id: id as string,
      createdAt: maintenant,
      commentaire,
      auteurId: u.id,
      auteur: { id: u.id, nom: u.nom },
      lignes,
    };
    c.stockage.executer("INSERT INTO inventaires_locales (id, sequence, creeLe, document) VALUES (?, ?, ?, ?)", [id as string, sequence, maintenant, JSON.stringify(lisible)]);
    c.ajouterEvenement("INVENTAIRE_ENREGISTRE", u.id, {
      id,
      ...(commentaire !== null ? { commentaire } : {}),
      lignes: corpsLignes,
    });

    const avertissements: AvertissementInventaire[] = [...new Set(preparees.map((p) => p.fiche.source.stockId))]
      .filter((stockId) => (fiches.get(stockId) as FicheEtStock).source.qualifie === false)
      .map((stockId) => ({
        code: "FICHE_NON_QUALIFIEE" as const,
        stockId,
        nom: (fiches.get(stockId) as FicheEtStock).source.nom,
        message: MESSAGE_FICHE_NON_QUALIFIEE,
      }));
    return { ...lisible, cree: true, avertissements };
  });
}

/** Nombre de fiches dont l'écart dépasse la tolérance, pour le message de fin. */
export function nombreEcartsAuDelaDeLaTolerance(i: Inventaire): number {
  return new Set(i.lignes.filter((l) => !l.sousTolerance).map((l) => l.stockId)).size;
}
