/**
 * Réception de marchandises et fournisseurs faits sur le poste, sans réseau. Une seule transaction par opération :
 * événement du journal, lots locaux à identifiant stable et mouvements locaux positifs (la surcouche monte le
 * stock affiché aussitôt). Le serveur applique ensuite l'événement ; la réception est toujours acceptée (la
 * marchandise est là), un coefficient différent au serveur donne une anomalie pour le responsable.
 *
 * Aucun prix d'achat ne descend sur le poste (Q8) : l'historique lu ici (réceptions des 30 derniers jours de la
 * photographie, plus celles faites sur ce poste) n'a ni coût ni montant de facture. Les coûts saisis partent dans
 * l'événement, jamais dans la base de lecture locale.
 */
import type {
  AvertissementReception,
  CorpsReception,
  Fournisseur,
  LigneReceptionDemandee,
  LotRecu,
  PageReceptions,
  Reception,
  ReceptionResume,
} from "@/lib/api_pharmacie";
import type { Contexte } from "./contexte";
import { fichesLocales } from "./fiche_locale";
import { idLotDeterministe } from "./ids_stables";
import { exigerUuid, RefusCaisse, refusValidation } from "./refus";
import { ajouterLotLocal, ajouterMouvementLocal } from "./stock_surcouche";
import type { Utilisateur } from "./types_caisse";
import type { FournisseurSynchro, ReceptionSynchro } from "./types_synchro";

export const PAR_PAGE_RECEPTIONS = 20;
export const JOURS_HISTORIQUE_RECEPTIONS = 30;
/** Plus grand entier enregistrable côté serveur. */
const ENTIER_MAX = 2_147_483_647;
const BOITES_MAX = 1_000_000;
const UNITES_MAX = 1_000_000_000;
const LIGNES_MAX = 200;
const TELEPHONE = /^[0-9 +().-]{6,30}$/;
const JOUR = /^\d{4}-\d{2}-\d{2}$/;

// Messages repris à la lettre de back_medconnect : src/pharmacie/receptions/receptions.service.ts.
export const MESSAGE_FOURNISSEUR_INTROUVABLE = "Ce fournisseur est introuvable.";
export const MESSAGE_RECEPTION_INTROUVABLE = "Cette réception est introuvable.";
export const MESSAGE_STOCK_INTROUVABLE_RECEPTION =
  "Un médicament de la livraison est introuvable dans le stock de cette pharmacie. Ajoutez-le d'abord à votre stock.";
export const MESSAGE_DATE_PEREMPTION_REQUISE =
  "Indiquez la date de péremption de chaque médicament reçu, ou précisez qu'il n'en a pas.";
export const MESSAGE_DATE_PEREMPTION_PASSEE =
  "La date de péremption de ce médicament est déjà passée : vérifiez-la. Un médicament périmé ne doit pas entrer en stock.";
export const MESSAGE_DATE_INVALIDE = "La date de péremption n'existe pas : vérifiez-la (format AAAA-MM-JJ).";
export const MESSAGE_DATE_FACTURE_INVALIDE = "La date de la facture n'existe pas : vérifiez-la.";
export const MESSAGE_QUANTITE_RECUE_REQUISE = "Indiquez la quantité reçue : un nombre de boîtes ou un nombre d'unités.";
export const MESSAGE_QUANTITE_RECUE_UNIQUE = "Indiquez soit le nombre de boîtes, soit le nombre d'unités reçues, pas les deux.";
export const MESSAGE_QUANTITE_RECUE_TROP_GRANDE = "La quantité reçue est trop grande pour être enregistrée. Vérifiez la quantité.";
export const MESSAGE_RECUE_DANS_LE_FUTUR = "La date de réception ne peut pas être dans le futur.";
export const MESSAGE_FICHE_NON_QUALIFIEE =
  "Le nombre d'unités par boîte de ce médicament n'est pas encore confirmé : vérifiez sa fiche avant de compter en boîtes.";
export const MESSAGE_RECEPTION_ENREGISTREE_HORS_LIGNE = "Réception enregistrée sur ce poste.";
export const MESSAGE_RECEPTION_REJOUEE = "Cette réception était déjà enregistrée.";
export const MESSAGE_FOURNISSEUR_ENREGISTRE = "Fournisseur enregistré.";
export const MESSAGE_NOM_FOURNISSEUR = "Écrivez le nom du fournisseur (2 caractères au moins).";
export const MESSAGE_TELEPHONE_FOURNISSEUR = "Le numéro de téléphone du fournisseur n'est pas valide.";

export function messageReceptionEnregistree(nombreLots: number): string {
  return nombreLots === 1 ? "Réception enregistrée sur ce poste : 1 lot." : `Réception enregistrée sur ce poste : ${nombreLots} lots.`;
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

function texte(v: string | undefined | null): string | null {
  const t = typeof v === "string" ? v.trim() : "";
  return t === "" ? null : t;
}

// ----------------------------------------------------------------------------------------------- fournisseurs

interface LigneFournisseurLocal {
  id: string;
  sequence: number;
  nom: string;
  telephone: string | null;
  creeLe: string;
}

function fournisseursPhoto(c: Contexte): FournisseurSynchro[] {
  return c.stockage.lire<{ document: string }>("SELECT document FROM fournisseurs_photo ORDER BY rang").map((l) => JSON.parse(l.document) as FournisseurSynchro);
}

function fournisseursLocauxActifs(c: Contexte): LigneFournisseurLocal[] {
  return c.stockage.lire<LigneFournisseurLocal>(
    "SELECT id, sequence, nom, telephone, creeLe FROM fournisseurs_locaux WHERE sequence > ? ORDER BY sequence",
    [c.etat().sequenceAppliquee],
  );
}

/** Fournisseurs de la photographie, puis ceux créés ici pas encore appliqués (un nom déjà connu n'est jamais doublé). */
export function listerFournisseursLocaux(c: Contexte): Fournisseur[] {
  const vus = new Set<string>();
  const sortie: Fournisseur[] = [];
  for (const f of fournisseursPhoto(c)) {
    vus.add(f.nom.trim().toLowerCase());
    sortie.push({ id: f.id, nom: f.nom, telephone: f.telephone, createdAt: "" });
  }
  for (const f of fournisseursLocauxActifs(c)) {
    const cle = f.nom.trim().toLowerCase();
    if (vus.has(cle)) continue;
    vus.add(cle);
    sortie.push({ id: f.id, nom: f.nom, telephone: f.telephone, createdAt: f.creeLe });
  }
  return sortie.sort((a, b) => a.nom.localeCompare(b.nom, "fr") || (a.id < b.id ? -1 : 1));
}

export function creerFournisseurLocal(c: Contexte, corps: { nom: string; telephone?: string }, u: Utilisateur): Fournisseur & { cree: boolean } {
  return c.stockage.transaction(() => {
    const nom = typeof corps.nom === "string" ? corps.nom.trim() : "";
    if (nom.length < 2 || nom.length > 100) throw refusValidation(MESSAGE_NOM_FOURNISSEUR);
    const telephone = texte(corps.telephone);
    if (telephone !== null && !TELEPHONE.test(telephone)) throw refusValidation(MESSAGE_TELEPHONE_FOURNISSEUR);

    // Un fournisseur de même nom (casse ignorée) est utilisé tel quel : aucune écriture, aucun événement.
    const existant = listerFournisseursLocaux(c).find((f) => f.nom.trim().toLowerCase() === nom.toLowerCase());
    if (existant !== undefined) return { ...existant, cree: false };

    const id = c.outils.genererId();
    exigerUuid(id, "du fournisseur");
    const sequence = c.etat().prochaineSequence;
    const creeLe = c.maintenant();
    c.stockage.executer("INSERT INTO fournisseurs_locaux (id, sequence, nom, telephone, creeLe) VALUES (?, ?, ?, ?, ?)", [id, sequence, nom, telephone, creeLe]);
    c.ajouterEvenement("FOURNISSEUR_CREE", u.id, { id, nom, ...(telephone !== null ? { telephone } : {}) });
    return { id, nom, telephone, createdAt: creeLe, cree: true };
  });
}

// ----------------------------------------------------------------------------------------------- réceptions

/** Réception locale gardée pour la lecture : le détail sans aucun coût ni montant de facture. */
type ReceptionLocale = Omit<Reception, "cree" | "avertissements">;

function recueLeMin(c: Contexte): string {
  return new Date(c.outils.horloge().getTime() - JOURS_HISTORIQUE_RECEPTIONS * 86_400_000).toISOString();
}

function lireLocale(c: Contexte, id: string): { sequence: number; recue: ReceptionLocale } | null {
  const ligne = c.stockage.lireUn<{ sequence: number; document: string }>("SELECT sequence, document FROM receptions_locales WHERE id = ?", [id]);
  return ligne === undefined || ligne === null ? null : { sequence: ligne.sequence, recue: JSON.parse(ligne.document) as ReceptionLocale };
}

function lotDepuisPhoto(l: ReceptionSynchro["lots"][number]): LotRecu {
  return { ...l };
}

function receptionDepuisPhoto(r: ReceptionSynchro): ReceptionLocale {
  return {
    id: r.id,
    reference: r.reference,
    recueLe: r.recueLe,
    createdAt: r.createdAt,
    auteurId: r.auteurId,
    numeroFacture: r.numeroFacture,
    referenceCommande: r.referenceCommande,
    dateFacture: r.dateFacture,
    nombrePages: r.nombrePages,
    fournisseur: r.fournisseur,
    lots: r.lots.map(lotDepuisPhoto),
    resolutions: [],
  };
}

function toutesLesReceptions(c: Contexte): ReceptionLocale[] {
  const sequence = c.etat().sequenceAppliquee;
  const minimum = recueLeMin(c);
  const locales = c.stockage
    .lire<{ document: string }>("SELECT document FROM receptions_locales WHERE sequence > ? ORDER BY sequence", [sequence])
    .map((l) => JSON.parse(l.document) as ReceptionLocale);
  const ids = new Set(locales.map((r) => r.id));
  const photo = c.stockage
    .lire<{ document: string }>("SELECT document FROM receptions_photo ORDER BY rang")
    .map((l) => receptionDepuisPhoto(JSON.parse(l.document) as ReceptionSynchro))
    .filter((r) => !ids.has(r.id) && r.recueLe >= minimum);
  return [...locales, ...photo].sort(
    (a, b) => (a.recueLe < b.recueLe ? 1 : a.recueLe > b.recueLe ? -1 : 0) || (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0) || (a.id < b.id ? 1 : -1),
  );
}

/** Soldes actuels du poste (photographie plus mouvements locaux) : un lot absent garde le solde de la photographie. */
function avecSoldes(c: Contexte, r: ReceptionLocale): ReceptionLocale {
  const soldes = new Map<string, number>();
  for (const f of fichesLocales(c)) for (const l of f.stock.lots) soldes.set(l.id, l.solde);
  return { ...r, lots: r.lots.map((l) => ({ ...l, solde: soldes.get(l.id) ?? l.solde })) };
}

export function listerReceptionsLocales(c: Contexte, page = 1): PageReceptions {
  const toutes = toutesLesReceptions(c);
  const p = Math.max(1, page);
  const debut = (p - 1) * PAR_PAGE_RECEPTIONS;
  const receptions: ReceptionResume[] = toutes.slice(debut, debut + PAR_PAGE_RECEPTIONS).map((r) => ({
    id: r.id,
    reference: r.reference,
    recueLe: r.recueLe,
    createdAt: r.createdAt,
    auteurId: r.auteurId,
    fournisseur: r.fournisseur,
    numeroFacture: r.numeroFacture ?? null,
    dateFacture: r.dateFacture ?? null,
    nombreLots: r.lots.length,
    quantiteTotale: r.lots.reduce((s, l) => s + l.quantiteRecue, 0),
  }));
  return { receptions, page: p, parPage: PAR_PAGE_RECEPTIONS, total: toutes.length };
}

export function lireReceptionLocale(c: Contexte, id: string): Reception {
  const r = toutesLesReceptions(c).find((x) => x.id === id);
  if (r === undefined) throw new RefusCaisse(404, "RECEPTION_INTROUVABLE", MESSAGE_RECEPTION_INTROUVABLE);
  return avecSoldes(c, r);
}

interface LignePreparee {
  ligne: LigneReceptionDemandee;
  stockId: string;
  coefficient: number;
  quantiteUm: number;
}

function preparerLigne(c: Contexte, l: LigneReceptionDemandee, jour: string, i: number): LignePreparee {
  const f = fichesLocales(c, l.stockId)[0];
  if (f === undefined) {
    throw new RefusCaisse(404, "STOCK_INTROUVABLE", MESSAGE_STOCK_INTROUVABLE_RECEPTION, [{ stockId: l.stockId }]);
  }
  const coefficient = f.source.coefficientBoite;
  const boites = l.nombreBoites;
  const unites = l.quantiteUnites;
  if (boites === undefined && unites === undefined) throw refusValidation(MESSAGE_QUANTITE_RECUE_REQUISE);
  if (boites !== undefined && unites !== undefined) throw refusValidation(MESSAGE_QUANTITE_RECUE_UNIQUE);
  if (boites !== undefined && !entier(boites, 1, BOITES_MAX)) throw refusValidation(MESSAGE_QUANTITE_RECUE_REQUISE);
  if (unites !== undefined && !entier(unites, 1, UNITES_MAX)) throw refusValidation(MESSAGE_QUANTITE_RECUE_REQUISE);
  const quantiteUm = boites !== undefined ? boites * coefficient : (unites as number);
  if (quantiteUm > ENTIER_MAX) throw refusValidation(MESSAGE_QUANTITE_RECUE_TROP_GRANDE);

  const date = texte(l.dateExpiration);
  if (date !== null && !jourValide(date)) throw refusValidation(MESSAGE_DATE_INVALIDE);
  if (date === null && l.sansPeremption !== true) {
    throw new RefusCaisse(400, "DATE_PEREMPTION_REQUISE", MESSAGE_DATE_PEREMPTION_REQUISE, [{ stockId: l.stockId, nom: f.source.nom, ligne: i }]);
  }
  if (date !== null && date < jour) {
    throw new RefusCaisse(400, "DATE_PEREMPTION_PASSEE", MESSAGE_DATE_PEREMPTION_PASSEE, [{ stockId: l.stockId, nom: f.source.nom, ligne: i }]);
  }
  for (const [cle, max] of [
    ["coutAchatBoite", ENTIER_MAX],
    ["prixPublicBoite", ENTIER_MAX],
    ["montantHTLigne", ENTIER_MAX],
    ["quantiteCommandee", BOITES_MAX],
    ["colisage", BOITES_MAX],
    ["tauxTvaPourMille", 1000],
  ] as const) {
    const v = l[cle];
    if (v !== undefined && !entier(v, 0, max)) throw refusValidation("Un montant ou une quantité de la facture n'est pas valide : vérifiez les lignes.");
  }
  return { ligne: l, stockId: l.stockId, coefficient, quantiteUm };
}

/** Corps de l'événement : le corps de la route, avec le lot stable et le coefficient local de chaque ligne. */
function corpsEvenement(corps: CorpsReception, id: string, recueLe: string, lignes: LignePreparee[]): Record<string, unknown> {
  const sans = <T extends Record<string, unknown>>(o: T): Record<string, unknown> => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== ""));
  return {
    id,
    ...sans({
      fournisseurId: corps.fournisseurId,
      reference: texte(corps.reference) ?? undefined,
      numeroFacture: texte(corps.numeroFacture) ?? undefined,
      referenceCommande: texte(corps.referenceCommande) ?? undefined,
      dateFacture: corps.dateFacture,
      nombrePages: corps.nombrePages,
      montantHT: corps.montantHT,
      totalTva: corps.totalTva,
      montantTTC: corps.montantTTC,
      netAPayer: corps.netAPayer,
    }),
    recueLe,
    lignes: lignes.map((p, i) => ({
      lotId: idLotDeterministe(id, i),
      coefficientLocal: p.coefficient,
      ...sans({
        stockId: p.stockId,
        numeroLot: texte(p.ligne.numeroLot) ?? undefined,
        dateExpiration: texte(p.ligne.dateExpiration) ?? undefined,
        sansPeremption: p.ligne.sansPeremption === true ? true : undefined,
        nombreBoites: p.ligne.nombreBoites,
        quantiteUnites: p.ligne.quantiteUnites,
        coutAchatBoite: p.ligne.coutAchatBoite,
        codeArticleFournisseur: texte(p.ligne.codeArticleFournisseur) ?? undefined,
        codeBarres: texte(p.ligne.codeBarres) ?? undefined,
        quantiteCommandee: p.ligne.quantiteCommandee,
        prixPublicBoite: p.ligne.prixPublicBoite,
        codeTva: texte(p.ligne.codeTva) ?? undefined,
        tauxTvaPourMille: p.ligne.tauxTvaPourMille,
        montantHTLigne: p.ligne.montantHTLigne,
        colisage: p.ligne.colisage,
        tableau: texte(p.ligne.tableau) ?? undefined,
        bonPreparation: texte(p.ligne.bonPreparation) ?? undefined,
      }),
    })),
  };
}

export function enregistrerReceptionLocale(c: Contexte, corps: CorpsReception, u: Utilisateur): Reception {
  return c.stockage.transaction(() => {
    const id = corps.id;
    exigerUuid(id, "de la réception");
    const deja = lireLocale(c, id as string);
    if (deja !== null) return { ...deja.recue, cree: false, avertissements: [] };

    if (!Array.isArray(corps.lignes) || corps.lignes.length < 1 || corps.lignes.length > LIGNES_MAX) {
      throw refusValidation(MESSAGE_QUANTITE_RECUE_REQUISE);
    }
    if (corps.dateFacture !== undefined && !jourValide(corps.dateFacture)) throw refusValidation(MESSAGE_DATE_FACTURE_INVALIDE);
    for (const cle of ["nombrePages", "montantHT", "totalTva", "montantTTC", "netAPayer"] as const) {
      const v = corps[cle];
      if (v !== undefined && !entier(v, 0, cle === "nombrePages" ? 1000 : ENTIER_MAX)) throw refusValidation("Un montant de la facture n'est pas valide : vérifiez-le.");
    }
    const fournisseurs = listerFournisseursLocaux(c);
    let fournisseur: { id: string; nom: string } | null = null;
    if (corps.fournisseurId !== undefined) {
      const f = fournisseurs.find((x) => x.id === corps.fournisseurId);
      if (f === undefined) throw new RefusCaisse(404, "FOURNISSEUR_INTROUVABLE", MESSAGE_FOURNISSEUR_INTROUVABLE);
      fournisseur = { id: f.id, nom: f.nom };
    }
    const maintenant = c.maintenant();
    const recueLe = corps.recueLe ?? maintenant;
    if (Number.isNaN(Date.parse(recueLe))) throw refusValidation(MESSAGE_RECUE_DANS_LE_FUTUR);
    if (new Date(recueLe).getTime() > c.outils.horloge().getTime() + 5 * 60_000) throw refusValidation(MESSAGE_RECUE_DANS_LE_FUTUR);

    const jour = c.jour();
    const lignes = corps.lignes.map((l, i) => preparerLigne(c, l, jour, i));
    // Plafond du stock par fiche : le total (stock local plus ce qui entre) reste enregistrable côté serveur.
    const parFiche = new Map<string, number>();
    for (const p of lignes) parFiche.set(p.stockId, (parFiche.get(p.stockId) ?? 0) + p.quantiteUm);
    for (const [stockId, entrant] of parFiche) {
      const f = fichesLocales(c, stockId)[0];
      if (f.stock.quantite + entrant > ENTIER_MAX) throw refusValidation(MESSAGE_QUANTITE_RECUE_TROP_GRANDE);
    }

    const sequence = c.etat().prochaineSequence;
    const lots: LotRecu[] = lignes.map((p, i) => {
      const lotId = idLotDeterministe(id as string, i);
      const f = fichesLocales(c, p.stockId)[0];
      const dateExpiration = texte(p.ligne.dateExpiration);
      const numeroLot = texte(p.ligne.numeroLot);
      ajouterLotLocal(c.stockage, { lotId, stockId: p.stockId, sequence, numeroLot, dateExpiration, dateReception: recueLe, coefficientReception: p.coefficient });
      ajouterMouvementLocal(c.stockage, { sequence, stockId: p.stockId, lotId, quantiteUm: p.quantiteUm, type: "RECEPTION", reference: id as string });
      return {
        id: lotId,
        stockId: p.stockId,
        nom: f.source.nom,
        numeroLot,
        dateExpiration,
        quantiteRecue: p.quantiteUm,
        coefficientReception: p.coefficient,
        solde: p.quantiteUm,
        codeArticleFournisseur: texte(p.ligne.codeArticleFournisseur),
        codeBarres: texte(p.ligne.codeBarres),
        quantiteCommandee: p.ligne.quantiteCommandee ?? null,
        prixPublicBoite: p.ligne.prixPublicBoite ?? null,
        codeTva: texte(p.ligne.codeTva),
        tauxTvaPourMille: p.ligne.tauxTvaPourMille ?? null,
        colisage: p.ligne.colisage ?? null,
        tableau: texte(p.ligne.tableau),
        bonPreparation: texte(p.ligne.bonPreparation),
      };
    });
    // Détail gardé pour la lecture : jamais de coût (coutAchatBoite, montantHTLigne) ni de montant de facture.
    const lisible: ReceptionLocale = {
      id: id as string,
      reference: texte(corps.reference),
      recueLe,
      createdAt: maintenant,
      auteurId: u.id,
      numeroFacture: texte(corps.numeroFacture),
      referenceCommande: texte(corps.referenceCommande),
      dateFacture: corps.dateFacture ?? null,
      nombrePages: corps.nombrePages ?? null,
      fournisseur,
      lots,
      resolutions: [],
    };
    c.stockage.executer("INSERT INTO receptions_locales (id, sequence, recueLe, document) VALUES (?, ?, ?, ?)", [id as string, sequence, recueLe, JSON.stringify(lisible)]);
    c.ajouterEvenement("RECEPTION_ENREGISTREE", u.id, corpsEvenement(corps, id as string, recueLe, lignes));

    const avertissements: AvertissementReception[] = [...new Set(lignes.map((p) => p.stockId))]
      .filter((stockId) => fichesLocales(c, stockId)[0].source.qualifie === false)
      .map((stockId) => ({ code: "FICHE_NON_QUALIFIEE" as const, stockId, nom: fichesLocales(c, stockId)[0].source.nom, message: MESSAGE_FICHE_NON_QUALIFIEE }));
    return avecSolde(c, { ...lisible, cree: true, avertissements });
  });
}

function avecSolde(c: Contexte, r: Reception): Reception {
  const avec = avecSoldes(c, r);
  return { ...r, lots: avec.lots };
}
