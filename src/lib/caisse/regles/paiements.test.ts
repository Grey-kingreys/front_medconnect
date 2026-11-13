import { describe, expect, it } from "vitest";
import { preparerPaiements, type ModeConnu } from "./paiements";

// Cas de back_medconnect/src/pharmacie/vente-regles.spec.ts (preparerPaiements).
const MODES: ModeConnu[] = [
  { id: "m-esp", code: "ESPECES", libelle: "Espèces", comptagePhysique: true, referenceAutorisee: false, ordre: 1 },
  { id: "m-om", code: "ORANGE_MONEY", libelle: "Orange Money", comptagePhysique: false, referenceAutorisee: true, ordre: 2 },
  { id: "m-mtn", code: "MTN_MOMO", libelle: "MTN MoMo", comptagePhysique: false, referenceAutorisee: true, ordre: 3 },
];

describe("preparerPaiements", () => {
  it("espèces par défaut", () => {
    expect(preparerPaiements(1000, undefined, MODES)).toEqual({
      ok: true,
      paiements: [{ modePaiementId: "m-esp", code: "ESPECES", montant: 1000, referenceExterne: null, montantRecu: null }],
    });
  });

  it("moitié espèces, moitié Orange Money", () => {
    const r = preparerPaiements(
      1000,
      [
        { mode: "ESPECES", montant: 500 },
        { mode: "ORANGE_MONEY", montant: 500, reference: "OM-9" },
      ],
      MODES,
    );
    expect(r).toMatchObject({ ok: true });
    if (!r.ok) return;
    expect(r.paiements.map((p) => [p.code, p.montant, p.referenceExterne])).toEqual([
      ["ESPECES", 500, null],
      ["ORANGE_MONEY", 500, "OM-9"],
    ]);
  });

  it("somme fausse : PAIEMENTS_INCOHERENTS", () => {
    expect(
      preparerPaiements(
        1000,
        [
          { mode: "ESPECES", montant: 600 },
          { mode: "ORANGE_MONEY", montant: 300 },
        ],
        MODES,
      ),
    ).toEqual({ ok: false, code: "PAIEMENTS_INCOHERENTS", somme: 900 });
  });

  it("mode inconnu, y compris l'espèces par défaut absente des modes actifs", () => {
    expect(preparerPaiements(1000, [{ mode: "CARTE", montant: 1000 }], MODES)).toEqual({
      ok: false,
      code: "MODE_PAIEMENT_INCONNU",
      mode: "CARTE",
    });
    expect(preparerPaiements(1000, undefined, MODES.slice(1))).toEqual({
      ok: false,
      code: "MODE_PAIEMENT_INCONNU",
      mode: "ESPECES",
    });
  });

  it("mode en double, montant reçu insuffisant", () => {
    expect(
      preparerPaiements(
        1000,
        [
          { mode: "ESPECES", montant: 500 },
          { mode: "ESPECES", montant: 500 },
        ],
        MODES,
      ),
    ).toEqual({ ok: false, code: "MODE_EN_DOUBLE" });
    expect(
      preparerPaiements(
        1000,
        [
          { mode: "ESPECES", montant: 600, montantRecu: 500 },
          { mode: "ORANGE_MONEY", montant: 400 },
        ],
        MODES,
      ),
    ).toEqual({ ok: false, code: "MONTANT_RECU_INSUFFISANT" });
  });

  it("rendu : le montant reçu en espèces est gardé, la référence des espèces ignorée, celle du mobile nettoyée", () => {
    const r = preparerPaiements(
      1000,
      [
        { mode: "ESPECES", montant: 500, reference: "X", montantRecu: 1000 },
        { mode: "ORANGE_MONEY", montant: 500, reference: "  OM-1  ", montantRecu: 800 },
      ],
      MODES,
    );
    expect(r).toMatchObject({ ok: true });
    if (!r.ok) return;
    expect(r.paiements[0]).toMatchObject({ referenceExterne: null, montantRecu: 1000 });
    expect(r.paiements[1]).toMatchObject({ referenceExterne: "OM-1", montantRecu: null });
  });
});
