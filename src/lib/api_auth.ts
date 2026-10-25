/**
 * MedConnecte Auth API
 * 
 * Contient uniquement les fonctions pour l'authentification.
 * L'URL du backend est lue depuis NEXT_PUBLIC_API_URL dans .env
 */

import { deconnexionForcee, motifDepuisReponse, MESSAGES_DECONNEXION, type MotifDeconnexion } from "./deconnexion_forcee";
import { estPermissionRefusee, signalerAccesRefuse } from "./acces";
import type { StructureType } from "./api_admin";

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
  telephone?: string;
  dateNaissance?: string;
  taille?: number;
  poids?: number;
  role: string;
  structureId?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  nom: string;
  prenom: string;
  telephone?: string;
  dateNaissance?: string;
  taille?: number;
  poids?: number;
  role: string;
  isActive: boolean;
  specialite?: string;
  structureId?: string;
  /** URL publique de la photo de profil (bucket R2 public), null si aucune. */
  avatarUrl?: string | null;
  /** Permissions effectives renvoyées par /auth/me (ex. "catalogue:write"). */
  permissions?: string[];
  /** Type de la structure de rattachement (absent sur un ancien serveur, null sans structure). */
  structureType?: StructureType | null;
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
  user: AuthUser;
}

export interface RegisterResponse {
  access_token: string;
  user: AuthUser;
}

export interface VerifyResetTokenResponse {
  valid: boolean;
  email: string;
}

export interface RefreshTokenResponse {
  access_token: string;
}

export interface VerifyTokenResponse {
  valid: boolean;
  userId: string;
  role: string;
}

// ─── Helpers ────────────────────────────────────────────────────

// Résilience réseau (D12) : délai par tentative, nouvelles tentatives sur les lectures seulement
const DELAI_REQUETE_MS = 20_000;
const ATTENTES_NOUVELLE_TENTATIVE_MS = [1_000, 3_000];
const STATUTS_INDISPONIBLES = [502, 503, 504];

const MSG_HORS_CONNEXION = "Vous semblez hors connexion. Vérifiez votre connexion internet puis réessayez.";
const MSG_DELAI_DEPASSE = "Le service met trop de temps à répondre. Vérifiez votre connexion puis réessayez.";
const MSG_INDISPONIBLE = "Le service est momentanément indisponible, réessayez dans quelques instants.";
const MSG_ILLISIBLE = "Un problème est survenu, réessayez dans un instant.";

const attendre = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Journalisation concise des échecs finaux : méthode, chemin sans paramètres, statut
const signalerEchec = (methode: string, endpoint: string, statut: number) =>
  console.warn(`[API] échec ${methode} ${endpoint.split("?")[0]} statut=${statut}`);

// Le backend NestJS renvoie { message, statusCode } pour les erreurs
type CorpsReponse = Record<string, unknown>;
const messageErreur = (body: CorpsReponse): string =>
  typeof body.message === "string"
    ? body.message
    : Array.isArray(body.message) && typeof body.message[0] === "string"
      ? body.message[0]
      : "Une erreur est survenue";

/** Réglages internes d'un appel : un seul essai et aucune trace d'échec (appels facultatifs). */
interface ReglagesAppel {
  tentativeUnique?: boolean;
  sansJournal?: boolean;
}

/** Vrai si le corps d'une réponse 502/503/504 vient du serveur applicatif (objet JSON avec un `code` texte). */
async function estReponseApplicative(res: Response): Promise<boolean> {
  try {
    const corps: unknown = await res.clone().json();
    return typeof corps === "object" && corps !== null && typeof (corps as CorpsReponse).code === "string";
  } catch {
    return false;
  }
}

/**
 * Envoi commun à apiFetch et authDownload : délai de 20 s par tentative, nouvelles
 * tentatives (1 s puis 3 s) pour GET et HEAD seulement, sur erreur réseau, délai
 * dépassé ou 502/503/504. Une annulation par l'appelant est propagée sans nouvel essai.
 */
async function envoyer(endpoint: string, options: RequestInit, reglages: ReglagesAppel = {}): Promise<Response> {
  const methode = (options.method || "GET").toUpperCase();
  const lecture = methode === "GET" || methode === "HEAD";
  const signalAppelant = options.signal ?? undefined;

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    if (!reglages.sansJournal) signalerEchec(methode, endpoint, 0);
    throw new ApiError(MSG_HORS_CONNEXION, 0);
  }

  const tentatives = lecture && !reglages.tentativeUnique ? ATTENTES_NOUVELLE_TENTATIVE_MS.length + 1 : 1;
  let derniereErreur = new ApiError(MSG_HORS_CONNEXION, 0);

  for (let i = 0; i < tentatives; i++) {
    if (i > 0) await attendre(ATTENTES_NOUVELLE_TENTATIVE_MS[i - 1]);

    const controleur = new AbortController();
    let delaiDepasse = false;
    const minuteur = setTimeout(() => {
      delaiDepasse = true;
      controleur.abort();
    }, DELAI_REQUETE_MS);
    const relayerAnnulation = () => controleur.abort();
    signalAppelant?.addEventListener("abort", relayerAnnulation);

    try {
      if (signalAppelant?.aborted) throw signalAppelant.reason;
      const res = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        credentials: "include",
        signal: controleur.signal,
      });
      if (!STATUTS_INDISPONIBLES.includes(res.status)) return res;
      // Réponse rédigée par le serveur (corps JSON avec un code) : rendue telle quelle,
      // sans nouvel essai, pour que son message parvienne à l'utilisateur (D02)
      if (await estReponseApplicative(res)) return res;
      derniereErreur = new ApiError(MSG_INDISPONIBLE, res.status);
    } catch (err) {
      // Annulation voulue par l'appelant : propagée telle quelle
      if (signalAppelant?.aborted) throw err;
      derniereErreur = new ApiError(delaiDepasse ? MSG_DELAI_DEPASSE : MSG_HORS_CONNEXION, 0);
    } finally {
      clearTimeout(minuteur);
      signalAppelant?.removeEventListener("abort", relayerAnnulation);
    }
  }

  if (!reglages.sansJournal) signalerEchec(methode, endpoint, derniereErreur.status);
  throw derniereErreur;
}

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {},
  reglages: ReglagesAppel = {}
): Promise<ApiResponse<T>> {
  // Corps FormData : le navigateur fixe lui-même l'en-tête multipart
  const estFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const res = await envoyer(
    endpoint,
    {
      ...options,
      headers: {
        ...(estFormData ? {} : { "Content-Type": "application/json" }),
        ...options.headers,
      },
    },
    reglages
  );

  let body: CorpsReponse = {};
  try {
    const text = await res.text();
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { message: MSG_ILLISIBLE };
  }

  if (!res.ok) {
    // Un 401 est d'abord traité par le rafraîchissement de la connexion (authFetch)
    if (res.status !== 401 && !reglages.sansJournal) {
      signalerEchec((options.method || "GET").toUpperCase(), endpoint, res.status);
    }
    throw new ApiError(messageErreur(body), res.status, body);
  }

  return body as unknown as ApiResponse<T>;
}

let refreshPromise: Promise<ApiResponse<{ access_token: string }>> | null = null;

const lireJeton = () =>
  typeof window !== "undefined" ? localStorage.getItem("access_token") : null;

/** Déconnexion forcée (appareil déconnecté ou compte désactivé) : prévient l'application et renvoie l'erreur à lever. */
function arreterConnexion(motif: MotifDeconnexion, details?: Record<string, unknown>): ApiError {
  deconnexionForcee(motif);
  return new ApiError(MESSAGES_DECONNEXION[motif], 401, details);
}

/** Codes d'un 401 qui demandent de renouveler le jeton de connexion (D14). */
const CODES_JETON_A_RENOUVELER = ["JETON_ABSENT", "JETON_EXPIRE", "JETON_INVALIDE"];

/** Vrai si un 401 appelle un rafraîchissement : code de jeton, ou pas de code (ancien serveur). */
function doitRafraichir(err: ApiError): boolean {
  if (err.status !== 401) return false;
  const code = err.details?.code;
  return typeof code !== "string" || CODES_JETON_A_RENOUVELER.includes(code);
}

/**
 * Exécute un appel authentifié ; en cas de 401 de jeton (expiré, invalide ou absent, ou sans code),
 * rafraîchit la connexion puis réessaie une seule fois. Partagé par authFetch et authDownload.
 */
async function avecRafraichissement<R>(appel: (token: string | null) => Promise<R>): Promise<R> {
  try {
    return await appel(lireJeton());
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 401) throw err;

    // Appareil déconnecté ou compte désactivé : inutile de rafraîchir la connexion
    const motifImmediat = motifDepuisReponse(err.status, err.details);
    if (motifImmediat) throw arreterConnexion(motifImmediat, err.details);

    // 401 qui ne concerne pas le jeton : relancée telle quelle, sans rien nettoyer
    if (!doitRafraichir(err)) throw err;
  }

  let nouveauJeton: string;
  try {
    // Utiliser une promesse partagée pour éviter les appels concurrents.
    // Le refresh token vit dans un cookie httpOnly (envoyé via credentials:include),
    // il n'est donc plus lu/transmis depuis le JS.
    if (!refreshPromise) {
      refreshPromise = apiFetch<{ access_token: string }>("/auth/refresh", {
        method: "POST",
      });
    }

    const refreshRes = await refreshPromise;

    // Nettoyer la promesse une fois terminée
    refreshPromise = null;

    // Sauvegarder le nouvel access token
    nouveauJeton = refreshRes.data.access_token;
    if (typeof window !== "undefined") {
      localStorage.setItem("access_token", nouveauJeton);
    }
  } catch (errRafraichissement) {
    // Nettoyer la promesse en cas d'échec
    refreshPromise = null;
    if (errRafraichissement instanceof ApiError) {
      const motif = motifDepuisReponse(errRafraichissement.status, errRafraichissement.details);
      if (motif) throw arreterConnexion(motif, errRafraichissement.details);
    }

    // Refresh échoué → session expirée, nettoyer le localStorage
    if (typeof window !== "undefined") {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      localStorage.removeItem("user");
      // Retirer aussi le cookie témoin lu par src/proxy.ts (voir useAuth.tsx)
      document.cookie = "mc_connecte=; path=/; max-age=0; SameSite=Lax";
    }
    throw new ApiError("Vous avez été déconnecté. Reconnectez-vous pour continuer.", 401);
  }

  // Réessayer la requête originale avec le nouveau token (hors du rafraîchissement : D15)
  try {
    return await appel(nouveauJeton);
  } catch (err) {
    if (err instanceof ApiError) {
      const motif = motifDepuisReponse(err.status, err.details);
      if (motif) throw arreterConnexion(motif, err.details);
    }
    throw err;
  }
}

/**
 * Fetch authentifié : ajoute automatiquement le jeton de connexion.
 * En cas de 401 de jeton (expiré, invalide ou absent, ou sans code), tente un rafraîchissement et réessaie une fois.
 */
export async function authFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    return await avecRafraichissement((token) =>
      apiFetch<T>(endpoint, {
        ...options,
        headers: {
          ...options.headers,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })
    );
  } catch (err) {
    // Lecture refusée faute de droit : le tableau de bord remplace la page par un message
    if ((options.method ?? "GET").toUpperCase() === "GET" && estPermissionRefusee(err)) {
      signalerAccesRefuse();
    }
    throw err;
  }
}

/**
 * Téléchargement authentifié d'un fichier (lecture : même délai, mêmes nouvelles
 * tentatives et même rafraîchissement de la connexion que authFetch).
 * Le nom vient de Content-Disposition s'il est lisible, sinon null.
 */
export async function authDownload(endpoint: string): Promise<{ blob: Blob; filename: string | null }> {
  return avecRafraichissement(async (token) => {
    const res = await envoyer(endpoint, {
      method: "GET",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!res.ok) {
      let body: CorpsReponse = {};
      try {
        body = JSON.parse(await res.text());
      } catch {
        body = {};
      }
      if (res.status !== 401) signalerEchec("GET", endpoint, res.status);
      throw new ApiError(messageErreur(body), res.status, body);
    }

    let blob: Blob;
    try {
      blob = await res.blob();
    } catch {
      signalerEchec("GET", endpoint, 0);
      throw new ApiError(MSG_HORS_CONNEXION, 0);
    }
    const disposition = res.headers.get("Content-Disposition");
    const nom = disposition?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i)?.[1];
    return { blob, filename: nom ? decodeURIComponent(nom) : null };
  });
}

export class ApiError extends Error {
  status: number;
  /** Corps de la réponse d'erreur, pour les écrans qui ont besoin d'un champ supplémentaire */
  details?: Record<string, unknown>;
  constructor(message: string, status: number, details?: Record<string, unknown>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

// ─── Auth Functions ─────────────────────────────────────────────

/**
 * Demande de connexion commune au formulaire et aux comptes de démonstration :
 * même envoi (POST sans jeton, cookie de rafraîchissement posé par le serveur) et même
 * réponse. Le succès est ensuite traité par `useTerminerConnexion` (hooks/useAuth).
 */
function demanderConnexion(endpoint: string, corps: Record<string, string>) {
  return apiFetch<LoginResponse>(endpoint, {
    method: "POST",
    body: JSON.stringify(corps),
  });
}

/**
 * Connexion utilisateur
 */
export async function login(email: string, password: string) {
  return demanderConnexion("/auth/login", { email, password });
}

// ─── Mode démonstration ─────────────────────────────────────────
// Piloté par le serveur (variable DEMO_MODE côté back) : en production la liste
// répond 404 et rien ne s'affiche.

export type RoleDemo =
  | "PATIENT"
  | "MEDECIN"
  | "PHARMACIEN"
  | "STRUCTURE_ADMIN"
  | "ADMIN"
  | "SUPER_ADMIN"
  | "ACCUEIL";

export interface CompteDemo {
  id: string;
  email: string;
  nom: string;
  prenom: string;
  role: RoleDemo;
  /** Libellé du rôle, prêt à afficher */
  roleLibelle: string;
  structureNom: string | null;
  /** Courte présentation du compte, prête à afficher */
  description: string;
}

const estCompteDemo = (c: unknown): c is CompteDemo => {
  if (!c || typeof c !== "object") return false;
  const v = c as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.nom === "string" &&
    typeof v.prenom === "string" &&
    typeof v.role === "string" &&
    typeof v.roleLibelle === "string" &&
    typeof v.description === "string" &&
    (v.structureNom === null || v.structureNom === undefined || typeof v.structureNom === "string")
  );
};

/**
 * Liste des comptes de démonstration. Un seul essai, sans trace d'échec : renvoie []
 * si le mode est désactivé (404), hors connexion ou en cas de toute autre erreur.
 * Ne lève jamais d'exception.
 */
export async function getComptesDemo(): Promise<CompteDemo[]> {
  try {
    const res = await apiFetch<unknown>("/auth/demo/comptes", {}, { tentativeUnique: true, sansJournal: true });
    if (!Array.isArray(res?.data)) return [];
    return res.data.filter(estCompteDemo).map((c) => ({ ...c, structureNom: c.structureNom ?? null }));
  } catch {
    return [];
  }
}

/**
 * Connexion à un compte de démonstration : même réponse et mêmes effets que `login`.
 */
export async function connexionDemo(userId: string) {
  return demanderConnexion("/auth/demo/connexion", { userId });
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
  dateNaissance?: string;
  taille?: number;
  poids?: number;
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
  dateNaissance?: string;
  taille?: number;
  poids?: number;
}) {
  return authFetch<UserProfile>("/auth/profile", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

/**
 * Définir ma photo de profil depuis un fichier R2 déjà téléversé et confirmé.
 * Renvoie l'URL publique du nouvel avatar.
 */
export async function setMyAvatar(fileId: string) {
  return authFetch<{ avatarUrl: string | null }>("/users/me/avatar", {
    method: "PATCH",
    body: JSON.stringify({ fileId }),
  });
}

/** Supprimer ma photo de profil. */
export async function removeMyAvatar() {
  return authFetch<{ avatarUrl: null }>("/users/me/avatar", {
    method: "DELETE",
  });
}

/**
 * Changer le mot de passe de l'utilisateur connecté ; `deconnecterAutresAppareils`
 * déconnecte aussi les autres appareils du compte (vrai par défaut côté serveur).
 */
export async function changePassword(currentPassword: string, newPassword: string, deconnecterAutresAppareils: boolean) {
  return authFetch<{ appareilsDeconnectes: number }>("/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword, deconnecterAutresAppareils }),
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
  if (!refreshPromise) {
    // Refresh token transmis automatiquement via le cookie httpOnly (credentials:include).
    refreshPromise = apiFetch<RefreshTokenResponse>("/auth/refresh", {
      method: "POST",
    });
  }

  try {
    const res = await refreshPromise;
    refreshPromise = null;
    return res;
  } catch (err) {
    refreshPromise = null;
    if (err instanceof ApiError) {
      const motif = motifDepuisReponse(err.status, err.details);
      if (motif) throw arreterConnexion(motif, err.details);
    }
    throw err;
  }
}

/**
 * Déconnexion : invalide le refresh token côté serveur
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
      // Retirer aussi le cookie témoin lu par src/proxy.ts (voir useAuth.tsx)
      document.cookie = "mc_connecte=; path=/; max-age=0; SameSite=Lax";
    }
  }
}
