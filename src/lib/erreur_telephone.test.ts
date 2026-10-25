import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api_auth";
import {
  erreurSeulementTelephone,
  messageErreurTelephone,
  MSG_TELEPHONE_DEJA_UTILISE,
  MSG_TELEPHONE_INVALIDE,
} from "./erreur_telephone";

const GENERIQUE = "Certaines informations saisies sont manquantes ou invalides. Vérifiez le formulaire puis réessayez.";

describe("erreur_telephone", () => {
  it("reconnaît un numéro déjà utilisé", () => {
    const err = new ApiError(MSG_TELEPHONE_DEJA_UTILISE, 409, { code: "TELEPHONE_DEJA_UTILISE" });
    expect(messageErreurTelephone(err)).toBe(MSG_TELEPHONE_DEJA_UTILISE);
    expect(erreurSeulementTelephone(err)).toBe(true);
  });

  it("reconnaît un numéro invalide quand seul le téléphone est refusé", () => {
    const err = new ApiError(GENERIQUE, 400, {
      code: "VALIDATION",
      champs: [{ champ: "telephone", contraintes: ["isPhoneNumber"] }],
    });
    expect(messageErreurTelephone(err)).toBe(MSG_TELEPHONE_INVALIDE);
    expect(erreurSeulementTelephone(err)).toBe(true);
  });

  it("garde le bandeau quand le téléphone et l'email sont refusés", () => {
    const err = new ApiError(GENERIQUE, 400, {
      code: "VALIDATION",
      champs: [
        { champ: "telephone", contraintes: ["isPhoneNumber"] },
        { champ: "email", contraintes: ["isEmail"] },
      ],
    });
    expect(messageErreurTelephone(err)).toBe(MSG_TELEPHONE_INVALIDE);
    expect(erreurSeulementTelephone(err)).toBe(false);
  });

  it("ignore une validation qui ne concerne que l'email", () => {
    const err = new ApiError(GENERIQUE, 400, {
      code: "VALIDATION",
      champs: [{ champ: "email", contraintes: ["isEmail"] }],
    });
    expect(messageErreurTelephone(err)).toBeNull();
    expect(erreurSeulementTelephone(err)).toBe(false);
  });

  it("ignore une validation sans liste de champs", () => {
    const err = new ApiError(GENERIQUE, 400, { code: "VALIDATION" });
    expect(messageErreurTelephone(err)).toBeNull();
    expect(erreurSeulementTelephone(err)).toBe(false);
  });

  it("ignore un conflit sans code", () => {
    const err = new ApiError("Cette information existe déjà.", 409, {});
    expect(messageErreurTelephone(err)).toBeNull();
    expect(erreurSeulementTelephone(err)).toBe(false);
  });

  it("ignore les erreurs qui ne viennent pas du serveur", () => {
    expect(messageErreurTelephone(new Error("x"))).toBeNull();
    expect(erreurSeulementTelephone(new Error("x"))).toBe(false);
    expect(messageErreurTelephone(undefined)).toBeNull();
    expect(erreurSeulementTelephone(undefined)).toBe(false);
  });
});
