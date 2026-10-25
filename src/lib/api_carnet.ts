import { authFetch } from "./api_auth";
import type { PositionMesuree } from "./geolocalisation";
import {
  analyseSchema,
  consultationSchema,
  ordonnanceSchema,
  rendezVousSchema,
  vaccinationSchema,
  validerEnvoi,
  type AnalyseInput,
  type ConsultationInput,
  type OrdonnanceInput,
  type RendezVousInput,
  type VaccinationInput,
} from "./schemas/carnet";

export type GroupeSanguin = "A_POSITIF" | "A_NEGATIF" | "B_POSITIF" | "B_NEGATIF" | "AB_POSITIF" | "AB_NEGATIF" | "O_POSITIF" | "O_NEGATIF" | "INCONNU";

export interface ProfilMedical {
  id: string;
  userId: string;
  groupeSanguin: GroupeSanguin;
  allergies: string;
  pathologies: string;
  traitements: string;
  taille: number | null;
  poids: number | null;
  dateNaissance: string | null;
  genre: string | null;
  contactNom: string | null;
  contactTelephone: string | null;
  contactEmail: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Urgence {
  id: string;
  patientId: string;
  latitude?: number;
  longitude?: number;
  message?: string;
  status: 'LANCE' | 'PRIS_EN_CHARGE' | 'TERMINE' | 'ANNULE';
  createdAt: string;
  // Prise en charge (F5)
  structurePriseEnChargeId?: string | null;
  priseEnChargeAt?: string | null;
  delaiArriveeMinutes?: number | null;
  // Renseignés par GET /carnet-sante/sos/en-cours
  structurePriseEnCharge?: { id: string; nom: string } | null;
  finDelaiAt?: string | null;
  peutRelancerA?: string | null;
  // Renseignés par POST /carnet-sante/sos : ce qui a réellement été prévenu
  structuresAlertees?: number;
  soignantsAlertes?: number;
  procheAlerte?: boolean;
  positionTransmise?: boolean;
}

export interface Consultation {
  id: string;
  patientId: string;
  patientNom?: string;       // Rempli quand c'est le médecin qui consulte sa liste
  structureId: string | null;
  structure?: { id: string; nom: string; type: string };
  medecinNom: string | null;
  motif: string;
  diagnostic: string | null;
  notes: string | null;
  dateConsultation: string;
  ordonnances?: Ordonnance[];
  createdAt: string;
  updatedAt: string;
}

export interface Ordonnance {
  id: string;
  patientId: string;
  consultationId: string | null;
  consultation?: Consultation;
  medecinNom: string | null;
  medicaments: string; // JSON string
  notes: string | null;
  dateEmission: string;
  dateExpiration: string | null;
  /** Ordonnance scannée (StoredFile privé) : lecture via /storage/:id/read-url. */
  scanFileId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Vaccination {
  id: string;
  patientId: string;
  vaccin: string;
  dateVaccin: string;
  prochainRappel: string | null;
  lotNumero: string | null;
  administrePar: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ResultatAnalyse {
  id: string;
  patientId: string;
  typeAnalyse: string;
  laboratoire: string | null;
  resultats: string;
  /** @deprecated ancienne URL brute, remplacée par documentFileId. */
  fichierUrl: string | null;
  /** Document d'analyse (StoredFile privé) : lecture via /storage/:id/read-url. */
  documentFileId: string | null;
  dateAnalyse: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AutoDiagnostic {
  id: string;
  patientId: string;
  symptomes: string;
  analyseia: string | null;
  recommendation: string | null;
  createdAt: string;
}

export type AppointmentStatus = "PROGRAMME" | "CONFIRME" | "ANNULE" | "TERMINE" | "EN_ATTENTE" | "REFUSE";

export interface RendezVous {
  id: string;
  patientId: string;
  patient?: { id: string; nom: string; prenom: string };
  medecinId?: string | null;
  medecin?: { id: string; nom: string; prenom: string; specialite: string } | null;
  structureId: string | null;
  structure?: { id: string; nom: string };
  date: string;
  motif: string;
  notes: string | null;
  status: AppointmentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CarnetResume {
  profil: ProfilMedical | null;
  stats: {
    consultations: number;
    ordonnances: number;
    analyses: number;
    vaccinations: number;
  };
}

// ─── Endpoints ──────────────────────────────────────────────────

export const getCarnetResume = () => authFetch<CarnetResume>("/carnet-sante");

export const getProfilMedical = () => authFetch<ProfilMedical>("/carnet-sante/profil-medical");

export const upsertProfilMedical = (data: Partial<ProfilMedical>) => 
  authFetch<ProfilMedical>("/carnet-sante/profil-medical", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const getConsultations = () => authFetch<Consultation[]>("/carnet-sante/consultations");

export const createConsultation = async (data: ConsultationInput) => {
  validerEnvoi(consultationSchema, data);
  return authFetch<Consultation>("/carnet-sante/consultations", {
    method: "POST",
    body: JSON.stringify(data),
  });
};

export const getOrdonnances = () => authFetch<Ordonnance[]>("/carnet-sante/ordonnances");

/** Ligne de médicament d'une ordonnance. `medicamentId` n'est présent que si la ligne est liée au catalogue. */
export interface LigneMedicament {
  nom: string;
  dosage: string;
  duree: string;
  instructions?: string;
  medicamentId?: string;
}

export const createOrdonnance = async (data: OrdonnanceInput) => {
  validerEnvoi(ordonnanceSchema, data);
  return authFetch<Ordonnance>("/carnet-sante/ordonnances", {
    method: "POST",
    body: JSON.stringify(data),
  });
};

export const getVaccinations = () => authFetch<Vaccination[]>("/carnet-sante/vaccinations");

export const createVaccination = async (data: VaccinationInput) => {
  validerEnvoi(vaccinationSchema, data);
  return authFetch<Vaccination>("/carnet-sante/vaccinations", {
    method: "POST",
    body: JSON.stringify(data),
  });
};

export const getAnalyses = () => authFetch<ResultatAnalyse[]>("/carnet-sante/analyses");

/** Champs de position acceptés par POST /carnet-sante/sos (contrat B6, rétrocompatible). */
export type PositionSos = PositionMesuree;

export const createUrgence = (data: Partial<PositionSos> & { message?: string }, cleIdempotence: string) =>
  authFetch<Urgence>("/carnet-sante/sos", {
    method: "POST",
    body: JSON.stringify(data),
    headers: { "Idempotency-Key": cleIdempotence },
  });

/**
 * Clé d'idempotence d'une alerte SOS (UUID v4). crypto.randomUUID n'existe qu'en HTTPS :
 * sinon UUID v4 construit avec crypto.getRandomValues.
 */
export function nouvelleCleIdempotence(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const octets = crypto.getRandomValues(new Uint8Array(16));
  octets[6] = (octets[6] & 0x0f) | 0x40;
  octets[8] = (octets[8] & 0x3f) | 0x80;
  const hex = Array.from(octets, (o) => o.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export const getActiveUrgences = () => authFetch<Urgence[]>("/carnet-sante/sos/actives");

export const takeChargeSOS = (id: string, delaiArriveeMinutes: number) =>
  authFetch<Urgence>(`/carnet-sante/sos/${id}/take-charge`, {
    method: "POST",
    body: JSON.stringify({ delaiArriveeMinutes }),
  });

/** Dernière alerte SOS active du patient connecté (null si aucune). */
export const getMonAlerteEnCours = () => authFetch<Urgence | null>("/carnet-sante/sos/en-cours");

export const createAnalyse = async (data: AnalyseInput) => {
  validerEnvoi(analyseSchema, data);
  return authFetch<ResultatAnalyse>("/carnet-sante/analyses", {
    method: "POST",
    body: JSON.stringify(data),
  });
};

export const getRendezVous = () => authFetch<RendezVous[]>("/carnet-sante/rendez-vous");

export const createRendezVous = async (data: RendezVousInput) => {
  validerEnvoi(rendezVousSchema, data);
  return authFetch<RendezVous>("/carnet-sante/rendez-vous", {
    method: "POST",
    body: JSON.stringify(data),
  });
};

export const updateRendezVousStatus = (id: string, status: string) =>
  authFetch<RendezVous>(`/carnet-sante/rendez-vous/${id}/status`, {
    method: "POST",
    body: JSON.stringify({ status }),
  });

/** Médecin : valider une proposition de RDV en attente (l'affecte à lui si « structure »). */
export const validerRendezVous = (id: string) =>
  authFetch<RendezVous>(`/carnet-sante/rendez-vous/${id}/valider`, { method: "POST" });

/** Médecin : refuser une proposition de RDV en attente. */
export const refuserRendezVous = (id: string) =>
  authFetch<RendezVous>(`/carnet-sante/rendez-vous/${id}/refuser`, { method: "POST" });

export const getAutoDiagnostics = () => authFetch<AutoDiagnostic[]>("/carnet-sante/auto-diagnostics");

export const createAutoDiagnostic = (symptomes: string) =>
  authFetch<AutoDiagnostic>("/carnet-sante/auto-diagnostics", {
    method: "POST",
    body: JSON.stringify({ symptomes }),
  });

// ─── Vue Médecin ─────────────────────────────────────────────

export interface PatientCarnet {
  patient: { id: string; nom: string; prenom: string; email: string; telephone: string; dateNaissance?: string; taille?: number; poids?: number };
  isMedecinTraitant: boolean;
  profil: ProfilMedical | null;
  consultations: Consultation[];
  ordonnances: Ordonnance[];
  analyses: ResultatAnalyse[];
  vaccinations: Vaccination[];
  stats: { consultations: number; ordonnances: number; analyses: number; vaccinations: number };
}

export const getPatientCarnet = (patientId: string) =>
  authFetch<PatientCarnet>(`/carnet-sante/patient/${patientId}`);

export const getAiFirstAid = (question: string) =>
  authFetch<{ tag: string; reponse: string; similarite: number; certain: boolean }>("/carnet-sante/sos/ai-instructions", {
    method: "POST",
    body: JSON.stringify({ question }),
  });
