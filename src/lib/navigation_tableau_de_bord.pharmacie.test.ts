import { describe, expect, it } from "vitest";
import { lireContexteAcces } from "./acces";
import type { StructureType } from "./api_admin";
import type { UserProfile } from "./api_auth";
import {
  estRouteAutorisee,
  raccourcis,
  sectionsMenu,
  vuePharmacie,
  type SectionMenu,
} from "./navigation_tableau_de_bord";

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

  it("place Ventes du jour juste après Nouvelle vente, dans le menu et les raccourcis", () => {
    const ctx = contexte("PHARMACIEN", "PHARMACIE", ["vente:read", "vente:write"]);
    const section = sectionsMenu(ctx).find((s) => s.liens.some((l) => l.href === "/dashboard/vente"));
    const liens = section?.liens.map((l) => l.libelle) ?? [];
    expect(liens[liens.indexOf("Nouvelle vente") + 1]).toBe("Ventes du jour");
    expect(hrefs(sectionsMenu(ctx))).toContain("/dashboard/ventes");
    const r = raccourcis(ctx);
    expect(r.find((x) => x.href === "/dashboard/ventes")?.libelle).toBe("Ventes du jour");
    expect(estRouteAutorisee("/dashboard/ventes", ctx)).toBe(true);
  });

  it("n'ouvre pas Ventes du jour en hôpital, sans droit de lecture ni en repli", () => {
    const hopital = contexte("PHARMACIEN", "HOPITAL", ["vente:read", "vente:write"]);
    expect(hrefs(sectionsMenu(hopital))).not.toContain("/dashboard/ventes");
    expect(estRouteAutorisee("/dashboard/ventes", hopital)).toBe(false);
    expect(estRouteAutorisee("/dashboard/ventes", contexte("PHARMACIEN", "PHARMACIE", ["vente:write"]))).toBe(false);
    const repli = enRepli("PHARMACIEN");
    expect(hrefs(sectionsMenu(repli))).not.toContain("/dashboard/ventes");
    expect(raccourcis(repli).map((x) => x.href)).not.toContain("/dashboard/ventes");
  });

  it("ne crée aucune entrée de menu avec une adresse paramétrée", () => {
    const menu = hrefs(sectionsMenu(contexte("PHARMACIEN", "PHARMACIE", PHARMACIEN)));
    expect(menu.filter((h) => h.includes("?"))).toEqual([]);
  });
});

describe("vue d'accueil et menu de la pharmacie (démo)", () => {
  const PERMISSIONS_PHARMACIEN_DEMO = [
    "catalogue:write", "chat:structure", "membre:read", "stock:read", "stock:write", "structure:read", "vente:read", "vente:write",
  ];
  const PERMISSIONS_ADMIN_DEMO = [
    "membre:manage", "membre:read", "role:manage", "stock:read", "stock:write", "structure:read", "structure:write",
    "vente:annuler", "vente:read", "vente:write",
  ];
  const pharmacien = () => contexte("PHARMACIEN", "PHARMACIE", PERMISSIONS_PHARMACIEN_DEMO);
  const admin = () => contexte("STRUCTURE_ADMIN", "PHARMACIE", PERMISSIONS_ADMIN_DEMO);

  it("choisit la vue d'après les permissions", () => {
    expect(vuePharmacie(admin())).toBe("pilotage");
    expect(vuePharmacie(pharmacien())).toBe("comptoir");
    expect(vuePharmacie(contexte("PHARMACIEN", "PHARMACIE", [...PERMISSIONS_PHARMACIEN_DEMO, "vente:annuler"]))).toBe("pilotage");
    expect(vuePharmacie(contexte("MEDECIN", "HOPITAL", ["structure:read", "structure:write"]))).toBeNull();
    expect(vuePharmacie(enRepli("PHARMACIEN"))).toBeNull();
    expect(vuePharmacie(enRepli("STRUCTURE_ADMIN"))).toBeNull();
  });

  it("garde Ma pharmacie en tête de la section Établissement", () => {
    for (const ctx of [admin(), pharmacien()]) {
      const section = sectionsMenu(ctx).find((s) => s.id === "etablissement");
      expect(section?.liens[0].libelle).toBe("Ma pharmacie");
      expect(section?.liens[0].href).toBe("/dashboard/structure");
    }
  });

  it("ne retire aucune page à ceux qui y ont droit", () => {
    const adresses = [
      "/dashboard/vente", "/dashboard/ventes", "/dashboard/ordonnances", "/dashboard/stock",
      "/dashboard/catalogue", "/dashboard/structure", "/dashboard/membres",
    ];
    for (const ctx of [admin(), pharmacien()]) {
      const menu = hrefs(sectionsMenu(ctx));
      for (const adresse of adresses) {
        expect(estRouteAutorisee(adresse, ctx)).toBe(true);
        expect(menu).toContain(adresse);
      }
    }
    expect(hrefs(sectionsMenu(pharmacien()))).toContain("/dashboard/chat");
  });

  it("décrit Ma pharmacie sans promettre une modification", () => {
    const r = raccourcis(admin()).find((x) => x.href === "/dashboard/structure");
    expect(r?.description).toBe("Informations, horaires et garde de votre pharmacie");
  });
});
