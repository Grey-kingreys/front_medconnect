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

export interface StockMedicament {
  id: string;
  medicamentId: string;
  medicament: Medicament;
  structureId: string;
  quantite: number;
  prixUnitaire?: number;
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
  quantite: number;
  prixUnitaire?: number;
  dateExpiration?: string;
  notes?: string;
}) => authFetch<StockMedicament>(`/pharmacie/stock/${structureId}`, {
  method: "POST",
  body: JSON.stringify(data),
});

export async function updateStockQuantite(structureId: string, stockId: string, variation: number, notes?: string) {
  return authFetch<StockMedicament>(`/pharmacie/stock/${structureId}/${stockId}/quantite`, {
    method: "PATCH",
    body: JSON.stringify({ variation, notes }),
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
