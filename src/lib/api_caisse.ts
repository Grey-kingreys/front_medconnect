/**
 * Caisse d'une pharmacie. Contrat aligné sur back_medconnect (orch/pharmacie-t1-back, CLAUDE.md puces PB05 et PB10).
 */
import { authFetch } from "./api_auth";

export interface ModePaiement {
  code: string;
  libelle: string;
  comptagePhysique: boolean;
  referenceAutorisee: boolean;
  ordre: number;
}
export interface Coupure {
  devise: string;
  valeurFaciale: number;
  type: string;
  ordre: number;
}
export interface ParametresPharmacie {
  horizonsPeremptionJours: number[];
  seuilEcartCaisse: number;
  seuilAvertissementPrixPct: number;
  seuilStockBas: number;
  taillePlageTickets: number;
  seuilRechargementPlagePct: number;
  debutCaisse: string;
}
export interface Referentiels {
  modesPaiement: ModePaiement[];
  coupures: Coupure[];
  parametres: ParametresPharmacie;
}
export interface Poste {
  id: string;
  code: string;
  libelle: string;
  type: "WEB" | "DESKTOP";
  cree?: boolean;
}
export interface ComptageCaisse {
  id: string;
  moment: "OUVERTURE" | "FERMETURE";
  totalEspeces: number;
  coupures: { valeurFaciale: number; nombre: number }[];
  releves: { mode: string; libelle: string; montant: number }[];
  auteurId: string;
  createdAt: string;
}
export interface SessionCaisse {
  id: string;
  poste: { id: string; code: string; libelle: string; type: "WEB" | "DESKTOP" };
  utilisateurId: string;
  utilisateurNom: string;
  statut: "OUVERTE" | "FERMEE" | "INCLUSE_DANS_CLOTURE";
  jourMetier: string;
  ouverteLe: string;
  fermeeLe: string | null;
  commentaireEcart: string | null;
  fondCaisse: number;
  fondCompte: boolean;
  comptageOuverture: ComptageCaisse | null;
  comptageFermeture: ComptageCaisse | null;
}

export function getReferentiels(structureId: string) {
  return authFetch<Referentiels>(`/pharmacie/${encodeURIComponent(structureId)}/referentiels`);
}

/** Poste web par défaut de l'utilisateur, le même que celui de la vente (D692). */
export function assurerPosteWeb(structureId: string, utilisateurId: string) {
  return authFetch<Poste>(`/pharmacie/${encodeURIComponent(structureId)}/postes`, {
    method: "POST",
    body: JSON.stringify({ type: "WEB", appareilId: `web-defaut:${utilisateurId}` }),
  });
}

export function getSessionCourante(structureId: string, posteId: string) {
  return authFetch<SessionCaisse | null>(
    `/pharmacie/${encodeURIComponent(structureId)}/caisse/sessions/courante?posteId=${encodeURIComponent(posteId)}`,
  );
}
