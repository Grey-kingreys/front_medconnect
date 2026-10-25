/**
 * Règles du mot de passe, partagées par les pages qui en créent un : profil (changement),
 * réinitialisation, inscription et configuration d'une structure invitée.
 * Ce sont les mêmes règles que le serveur : de 8 à 50 caractères, avec au moins une
 * majuscule, une minuscule et un chiffre.
 */

import { ApiError } from "./api_auth";

export const LONGUEUR_MIN_MOT_DE_PASSE = 8;
export const LONGUEUR_MAX_MOT_DE_PASSE = 50;

export interface RegleMotDePasse {
  id: "longueur" | "majuscule" | "minuscule" | "chiffre";
  libelle: string;
  test: (motDePasse: string) => boolean;
}

export const REGLES_MOT_DE_PASSE: readonly RegleMotDePasse[] = [
  { id: "longueur", libelle: "Au moins 8 caractères", test: (m) => m.length >= LONGUEUR_MIN_MOT_DE_PASSE },
  { id: "majuscule", libelle: "Une lettre majuscule", test: (m) => /[A-Z]/.test(m) },
  { id: "minuscule", libelle: "Une lettre minuscule", test: (m) => /[a-z]/.test(m) },
  { id: "chiffre", libelle: "Un chiffre", test: (m) => /\d/.test(m) },
];

export const MSG_REGLES_NON_RESPECTEES = "Le mot de passe ne respecte pas encore toutes les règles ci-dessous.";
export const MSG_NOUVEAU_MOT_DE_PASSE_REFUSE =
  "Le nouveau mot de passe doit contenir de 8 à 50 caractères, dont au moins une majuscule, une minuscule et un chiffre.";

/** Vrai si le mot de passe respecte toutes les règles, longueur maximale comprise. */
export function motDePasseValide(motDePasse: string): boolean {
  return (
    REGLES_MOT_DE_PASSE.every((regle) => regle.test(motDePasse)) &&
    motDePasse.length <= LONGUEUR_MAX_MOT_DE_PASSE
  );
}

/** Vrai si le serveur refuse le changement parce que le mot de passe actuel est faux. */
export function estMotDePasseActuelIncorrect(err: unknown): boolean {
  return err instanceof ApiError && err.status === 400 && err.details?.code === "MOT_DE_PASSE_ACTUEL_INCORRECT";
}

/**
 * Message à afficher sous le champ du nouveau mot de passe quand le serveur refuse ce champ
 * (erreur de validation), sinon null. Reprend le message du serveur s'il existe.
 */
export function messageErreurNouveauMotDePasse(err: unknown, champ = "newPassword"): string | null {
  if (!(err instanceof ApiError) || err.details?.code !== "VALIDATION") return null;
  const champs: unknown = err.details.champs;
  if (!Array.isArray(champs)) return null;
  for (const entree of champs as unknown[]) {
    if (typeof entree !== "object" || entree === null) continue;
    const { champ: nom, message } = entree as Record<string, unknown>;
    if (nom !== champ) continue;
    return typeof message === "string" && message !== "" ? message : MSG_NOUVEAU_MOT_DE_PASSE_REFUSE;
  }
  return null;
}
