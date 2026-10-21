import { authFetch } from "./api_auth";

/**
 * Consentement d'accès au dossier (partage patient → structure).
 *
 * Les endpoints `/consent/*` renvoient des objets « plats » (pas d'enveloppe
 * `{ data }`), d'où les casts `as unknown as` sur le retour d'`authFetch`.
 */

export interface ShareCode {
  code: string;
  qrDataUrl: string;
  expiresInSec: number;
}

export interface ConsentResult {
  success: boolean;
  dejaAutorisee: boolean;
  message: string;
  patient: { id: string; nom: string; prenom: string };
}

export interface OtpRequested {
  patientId: string;
  nom: string;
  prenom: string;
  expiresInSec: number;
  message: string;
}

/** Patient : génère un code/QR de partage éphémère de son dossier. */
export async function generateShareCode(): Promise<ShareCode> {
  return (await authFetch<unknown>("/consent/code", { method: "POST" })) as unknown as ShareCode;
}

/** Accueil : enregistre le consentement à partir du code présenté par le patient. */
export async function redeemConsentCode(code: string): Promise<ConsentResult> {
  return (await authFetch<unknown>("/consent/redeem", {
    method: "POST",
    body: JSON.stringify({ code }),
  })) as unknown as ConsentResult;
}

/** Accueil : envoie un code de partage par SMS au patient (fallback sans smartphone). */
export async function requestConsentOtp(telephone: string): Promise<OtpRequested> {
  return (await authFetch<unknown>("/consent/otp/request", {
    method: "POST",
    body: JSON.stringify({ telephone }),
  })) as unknown as OtpRequested;
}

/** Accueil : valide le code SMS dicté par le patient. */
export async function verifyConsentOtp(patientId: string, code: string): Promise<ConsentResult> {
  return (await authFetch<unknown>("/consent/otp/verify", {
    method: "POST",
    body: JSON.stringify({ patientId, code }),
  })) as unknown as ConsentResult;
}
