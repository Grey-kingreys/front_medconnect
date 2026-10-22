import { describe, expect, it } from "vitest";
import { lireContexteAcces } from "./acces";
import type { StructureType } from "./api_admin";
import type { UserProfile } from "./api_auth";
import { estRouteAutorisee, raccourcis, sectionsMenu, type SectionMenu } from "./navigation_tableau_de_bord";

const profil = (role: string, structureType: StructureType | null | undefined, permissions: string[] | undefined): UserProfile => ({
  id: "u1",
  email: "u1@exemple.com",
  nom: "Diallo",
  prenom: "Mariama",
  role,
  isActive: true,
  permissions,
  ...(structureType !== undefined ? { structureType } : {}),
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

const contexte = (role: string, structureType: StructureType | null, permissions: string[]) =>
  lireContexteAcces({ role }, profil(role, structureType, permissions));

const enRepli = (role: string) => lireContexteAcces({ role }, null);

const hrefs = (sections: SectionMenu[]) => sections.flatMap((s) => s.liens.map((l) => l.href));

const ADMIN_PHARMACIE = ["structure:read", "structure:write", "membre:read", "membre:manage", "role:manage"];
const PHARMACIEN = ["stock:read", "stock:write", "catalogue:write", "chat:structure", "structure:read", "membre:read"];

const IMPORT = "/dashboard/stock?importer=1";
const CATALOGUE = "/dashboard/catalogue";

describe("raccourcis de la pharmacie", () => {
  it("garde l'administrateur par défaut sans accès au stock", () => {
    const ctx = contexte("STRUCTURE_ADMIN", "PHARMACIE", ADMIN_PHARMACIE);
    expect(hrefs(sectionsMenu(ctx))).not.toContain("/dashboard/stock");
    expect(estRouteAutorisee("/dashboard/stock", ctx)).toBe(false);
    expect(raccourcis(ctx).map((r) => r.href)).toEqual(["/dashboard/structure", "/dashboard/membres"]);
  });

  it("ajoute l'import et le catalogue quand l'administrateur a les droits du stock", () => {
    const ctx = contexte("STRUCTURE_ADMIN", "PHARMACIE", [...ADMIN_PHARMACIE, "stock:read", "stock:write"]);
    const menu = hrefs(sectionsMenu(ctx));
    expect(menu).toContain("/dashboard/stock");
    expect(menu).toContain(CATALOGUE);
    expect(raccourcis(ctx).map((r) => r.href)).toEqual([
      "/dashboard/ordonnances",
      "/dashboard/stock",
      IMPORT,
      CATALOGUE,
      "/dashboard/structure",
      "/dashboard/membres",
    ]);
  });

  it("place les deux accès rapides après le stock pour le pharmacien", () => {
    const r = raccourcis(contexte("PHARMACIEN", "PHARMACIE", PHARMACIEN));
    expect(r.map((x) => x.href)).toEqual([
      "/dashboard/chat",
      "/dashboard/ordonnances",
      "/dashboard/stock",
      IMPORT,
      CATALOGUE,
      "/dashboard/structure",
      "/dashboard/membres",
    ]);
    expect(r.find((x) => x.href === IMPORT)?.libelle).toBe("Importer le stock");
    expect(r.find((x) => x.href === CATALOGUE)?.libelle).toBe("Catalogue des médicaments");
  });

  it("ne propose rien de tout cela à un médecin d'hôpital", () => {
    const ctx = contexte("MEDECIN", "HOPITAL", [
      "carnet:read", "consultation:write", "ordonnance:write", "analyse:write", "vaccination:write",
      "rendezvous:write", "sos:respond", "patient:read", "structure:read", "membre:read",
    ]);
    const liens = raccourcis(ctx).map((r) => r.href);
    expect(liens).not.toContain(IMPORT);
    expect(liens).not.toContain(CATALOGUE);
  });

  it("n'ajoute rien sur un ancien serveur", () => {
    const liens = raccourcis(enRepli("PHARMACIEN")).map((r) => r.href);
    expect(liens).not.toContain(IMPORT);
    expect(liens).not.toContain(CATALOGUE);
  });

  it("ne crée aucune entrée de menu avec une adresse paramétrée", () => {
    const menu = hrefs(sectionsMenu(contexte("PHARMACIEN", "PHARMACIE", PHARMACIEN)));
    expect(menu.filter((h) => h.includes("?"))).toEqual([]);
  });
});
