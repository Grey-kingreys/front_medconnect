/**
 * MedConnecte Pharmacy & Medication API
 */

import { authFetch, authDownload } from "./api_auth";

// ─── Types ──────────────────────────────────────────────────────

export interface Medicament {
  id: string;
  nom: string;
  nomGenerique?: string;
  categorie: string;
  description?: string;
  ordonnanceRequise: boolean;
  formes: string[];
}

export type UniteMinimale = "COMPRIME" | "GELULE" | "ML" | "SACHET" | "GRAMME" | "AMPOULE" | "UNITE";

export interface LotFiche {
  id: string;
  numeroLot: string | null;
  dateExpiration: string | null;
  quantite: number;
  lotTechnique: boolean;
  /** Présent seulement avec `marge:read` : tester la présence de la clé (D698). */
  coutUnitaire?: number | null;
}

export interface StockMedicament {
  id: string;
  medicamentId: string;
  medicament: Medicament;
  structureId: string;
  /** Unités minimales (comprimés, ml...), peut être négative. */
  quantite: number;
  /** Prix de la boîte. */
  prixUnitaire?: number;
  // Champs de la fiche : la recherche publique ne les renvoie pas.
  uniteMinimale?: UniteMinimale;
  coefficientBoite?: number;
  prixUnite?: number | null;
  deconditionnable?: boolean;
  toleranceInventaire?: number | null;
  qualifie?: boolean;
  /** Renseigné quand la fiche est archivée (retirée du stock) : l'ajout simple ne la désarchive pas. */
  archiveLe?: string | null;
  reliquat?: { lotId: string; unitesRestantes: number }[];
  quantiteVendable?: number;
  lots?: LotFiche[];
  disponible: boolean;
  dateExpiration?: string;
  notes?: string;
  distanceKm?: number; // Calculé par le backend
  structure?: {
    id: string;
    nom: string;
    adresse?: string;
    ville?: string;
    telephone?: string;
    latitude?: number;
    longitude?: number;
    estDeGarde: boolean;
  };
}

export interface StockInfo {
  stocks: StockMedicament[];
  alertes: {
    stockBas: Array<{ id: string; nom: string; quantite: number }>;
    rupture: Array<{ id: string; nom: string }>;
  };
}

// ─── Public / Patient ──────────────────────────────────────────

export async function rechercherMedicaments(q?: string, lat?: number, lng?: number, ville?: string, pharmacieId?: string) {
  let url = `/pharmacie/rechercher?q=${encodeURIComponent(q || "")}`;
  if (lat && lng) url += `&lat=${lat}&lng=${lng}`;
  if (ville) url += `&ville=${encodeURIComponent(ville)}`;
  if (pharmacieId) url += `&pharmacieId=${pharmacieId}`;
  return authFetch<StockMedicament[]>(url);
}

export async function getCatalogue(search?: string, categorie?: string) {
  let url = "/pharmacie/catalogue";
  const params = new URLSearchParams();
  if (search) params.append("search", search);
  if (categorie) params.append("categorie", categorie);
  const queryString = params.toString();
  if (queryString) url += `?${queryString}`;
  return authFetch<Medicament[]>(url);
}

export async function getCategories() {
  return authFetch<string[]>("/pharmacie/catalogue/categories");
}

export async function getMedicamentDetails(id: string) {
  return authFetch<Medicament & { stocks: StockMedicament[] }>(`/pharmacie/catalogue/${id}`);
}

// ─── Pharmacist / Structure Admin ──────────────────────────────

export const createMedicament = (data: Partial<Medicament>) =>
  authFetch<Medicament>("/pharmacie/catalogue", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updateMedicament = (id: string, data: Partial<Medicament>) =>
  authFetch<Medicament>(`/pharmacie/catalogue/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });

export const deleteMedicament = (id: string) =>
  authFetch<null>(`/pharmacie/catalogue/${id}`, {
    method: "DELETE",
  });

export async function getMyStock(structureId: string) {
  return authFetch<StockInfo>(`/pharmacie/stock/${structureId}`);
}

export const upsertStock = (structureId: string, data: {
  medicamentId: string;
  /** Absente : aucune écriture de stock (fiche créée si elle manque, prix et notes seulement). */
  quantite?: number;
  prixUnitaire?: number;
  dateExpiration?: string;
  notes?: string;
  /** Fiche sans lot et quantité positive : la date est obligatoire, sauf si ce champ est vrai (D701). */
  sansPeremption?: boolean;
}) => authFetch<StockMedicament>(`/pharmacie/stock/${structureId}`, {
  method: "POST",
  body: JSON.stringify(data),
});

/** Avertissement non bloquant renvoyé par la modification d'une fiche. */
export interface AvertissementFiche {
  code: "ECART_PRIX";
  ecartPct: number;
}

/** Champs modifiables d'une fiche ; `null` efface le prix de la boîte, le prix d'une unité ou la tolérance. */
export interface CorpsFiche {
  prixUnitaire?: number | null;
  prixUnite?: number | null;
  coefficientBoite?: number;
  uniteMinimale?: UniteMinimale;
  deconditionnable?: boolean;
  toleranceInventaire?: number | null;
  qualifie?: true;
  conversionStock?: "MULTIPLIER" | "CONSERVER";
}

/** Modifie la fiche d'un médicament du stock (prix, unité, qualification, conversion du stock). */
export async function modifierFiche(structureId: string, stockId: string, corps: CorpsFiche) {
  return authFetch<StockMedicament & { avertissements: AvertissementFiche[]; conversion: unknown }>(
    `/pharmacie/${structureId}/stock/${stockId}/fiche`,
    {
      method: "PATCH",
      body: JSON.stringify(corps),
    },
  );
}

/** Correction de quantité : `variation` en unités minimales (entier non nul), motif de 3 à 300 caractères. Route non rejouable. */
export async function updateStockQuantite(
  structureId: string,
  stockId: string,
  corps: { variation: number; lotId?: string; motif: string },
) {
  return authFetch<StockMedicament>(`/pharmacie/stock/${structureId}/${stockId}/quantite`, {
    method: "PATCH",
    body: JSON.stringify(corps),
  });
}

export async function removeStockItem(structureId: string, stockId: string) {
  return authFetch<null>(`/pharmacie/stock/${structureId}/${stockId}`, {
    method: "DELETE",
  });
}

// ─── Import Excel du stock (F1) ─────────────────────────────────

/** Mode d'import du stock : l'inventaire remplace les quantités, la livraison les ajoute (D01). */
export type ModeImportStock = "inventaire" | "livraison";

/** Résultat de l'analyse d'une ligne du fichier Excel. */
export interface LigneImportStock {
  /** Numéro de la ligne dans Excel (la ligne 1 contient les titres). */
  ligne: number;
  /** Nom tel qu'écrit dans le fichier. */
  nom: string;
  statut: "acceptee" | "rejetee";
  raison?: string;
  medicamentId?: string;
  /** Nom du médicament reconnu dans le catalogue. */
  medicamentNom?: string;
  quantite?: number;
  prixUnitaire?: number;
  dateExpiration?: string;
  notes?: string;
  /** Quantité en stock avant l'import (0 si le médicament n'est pas encore en stock) ; absente sur un ancien serveur. */
  quantiteAvant?: number | null;
  /** Quantité en stock après l'import, selon le mode choisi ; absente sur un ancien serveur. */
  quantiteApres?: number | null;
}

/** Colonnes du fichier telles que le serveur les a comprises. */
export interface ColonnesLuesImport {
  /** Numéro de la ligne des titres dans Excel (1 le plus souvent). */
  ligneTitres: number;
  /** Titre du fichier et colonne de la plateforme correspondante (« Qté » lue comme « Quantité »). */
  reconnues: { titre: string; colonne: string }[];
  /** Titres non reconnus ou en double : leur contenu n'est pas importé. */
  ignorees: string[];
}

/** Rapport de l'aperçu (stock ou catalogue) ; `importees` n'est présent qu'après l'import. */
export interface RapportImport<L> {
  totalLignes: number;
  acceptees: number;
  rejetees: number;
  importees?: number;
  lignes: L[];
  /** Absent sur un ancien serveur. */
  colonnes?: ColonnesLuesImport;
}

export type RapportImportStock = RapportImport<LigneImportStock>;

const corpsImport = (fichier: File, mode?: ModeImportStock) => {
  const formulaire = new FormData();
  formulaire.append("fichier", fichier);
  if (mode) formulaire.append("mode", mode);
  return formulaire;
};

/** Télécharge le modèle Excel à remplir ; renvoie le contenu et le nom du fichier. */
export async function telechargerModeleImportStock(structureId: string) {
  const { blob, filename } = await authDownload(`/pharmacie/stock/${structureId}/import/modele`);
  return { blob, filename: filename ?? "modele-import-stock.xlsx" };
}

/** Analyse le fichier sans rien enregistrer, selon le mode choisi. */
export async function apercuImportStock(structureId: string, fichier: File, mode: ModeImportStock = "inventaire") {
  return authFetch<RapportImportStock>(`/pharmacie/stock/${structureId}/import/apercu`, {
    method: "POST",
    body: corpsImport(fichier, mode),
  });
}

/** Refait l'analyse et enregistre les lignes acceptées : la quantité remplace celle en stock (inventaire) ou s'y ajoute (livraison). */
export async function importerStock(structureId: string, fichier: File, mode: ModeImportStock = "inventaire") {
  return authFetch<RapportImportStock>(`/pharmacie/stock/${structureId}/import`, {
    method: "POST",
    body: corpsImport(fichier, mode),
  });
}

// ─── Import Excel du catalogue ──────────────────────────────────

/** Résultat de l'analyse d'une ligne du fichier Excel du catalogue. */
export interface LigneImportCatalogue {
  /** Numéro de la ligne dans Excel (la ligne 1 contient les titres). */
  ligne: number;
  /** Nom tel qu'écrit dans le fichier. */
  nom: string;
  statut: "acceptee" | "rejetee";
  raison?: string;
  nomGenerique?: string;
  /** Catégorie retenue (orthographe du catalogue si elle existe déjà). */
  categorie?: string;
  description?: string;
  ordonnanceRequise?: boolean;
  formes?: string[];
}

export type RapportImportCatalogue = RapportImport<LigneImportCatalogue>;

/** Télécharge le modèle Excel du catalogue ; renvoie le contenu et le nom du fichier. */
export async function telechargerModeleImportCatalogue() {
  const { blob, filename } = await authDownload("/pharmacie/catalogue/import/modele");
  return { blob, filename: filename ?? "modele-import-catalogue.xlsx" };
}

/** Analyse le fichier du catalogue sans rien enregistrer. */
export async function apercuImportCatalogue(fichier: File) {
  return authFetch<RapportImportCatalogue>("/pharmacie/catalogue/import/apercu", {
    method: "POST",
    body: corpsImport(fichier),
  });
}

/** Refait l'analyse et ajoute au catalogue les médicaments acceptés (les existants ne sont jamais modifiés). */
export async function importerCatalogue(fichier: File) {
  return authFetch<RapportImportCatalogue>("/pharmacie/catalogue/import", {
    method: "POST",
    body: corpsImport(fichier),
  });
}

// ─── Réceptions et fournisseurs (PF07a) ─────────────────────────

export interface Fournisseur {
  id: string;
  nom: string;
  telephone: string | null;
  createdAt: string;
}

/** Une ligne de la facture : exactement un de `nombreBoites` et `quantiteUnites` ; la date manque seulement avec `sansPeremption`. */
export interface LigneReceptionDemandee {
  stockId: string;
  numeroLot?: string;
  /** Jour AAAA-MM-JJ. */
  dateExpiration?: string;
  sansPeremption?: boolean;
  nombreBoites?: number;
  quantiteUnites?: number;
  /** Coût d'une boîte en GNF (entier, 0 ou plus). */
  coutAchatBoite?: number;
}

export interface CorpsReception {
  /** Identifiant choisi par le client : un rejeu du même identifiant ne crée rien de plus (D688). */
  id?: string;
  fournisseurId?: string;
  reference?: string;
  /** Date ISO, jamais dans le futur. */
  recueLe?: string;
  lignes: LigneReceptionDemandee[];
}

export interface LotRecu {
  id: string;
  stockId: string;
  nom: string;
  numeroLot: string | null;
  dateExpiration: string | null;
  quantiteRecue: number;
  coefficientReception: number;
  solde: number;
  /** Présents seulement avec `marge:read` : tester la présence de la clé, un coût nul ou absent est « inconnu » (D698). */
  coutAchatBoite?: number | null;
  coutUnitaire?: number | null;
}

export interface AvertissementReception {
  code: "FICHE_NON_QUALIFIEE";
  stockId: string;
  nom: string;
  message: string;
}

export interface ReceptionResume {
  id: string;
  reference: string | null;
  recueLe: string;
  createdAt: string;
  auteurId: string;
  fournisseur: { id: string; nom: string } | null;
  nombreLots: number;
  quantiteTotale: number;
}

export interface Reception {
  id: string;
  reference: string | null;
  recueLe: string;
  createdAt: string;
  auteurId: string;
  fournisseur: { id: string; nom: string } | null;
  lots: LotRecu[];
  resolutions?: unknown[];
  /** Faux sur le rejeu d'un identifiant déjà enregistré. */
  cree?: boolean;
  avertissements?: AvertissementReception[];
}

export interface PageReceptions {
  receptions: ReceptionResume[];
  page: number;
  parPage: number;
  total: number;
}

export async function listerFournisseurs(structureId: string) {
  return authFetch<Fournisseur[]>(`/pharmacie/${encodeURIComponent(structureId)}/fournisseurs`);
}

export async function creerFournisseur(structureId: string, corps: { nom: string; telephone?: string }) {
  return authFetch<Fournisseur & { cree: boolean }>(`/pharmacie/${encodeURIComponent(structureId)}/fournisseurs`, {
    method: "POST",
    body: JSON.stringify(corps),
  });
}

/** Enregistre une livraison ; rejouable avec le même `id` sans rien enregistrer deux fois. */
export async function enregistrerReception(structureId: string, corps: CorpsReception) {
  return authFetch<Reception>(`/pharmacie/${encodeURIComponent(structureId)}/receptions`, {
    method: "POST",
    body: JSON.stringify(corps),
  });
}

export async function listerReceptions(structureId: string, page = 1) {
  return authFetch<PageReceptions>(`/pharmacie/${encodeURIComponent(structureId)}/receptions?page=${page}`);
}

export async function getReception(structureId: string, receptionId: string) {
  return authFetch<Reception>(
    `/pharmacie/${encodeURIComponent(structureId)}/receptions/${encodeURIComponent(receptionId)}`,
  );
}
