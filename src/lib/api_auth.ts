/**
 * MedConnect Auth API
 * 
 * Contient uniquement les fonctions pour l'authentification.
 * L'URL du backend est lue depuis NEXT_PUBLIC_API_URL dans .env
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

// ─── Types ──────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  data: T;
  message: string;
  success: boolean;
}

export interface AuthUser {
  id: string;
  email: string;
  nom: string;
  prenom: string;
  role: string;
  structureId?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  nom: string;
  prenom: string;
  telephone?: string;
  role: string;
  isActive: boolean;
  structureId?: string;
  structure?: {
    id: string;
    nom: string;
    type: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface LoginResponse {
  access_token: string;
  refreshToken: string;
  user: AuthUser;
}

export interface RegisterResponse {
  access_token: string;
  refreshToken: string;
  user: AuthUser;
}

export interface VerifyResetTokenResponse {
  valid: boolean;
  email: string;
}

export interface RefreshTokenResponse {
  access_token: string;
  refresh_token: string;
}

export interface VerifyTokenResponse {
  valid: boolean;
  userId: string;
  role: string;
}

// ─── Helpers ────────────────────────────────────────────────────

async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${API_URL}${endpoint}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const body = await res.json();

  if (!res.ok) {
    // Le backend NestJS renvoie { message, statusCode } pour les erreurs
    const errorMessage =
      typeof body.message === "string"
        ? body.message
        : Array.isArray(body.message)
          ? body.message[0]
          : "Une erreur est survenue";
    throw new ApiError(errorMessage, res.status);
  }

  return body as ApiResponse<T>;
}

/**
 * Fetch authentifié — ajoute automatiquement le Bearer token
 * En cas de 401 (token expiré), tente un refresh automatique et réessaie une fois.
 */
async function authFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const getToken = () =>
    typeof window !== "undefined" ? localStorage.getItem("access_token") : null;

  const doFetch = (token: string | null) =>
    apiFetch<T>(endpoint, {
      ...options,
      headers: {
        ...options.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

  try {
    return await doFetch(getToken());
  } catch (err) {
    // Si 401 → tenter un refresh du token puis réessayer une seule fois
    if (err instanceof ApiError && err.status === 401) {
      try {
        const refreshToken =
          typeof window !== "undefined"
            ? localStorage.getItem("refresh_token")
            : null;
        if (!refreshToken) throw new ApiError("Pas de refresh token", 401);

        const refreshRes = await apiFetch<{ access_token: string; refresh_token: string }>(
          "/auth/refresh",
          {
            method: "POST",
            body: JSON.stringify({ refresh_token: refreshToken }),
          }
        );

        // Sauvegarder les nouveaux tokens
        if (typeof window !== "undefined") {
          localStorage.setItem("access_token", refreshRes.data.access_token);
          localStorage.setItem("refresh_token", refreshRes.data.refresh_token);
        }

        // Réessayer la requête originale avec le nouveau token
        return await doFetch(refreshRes.data.access_token);
      } catch {
        // Refresh échoué → session expirée, nettoyer le localStorage
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

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// ─── Auth Functions ─────────────────────────────────────────────

/**
 * Connexion utilisateur
 */
export async function login(email: string, password: string) {
  return apiFetch<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

/**
 * Inscription patient
 */
export async function register(data: {
  email: string;
  password: string;
  nom: string;
  prenom: string;
  telephone?: string;
}) {
  return apiFetch<RegisterResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Demande de réinitialisation de mot de passe
 */
export async function forgotPassword(email: string) {
  return apiFetch<null>("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

/**
 * Vérification d'un token de réinitialisation
 */
export async function verifyResetToken(token: string) {
  return apiFetch<VerifyResetTokenResponse>(
    `/auth/verify-reset-token/${token}`
  );
}

/**
 * Réinitialisation du mot de passe avec token
 */
export async function resetPassword(token: string, newPassword: string) {
  return apiFetch<null>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, newPassword }),
  });
}

// ─── Profile Functions ──────────────────────────────────────────

/**
 * Récupérer le profil de l'utilisateur connecté
 */
export async function getMe() {
  return authFetch<UserProfile>("/auth/me");
}

/**
 * Modifier le profil de l'utilisateur connecté
 */
export async function updateProfile(data: {
  nom?: string;
  prenom?: string;
  email?: string;
  telephone?: string;
}) {
  return authFetch<UserProfile>("/auth/profile", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

/**
 * Changer le mot de passe de l'utilisateur connecté
 */
export async function changePassword(currentPassword: string, newPassword: string) {
  return authFetch<null>("/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

/**
 * Vérifier la validité du JWT
 */
export async function verifyToken() {
  return authFetch<VerifyTokenResponse>("/auth/verify");
}

/**
 * Rafraîchir le access token via le refresh token
 */
export async function refreshAccessToken() {
  const refreshToken = typeof window !== "undefined" ? localStorage.getItem("refresh_token") : null;
  if (!refreshToken) throw new ApiError("Pas de refresh token", 401);

  return apiFetch<RefreshTokenResponse>("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
}

/**
 * Déconnexion — invalide le refresh token côté serveur
 */
export async function logout() {
  try {
    await authFetch<null>("/auth/logout", { method: "POST" });
  } finally {
    // Toujours nettoyer le localStorage même si l'appel API échoue
    if (typeof window !== "undefined") {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      localStorage.removeItem("user");
    }
  }
}
