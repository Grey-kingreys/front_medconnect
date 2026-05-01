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
