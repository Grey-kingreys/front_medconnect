import { afterEach, describe, expect, it } from "vitest";
import { hauteurMicrons, largeurMicrons, taillePage } from "./mesures_ticket";
import { enregistrerReglages, lireReglages } from "./reglages";
import { migrer, VERSION_SCHEMA } from "./schema";
import type { Stockage } from "./stockage";
import { ouvrirStockage } from "./stockage_sqlite";

const OUVERTS: Stockage[] = [];

function base(): Stockage {
  const s = ouvrirStockage(":memory:");
  OUVERTS.push(s);
  migrer(s);
  return s;
}

afterEach(() => {
  for (const s of OUVERTS.splice(0)) s.fermer();
});

describe("réglages du poste", () => {
  it("la migration 4 crée la table des réglages sur une base de version 3, sans rien perdre", () => {
    const s = ouvrirStockage(":memory:");
    OUVERTS.push(s);
    migrer(s, 3);
    s.executer("UPDATE etat_poste SET structureId = 'ph1' WHERE id = 1");
    expect(s.lire("SELECT name FROM sqlite_master WHERE name = 'reglages'")).toHaveLength(0);
    migrer(s);
    expect(VERSION_SCHEMA).toBe(4);
    expect(s.lireUn<{ user_version: number }>("PRAGMA user_version")?.user_version).toBe(4);
    expect(s.lire("SELECT name FROM sqlite_master WHERE name = 'reglages'")).toHaveLength(1);
    expect(s.lireUn<{ structureId: string }>("SELECT structureId FROM etat_poste")?.structureId).toBe("ph1");
  });

  it("par défaut : aucune imprimante, 58 mm comme sur le web, impression automatique inactive", () => {
    expect(lireReglages(base())).toEqual({ imprimante: null, formatRecu: "58", impressionAutomatique: false });
  });

  it("choisir une imprimante active l'impression automatique tant qu'elle n'est pas désactivée", () => {
    const s = base();
    expect(enregistrerReglages(s, { imprimante: "Ticket 80" })).toEqual({
      imprimante: "Ticket 80",
      formatRecu: "58",
      impressionAutomatique: true,
    });
    expect(enregistrerReglages(s, { impressionAutomatique: false }).impressionAutomatique).toBe(false);
    // Un autre changement ne la réactive pas.
    expect(enregistrerReglages(s, { formatRecu: "80" })).toEqual({ imprimante: "Ticket 80", formatRecu: "80", impressionAutomatique: false });
  });

  it("les réglages survivent à la réouverture et retirer l'imprimante la remet à null", () => {
    const s = base();
    enregistrerReglages(s, { imprimante: "Ticket 58", formatRecu: "58", impressionAutomatique: true });
    expect(lireReglages(s)).toEqual({ imprimante: "Ticket 58", formatRecu: "58", impressionAutomatique: true });
    const sans = enregistrerReglages(s, { imprimante: null });
    expect(sans.imprimante).toBeNull();
    // La case reste cochée en base mais, sans imprimante, l'impression automatique est inactive.
    expect(sans.impressionAutomatique).toBe(false);
    expect(enregistrerReglages(s, { imprimante: "Ticket 58" }).impressionAutomatique).toBe(true);
  });

  it("une valeur de format illisible en base retombe sur 58 mm", () => {
    const s = base();
    s.executer("INSERT INTO reglages (cle, valeur) VALUES ('formatRecu', 'A3')");
    expect(lireReglages(s).formatRecu).toBe("58");
  });
});

describe("mesures du ticket", () => {
  it("largeurs en microns et hauteur en pixels CSS vers microns", () => {
    expect(largeurMicrons("58")).toBe(58_000);
    expect(largeurMicrons("80")).toBe(80_000);
    expect(hauteurMicrons(100)).toBe(Math.ceil(100 * 264.58) + 3_000);
    expect(hauteurMicrons(Number.NaN)).toBe(3_000);
  });

  it("un reçu de 50 lignes tient en une seule page haute (hauteur mesurée, jamais un format fixe)", () => {
    // 50 lignes de deux rangées de 15 px, plus l'entête et le pied : environ 1 900 px.
    const hauteurPx = 50 * 2 * 15 + 400;
    const page = taillePage("58", hauteurPx);
    expect(page).toEqual({ width: 58_000, height: Math.ceil(hauteurPx * 264.58) + 3_000 });
    expect((page as { height: number }).height).toBeGreaterThan(500_000);
    expect(taillePage("80", hauteurPx)).toMatchObject({ width: 80_000 });
    expect(hauteurMicrons(0)).toBe(3_000);
    expect(hauteurMicrons(-5)).toBe(3_000);
    expect(hauteurMicrons(Number.POSITIVE_INFINITY)).toBe(3_000);
  });

  it("A4 reste « A4 », les rouleaux ont une largeur fixe et une hauteur mesurée", () => {
    expect(taillePage("A4", 900)).toBe("A4");
    expect(taillePage("58", 500)).toEqual({ width: 58_000, height: Math.ceil(500 * 264.58) + 3_000 });
  });
});
