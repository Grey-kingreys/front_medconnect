/**
 * MedConnect Admin API
 *
 * Fonctions pour les routes ADMIN / SUPER_ADMIN
 * - Statistiques globales (super-admin)
 * - Gestion des structures (super-admin)
 * - Gestion des utilisateurs (admin + super-admin)
 */

import { ApiError, ApiResponse, authFetch, apiFetch } from "./api_auth";
export { ApiError } from "./api_auth";

// ─── Types ──────────────────────────────────────────────────────

export type StructureType = "HOPITAL" | "CLINIQUE" | "PHARMACIE";

export interface Structure {
  id: string;
  nom: string;
  type: StructureType;
  email: string;
  telephone?: string;
  adresse?: string;
  ville?: string;
  latitude?: number;
  longitude?: number;
  description?: string;
  horaires?: string;
  estDeGarde: boolean;
  isActive: boolean;
  isConfigured: boolean;
  admin?: { id: string; nom: string; prenom: string; email: string };
  membres?: Array<{ id: string; nom: string; prenom: string; role: string; isActive: boolean }>;
  _count?: { membres: number };
  createdAt: string;
  updatedAt: string;
}

export interface CreateStructurePayload {
  nom: string;
  type: StructureType;
  email: string;
  telephone?: string;
  adresse?: string;
  ville?: string;
  latitude?: number;
  longitude?: number;
  horaires?: string;
  estDeGarde?: boolean;
}

export interface GlobalStats {
  totalUsers: number;
  totalStructures: number;
  structuresConfigurees: number;
  structuresEnAttente: number;
  parType: Array<{ type: StructureType; _count: number }>;
}

export interface UserStats {
  total: number;
  actifs: number;
  inactifs: number;
  parRole: Array<{ role: string; _count: number }>;
}

export interface AdminUser {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  role: string;
  isActive: boolean;
  telephone?: string;
  dateNaissance?: string;
  taille?: number;
  poids?: number;
  structureId?: string;
  structure?: { id: string; nom: string; type: string };
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserPayload {
  nom: string;
  prenom: string;
  email: string;
  password: string;
  role: string;
  telephone?: string;
  specialite?: string;
}

// ─── Super-Admin : Stats globales ───────────────────────────────

export async function getGlobalStats() {
  return authFetch<GlobalStats>("/super-admin/stats");
}

// ─── Super-Admin : Structures ────────────────────────────────────

export async function getStructures() {
  return authFetch<Structure[]>("/super-admin/structures");
}

export async function getStructure(id: string) {
  return authFetch<Structure>(`/super-admin/structures/${id}`);
}

export async function createStructure(data: CreateStructurePayload) {
  return authFetch<Structure>("/super-admin/structures", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function toggleStructureActive(id: string) {
  return authFetch<{ id: string; nom: string; isActive: boolean }>(
    `/super-admin/structures/${id}/toggle-active`,
    { method: "PATCH" }
  );
}

export async function resendStructureInvitation(id: string) {
  return authFetch<null>(
    `/super-admin/structures/${id}/resend-invitation`,
    { method: "POST" }
  );
}

export async function deleteStructure(id: string) {
  return authFetch<null>(
    `/super-admin/structures/${id}/delete`,
    { method: "POST" }
  );
}

// ─── Admin : Utilisateurs ────────────────────────────────────────

export async function getUsers() {
  return authFetch<AdminUser[]>("/users");
}

export async function getUserStats() {
  return authFetch<UserStats>("/users/stats");
}

export async function createUser(data: CreateUserPayload) {
  return authFetch<AdminUser>("/users", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function toggleUserActive(userId: string) {
  return authFetch<{ id: string; isActive: boolean }>(
    `/users/${userId}/toggle-active`,
    { method: "PATCH" }
  );
}

export async function deleteUser(userId: string) {
  return authFetch<null>(`/users/${userId}`, { method: "DELETE" });
}
