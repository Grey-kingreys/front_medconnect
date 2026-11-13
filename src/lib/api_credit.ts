/**
 * Cahier de crédit d'une pharmacie. Contrat aligné sur le back (module crédit, préfixe /pharmacie/:structureId).
 * Montants : entiers en GNF. Dates : AAAA-MM-JJ (jour de Conakry), sauf `createdAt` et `dernierePrise` (ISO).
 */
import { ApiError, authFetch } from "./api_auth";
import type { UniteVente } from "./api_ventes";

export type StatutCredit = "EN_COURS" | "EN_RETARD" | "SOLDE";
export const LIBELLES_STATUT_CREDIT: Record<StatutCredit, string> = {
  EN_COURS: "En cours",
  EN_RETARD: "En retard",
  SOLDE: "Soldé",
};
export type FiltreStatutCredit = StatutCredit | "TOUS";

export interface ClientCreditResume {
  id: string;
  nomComplet: string;
  telephone: string | null;
  resteAPayer: number;
  statut: StatutCredit;
  dernierePrise: string | null;
  /** Résumé de ce qu'il a pris, vide si soldé. */
  resume: string;
  dateLimite: string | null;
  nombrePrises: number;
}
export interface ListeCredits {
  clients: ClientCreditResume[];
  total: number;
  page: number;
  parPage: number;
  totalPages: number;
  resteTotal: number;
}
export interface LignePriseCredit {
  nomMedicament: string;
  /** Unités minimales. */
  quantite: number;
  nombreAffiche: number;
  uniteAffichee: UniteVente;
  sousTotal: number;
}
export interface PriseCredit {
  venteId: string;
  numero: string;
  createdAt: string;
  jourMetier: string;
  vendeurNom: string;
  total: number;
  resteSurPrise: number;
  soldee: boolean;
  annulee: boolean;
  motifAnnulation: string | null;
  dateLimite: string | null;
  lignes: LignePriseCredit[];
}
export interface RemboursementCredit {
  id: string;
  montant: number;
  note: string | null;
  verseEnCaisse: boolean;
  auteurNom: string;
  createdAt: string;
}
export interface FicheClientCredit {
  id: string;
  nomComplet: string;
  telephone: string | null;
  note: string | null;
  createdAt: string;
  resteAPayer: number;
  totalPris: number;
  totalRembourse: number;
  statut: StatutCredit;
  dateLimite: string | null;
  prises: PriseCredit[];
  remboursements: RemboursementCredit[];
}
export interface CorpsClientCredit {
  nomComplet: string;
  telephone?: string;
  note?: string;
}
export interface CorpsModifClientCredit {
  nomComplet?: string;
  telephone?: string | null;
  note?: string | null;
}
export interface CorpsRemboursement {
  montant: number;
  note?: string;
  verseEnCaisse?: boolean;
}
export interface ResultatRemboursement {
  remboursement: RemboursementCredit & { mouvementCaisseId: string | null };
  resteAPayer: number;
  statut: StatutCredit;
}

export const CODES_ERREUR_CREDIT = [
  "VALIDATION",
  "CLIENT_CREDIT_INTROUVABLE",
  "PRISE_INTROUVABLE",
  "PRISE_ANNULEE",
  "PRISE_SOLDEE",
  "DATE_LIMITE_PASSEE",
  "MONTANT_SUPERIEUR_AU_RESTE",
  "CREDIT_DEJA_SOLDE",
  "CAISSE_NON_OUVERTE",
  "JOURNEE_CLOTUREE",
  "PERMISSION_REFUSEE",
] as const;
export type CodeErreurCredit = (typeof CODES_ERREUR_CREDIT)[number];

/** Code d'erreur métier du crédit, ou null si l'erreur n'en porte pas de connu. */
export function codeErreurCredit(err: unknown): CodeErreurCredit | null {
  if (!(err instanceof ApiError)) return null;
  const code = err.details?.code;
  return CODES_ERREUR_CREDIT.find((c) => c === code) ?? null;
}

const base = (structureId: string) => `/pharmacie/${encodeURIComponent(structureId)}/credits`;

export function listerCredits(
  structureId: string,
  options: { q?: string; statut?: FiltreStatutCredit; page?: number; parPage?: number } = {},
) {
  const params = new URLSearchParams();
  if (options.q !== undefined && options.q.trim() !== "") params.set("q", options.q.trim());
  if (options.statut !== undefined && options.statut !== "TOUS") params.set("statut", options.statut);
  if (options.page !== undefined) params.set("page", String(options.page));
  if (options.parPage !== undefined) params.set("parPage", String(options.parPage));
  const requete = params.toString();
  return authFetch<ListeCredits>(`${base(structureId)}${requete === "" ? "" : `?${requete}`}`);
}

export function getFicheClientCredit(structureId: string, clientId: string) {
  return authFetch<FicheClientCredit>(`${base(structureId)}/clients/${encodeURIComponent(clientId)}`);
}

export function creerClientCredit(structureId: string, corps: CorpsClientCredit) {
  return authFetch<FicheClientCredit>(`${base(structureId)}/clients`, { method: "POST", body: JSON.stringify(corps) });
}

export function modifierClientCredit(structureId: string, clientId: string, corps: CorpsModifClientCredit) {
  return authFetch<FicheClientCredit>(`${base(structureId)}/clients/${encodeURIComponent(clientId)}`, {
    method: "PATCH",
    body: JSON.stringify(corps),
  });
}

/** `dateLimite` null retire la date. */
export function modifierDateLimitePrise(structureId: string, venteId: string, dateLimite: string | null) {
  return authFetch<FicheClientCredit>(`${base(structureId)}/prises/${encodeURIComponent(venteId)}/date-limite`, {
    method: "PATCH",
    body: JSON.stringify({ dateLimite }),
  });
}

export function enregistrerRemboursement(structureId: string, clientId: string, corps: CorpsRemboursement) {
  return authFetch<ResultatRemboursement>(
    `${base(structureId)}/clients/${encodeURIComponent(clientId)}/remboursements`,
    { method: "POST", body: JSON.stringify(corps) },
  );
}
