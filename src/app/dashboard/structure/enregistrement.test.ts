import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api_auth";
import type { MyStructure } from "@/lib/api_structure";
import { HORAIRES_PAR_DEFAUT, JOURS_SEMAINE, lirePlage, type JourSemaine, type PlageHoraire } from "@/lib/horaires_structure";
import {
  corpsHoraires,
  corpsInformations,
  corpsPosition,
  messageErreurEnregistrement,
} from "./enregistrement";

const origine = (surcharge: Partial<MyStructure> = {}): MyStructure => ({
  id: "s1",
  nom: "Pharmacie de Kaloum",
  type: "PHARMACIE",
  email: "admin@exemple.com",
  telephone: "+224 621 33 44 55",
  adresse: "Avenue de la République, Kaloum",
  ville: "Conakry",
  isActive: true,
  isConfigured: true,
  membres: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...surcharge,
});

const saisieComplete = {
  nom: "Pharmacie de Kaloum",
  telephone: "+224 621 00 00 00",
  ville: "Conakry",
  adresse: "Avenue de la République, Kaloum",
  description: "Ouverte tous les jours",
};

describe("corpsInformations", () => {
  it("n'envoie que les champs du bloc", () => {
    const r = corpsInformations(saisieComplete, origine());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(Object.keys(r.corps).sort()).toEqual(["adresse", "description", "nom", "telephone", "ville"]);
      expect(r.corps.telephone).toBe("+224 621 00 00 00");
    }
  });

  it("n'envoie pas un champ facultatif vide qui l'était déjà", () => {
    const r = corpsInformations(
      { ...saisieComplete, telephone: "  " },
      origine({ telephone: undefined }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.corps).not.toHaveProperty("telephone");
    const r2 = corpsInformations({ ...saisieComplete, ville: "" }, origine({ ville: null as unknown as undefined }));
    expect(r2.ok).toBe(true);
    if (r2.ok) expect(r2.corps).not.toHaveProperty("ville");
  });

  it("refuse un champ vidé alors qu'il était renseigné", () => {
    const r = corpsInformations({ ...saisieComplete, telephone: "" }, origine());
    expect(r).toEqual({
      ok: false,
      message: "Le champ téléphone ne peut pas être vidé. Saisissez une nouvelle valeur.",
    });
  });

  it("refuse un nom trop court et des longueurs hors bornes", () => {
    expect(corpsInformations({ ...saisieComplete, nom: "A" }, origine())).toEqual({
      ok: false,
      message: "Le nom de la pharmacie doit contenir entre 2 et 150 caractères.",
    });
    expect(corpsInformations({ ...saisieComplete, telephone: "123" }, origine())).toEqual({
      ok: false,
      message: "Le téléphone doit contenir entre 8 et 20 caractères.",
    });
    expect(corpsInformations({ ...saisieComplete, description: "x".repeat(501) }, origine())).toEqual({
      ok: false,
      message: "La description ne doit pas dépasser 500 caractères.",
    });
  });

  it("envoie une description vide", () => {
    const r = corpsInformations({ ...saisieComplete, description: "  " }, origine());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.corps.description).toBe("");
  });
});

const plagesParDefaut = (): Record<JourSemaine, PlageHoraire> =>
  Object.fromEntries(JOURS_SEMAINE.map((j) => [j, lirePlage(HORAIRES_PAR_DEFAUT[j])])) as Record<JourSemaine, PlageHoraire>;

describe("corpsHoraires", () => {
  it("envoie seulement horaires, avec les 7 jours dans l'ordre", () => {
    const plages = plagesParDefaut();
    plages.Samedi = { ferme: true, ouverture: "", fermeture: "" };
    const r = corpsHoraires(plages);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(Object.keys(r.corps)).toEqual(["horaires"]);
      const objet = JSON.parse(r.corps.horaires as string) as Record<string, string>;
      expect(Object.keys(objet)).toEqual([...JOURS_SEMAINE]);
      expect(objet.Samedi).toBe("Fermé");
      expect(objet.Lundi).toBe("08:00-18:00");
    }
  });

  it("refuse une heure manquante", () => {
    const plages = plagesParDefaut();
    plages.Mardi = { ferme: false, ouverture: "08:00", fermeture: "" };
    expect(corpsHoraires(plages)).toEqual({
      ok: false,
      message: "Indiquez l'heure d'ouverture et de fermeture du mardi, ou cochez Fermé.",
    });
  });

  it("refuse une fermeture avant l'ouverture", () => {
    const plages = plagesParDefaut();
    plages.Jeudi = { ferme: false, ouverture: "20:00", fermeture: "08:00" };
    expect(corpsHoraires(plages)).toEqual({
      ok: false,
      message: "Le jeudi, l'heure de fermeture doit être après l'heure d'ouverture.",
    });
  });
});

describe("corpsPosition", () => {
  it("envoie des nombres", () => {
    expect(corpsPosition({ latitude: "9.5370", longitude: "-13.6773" })).toEqual({
      ok: true,
      corps: { latitude: 9.537, longitude: -13.6773 },
    });
  });

  it("refuse les champs manquants ou non numériques", () => {
    expect(corpsPosition({ latitude: "", longitude: "" })).toEqual({
      ok: false,
      message: "Choisissez la position sur la carte ou saisissez la latitude et la longitude.",
    });
    expect(corpsPosition({ latitude: "9.5", longitude: "" })).toEqual({
      ok: false,
      message: "Indiquez la latitude et la longitude.",
    });
    expect(corpsPosition({ latitude: "abc", longitude: "1" })).toEqual({
      ok: false,
      message: "Indiquez la latitude et la longitude.",
    });
  });

  it("refuse les valeurs hors bornes", () => {
    expect(corpsPosition({ latitude: "91", longitude: "0" })).toEqual({
      ok: false,
      message: "La latitude doit être comprise entre -90 et 90.",
    });
    expect(corpsPosition({ latitude: "0", longitude: "-181" })).toEqual({
      ok: false,
      message: "La longitude doit être comprise entre -180 et 180.",
    });
  });
});

describe("messageErreurEnregistrement", () => {
  afterEach(() => vi.restoreAllMocks());

  it("remplace le message technique d'une validation refusée", () => {
    const message = messageErreurEnregistrement(
      new ApiError("nom must be longer than or equal to 2 characters", 400, { code: "VALIDATION" }),
    );
    expect(message).toBe("Certaines informations n'ont pas été acceptées. Vérifiez ce bloc puis réessayez.");
    expect(message).not.toContain("must be");
  });

  it("signale un refus d'autorisation", () => {
    const envoi = vi.spyOn(window, "dispatchEvent");
    const message = messageErreurEnregistrement(new ApiError("Interdit", 403, { code: "PERMISSION_REFUSEE" }));
    expect(message).toBe("Vous n'avez plus l'autorisation de modifier ces informations.");
    expect(envoi).toHaveBeenCalledTimes(1);
  });

  it("garde le message des autres erreurs et un texte par défaut sinon", () => {
    expect(messageErreurEnregistrement(new ApiError("Pharmacie introuvable.", 404))).toBe("Pharmacie introuvable.");
    expect(messageErreurEnregistrement(new Error("x"))).toBe(
      "L'enregistrement n'a pas abouti. Vérifiez votre connexion puis réessayez.",
    );
  });
});
