import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api_auth";
import { getAlertesPeremption, type GroupeAlerte, type LotAlerte } from "@/lib/api_pilotage";
import AlertesPeremption from "./AlertesPeremption";

vi.mock("@/lib/api_pilotage", () => ({ getAlertesPeremption: vi.fn() }));

const reponse = (data: unknown) => ({ data, message: "ok", success: true }) as never;

const lot = (surcharge: Partial<LotAlerte> = {}): LotAlerte => ({
  lotId: "l1",
  stockId: "s1",
  nom: "Doliprane 500",
  numeroLot: "CT23H990",
  dateExpiration: "2026-11-10",
  joursRestants: 7,
  quantite: 26,
  quantiteBoites: 2,
  unitesEnPlus: 6,
  lotTechnique: false,
  ficheArchivee: false,
  valeurVente: 5000,
  ...surcharge,
});

const groupe = (surcharge: Partial<GroupeAlerte> = {}): GroupeAlerte => ({
  nombreLots: 0,
  valeurVente: null,
  nombreLotsSansPrix: 0,
  lots: [],
  ...surcharge,
});

const alertes = (surcharge: Record<string, unknown> = {}) => ({
  jour: "2026-11-03",
  horizons: [
    { jours: 90, ...groupe({ nombreLots: 1, valeurVente: 9000, lots: [lot({ lotId: "l90", joursRestants: 90, dateExpiration: "2027-02-01" })] }) },
    { jours: 30, ...groupe({ nombreLots: 1, valeurVente: 7000, lots: [lot({ lotId: "l30", joursRestants: 30 })] }) },
    { jours: 7, ...groupe({ nombreLots: 1, valeurVente: 5000, lots: [lot()] }) },
  ],
  perimes: groupe({ nombreLots: 1, valeurVente: 1000, lots: [lot({ lotId: "lp", numeroLot: "AG23C777", joursRestants: -3, dateExpiration: "2026-10-31" })] }),
  sansDate: { nombreLots: 0 },
  ...surcharge,
});

describe("Péremptions à surveiller", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getAlertesPeremption).mockResolvedValue(reponse(alertes()));
  });
  afterEach(() => cleanup());

  it("affiche Périmés puis les horizons du plus court au plus long", async () => {
    render(<AlertesPeremption structureId="s1" />);
    await screen.findByRole("group", { name: "Dans 7 jours" });
    const noms = screen.getAllByRole("group").map((g) => g.getAttribute("aria-label"));
    expect(noms).toEqual(["Périmés", "Dans 7 jours", "Dans 30 jours", "Dans 90 jours"]);
    expect(getAlertesPeremption).toHaveBeenCalledWith("s1");
  });

  it("affiche inconnue pour une valeur de vente nulle, jamais 0 GNF", async () => {
    vi.mocked(getAlertesPeremption).mockResolvedValue(
      reponse(
        alertes({
          perimes: groupe({ nombreLots: 1, valeurVente: null, nombreLotsSansPrix: 1, lots: [lot({ valeurVente: null, joursRestants: -1 })] }),
        }),
      ),
    );
    render(<AlertesPeremption structureId="s1" />);
    const carte = within(await screen.findByRole("group", { name: "Périmés" }));
    expect(carte.getByText("Valeur de vente : inconnue, 1 lot sans prix")).toBeTruthy();
    expect(document.body.textContent).not.toContain("0 GNF");
  });

  it("n'évoque le coût que si la clé est transmise, et l'affiche inconnu quand elle est nulle", async () => {
    const { unmount } = render(<AlertesPeremption structureId="s1" />);
    await screen.findByRole("group", { name: "Périmés" });
    expect(document.body.textContent).not.toContain("Coût d'achat");
    unmount();

    vi.mocked(getAlertesPeremption).mockResolvedValue(
      reponse(
        alertes({
          perimes: groupe({
            nombreLots: 2,
            valeurVente: 1000,
            valeurCout: null,
            nombreLotsCoutInconnu: 2,
            lots: [lot({ joursRestants: -3, valeurCout: null, coutConnu: false })],
          }),
        }),
      ),
    );
    render(<AlertesPeremption structureId="s1" />);
    const carte = within(await screen.findByRole("group", { name: "Périmés" }));
    expect(carte.getByText("Coût d'achat : inconnu, 2 lots au coût inconnu")).toBeTruthy();
  });

  it("propose de sortir du stock un lot périmé", async () => {
    render(<AlertesPeremption structureId="s1" />);
    expect(await screen.findByText(/périmé depuis le 31\/10\/2026/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Sortir du stock" })).toHaveAttribute("href", "/dashboard/stock");
    expect(screen.getByText(/AG23C777 : 2 boîtes et 6 unités/)).toBeTruthy();
  });

  const alertesSansLot = (sansDate: number, horizons = true) =>
    reponse({
      jour: "2026-11-03",
      horizons: horizons ? [{ jours: 90, ...groupe() }, { jours: 7, ...groupe() }] : [],
      perimes: groupe(),
      sansDate: { nombreLots: sansDate },
    });

  it("ne dit pas qu'il n'y a aucune péremption quand des lots n'ont pas de date", async () => {
    vi.mocked(getAlertesPeremption).mockResolvedValue(alertesSansLot(2));
    render(<AlertesPeremption structureId="s1" />);
    expect(await screen.findByText("Aucun lot daté ne périme dans les 90 prochains jours.")).toBeTruthy();
    expect(screen.queryByText(/Aucune péremption/)).toBeNull();
    expect(screen.getByText(/2 lots sans date de péremption/)).toBeTruthy();
  });

  it("dit qu'il n'y a aucune péremption quand tout est daté, sans écrire 0 prochains jours", async () => {
    vi.mocked(getAlertesPeremption).mockResolvedValue(alertesSansLot(0));
    const { unmount } = render(<AlertesPeremption structureId="s1" />);
    expect(await screen.findByText("Aucune péremption dans les 90 prochains jours.")).toBeTruthy();
    unmount();
    vi.mocked(getAlertesPeremption).mockResolvedValue(alertesSansLot(0, false));
    render(<AlertesPeremption structureId="s1" />);
    expect(await screen.findByText("Aucune péremption prochainement.")).toBeTruthy();
    expect(document.body.textContent).not.toContain("0 prochains jours");
  });

  it("masque le bloc quand l'accès est refusé", async () => {
    vi.mocked(getAlertesPeremption).mockRejectedValue(new ApiError("Accès refusé", 403));
    const { container } = render(<AlertesPeremption structureId="s1" />);
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Péremptions à surveiller" })).toBeNull());
    expect(container.textContent).toBe("");
  });

  it("propose de réessayer après une panne", async () => {
    vi.mocked(getAlertesPeremption).mockRejectedValueOnce(new Error("Hors connexion")).mockResolvedValue(reponse(alertes()));
    render(<AlertesPeremption structureId="s1" />);
    expect((await screen.findByRole("alert")).textContent).toContain("Les péremptions n'ont pas pu être chargées.");
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    expect(await screen.findByRole("group", { name: "Dans 7 jours" })).toBeTruthy();
    expect(getAlertesPeremption).toHaveBeenCalledTimes(2);
  });

  it("compte les lots sans date et renvoie vers le stock", async () => {
    vi.mocked(getAlertesPeremption).mockResolvedValue(reponse(alertes({ sansDate: { nombreLots: 3 } })));
    render(<AlertesPeremption structureId="s1" />);
    expect(await screen.findByText(/3 lots sans date de péremption : datez-les depuis le stock\./)).toBeTruthy();
    expect(screen.getByRole("link", { name: /Ouvrir le stock/ })).toHaveAttribute("href", "/dashboard/stock");
  });
});
