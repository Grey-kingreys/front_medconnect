import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  EVENEMENT_DECONNEXION_FORCEE,
  deconnexionForcee,
  gererSessionRevoquee,
  lireEtEffacerMotif,
  motifDepuisCode,
  motifDepuisReponse,
  type DetailDeconnexionForcee,
} from "./deconnexion_forcee";

let motifsRecus: string[] = [];
const ecouteur = (e: Event) => {
  motifsRecus.push((e as CustomEvent<DetailDeconnexionForcee>).detail.motif);
};

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  document.cookie = "mc_connecte=; path=/; max-age=0";
  motifsRecus = [];
  window.addEventListener(EVENEMENT_DECONNEXION_FORCEE, ecouteur);
});

afterEach(() => {
  window.removeEventListener(EVENEMENT_DECONNEXION_FORCEE, ecouteur);
});

describe("motifDepuisCode", () => {
  it("convertit les codes du serveur en motif, ou null si le code ne force pas la déconnexion", () => {
    expect(motifDepuisCode("SESSION_REVOQUEE")).toBe("SESSION_REVOQUEE");
    expect(motifDepuisCode("REFRESH_REUTILISE")).toBe("SESSION_REVOQUEE");
    expect(motifDepuisCode("COMPTE_DESACTIVE")).toBe("COMPTE_DESACTIVE");
    expect(motifDepuisCode("SESSION_EXPIREE")).toBeNull();
    expect(motifDepuisCode(undefined)).toBeNull();
    expect(motifDepuisCode(42)).toBeNull();
  });
});

describe("motifDepuisReponse", () => {
  it("ne retient que les réponses 401 portant un code connu", () => {
    expect(motifDepuisReponse(401, { code: "COMPTE_DESACTIVE" })).toBe("COMPTE_DESACTIVE");
    expect(motifDepuisReponse(403, { code: "COMPTE_DESACTIVE" })).toBeNull();
    expect(motifDepuisReponse(401)).toBeNull();
  });
});

describe("deconnexionForcee", () => {
  it("vide la connexion locale, prévient l'application et garde le motif pour la page de connexion", () => {
    localStorage.setItem("access_token", "jeton-test");
    localStorage.setItem("refresh_token", "r");
    localStorage.setItem("user", "{}");
    document.cookie = "mc_connecte=1; path=/";

    deconnexionForcee("SESSION_REVOQUEE");

    expect(localStorage.getItem("access_token")).toBeNull();
    expect(localStorage.getItem("refresh_token")).toBeNull();
    expect(localStorage.getItem("user")).toBeNull();
    expect(document.cookie).not.toContain("mc_connecte=1");
    expect(motifsRecus).toEqual(["SESSION_REVOQUEE"]);
    expect(lireEtEffacerMotif()).toBe("SESSION_REVOQUEE");
    expect(lireEtEffacerMotif()).toBeNull();
  });
});

describe("lireEtEffacerMotif", () => {
  it("renvoie null pour une valeur inconnue", () => {
    sessionStorage.setItem("mc_motif_deconnexion", "AUTRE_CHOSE");
    expect(lireEtEffacerMotif()).toBeNull();
  });
});

describe("gererSessionRevoquee", () => {
  it("émet le motif reçu, ou SESSION_REVOQUEE par défaut", () => {
    gererSessionRevoquee({ code: "COMPTE_DESACTIVE", message: "..." });
    gererSessionRevoquee(undefined);
    expect(motifsRecus).toEqual(["COMPTE_DESACTIVE", "SESSION_REVOQUEE"]);
  });
});
