/**
 * Appareils connectés au compte (un appareil = une connexion ouverte).
 */
import { authFetch } from "./api_auth";

export interface AppareilConnecte {
  id: string;
  type: "web" | "mobile";
  /** Nom lisible fourni par le serveur (« Chrome sur Windows », « iPhone ») */
  nom: string;
  /** "web", "ios", "android" ou "inconnue" */
  plateforme: string;
  versionApp: string | null;
  creeLe: string;
  derniereActivite: string;
  expireLe: string;
  /** Vrai pour l'appareil qui fait la demande */
  appareilCourant: boolean;
}

export async function getAppareilsConnectes() {
  return authFetch<AppareilConnecte[]>("/auth/sessions");
}

export async function deconnecterAppareil(id: string) {
  return authFetch<{ id: string }>(`/auth/sessions/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function deconnecterAutresAppareils() {
  return authFetch<{ nombre: number }>("/auth/sessions/revoquer-autres", { method: "POST" });
}
