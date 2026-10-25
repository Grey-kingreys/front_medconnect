/**
 * Ventes d'une pharmacie. Contrat aligné sur back_medconnect (orch/lot8-back, vente.controller.ts et vente.service.ts).
 */
import { ApiError, authFetch } from "./api_auth";

export type StatutVente = "VALIDEE" | "ANNULEE";

export const CODES_ERREUR_VENTE = [
  "STOCK_INSUFFISANT",
  "MEDICAMENT_EXPIRE",
  "PRIX_MANQUANT",
  "ORDONNANCE_NON_CONFIRMEE",
  "STOCK_INTROUVABLE",
  "VALIDATION",
  "VENTE_DEJA_ANNULEE",
  "ANNULATION_HORS_DELAI",
] as const;
export type CodeErreurVente = (typeof CODES_ERREUR_VENTE)[number];

export interface LigneVenteDemandee {
  stockId: string;
  quantite: number;
}
export interface CorpsCreationVente {
  lignes: LigneVenteDemandee[];
  clientNom?: string;
  clientTelephone?: string;
  ordonnanceVerifiee?: boolean;
}
export interface LigneVente {
  id: string;
  stockId: string;
  medicamentId: string;
  nomMedicament: string;
  prixUnitaire: number;
  quantite: number;
  sousTotal: number;
}
export interface PharmacieVente {
  id: string;
  nom: string;
  adresse: string | null;
  ville: string | null;
  telephone: string | null;
  logoUrl: string | null;
}
export interface VendeurVente {
  id: string;
  nom: string;
}
export interface Vente {
  id: string;
  numero: string;
  statut: StatutVente;
  createdAt: string;
  total: number;
  ordonnanceVerifiee: boolean;
  clientNom: string | null;
  clientTelephone: string | null;
  vendeur: VendeurVente;
  annuleeLe: string | null;
  annuleeParId: string | null;
  motifAnnulation: string | null;
  lignes: LigneVente[];
  pharmacie: PharmacieVente;
  /** Vrai quand la même clé a déjà servi : vente renvoyée sans second retrait du stock. */
  rejeu?: boolean;
}
export interface VenteResume {
  id: string;
  numero: string;
  createdAt: string;
  statut: StatutVente;
  total: number;
  nombreArticles: number;
  vendeur: VendeurVente;
  clientNom: string | null;
}
export interface VentesDuJour {
  date: string;
  totalJour: number;
  nombre: number;
  page: number;
  parPage: number;
  totalPages: number;
  ventes: VenteResume[];
}
/** Ligne citée par une erreur de vente (STOCK_INSUFFISANT, STOCK_INTROUVABLE, MEDICAMENT_EXPIRE, PRIX_MANQUANT, ORDONNANCE_NON_CONFIRMEE). */
export interface LigneErreurVente {
  stockId: string;
  nom?: string;
  disponible?: number;
  demande?: number;
}

export function creerVente(structureId: string, corps: CorpsCreationVente, cleIdempotence: string) {
  return authFetch<Vente>(`/pharmacie/${encodeURIComponent(structureId)}/ventes`, {
    method: "POST",
    body: JSON.stringify(corps),
    headers: { "Idempotency-Key": cleIdempotence },
  });
}

export function listerVentes(structureId: string, options: { date?: string; page?: number } = {}) {
  const params = new URLSearchParams();
  if (options.date !== undefined) params.set("date", options.date);
  if (options.page !== undefined) params.set("page", String(options.page));
  const requete = params.toString();
  return authFetch<VentesDuJour>(
    `/pharmacie/${encodeURIComponent(structureId)}/ventes${requete === "" ? "" : `?${requete}`}`,
  );
}

export function getVente(structureId: string, venteId: string) {
  return authFetch<Vente>(`/pharmacie/${encodeURIComponent(structureId)}/ventes/${encodeURIComponent(venteId)}`);
}

export function annulerVente(structureId: string, venteId: string, motif: string) {
  return authFetch<Vente>(
    `/pharmacie/${encodeURIComponent(structureId)}/ventes/${encodeURIComponent(venteId)}/annuler`,
    { method: "POST", body: JSON.stringify({ motif }) },
  );
}

/** Code d'erreur métier d'une vente, ou null si l'erreur n'en porte pas de connu. */
export function codeErreurVente(err: unknown): CodeErreurVente | null {
  if (!(err instanceof ApiError)) return null;
  const code = err.details?.code;
  return CODES_ERREUR_VENTE.find((c) => c === code) ?? null;
}

const estObjet = (valeur: unknown): valeur is Record<string, unknown> =>
  typeof valeur === "object" && valeur !== null && !Array.isArray(valeur);

/** Lignes citées par l'erreur : tableau `details` à la racine du corps de la réponse. */
export function lignesErreurVente(err: unknown): LigneErreurVente[] {
  if (!(err instanceof ApiError) || !err.details) return [];
  const tableau = err.details.details;
  if (!Array.isArray(tableau)) return [];
  const entierPositif = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0;
  const lignes: LigneErreurVente[] = [];
  for (const element of tableau as unknown[]) {
    if (!estObjet(element)) continue;
    const { stockId, nom, disponible, demande } = element;
    if (typeof stockId !== "string" || stockId === "") continue;
    const ligne: LigneErreurVente = { stockId };
    if (typeof nom === "string") ligne.nom = nom;
    if (entierPositif(disponible)) ligne.disponible = disponible;
    if (entierPositif(demande)) ligne.demande = demande;
    lignes.push(ligne);
  }
  return lignes;
}
