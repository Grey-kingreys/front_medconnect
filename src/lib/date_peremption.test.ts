import { describe, expect, it } from "vitest";
import { afficherDatePeremption, lireDatePeremption } from "./date_peremption";

const MESSAGE = "Date de péremption illisible : écrivez par exemple 06/28 ou 30/06/2028.";

describe("lireDatePeremption", () => {
  it("lit le format des factures et donne le dernier jour du mois", () => {
    expect(lireDatePeremption("6/28")).toEqual({ ok: true, jour: "2028-06-30" });
    expect(lireDatePeremption("06/2028")).toEqual({ ok: true, jour: "2028-06-30" });
    expect(lireDatePeremption(" 6-28 ")).toEqual({ ok: true, jour: "2028-06-30" });
  });

  it("tient compte des années bissextiles", () => {
    expect(lireDatePeremption("2/28")).toEqual({ ok: true, jour: "2028-02-29" });
    expect(lireDatePeremption("2/27")).toEqual({ ok: true, jour: "2027-02-28" });
  });

  it("donne le 31 décembre pour décembre", () => {
    expect(lireDatePeremption("12/27")).toEqual({ ok: true, jour: "2027-12-31" });
  });

  it("lit une date complète sur deux ou quatre chiffres d'année", () => {
    expect(lireDatePeremption("15/03/2027")).toEqual({ ok: true, jour: "2027-03-15" });
    expect(lireDatePeremption("15/03/27")).toEqual({ ok: true, jour: "2027-03-15" });
  });

  it("garde la valeur d'un champ date", () => {
    expect(lireDatePeremption("2027-03-15")).toEqual({ ok: true, jour: "2027-03-15" });
  });

  it("refuse un mois hors 1 à 12", () => {
    expect(lireDatePeremption("13/28")).toEqual({ ok: false, message: MESSAGE });
  });

  it("refuse un jour inexistant, un texte ou une saisie vide", () => {
    expect(lireDatePeremption("31/04/2028")).toEqual({ ok: false, message: MESSAGE });
    expect(lireDatePeremption("abc")).toEqual({ ok: false, message: MESSAGE });
    expect(lireDatePeremption("")).toEqual({ ok: false, message: MESSAGE });
  });

  it("refuse une année de quatre chiffres inférieure à 1000", () => {
    expect(lireDatePeremption("06/0050")).toEqual({ ok: false, message: MESSAGE });
    expect(lireDatePeremption("15/03/0027")).toEqual({ ok: false, message: MESSAGE });
  });

  it("affiche un jour au format 30/06/2028", () => {
    expect(afficherDatePeremption("2028-06-30")).toBe("30/06/2028");
  });
});
