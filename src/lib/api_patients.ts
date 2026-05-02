import { authFetch } from "./api_auth";

export interface PatientSummary {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  derniereConsultation: string;
  dernierMotif: string;
  profilMedical?: {
    groupeSanguin: string;
    allergies: string[];
  };
}

export async function getMyPatients() {
  return authFetch<PatientSummary[]>("/users/patients/my");
}

export async function autoriserStructure(structureId: string) {
  return authFetch<any>(`/users/patient/autoriser-structure/${structureId}`, { method: 'POST' });
}

export async function designerMedecin(medecinId: string) {
  return authFetch<any>(`/users/patient/designer-medecin/${medecinId}`, { method: 'POST' });
}

export async function getAutorisations() {
  return authFetch<any>("/users/patient/autorisations");
}
