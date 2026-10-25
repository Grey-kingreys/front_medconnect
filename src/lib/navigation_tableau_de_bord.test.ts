import { describe, expect, it } from "vitest";
import { lireContexteAcces, type CodePermission } from "./acces";
import type { StructureType } from "./api_admin";
import type { UserProfile } from "./api_auth";
import { cartesCompteurs, estRouteAutorisee, raccourcis, sectionsMenu, type SectionMenu } from "./navigation_tableau_de_bord";

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
const libelles = (sections: SectionMenu[]) => sections.flatMap((s) => s.liens.map((l) => l.libelle));

const PERMISSIONS_ADMIN_STRUCTURE = ["structure:read", "structure:write", "membre:read", "membre:manage", "role:manage"];

const TOUS_LES_CODES: CodePermission[] = [
  "carnet:read", "consultation:write", "ordonnance:write", "analyse:write", "vaccination:write",
  "rendezvous:write", "patient:read", "sos:respond", "stock:read", "stock:write", "catalogue:write",
  "catalogue:manage", "structure:read", "structure:write", "membre:read", "membre:manage", "role:manage",
  "chat:structure", "user:admin", "platform:structures", "platform:admin",
];

describe("administrateur de pharmacie", () => {
  const ctx = contexte("STRUCTURE_ADMIN", "PHARMACIE", PERMISSIONS_ADMIN_STRUCTURE);
  const menu = sectionsMenu(ctx);

  it("voit le vocabulaire de la pharmacie et rien de l'hôpital", () => {
    const l = libelles(menu);
    expect(l).toContain("Ma pharmacie");
    expect(l).toContain("Équipe de la pharmacie");
    for (const absent of ["Patients", "Équipe médicale", "Ma structure", "Rendez-vous", "Accueil patient"]) {
      expect(l).not.toContain(absent);
    }
    expect(hrefs(menu)).not.toContain("/dashboard/patients");
  });

  it("n'a que la carte des pharmaciens et deux raccourcis", () => {
    expect(cartesCompteurs(ctx).map((c) => c.cle)).toEqual(["structurePharmaciens"]);
    const r = raccourcis(ctx);
    expect(r.map((x) => x.href)).toEqual(["/dashboard/structure", "/dashboard/membres"]);
    expect(r.map((x) => x.libelle)).toEqual(["Ma pharmacie", "Équipe de la pharmacie"]);
  });

  it("garde les pages selon le droit", () => {
    expect(estRouteAutorisee("/dashboard/patients", ctx)).toBe(false);
    expect(estRouteAutorisee("/dashboard/membres", ctx)).toBe(true);
    expect(estRouteAutorisee("/dashboard/membres/", ctx)).toBe(true);
    expect(estRouteAutorisee("/dashboard", ctx)).toBe(true);
    expect(estRouteAutorisee("/dashboard/profil", ctx)).toBe(true);
  });
});

describe("administrateur d'hôpital", () => {
  const ctx = contexte("STRUCTURE_ADMIN", "HOPITAL", [...PERMISSIONS_ADMIN_STRUCTURE, "patient:read"]);
  const menu = sectionsMenu(ctx);

  it("voit le vocabulaire de l'hôpital et rien de la pharmacie", () => {
    const l = libelles(menu);
    for (const present of ["Ma structure", "Équipe médicale", "Patients", "Rendez-vous", "Accueil patient"]) {
      expect(l).toContain(present);
    }
    for (const absent of ["Stock Médicaments", "Catalogue Médicaments", "Ma pharmacie", "Ordonnances reçues"]) {
      expect(l).not.toContain(absent);
    }
  });

  it("a les cartes médecins et patients, sans accès au stock", () => {
    expect(cartesCompteurs(ctx).map((c) => c.cle)).toEqual(["structureMedecins", "structurePatients"]);
    expect(estRouteAutorisee("/dashboard/stock", ctx)).toBe(false);
  });
});

describe("rôle personnalisé de pharmacie", () => {
  it("n'a que ce que ses droits ouvrent, puis gagne la page de la pharmacie avec le droit ajouté", () => {
    const ctx = contexte("PHARMACIEN", "PHARMACIE", ["stock:read"]);
    expect(hrefs(sectionsMenu(ctx))).toEqual([
      "/dashboard",
      "/dashboard/ordonnances",
      "/dashboard/stock",
      "/dashboard/catalogue",
    ]);
    expect(estRouteAutorisee("/dashboard/structure", ctx)).toBe(false);

    const etendu = contexte("PHARMACIEN", "PHARMACIE", ["stock:read", "structure:write"]);
    expect(libelles(sectionsMenu(etendu))).toContain("Ma pharmacie");
    expect(estRouteAutorisee("/dashboard/structure", etendu)).toBe(true);
  });
});

describe("super-administrateur en mode permissions", () => {
  it("garde son tableau de bord dédié et l'administration", () => {
    const ctx = contexte("SUPER_ADMIN", null, TOUS_LES_CODES);
    expect(hrefs(sectionsMenu(ctx))).toEqual([
      "/dashboard/super-admin",
      "/dashboard/utilisateurs",
      "/dashboard/structures",
      "/dashboard/catalogue",
    ]);
  });
});

describe("choix du mode", () => {
  it("passe en repli sans profil", () => {
    expect(lireContexteAcces({ role: "MEDECIN" }, null).mode).toBe("repli");
  });

  it("passe en repli quand le serveur ne renvoie pas structureType", () => {
    expect(lireContexteAcces({ role: "MEDECIN" }, profil("MEDECIN", undefined, ["carnet:read"])).mode).toBe("repli");
  });

  it("passe en mode permissions quand structureType vaut null", () => {
    expect(lireContexteAcces({ role: "ADMIN" }, profil("ADMIN", null, ["user:admin"])).mode).toBe("permissions");
  });
});

describe("repli sur les rôles (ancien serveur)", () => {
  const HREFS_MENU: Record<string, string[]> = {
    PATIENT: ["/dashboard", "/dashboard/carnet", "/dashboard/consultations", "/dashboard/ordonnances", "/dashboard/analyses", "/dashboard/vaccinations", "/dashboard/chat", "/dashboard/diagnostic", "/dashboard/map", "/dashboard/medicaments", "/dashboard/pharmacies", "/dashboard/mes-structures", "/dashboard/rendez-vous"],
    MEDECIN: ["/dashboard", "/dashboard/chat", "/dashboard/patients", "/dashboard/consultations", "/dashboard/ordonnances", "/dashboard/analyses", "/dashboard/catalogue", "/dashboard/rendez-vous", "/dashboard/structure"],
    PHARMACIEN: ["/dashboard", "/dashboard/ordonnances", "/dashboard/stock", "/dashboard/catalogue", "/dashboard/structure"],
    STRUCTURE_ADMIN: ["/dashboard", "/dashboard/patients", "/dashboard/structure", "/dashboard/membres"],
    ACCUEIL: ["/dashboard", "/dashboard/chat", "/dashboard/accueil", "/dashboard/patients", "/dashboard/rendez-vous"],
    ADMIN: ["/dashboard", "/dashboard/utilisateurs", "/dashboard/structures", "/dashboard/catalogue"],
    SUPER_ADMIN: ["/dashboard/super-admin", "/dashboard/utilisateurs", "/dashboard/structures", "/dashboard/catalogue"],
  };
  const HREFS_RACCOURCIS: Record<string, string[]> = {
    PATIENT: ["/dashboard/carnet", "/dashboard/consultations", "/dashboard/ordonnances", "/dashboard/diagnostic", "/dashboard/map", "/dashboard/pharmacies"],
    MEDECIN: ["/dashboard/patients", "/dashboard/consultations", "/dashboard/ordonnances", "/dashboard/rendez-vous"],
    PHARMACIEN: ["/dashboard/ordonnances", "/dashboard/stock", "/dashboard/structure"],
    STRUCTURE_ADMIN: ["/dashboard/structure", "/dashboard/membres"],
    ACCUEIL: ["/dashboard/chat", "/dashboard/accueil", "/dashboard/patients", "/dashboard/rendez-vous"],
    ADMIN: ["/dashboard/utilisateurs", "/dashboard/structures"],
    SUPER_ADMIN: ["/dashboard/utilisateurs", "/dashboard/structures"],
  };

  it.each(Object.keys(HREFS_MENU))("%s retrouve son menu et ses raccourcis d'avant", (role) => {
    const ctx = enRepli(role);
    expect(hrefs(sectionsMenu(ctx)).sort()).toEqual([...HREFS_MENU[role]].sort());
    expect(raccourcis(ctx).map((r) => r.href).sort()).toEqual([...HREFS_RACCOURCIS[role]].sort());
  });

  it("le pharmacien voit « Ma pharmacie »", () => {
    expect(libelles(sectionsMenu(enRepli("PHARMACIEN")))).toContain("Ma pharmacie");
  });

  it("aucun rôle n'a de lien vers une page qui n'existe pas", () => {
    const contextes = [...Object.keys(HREFS_MENU).map(enRepli), contexte("SUPER_ADMIN", null, TOUS_LES_CODES)];
    for (const ctx of contextes) {
      for (const absent of ["/dashboard/stats", "/dashboard/config", "/dashboard/securite"]) {
        expect(hrefs(sectionsMenu(ctx))).not.toContain(absent);
        expect(raccourcis(ctx).map((r) => r.href)).not.toContain(absent);
      }
    }
  });
});

describe("nouvelle vente", () => {
  const droits = ["stock:read", "stock:write", "vente:write"];

  it("le pharmacien avec le droit de vente voit l'entrée avant les ordonnances, avec son raccourci", () => {
    const ctx = contexte("PHARMACIEN", "PHARMACIE", droits);
    const liens = hrefs(sectionsMenu(ctx));
    expect(liens).toContain("/dashboard/vente");
    expect(liens.indexOf("/dashboard/vente")).toBeLessThan(liens.indexOf("/dashboard/ordonnances"));
    expect(libelles(sectionsMenu(ctx))).toContain("Nouvelle vente");
    expect(raccourcis(ctx).map((r) => r.href)).toContain("/dashboard/vente");
    expect(estRouteAutorisee("/dashboard/vente", ctx)).toBe(true);
  });

  it("les mêmes droits dans un hôpital n'ouvrent pas la page", () => {
    const ctx = contexte("PHARMACIEN", "HOPITAL", droits);
    expect(hrefs(sectionsMenu(ctx))).not.toContain("/dashboard/vente");
    expect(estRouteAutorisee("/dashboard/vente", ctx)).toBe(false);
  });

  it("sans le droit de vente, la page est refusée", () => {
    const ctx = contexte("PHARMACIEN", "PHARMACIE", ["stock:read", "stock:write"]);
    expect(hrefs(sectionsMenu(ctx))).not.toContain("/dashboard/vente");
    expect(estRouteAutorisee("/dashboard/vente", ctx)).toBe(false);
  });

  it("sur un ancien serveur, le pharmacien n'a pas l'entrée", () => {
    const ctx = enRepli("PHARMACIEN");
    expect(hrefs(sectionsMenu(ctx))).not.toContain("/dashboard/vente");
    expect(raccourcis(ctx).map((r) => r.href)).not.toContain("/dashboard/vente");
  });
});
