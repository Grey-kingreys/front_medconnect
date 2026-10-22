import { describe, expect, it } from "vitest";
import {
  HORAIRES_PAR_DEFAUT,
  JOURS_SEMAINE,
  ecrirePlage,
  lireHoraires,
  lirePlage,
} from "./horaires_structure";

describe("lireHoraires", () => {
  it("lit un texte complet dans l'ordre de la semaine", () => {
    const complet = Object.fromEntries(JOURS_SEMAINE.map((j) => [j, "09:00-20:00"]));
    const lu = lireHoraires(JSON.stringify(complet));
    expect(Object.keys(lu)).toEqual([...JOURS_SEMAINE]);
    expect(lu.Dimanche).toBe("09:00-20:00");
  });

  it("complète un texte partiel avec les valeurs par défaut", () => {
    const lu = lireHoraires(JSON.stringify({ Lundi: "07:00-19:00" }));
    expect(lu.Lundi).toBe("07:00-19:00");
    expect(lu.Samedi).toBe("08:00-12:00");
    expect(lu.Dimanche).toBe("Fermé");
  });

  it("renvoie les valeurs par défaut pour un texte invalide, absent ou non objet", () => {
    expect(lireHoraires("pas du json")).toEqual(HORAIRES_PAR_DEFAUT);
    expect(lireHoraires(null)).toEqual(HORAIRES_PAR_DEFAUT);
    expect(lireHoraires(undefined)).toEqual(HORAIRES_PAR_DEFAUT);
    expect(lireHoraires("null")).toEqual(HORAIRES_PAR_DEFAUT);
    expect(lireHoraires("3")).toEqual(HORAIRES_PAR_DEFAUT);
  });

  it("renvoie une copie, jamais l'objet partagé", () => {
    expect(lireHoraires(null)).not.toBe(HORAIRES_PAR_DEFAUT);
  });
});

describe("lirePlage et ecrirePlage", () => {
  it("lit une plage ouverte", () => {
    expect(lirePlage("08:00-21:00")).toEqual({ ferme: false, ouverture: "08:00", fermeture: "21:00" });
    expect(lirePlage(" 08:00-21:00 ")).toEqual({ ferme: false, ouverture: "08:00", fermeture: "21:00" });
  });

  it("lit Fermé", () => {
    expect(lirePlage("Fermé")).toEqual({ ferme: true, ouverture: "", fermeture: "" });
  });

  it("laisse à compléter un texte non reconnu", () => {
    expect(lirePlage("sur rendez-vous")).toEqual({ ferme: false, ouverture: "", fermeture: "" });
  });

  it("écrit une plage", () => {
    expect(ecrirePlage({ ferme: true, ouverture: "08:00", fermeture: "12:00" })).toBe("Fermé");
    expect(ecrirePlage({ ferme: false, ouverture: "08:00", fermeture: "12:00" })).toBe("08:00-12:00");
  });

  it("fait l'aller-retour", () => {
    for (const valeur of ["08:00-21:00", "Fermé", "00:00-23:59"]) {
      expect(ecrirePlage(lirePlage(valeur))).toBe(valeur);
    }
  });
});
