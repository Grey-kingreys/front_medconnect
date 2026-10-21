/**
 * Contexte d'accès de l'utilisateur connecté (rôle, type de structure, permissions)
 * et signal de refus d'accès envoyé par le serveur.
 */
import type { StructureType } from "./api_admin";
import { ApiError } from "./api_auth";
import type { AuthUser, UserProfile } from "./api_auth";

export type RoleUtilisateur =
  | "PATIENT"
  | "MEDECIN"
  | "PHARMACIEN"
  | "STRUCTURE_ADMIN"
  | "ACCUEIL"
  | "ADMIN"
  | "SUPER_ADMIN";

// Miroir du catalogue du serveur (back_medconnect/src/common/rbac/permissions.constants.ts)
export type CodePermission =
  | "carnet:read"
  | "consultation:write"
  | "ordonnance:write"
  | "analyse:write"
  | "vaccination:write"
  | "rendezvous:write"
  | "patient:read"
  | "sos:respond"
  | "stock:read"
  | "stock:write"
  | "catalogue:write"
  | "catalogue:manage"
  | "structure:read"
  | "structure:write"
  | "membre:read"
  | "membre:manage"
  | "role:manage"
  | "chat:structure"
  | "user:admin"
  | "platform:structures"
  | "platform:admin";

export interface ContexteAcces {
  mode: "permissions" | "repli";
  role: string;
  typeStructure: StructureType | null;
  permissions: ReadonlySet<string>;
}

export function lireContexteAcces(user: Pick<AuthUser, "role">, profile: UserProfile | null): ContexteAcces {
  if (profile !== null && Array.isArray(profile.permissions) && profile.structureType !== undefined) {
    const type = profile.structureType;
    return {
      mode: "permissions",
      role: user.role,
      typeStructure: type === "HOPITAL" || type === "CLINIQUE" || type === "PHARMACIE" ? type : null,
      permissions: new Set(profile.permissions),
    };
  }
  return {
    mode: "repli",
    role: user.role,
    typeStructure: user.role === "PHARMACIEN" ? "PHARMACIE" : null,
    permissions: new Set<string>(),
  };
}

export const EVENEMENT_ACCES_REFUSE = "mc:acces-refuse";

export function estPermissionRefusee(err: unknown): boolean {
  return err instanceof ApiError && err.status === 403 && err.details?.code === "PERMISSION_REFUSEE";
}

export function signalerAccesRefuse(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(EVENEMENT_ACCES_REFUSE));
  }
}
