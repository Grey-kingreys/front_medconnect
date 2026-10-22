/**
 * Ventes d'une pharmacie. Le contrat suit SPEC-VENTES-PHARMACIE.md, à confirmer avec orch/lot7-back.
 */
import { ApiError, authFetch } from "./api_auth";

export type StatutVente = "VALIDEE" | "ANNULEE";

export const CODES_ERREUR_VENTE = [
  "STOCK_INSUFFISANT",
  "MEDICAMENT_EXPIRE",
  "PRIX_MANQUANT",
  "ORDONNANCE_NON_CONFIRMEE",
  "VALIDATION",
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
  venteId: string;
  medicamentId: string;
  stockMedicamentId: string;
  nomMedicament: string;
  prixUnitaire: number;
  quantite: number;
  sousTotal: number;
}
export interface PharmacieVente {
  nom: string;
  adresse?: string | null;
  ville?: string | null;
  telephone?: string | null;
  logoUrl?: string | null;
}
export interface Vente {
  id: string;
  structureId: string;
  numero: string;
  vendeurId: string;
  vendeur?: { id: string; nom: string; prenom: string };
  clientNom: string | null;
  clientTelephone: string | null;
  ordonnanceVerifiee: boolean;
  total: number;
  statut: StatutVente;
  annuleeLe: string | null;
  annuleeParId: string | null;
  motifAnnulation: string | null;
  createdAt: string;
  lignes: LigneVente[];
  pharmacie?: PharmacieVente;
}
/** Ligne citée par une erreur de vente (409 STOCK_INSUFFISANT, 400 MEDICAMENT_EXPIRE, PRIX_MANQUANT, ORDONNANCE_NON_CONFIRMEE). */
export interface LigneErreurVente {
  stockId: string;
  nom?: string;
  disponible?: number;
}

export function creerVente(structureId: string, corps: CorpsCreationVente, cleIdempotence: string) {
  return authFetch<Vente>(`/pharmacie/${encodeURIComponent(structureId)}/ventes`, {
    method: "POST",
    body: JSON.stringify(corps),
    headers: { "Idempotency-Key": cleIdempotence },
  });
}

/** Code d'erreur métier d'une vente, ou null si l'erreur n'en porte pas de connu. */
export function codeErreurVente(err: unknown): CodeErreurVente | null {
  if (!(err instanceof ApiError)) return null;
  const code = err.details?.code;
  return CODES_ERREUR_VENTE.find((c) => c === code) ?? null;
}

const estObjet = (valeur: unknown): valeur is Record<string, unknown> =>
  typeof valeur === "object" && valeur !== null && !Array.isArray(valeur);

/** Lignes citées par l'erreur : premier tableau trouvé parmi les emplacements possibles du corps. */
export function lignesErreurVente(err: unknown): LigneErreurVente[] {
  if (!(err instanceof ApiError) || !err.details) return [];
  const details = err.details;
  const donnees = estObjet(details.donnees) ? details.donnees : undefined;
  const candidats: unknown[] = [details.details, donnees?.details, donnees?.lignes, details.lignes];
  const tableau = candidats.find((c): c is unknown[] => Array.isArray(c));
  if (!tableau) return [];
  const lignes: LigneErreurVente[] = [];
  for (const element of tableau) {
    if (!estObjet(element)) continue;
    const { stockId, nom, disponible } = element;
    if (typeof stockId !== "string" || stockId === "") continue;
    const ligne: LigneErreurVente = { stockId };
    if (typeof nom === "string") ligne.nom = nom;
    if (typeof disponible === "number" && Number.isInteger(disponible) && disponible >= 0) {
      ligne.disponible = disponible;
    }
    lignes.push(ligne);
  }
  return lignes;
}
