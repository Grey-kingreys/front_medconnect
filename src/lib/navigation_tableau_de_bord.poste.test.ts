import { afterEach, describe, expect, it } from "vitest";
import { lireContexteAcces } from "./acces";
import type { UserProfile } from "./api_auth";
import type { PontDesktop } from "./caisse/contrat_desktop";
import { estRouteAutorisee, sectionsMenu } from "./navigation_tableau_de_bord";

const profil: UserProfile = {
  id: "u1",
  email: "u1@exemple.com",
  nom: "Diallo",
  prenom: "Mariama",
  role: "PHARMACIEN",
  isActive: true,
  permissions: ["vente:read", "vente:write", "caisse:utiliser", "stock:read"],
  structureType: "PHARMACIE",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const liens = () => sectionsMenu(lireContexteAcces({ role: "PHARMACIEN" }, profil)).flatMap((s) => s.liens);

afterEach(() => {
  delete window.medconnecteDesktop;
});

describe("entrée de menu « Ce poste »", () => {
  it("n'existe pas sur le web : le menu est celui d'avant", () => {
    const l = liens();
    expect(l.map((x) => x.href)).not.toContain("/dashboard/poste");
    expect(l.map((x) => x.libelle)).not.toContain("Ce poste");
  });

  it("existe dans l'application de caisse, dans la section Pharmacie", () => {
    window.medconnecteDesktop = { version: "0.1.0" } as unknown as PontDesktop;
    const sections = sectionsMenu(lireContexteAcces({ role: "PHARMACIEN" }, profil));
    const lien = sections.flatMap((s) => s.liens).find((x) => x.href === "/dashboard/poste");
    expect(lien?.libelle).toBe("Ce poste");
    expect(sections.find((s) => s.liens.some((x) => x.href === "/dashboard/poste"))?.titre).toBe("Pharmacie");
  });

  it("la garde des pages laisse la page décider (introuvable sur le web)", () => {
    expect(estRouteAutorisee("/dashboard/poste", lireContexteAcces({ role: "PHARMACIEN" }, profil))).toBe(true);
  });
});
