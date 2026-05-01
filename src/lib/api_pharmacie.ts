/**
 * MedConnect Pharmacy & Medication API
 */

import { ApiError, ApiResponse, authFetch } from "./api_auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

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
