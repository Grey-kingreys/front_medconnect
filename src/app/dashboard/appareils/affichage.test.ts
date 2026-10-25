import { describe, expect, it } from "vitest";
import { formaterDerniereActivite, libellePlateforme } from "./affichage";

describe("libellePlateforme", () => {
  it("nomme la plateforme en langage simple", () => {
    expect(libellePlateforme({ type: "web", plateforme: "web" })).toBe("Navigateur web");
    expect(libellePlateforme({ type: "mobile", plateforme: "ios" })).toBe("Application iPhone");
    expect(libellePlateforme({ type: "mobile", plateforme: "android" })).toBe("Application Android");
    expect(libellePlateforme({ type: "mobile", plateforme: "inconnue" })).toBe("Application mobile");
  });
});

describe("formaterDerniereActivite", () => {
  const maintenant = new Date(2026, 9, 21, 15, 0, 0);
  const formater = (date: Date) => formaterDerniereActivite(date.toISOString(), maintenant);

  it("décrit la dernière activité en langage simple", () => {
    expect(formater(new Date(maintenant.getTime() - 30_000))).toBe("à l'instant");
    expect(formater(new Date(maintenant.getTime() + 5 * 60_000))).toBe("à l'instant");
    expect(formater(new Date(maintenant.getTime() - 60_000))).toBe("il y a 1 minute");
    expect(formater(new Date(maintenant.getTime() - 45 * 60_000))).toBe("il y a 45 minutes");
    expect(formater(new Date(2026, 9, 21, 9, 5))).toBe("aujourd'hui à 09:05");
    expect(formater(new Date(2026, 9, 20, 22, 30))).toBe("hier à 22:30");
    expect(formater(new Date(2026, 9, 18, 10, 0))).toBe("il y a 3 jours");
    expect(formater(new Date(2026, 9, 14, 15, 0))).toBe("le 14 octobre 2026");
  });

  it("renvoie « inconnue » pour une date illisible", () => {
    expect(formaterDerniereActivite("pas une date", maintenant)).toBe("inconnue");
  });
});
