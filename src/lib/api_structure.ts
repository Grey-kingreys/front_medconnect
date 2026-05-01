/**
 * MedConnect Structure API
 * Pour les STRUCTURE_ADMIN : gestion de leur structure et de leurs membres
 */

import { ApiError, ApiResponse } from "./api_auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

// ─── Helpers ────────────────────────────────────────────────────

async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const body = await res.json();
  if (!res.ok) {
    const msg = typeof body.message === "string" ? body.message : Array.isArray(body.message) ? body.message[0] : "Erreur";
    throw new ApiError(msg, res.status);
  }
  return body as ApiResponse<T>;
}

async function authFetch<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const getToken = () => typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
  const doFetch = (token: string | null) => apiFetch<T>(endpoint, {
    ...options,
    headers: { ...options.headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });

  try {
    return await doFetch(getToken());
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      try {
        const rt = typeof window !== "undefined" ? localStorage.getItem("refresh_token") : null;
        if (!rt) throw new ApiError("Pas de refresh token", 401);
        const r = await apiFetch<{ access_token: string; refresh_token: string }>("/auth/refresh", {
          method: "POST", body: JSON.stringify({ refresh_token: rt }),
        });
        if (typeof window !== "undefined") {
          localStorage.setItem("access_token", r.data.access_token);
          localStorage.setItem("refresh_token", r.data.refresh_token);
        }
        return await doFetch(r.data.access_token);
      } catch {
        if (typeof window !== "undefined") {
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
          localStorage.removeItem("user");
        }
        throw new ApiError("Session expirée. Veuillez vous reconnecter.", 401);
      }
    }
    throw err;
  }
}

// ─── Structures Publiques ───────────────────────────────────────

export async function getAllStructures() {
  return apiFetch<MyStructure[]>("/structures/all");
}

export async function getPublicStructureDetails(id: string) {
  return apiFetch<MyStructure>(`/structures/public/${id}`);
}

// ─── Types ──────────────────────────────────────────────────────

export type MembreRole = "MEDECIN" | "PHARMACIEN" | "STRUCTURE_ADMIN";

export interface Membre {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  telephone?: string;
  role: MembreRole;
  isActive: boolean;
  specialite?: string;
  createdAt: string;
}

export interface MyStructure {
  id: string;
  nom: string;
  type: "HOPITAL" | "CLINIQUE" | "PHARMACIE";
  email: string;
  telephone?: string;
  adresse?: string;
  ville?: string;
  description?: string;
  latitude?: number;
  longitude?: number;
  horaires?: string;
  estDeGarde?: boolean;
  estOuvertManuel?: boolean | null;
  isActive: boolean;
  isConfigured: boolean;
  admin?: { id: string; nom: string; prenom: string; email: string; telephone?: string };
  membres: Membre[];
  createdAt: string;
  updatedAt: string;
}

export interface UpdateStructurePayload {
  nom?: string;
  adresse?: string;
  ville?: string;
  telephone?: string;
  description?: string;
  latitude?: number;
  longitude?: number;
  horaires?: string;
  estDeGarde?: boolean;
  estOuvertManuel?: boolean | null;
}

export interface CreateMembrePayload {
  nom: string;
  prenom: string;
  email: string;
  role: MembreRole;
  telephone?: string;
  specialite?: string;
}

// ─── Structure Admin : Ma Structure ─────────────────────────────

export async function getMyStructure() {
  return authFetch<MyStructure>("/structures/my");
}

export async function updateMyStructure(data: UpdateStructurePayload) {
  return authFetch<MyStructure>("/structures/my", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

// ─── Structure Admin : Setup ──────────────────────────────────────

export interface SetupStructurePayload {
  nom: string;
  prenom: string;
  telephone: string;
  password: string;
  structureNom: string;
  adresse: string;
  ville: string;
  structureTelephone?: string;
  description?: string;
}

export async function verifyInviteToken(token: string) {
  return apiFetch<MyStructure>(`/structures/setup/${token}`);
}

export async function setupStructure(token: string, data: SetupStructurePayload) {
  return apiFetch<{ access_token: string; refresh_token: string; user: any }>(`/structures/setup/${token}`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ─── Structure Admin : Membres ───────────────────────────────────

export async function getMembres(structureId: string) {
  return authFetch<Membre[]>(`/structures/${structureId}/membres`);
}

export async function createMembre(structureId: string, data: CreateMembrePayload) {
  return authFetch<Membre>(`/structures/${structureId}/membres`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function toggleMembreActive(structureId: string, membreId: string) {
  return authFetch<{ id: string; nom: string; prenom: string; role: string; isActive: boolean }>(
    `/structures/${structureId}/membres/${membreId}/toggle-active`,
    { method: "PATCH" }
  );
}

export async function deleteMembre(structureId: string, membreId: string) {
  return authFetch<null>(
    `/structures/${structureId}/membres/${membreId}/delete`,
    { method: "POST" }
  );
}

// ─── Super Admin : create SUPER_ADMIN ───────────────────────────

export interface CreateSuperAdminPayload {
  nom: string;
  prenom: string;
  email: string;
  password: string;
  telephone?: string;
}

export async function createSuperAdmin(data: CreateSuperAdminPayload) {
  return authFetch<{ id: string; email: string; nom: string; prenom: string; role: string }>(
    "/super-admin/create-super-admin",
    { method: "POST", body: JSON.stringify(data) }
  );
}

export { ApiError };
