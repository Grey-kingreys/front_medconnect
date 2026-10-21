import { beforeEach, describe, expect, it, vi } from "vitest";
import { authFetch } from "../api_auth";
import { createConsultation } from "../api_carnet";
import {
  analyseSchema,
  consultationSchema,
  ordonnanceSchema,
  rendezVousSchema,
  vaccinationSchema,
  validerEnvoi,
} from "./carnet";

vi.mock("../api_auth");

const mockedAuthFetch = vi.mocked(authFetch);

beforeEach(() => {
  mockedAuthFetch.mockReset();
});

const UUID = "3f2b8c1e-4a5d-4e6f-9a7b-1c2d3e4f5a6b";

// Premier message d'erreur du schéma pour une donnée invalide.
function premierMessage(schema: Parameters<typeof validerEnvoi>[0], data: unknown): string {
  const resultat = schema.safeParse(data);
  expect(resultat.success).toBe(false);
  return resultat.error?.issues[0]?.message ?? "";
}

describe("consultationSchema", () => {
  it("accepte un envoi minimal", () => {
    expect(consultationSchema.safeParse({ motif: "Fièvre" }).success).toBe(true);
  });

  it("accepte un envoi complet, champs vides et absents compris", () => {
    const resultat = consultationSchema.safeParse({
      motif: "Fièvre et maux de tête",
      patientId: "p1",
      medecinNom: "Dr. Kouyaté",
      diagnostic: "",
      notes: "",
      dateConsultation: "2026-04-20",
      structureId: null,
    });
    expect(resultat.success).toBe(true);
  });

  it("refuse un motif manquant avec un message en français", () => {
    expect(premierMessage(consultationSchema, { motif: "" })).toBe("Indiquez le motif de la consultation.");
    expect(premierMessage(consultationSchema, {})).toBe("Indiquez le motif de la consultation.");
  });

  it("refuse un motif trop court et une date invalide", () => {
    expect(premierMessage(consultationSchema, { motif: "ab" })).toBe(
      "Le motif de la consultation doit contenir entre 3 et 500 caractères.",
    );
    expect(premierMessage(consultationSchema, { motif: "Fièvre", dateConsultation: "20/04/2026" })).toBe(
      "Indiquez une date de consultation valide.",
    );
  });

  it("compte un emoji comme un seul caractère, comme le back", () => {
    expect(consultationSchema.safeParse({ motif: "ab😀" }).success).toBe(true);
    expect(consultationSchema.safeParse({ motif: "a".repeat(499) + "😀" }).success).toBe(true);
  });
});

describe("ordonnanceSchema", () => {
  it("accepte un envoi minimal (liste vide, comme le back)", () => {
    expect(ordonnanceSchema.safeParse({ medicaments: [] }).success).toBe(true);
  });

  it("accepte un envoi complet sans figer la forme des lignes", () => {
    const resultat = ordonnanceSchema.safeParse({
      consultationId: "c1",
      medecinNom: "Dr. Kouyaté",
      medicaments: [
        { nom: "Coartem 20/120mg", dosage: "2 comprimés", duree: "3 jours", instructions: "" },
        { nom: "Paracétamol", dosage: "1 g", duree: "5 jours", medicamentId: "cat-42" },
      ],
      patientId: "p1",
      notes: "",
      dateExpiration: "2026-07-01",
      scanFileId: UUID,
    });
    expect(resultat.success).toBe(true);
  });

  it("refuse des médicaments absents ou envoyés sous forme de texte", () => {
    expect(premierMessage(ordonnanceSchema, {})).toBe("Ajoutez les médicaments de l'ordonnance.");
    expect(premierMessage(ordonnanceSchema, { medicaments: "[]" })).toBe("Ajoutez les médicaments de l'ordonnance.");
  });

  it("refuse une ordonnance scannée non reconnue", () => {
    expect(premierMessage(ordonnanceSchema, { medicaments: [], scanFileId: "abc" })).toBe(
      "L'ordonnance scannée n'a pas été reconnue. Ajoutez-la de nouveau.",
    );
  });
});

describe("vaccinationSchema", () => {
  it("accepte un envoi minimal", () => {
    expect(vaccinationSchema.safeParse({ vaccin: "BCG", dateVaccin: "2026-03-01" }).success).toBe(true);
  });

  it("accepte un envoi complet", () => {
    const resultat = vaccinationSchema.safeParse({
      vaccin: "Fièvre jaune",
      patientId: "p1",
      dateVaccin: "2026-03-01T09:30:00Z",
      prochainRappel: "2036-03-01",
      lotNumero: "LOT-2024-GN-01",
      administrePar: "Centre de Santé Ratoma",
      notes: "",
    });
    expect(resultat.success).toBe(true);
  });

  it("refuse un vaccin manquant et une date de rappel vide (comme le back)", () => {
    expect(premierMessage(vaccinationSchema, { vaccin: "", dateVaccin: "2026-03-01" })).toBe(
      "Indiquez le nom du vaccin.",
    );
    expect(premierMessage(vaccinationSchema, { vaccin: "BCG", dateVaccin: "2026-03-01", prochainRappel: "" })).toBe(
      "Indiquez une date de rappel valide, ou laissez le champ vide.",
    );
  });
});

describe("analyseSchema", () => {
  it("accepte un envoi minimal", () => {
    const resultat = analyseSchema.safeParse({ typeAnalyse: "NFS", resultats: "Normal", dateAnalyse: "2026-04-15" });
    expect(resultat.success).toBe(true);
  });

  it("accepte un envoi complet", () => {
    const resultat = analyseSchema.safeParse({
      typeAnalyse: "Bilan sanguin complet",
      patientId: "p1",
      laboratoire: "",
      resultats: "Hémoglobine : 12.5 g/dL",
      documentFileId: UUID,
      dateAnalyse: "2026-04-15",
      notes: "",
    });
    expect(resultat.success).toBe(true);
  });

  it("refuse des résultats manquants avec un message en français", () => {
    expect(premierMessage(analyseSchema, { typeAnalyse: "NFS", resultats: "", dateAnalyse: "2026-04-15" })).toBe(
      "Indiquez les résultats de l'analyse.",
    );
    expect(premierMessage(analyseSchema, { typeAnalyse: "NFS", resultats: "Normal" })).toBe(
      "Indiquez une date d'analyse valide.",
    );
  });
});

describe("rendezVousSchema", () => {
  it("accepte un envoi minimal", () => {
    const resultat = rendezVousSchema.safeParse({ date: "2026-12-01T10:00", motif: "Suivi", patientId: "p1" });
    expect(resultat.success).toBe(true);
  });

  it("accepte un envoi complet", () => {
    const resultat = rendezVousSchema.safeParse({
      date: "2026-04-20T10:00:00Z",
      motif: "Consultation de suivi",
      notes: "",
      patientId: "p1",
      structureId: "s1",
      medecinId: "m1",
      status: "EN_ATTENTE",
    });
    expect(resultat.success).toBe(true);
  });

  it("refuse un patient manquant, une date vide et un statut inconnu", () => {
    expect(premierMessage(rendezVousSchema, { date: "2026-12-01", motif: "Suivi" })).toBe(
      "Choisissez le patient concerné par le rendez-vous.",
    );
    expect(premierMessage(rendezVousSchema, { date: "", motif: "Suivi", patientId: "p1" })).toBe(
      "Indiquez une date de rendez-vous valide.",
    );
    expect(
      premierMessage(rendezVousSchema, { date: "2026-12-01", motif: "Suivi", patientId: "p1", status: "INCONNU" }),
    ).toBe("Le statut du rendez-vous n'est pas reconnu.");
  });
});

describe("createConsultation : validation avant l'envoi", () => {
  it("lève une erreur lisible sans appeler authFetch", async () => {
    await expect(createConsultation({ motif: "" })).rejects.toThrow("Indiquez le motif de la consultation.");
    expect(mockedAuthFetch).not.toHaveBeenCalled();
  });

  it("envoie les données d'origine telles quelles si elles sont valides", async () => {
    const data = { motif: "Fièvre", patientId: "p1", notes: "" };
    await createConsultation(data);
    expect(mockedAuthFetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(mockedAuthFetch.mock.calls[0][1]?.body as string)).toEqual(data);
  });
});
