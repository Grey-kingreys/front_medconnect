import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAutoDiagnostics, getCarnetResume, getConsultations, getRendezVous } from "@/lib/api_carnet";
import { getMyPatients } from "@/lib/api_patients";
import { getMyStock } from "@/lib/api_pharmacie";
import { getUserStats } from "@/lib/api_admin";
import { getAllStructures, getMyStructure } from "@/lib/api_structure";
import { sourcesCompteurs, type CleCompteur, type ValeursCompteurs } from "./compteurs_tableau_de_bord";

vi.mock("@/lib/api_carnet", () => ({
  getAutoDiagnostics: vi.fn(),
  getCarnetResume: vi.fn(),
  getConsultations: vi.fn(),
  getRendezVous: vi.fn(),
}));
vi.mock("@/lib/api_patients", () => ({ getMyPatients: vi.fn() }));
vi.mock("@/lib/api_pharmacie", () => ({ getMyStock: vi.fn() }));
vi.mock("@/lib/api_admin", () => ({ getUserStats: vi.fn() }));
vi.mock("@/lib/api_structure", () => ({ getAllStructures: vi.fn(), getMyStructure: vi.fn() }));

const MAINTENANT = new Date(2026, 9, 20, 10, 0, 0);

// Réponse d'API simulée (le type exact n'importe pas pour ces tests)
const reponse = (data: unknown) => ({ data, message: "ok", success: true }) as never;

const aucunMockAppele = () =>
  [getAutoDiagnostics, getCarnetResume, getConsultations, getRendezVous, getMyPatients, getMyStock, getUserStats, getAllStructures, getMyStructure].every(
    (f) => vi.mocked(f).mock.calls.length === 0,
  );

const CLES_PAR_ROLE: Record<string, CleCompteur[]> = {
  PATIENT: ["patientConsultations", "patientOrdonnances", "patientVaccinations", "patientDiagnosticsIA"],
  MEDECIN: ["medecinPatients", "medecinConsultationsAujourdhui", "medecinRendezVousAVenir"],
  PHARMACIEN: ["pharmacieMedicamentsEnStock", "pharmacieRuptures"],
  ADMIN: ["adminUtilisateurs", "adminStructures"],
  STRUCTURE_ADMIN: ["structureMedecins", "structurePharmaciens", "structurePatients"],
  ACCUEIL: ["accueilRdvEnAttente", "accueilRdvAujourdhui", "accueilRdvAVenir"],
};

const TOUTES_LES_CLES: CleCompteur[] = Object.values(CLES_PAR_ROLE).flat();

async function charger(role: string, utilisateur: { id: string; structureId?: string }) {
  const sources = sourcesCompteurs(CLES_PAR_ROLE[role], utilisateur, MAINTENANT);
  const valeurs: ValeursCompteurs = {};
  for (const source of sources) Object.assign(valeurs, await source.charger());
  return { sources, valeurs };
}

const rdv = (medecinId: string, date: Date, status: string) => ({ medecinId, date: date.toISOString(), status });
const demain = new Date(2026, 9, 21, 9, 0, 0);
const hier = new Date(2026, 9, 19, 9, 0, 0);
const ceSoir = new Date(2026, 9, 20, 18, 0, 0);
const ceMatin = new Date(2026, 9, 20, 8, 0, 0);

describe("sourcesCompteurs", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("calcule les compteurs d'un patient", async () => {
    vi.mocked(getCarnetResume).mockResolvedValue(
      reponse({ stats: { consultations: 3, ordonnances: 2, analyses: 9, vaccinations: 1 } }),
    );
    vi.mocked(getAutoDiagnostics).mockResolvedValue(reponse([{}, {}, {}, {}]));
    const { sources, valeurs } = await charger("PATIENT", { id: "p1" });
    expect(sources).toHaveLength(2);
    expect(valeurs).toEqual({
      patientConsultations: 3,
      patientOrdonnances: 2,
      patientVaccinations: 1,
      patientDiagnosticsIA: 4,
    });
  });

  it("calcule les compteurs d'un médecin", async () => {
    vi.mocked(getMyPatients).mockResolvedValue(reponse([{}, {}]));
    vi.mocked(getConsultations).mockResolvedValue(
      reponse([
        { dateConsultation: ceMatin.toISOString() },
        { dateConsultation: ceSoir.toISOString() },
        { dateConsultation: hier.toISOString() },
      ]),
    );
    vi.mocked(getRendezVous).mockResolvedValue(
      reponse([
        rdv("m1", demain, "PROGRAMME"),
        rdv("m1", demain, "CONFIRME"),
        rdv("m1", demain, "EN_ATTENTE"),
        rdv("m1", demain, "ANNULE"),
        rdv("m1", hier, "PROGRAMME"),
        rdv("m2", demain, "PROGRAMME"),
      ]),
    );
    const { valeurs } = await charger("MEDECIN", { id: "m1" });
    expect(valeurs).toEqual({ medecinPatients: 2, medecinConsultationsAujourdhui: 2, medecinRendezVousAVenir: 2 });
  });

  it("calcule les compteurs d'un pharmacien rattaché à une structure", async () => {
    vi.mocked(getMyStock).mockResolvedValue(
      reponse({ stocks: [{ quantite: 5 }, { quantite: 0 }, { quantite: 12 }], alertes: { rupture: [{}] } }),
    );
    const { valeurs } = await charger("PHARMACIEN", { id: "ph1", structureId: "s1" });
    expect(valeurs).toEqual({ pharmacieMedicamentsEnStock: 2, pharmacieRuptures: 1 });
    expect(getMyStock).toHaveBeenCalledWith("s1");
  });

  it("échoue sans interroger le stock pour un pharmacien sans structure", async () => {
    const sources = sourcesCompteurs(CLES_PAR_ROLE.PHARMACIEN, { id: "ph1" }, MAINTENANT);
    expect(sources).toHaveLength(1);
    await expect(sources[0].charger()).rejects.toThrow();
    expect(getMyStock).not.toHaveBeenCalled();
  });

  it("calcule les compteurs d'un administrateur", async () => {
    vi.mocked(getUserStats).mockResolvedValue(reponse({ total: 42 }));
    vi.mocked(getAllStructures).mockResolvedValue(reponse([{}, {}, {}]));
    const { valeurs } = await charger("ADMIN", { id: "a1" });
    expect(valeurs).toEqual({ adminUtilisateurs: 42, adminStructures: 3 });
  });

  it("calcule les compteurs d'un administrateur de structure", async () => {
    vi.mocked(getMyStructure).mockResolvedValue(
      reponse({ membres: [{ role: "MEDECIN" }, { role: "MEDECIN" }, { role: "PHARMACIEN" }, { role: "ACCUEIL" }] }),
    );
    vi.mocked(getMyPatients).mockResolvedValue(reponse([{}, {}, {}, {}, {}]));
    const { valeurs } = await charger("STRUCTURE_ADMIN", { id: "sa1" });
    expect(valeurs).toEqual({ structureMedecins: 2, structurePharmaciens: 1, structurePatients: 5 });
  });

  it("calcule les compteurs de l'accueil selon chaque règle", async () => {
    vi.mocked(getRendezVous).mockResolvedValue(
      reponse([
        rdv("m1", demain, "EN_ATTENTE"), // en attente, à venir
        rdv("m1", hier, "EN_ATTENTE"), // en attente, ni aujourd'hui ni à venir
        rdv("m1", ceSoir, "PROGRAMME"), // aujourd'hui, à venir
        rdv("m1", ceMatin, "CONFIRME"), // aujourd'hui, déjà passé donc pas à venir
        rdv("m1", demain, "CONFIRME"), // à venir
        rdv("m1", demain, "ANNULE"), // exclu partout
      ]),
    );
    const { valeurs } = await charger("ACCUEIL", { id: "ac1" });
    expect(valeurs).toEqual({ accueilRdvEnAttente: 2, accueilRdvAujourdhui: 2, accueilRdvAVenir: 3 });
  });

  it("ne renvoie aucune source sans clé demandée", () => {
    expect(sourcesCompteurs([], { id: "x1", structureId: "s1" }, MAINTENANT)).toEqual([]);
    expect(aucunMockAppele()).toBe(true);
  });

  it("ne renvoie que la source qui porte la clé demandée, avec ses deux clés", () => {
    const sources = sourcesCompteurs(["structurePharmaciens"], { id: "sa1" }, MAINTENANT);
    expect(sources).toHaveLength(1);
    expect(sources[0].cles).toEqual(["structureMedecins", "structurePharmaciens"]);
    expect(aucunMockAppele()).toBe(true);
  });

  it("renvoie pour chaque source exactement les clés annoncées", async () => {
    vi.mocked(getCarnetResume).mockResolvedValue(reponse({ stats: { consultations: 1, ordonnances: 1, analyses: 1, vaccinations: 1 } }));
    vi.mocked(getAutoDiagnostics).mockResolvedValue(reponse([]));
    vi.mocked(getMyPatients).mockResolvedValue(reponse([]));
    vi.mocked(getConsultations).mockResolvedValue(reponse([]));
    vi.mocked(getRendezVous).mockResolvedValue(reponse([]));
    vi.mocked(getMyStock).mockResolvedValue(reponse({ stocks: [], alertes: { rupture: [] } }));
    vi.mocked(getUserStats).mockResolvedValue(reponse({ total: 0 }));
    vi.mocked(getAllStructures).mockResolvedValue(reponse([]));
    vi.mocked(getMyStructure).mockResolvedValue(reponse({ membres: [] }));
    const sources = sourcesCompteurs(TOUTES_LES_CLES, { id: "u1", structureId: "s1" }, MAINTENANT);
    expect(sources).toHaveLength(11);
    for (const source of sources) {
      const valeurs = await source.charger();
      expect(Object.keys(valeurs).sort()).toEqual([...source.cles].sort());
    }
  });
});
