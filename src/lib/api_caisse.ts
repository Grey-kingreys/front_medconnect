/**
 * Caisse d'une pharmacie. Contrat aligné sur back_medconnect (orch/pharmacie-t1-back, CLAUDE.md puces PB05 et PB10).
 */
import { authDownload, authFetch } from "./api_auth";
import { listerAnomalies } from "./api_pilotage";

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

export interface LigneComptage {
  valeurFaciale: number;
  nombre: number;
}
export type SessionCaisseOuverte = SessionCaisse & { cree: boolean; ouverteMaintenant: boolean };

export type TypeMouvementCaisse = "PRELEVEMENT" | "APPORT" | "REMBOURSEMENT";
export interface MouvementCaisse {
  id: string;
  type: TypeMouvementCaisse;
  mode: string;
  montant: number;
  motif: string;
  auteurId: string;
  horodatageServeur: string;
}
export interface BilanCaisse {
  activite: {
    nombreVentes: number;
    nombreAnnulations: number;
    montantEncaisse: number;
    parMode: { mode: string; libelle: string; montant: number; nombrePaiements: number }[];
  };
  session: SessionCaisse;
  fond: { montant: number; compte: boolean };
  mouvements: MouvementCaisse[];
  theorique: { mode: string; libelle: string; montant: number }[];
  compte: { mode: string; libelle: string; montant: number | null }[];
  ecarts: { mode: string; libelle: string; ecart: number | null }[];
  ecartEspeces: number | null;
  seuilEcartCaisse: number;
  commentaireRequis: boolean;
  fige: boolean;
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

/** Ouvre la caisse du poste, avec ou sans comptage du fond. Rejouable avec le même `id` (D688). */
export function ouvrirSession(
  structureId: string,
  corps: { id: string; posteId: string; comptage?: { coupures: LigneComptage[] } },
) {
  return authFetch<SessionCaisseOuverte>(`/pharmacie/${encodeURIComponent(structureId)}/caisse/sessions`, {
    method: "POST",
    body: JSON.stringify(corps),
  });
}

/** Enregistre un comptage par coupure (fond à l'ouverture, caisse à la fermeture). */
export function saisirComptage(
  structureId: string,
  sessionId: string,
  corps: {
    id: string;
    moment: "OUVERTURE" | "FERMETURE";
    coupures: LigneComptage[];
    releves?: { mode: string; montant: number }[];
  },
) {
  return authFetch<ComptageCaisse>(
    `/pharmacie/${encodeURIComponent(structureId)}/caisse/sessions/${encodeURIComponent(sessionId)}/comptages`,
    { method: "POST", body: JSON.stringify(corps) },
  );
}

/** Prélèvement, apport ou remboursement d'espèces ou d'un autre mode. Rejouable avec le même `id` (D688). */
export function enregistrerMouvement(
  structureId: string,
  sessionId: string,
  corps: { id: string; type: TypeMouvementCaisse; montant: number; motif: string; mode?: string },
) {
  return authFetch<MouvementCaisse>(
    `/pharmacie/${encodeURIComponent(structureId)}/caisse/sessions/${encodeURIComponent(sessionId)}/mouvements`,
    { method: "POST", body: JSON.stringify(corps) },
  );
}

/** Bilan d'une caisse : activité du vendeur d'abord, puis attendu, compté et écart. */
export function getBilan(structureId: string, sessionId: string) {
  return authFetch<BilanCaisse>(
    `/pharmacie/${encodeURIComponent(structureId)}/caisse/sessions/${encodeURIComponent(sessionId)}/bilan`,
  );
}

/** Caisse d'une journée, telle que la liste la préparation de la clôture. */
export interface SessionResume {
  id: string;
  posteId: string;
  posteCode: string;
  posteLibelle: string;
  posteType: "WEB" | "DESKTOP";
  utilisateurId: string;
  utilisateurNom: string;
  statut: "OUVERTE" | "FERMEE" | "INCLUSE_DANS_CLOTURE";
  ouverteLe: string;
  fermeeLe: string | null;
}
/** Poste qu'il faut attendre avant de clôturer ; `message` est rédigé par le serveur. */
export interface PosteAttendu {
  posteId: string;
  posteCode: string;
  libelle: string;
  type: "WEB" | "DESKTOP";
  raison: string;
  sessionId: string | null;
  utilisateurNom: string | null;
  dernierContactLe: string | null;
  message: string;
}
/** Poste manquant consigné dans une clôture forcée. */
export type PosteManquant = Omit<PosteAttendu, "message">;
export interface TotalCloture {
  mode: string;
  libelle: string;
  theorique: number;
  compte: number | null;
  ecart: number | null;
  /** Absent d'une clôture déjà faite : présent seulement dans la préparation. */
  sessionsNonRapprochees?: number;
}
export interface Cloture {
  id: string;
  jour: string;
  clotureeLe: string;
  clotureParId: string;
  clotureParNom: string | null;
  forcee: boolean;
  motifForcage: string | null;
  postesManquants: PosteManquant[];
  nombreSessions: number;
  totaux: TotalCloture[];
}
export interface PreparationCloture {
  jour: string;
  cloture: Cloture | null;
  sessions: SessionResume[];
  sessionsOuvertes: SessionResume[];
  postesAttendus: PosteAttendu[];
  totaux: TotalCloture[];
  peutCloturer: boolean;
  peutForcer: boolean;
}
/** Somme arrivée après une clôture ou la fermeture d'une caisse, non comptée par les totaux. */
export interface RemonteeApresCloture {
  id: string;
  libelle: string;
  creeLe: string;
  details: { message?: string } & Record<string, unknown>;
}

export function getPreparationCloture(structureId: string, jour: string) {
  return authFetch<PreparationCloture>(
    `/pharmacie/${encodeURIComponent(structureId)}/caisse/clotures/${encodeURIComponent(jour)}/preparation`,
  );
}

/** Clôture la journée. Jamais renvoyée automatiquement : l'issue d'une erreur réseau est inconnue. */
export function cloturerJournee(structureId: string, corps: { jour: string; forcer?: true; motifForcage?: string }) {
  return authFetch<Cloture>(`/pharmacie/${encodeURIComponent(structureId)}/caisse/clotures`, {
    method: "POST",
    body: JSON.stringify(corps),
  });
}

/** Clôtures d'un mois (AAAA-MM). */
export function listerClotures(structureId: string, mois: string) {
  return authFetch<{ mois: string; clotures: Cloture[] }>(
    `/pharmacie/${encodeURIComponent(structureId)}/caisse/clotures?mois=${encodeURIComponent(mois)}`,
  );
}

/** Fichier d'une journée clôturée, rendu tel que reçu (BOM et apostrophes de neutralisation compris, D702). */
export async function exporterCloture(structureId: string, jour: string): Promise<{ blob: Blob; filename: string }> {
  const { blob, filename } = await authDownload(
    `/pharmacie/${encodeURIComponent(structureId)}/caisse/clotures/${encodeURIComponent(jour)}/export`,
  );
  return { blob, filename: filename ?? `cloture-${jour}.csv` };
}

/** Anomalies ouvertes « somme arrivée après une clôture » (`anomalie:gerer`). */
export async function listerRemonteesApresCloture(
  structureId: string,
): Promise<{ anomalies: RemonteeApresCloture[]; total: number }> {
  const res = await listerAnomalies(structureId, { type: "REMONTEE_APRES_CLOTURE", statut: "OUVERTE" });
  const { anomalies, total } = res.data as { anomalies: RemonteeApresCloture[]; total?: number };
  // Le serveur pagine : `total` dit combien d'anomalies existent, pas seulement combien sont renvoyées.
  return { anomalies, total: typeof total === "number" ? total : anomalies.length };
}

/** Ferme la caisse et renvoie le bilan figé. Rejouable avec le même `id` de comptage (D688). */
export function fermerSession(
  structureId: string,
  sessionId: string,
  corps: {
    comptageFermeture: { id: string; coupures: LigneComptage[]; releves?: { mode: string; montant: number }[] };
    commentaire?: string;
  },
) {
  return authFetch<BilanCaisse>(
    `/pharmacie/${encodeURIComponent(structureId)}/caisse/sessions/${encodeURIComponent(sessionId)}/fermer`,
    { method: "POST", body: JSON.stringify(corps) },
  );
}
