import { authFetch } from "./api_auth";

export type GroupeSanguin = "A_POSITIF" | "A_NEGATIF" | "B_POSITIF" | "B_NEGATIF" | "AB_POSITIF" | "AB_NEGATIF" | "O_POSITIF" | "O_NEGATIF" | "INCONNU";

export interface ProfilMedical {
  id: string;
  userId: string;
  groupeSanguin: GroupeSanguin;
  allergies: string[];
  pathologies: string[];
  traitements: string[];
  taille: number | null;
  poids: number | null;
  dateNaissance: string | null;
  genre: string | null;
  contactUrgence: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Consultation {
  id: string;
  patientId: string;
  structureId: string | null;
  structure?: { id: string; nom: string; type: string };
  medecinNom: string | null;
  motif: string;
  diagnostic: string | null;
  notes: string | null;
  dateConsultation: string;
  createdAt: string;
  updatedAt: string;
}

export interface Ordonnance {
  id: string;
  patientId: string;
  consultationId: string | null;
  medecinNom: string | null;
  medicaments: string; // JSON string
  notes: string | null;
  dateEmission: string;
  dateExpiration: string | null;
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
  fichierUrl: string | null;
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

export type AppointmentStatus = "PROGRAMME" | "CONFIRME" | "ANNULE" | "TERMINE";

export interface RendezVous {
  id: string;
  patientId: string;
  patient?: { id: string; nom: string; prenom: string };
  medecinId: string;
  medecin?: { id: string; nom: string; prenom: string; specialite: string };
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

export const createConsultation = (data: any) =>
  authFetch<Consultation>("/carnet-sante/consultations", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const getOrdonnances = () => authFetch<Ordonnance[]>("/carnet-sante/ordonnances");

export const createOrdonnance = (data: any) =>
  authFetch<Ordonnance>("/carnet-sante/ordonnances", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const getVaccinations = () => authFetch<Vaccination[]>("/carnet-sante/vaccinations");

export const createVaccination = (data: any) =>
  authFetch<Vaccination>("/carnet-sante/vaccinations", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const getAnalyses = () => authFetch<ResultatAnalyse[]>("/carnet-sante/analyses");

export const createAnalyse = (data: any) =>
  authFetch<ResultatAnalyse>("/carnet-sante/analyses", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const getRendezVous = () => authFetch<RendezVous[]>("/carnet-sante/rendez-vous");

export const createRendezVous = (data: any) =>
  authFetch<RendezVous>("/carnet-sante/rendez-vous", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updateRendezVousStatus = (id: string, status: string) =>
  authFetch<RendezVous>(`/carnet-sante/rendez-vous/${id}/status`, {
    method: "POST",
    body: JSON.stringify({ status }),
  });

export const getAutoDiagnostics = () => authFetch<AutoDiagnostic[]>("/carnet-sante/auto-diagnostics");

export const createAutoDiagnostic = (symptomes: string) =>
  authFetch<AutoDiagnostic>("/carnet-sante/auto-diagnostics", {
    method: "POST",
    body: JSON.stringify({ symptomes }),
  });

// ─── Vue Médecin ─────────────────────────────────────────────

export interface PatientCarnet {
  patient: { id: string; nom: string; prenom: string; email: string; telephone: string };
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
