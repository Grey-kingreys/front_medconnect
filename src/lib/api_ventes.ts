/**
 * Ventes d'une pharmacie. Contrat aligné sur back_medconnect (orch/lot8-back, vente.controller.ts et vente.service.ts).
 */
import { ApiError, authFetch } from "./api_auth";

export type StatutVente = "VALIDEE" | "ANNULEE";

export type UniteVente = "BOITE" | "UNITE";
export type TypePiece = "VENTE" | "ANNULATION" | "REGULARISATION";

// ANNULATION_HORS_DELAI n'est plus renvoyé par le serveur (PB12) ; retiré par PF04.
export const CODES_ERREUR_VENTE = [
  "PRIX_MANQUANT",
  "ORDONNANCE_NON_CONFIRMEE",
  "STOCK_INTROUVABLE",
  "VALIDATION",
  "VENTE_DEJA_ANNULEE",
  "ANNULATION_HORS_DELAI",
  "VENTE_UNITE_INTERDITE",
  "PRIX_UNITE_MANQUANT",
  "SORTIE_MANUELLE_REQUISE",
  "MOTIF_REQUIS",
  "PAIEMENTS_INCOHERENTS",
  "MODE_PAIEMENT_INCONNU",
  "POSTE_INCONNU",
  "SESSION_AUTRE_UTILISATEUR",
  "STOCK_LOT_NEGATIF",
  "FICHE_MODIFIEE",
  "JOURNEE_CLOTUREE",
  "PIECE_NON_ANNULABLE",
] as const;
export type CodeErreurVente = (typeof CODES_ERREUR_VENTE)[number];

export interface LigneVenteDemandee {
  stockId: string;
  quantite: number;
  unite?: UniteVente;
  sortieManuelle?: { lotId: string; motif: string };
}
export interface PaiementDemande {
  mode: string;
  montant: number;
  reference?: string;
  montantRecu?: number;
}
export interface CorpsCreationVente {
  lignes: LigneVenteDemandee[];
  paiements?: PaiementDemande[];
  clientNom?: string;
  clientTelephone?: string;
  ordonnanceVerifiee?: boolean;
}
export interface AllocationVente {
  lotId: string | null;
  numeroLot: string | null;
  dateExpiration: string | null;
  quantite: number;
  statut: "DEFINITIVE" | "PROVISOIRE" | "REMPLACEE";
  sortieManuelle: boolean;
  motif: string | null;
  lotTechnique: boolean;
  coutUnitaire?: number | null;
}
export interface LigneVente {
  id: string;
  stockId: string;
  medicamentId: string;
  nomMedicament: string;
  /** `quantite` et `prixUnitaire` sont en unités minimales ; `sousTotal` fait foi. */
  prixUnitaire: number;
  quantite: number;
  sousTotal: number;
  // Facultatifs pour que les fixtures existantes compilent ; toujours présents dans la réponse du serveur.
  uniteAffichee?: UniteVente;
  nombreAffiche?: number;
  coefficientApplique?: number;
  allocations?: AllocationVente[];
}
export interface PaiementVente {
  id: string;
  mode: string;
  libelle: string;
  montant: number;
  reference: string | null;
  montantRecu: number | null;
  rendu: number | null;
}
export interface AnnulationPiece {
  id: string;
  numero: string;
  motif: string | null;
  le: string;
  par: { id: string; nom: string };
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
  // Facultatifs pour que les fixtures existantes compilent ; toujours présents dans la réponse du serveur.
  typePiece?: TypePiece;
  /** Numéro de ticket du poste (entier, null pour une pièce d'annulation) ; le numéro lisible est `numero`. */
  numeroTicket?: number | null;
  jourMetier?: string;
  provisoire?: boolean;
  poste?: { id: string; code: string };
  session?: { id: string; ouverteAutomatiquement: boolean };
  paiements?: PaiementVente[];
  annulation?: AnnulationPiece | null;
  venteOrigine?: { id: string; numero: string } | null;
  motif?: string | null;
  /** Vrai quand la même clé a déjà servi : vente renvoyée sans second retrait du stock. */
  rejeu?: boolean;
}
export interface VenteResume {
  id: string;
  numero: string;
  createdAt: string;
  statut: StatutVente;
  /** Négatif pour une annulation. */
  total: number;
  /** Somme des quantités en unités minimales. */
  nombreArticles: number;
  vendeur: VendeurVente;
  clientNom: string | null;
  // Facultatifs pour que les fixtures existantes compilent ; toujours présents dans la réponse du serveur.
  typePiece?: TypePiece;
  /** Numéro de ticket du poste (entier, null pour une pièce d'annulation) ; le numéro lisible est `numero`. */
  numeroTicket?: number | null;
  jourMetier?: string;
  venteOrigine?: { id: string; numero: string } | null;
  annulation?: { id: string; numero: string } | null;
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
/** Lot périmé cité par une erreur SORTIE_MANUELLE_REQUISE. */
export interface LotErreurVente {
  lotId: string;
  numeroLot: string | null;
  dateExpiration: string | null;
  quantite: number;
}
/** Ligne citée par une erreur de vente (STOCK_INTROUVABLE, PRIX_MANQUANT, ORDONNANCE_NON_CONFIRMEE, SORTIE_MANUELLE_REQUISE...). */
export interface LigneErreurVente {
  stockId: string;
  nom?: string;
  disponible?: number;
  demande?: number;
  lots?: LotErreurVente[];
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
    if (Array.isArray(element.lots)) {
      const lots: LotErreurVente[] = [];
      for (const lot of element.lots as unknown[]) {
        if (!estObjet(lot)) continue;
        const { lotId, numeroLot, dateExpiration, quantite } = lot;
        if (typeof lotId !== "string" || lotId === "") continue;
        if (typeof quantite !== "number" || !Number.isInteger(quantite)) continue;
        if (numeroLot !== null && typeof numeroLot !== "string") continue;
        if (dateExpiration !== null && typeof dateExpiration !== "string") continue;
        lots.push({ lotId, numeroLot, dateExpiration, quantite });
      }
      ligne.lots = lots;
    }
    lignes.push(ligne);
  }
  return lignes;
}
