import { describe, expect, it } from "vitest";
import { ApiError } from "./api_auth";
import {
  MSG_NOUVEAU_MOT_DE_PASSE_REFUSE,
  REGLES_MOT_DE_PASSE,
  estMotDePasseActuelIncorrect,
  messageErreurNouveauMotDePasse,
  motDePasseValide,
} from "./regles_mot_de_passe";

const regle = (id: string) => {
  const trouvee = REGLES_MOT_DE_PASSE.find((r) => r.id === id);
  if (!trouvee) throw new Error(`Règle introuvable : ${id}`);
  return trouvee;
};

describe("règles du mot de passe", () => {
  it("longueur : 8 caractères au moins", () => {
    expect(regle("longueur").test("abc")).toBe(false);
    expect(regle("longueur").test("abcdefgh")).toBe(true);
  });

  it("majuscule : une lettre majuscule", () => {
    expect(regle("majuscule").test("abcdefgh")).toBe(false);
    expect(regle("majuscule").test("ABCDEFGH1")).toBe(true);
  });

  it("minuscule : une lettre minuscule", () => {
    expect(regle("minuscule").test("ABCDEFGH1")).toBe(false);
    expect(regle("minuscule").test("Abcdefg1")).toBe(true);
  });

  it("chiffre : un chiffre", () => {
    expect(regle("chiffre").test("abcdefgh")).toBe(false);
    expect(regle("chiffre").test("Abcdefg1")).toBe(true);
  });
});

describe("motDePasseValide", () => {
  it("accepte un mot de passe qui respecte toutes les règles", () => {
    expect(motDePasseValide("Nouveau123")).toBe(true);
  });

  it.each(["nouveau123", "NOUVEAU123", "Nouveaumdp", "Nouv1"])("refuse %s", (valeur) => {
    expect(motDePasseValide(valeur)).toBe(false);
  });

  it("refuse un mot de passe de plus de 50 caractères", () => {
    const long = `Aa1${"x".repeat(48)}`;
    expect(long).toHaveLength(51);
    expect(motDePasseValide(long)).toBe(false);
    expect(motDePasseValide(long.slice(0, 50))).toBe(true);
  });
});

describe("estMotDePasseActuelIncorrect", () => {
  it("vrai pour un 400 avec le code attendu", () => {
    const err = new ApiError("x", 400, { code: "MOT_DE_PASSE_ACTUEL_INCORRECT" });
    expect(estMotDePasseActuelIncorrect(err)).toBe(true);
  });

  it("faux pour un 401 avec le même code", () => {
    const err = new ApiError("x", 401, { code: "MOT_DE_PASSE_ACTUEL_INCORRECT" });
    expect(estMotDePasseActuelIncorrect(err)).toBe(false);
  });

  it("faux pour une erreur ordinaire", () => {
    expect(estMotDePasseActuelIncorrect(new Error("x"))).toBe(false);
  });
});

describe("messageErreurNouveauMotDePasse", () => {
  const validation = (champs: unknown) => new ApiError("x", 400, { code: "VALIDATION", champs });

  it("reprend le message de l'entrée du serveur", () => {
    const err = validation([{ champ: "newPassword", contraintes: ["matches"], message: "Message du serveur" }]);
    expect(messageErreurNouveauMotDePasse(err)).toBe("Message du serveur");
  });

  it("utilise la phrase fixe quand l'entrée n'a pas de message", () => {
    const err = validation([{ champ: "newPassword", contraintes: ["matches"] }]);
    expect(messageErreurNouveauMotDePasse(err)).toBe(MSG_NOUVEAU_MOT_DE_PASSE_REFUSE);
  });

  it("renvoie null quand seul un autre champ est refusé", () => {
    const err = validation([{ champ: "email", contraintes: ["isEmail"] }]);
    expect(messageErreurNouveauMotDePasse(err)).toBeNull();
  });

  it("renvoie null pour un code autre que VALIDATION", () => {
    const err = new ApiError("x", 400, { code: "AUTRE", champs: [{ champ: "newPassword" }] });
    expect(messageErreurNouveauMotDePasse(err)).toBeNull();
  });

  it("accepte un autre nom de champ en argument", () => {
    const err = validation([{ champ: "password", contraintes: ["matches"], message: "Refusé" }]);
    expect(messageErreurNouveauMotDePasse(err, "password")).toBe("Refusé");
    expect(messageErreurNouveauMotDePasse(err)).toBeNull();
  });
});
