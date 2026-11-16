import { describe, expect, it } from "vitest";
import { calculerEtatCredit, resumerMedicaments } from "./credit";

const prise = (venteId: string, total: number, createdAt: string, extra: Partial<{ annulee: boolean; dateLimite: string | null }> = {}) => ({
  venteId,
  total,
  createdAt,
  annulee: false,
  dateLimite: null,
  ...extra,
});

describe("règles du cahier de crédit", () => {
  it("impute les remboursements aux prises les plus anciennes", () => {
    const e = calculerEtatCredit([prise("b", 3000, "2026-01-02"), prise("a", 2000, "2026-01-01")], 2500, "2026-02-01");
    expect(e.resteAPayer).toBe(2500);
    expect(e.prises.find((p) => p.venteId === "a")?.reste).toBe(0);
    expect(e.prises.find((p) => p.venteId === "b")?.reste).toBe(2500);
    expect(e.statut).toBe("EN_COURS");
  });

  it("un remboursement en trop solde le crédit sans reste négatif", () => {
    const e = calculerEtatCredit([prise("a", 1000, "2026-01-01")], 4000, "2026-02-01");
    expect(e.resteAPayer).toBe(0);
    expect(e.statut).toBe("SOLDE");
    expect(e.totalRembourse).toBe(4000);
  });

  it("EN_RETARD seulement si une prise non soldée a une date limite dépassée", () => {
    const p = [prise("a", 1000, "2026-01-01", { dateLimite: "2026-01-10" })];
    expect(calculerEtatCredit(p, 0, "2026-01-11").statut).toBe("EN_RETARD");
    expect(calculerEtatCredit(p, 0, "2026-01-10").statut).toBe("EN_COURS");
    expect(calculerEtatCredit(p, 1000, "2026-01-11").statut).toBe("SOLDE");
  });

  it("une prise annulée sort du reste", () => {
    const e = calculerEtatCredit([prise("a", 1000, "2026-01-01", { annulee: true })], 0, "2026-02-01");
    expect(e.resteAPayer).toBe(0);
    expect(e.totalPris).toBe(0);
  });

  it("résume les médicaments", () => {
    expect(resumerMedicaments(["A", "B", "C", "D", "A"])).toBe("A, B, C et 1 autre");
  });
});
