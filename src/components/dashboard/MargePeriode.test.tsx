import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api_auth";
import { getRapportMarge, type RapportMarge } from "@/lib/api_pilotage";
import { formaterGNF } from "@/lib/format_gnf";
import MargePeriode from "./MargePeriode";

vi.mock("@/lib/api_pilotage", () => ({ getRapportMarge: vi.fn() }));

const reponse = (data: unknown) => ({ data, message: "ok", success: true }) as never;

const rapport = (surcharge: Partial<RapportMarge> = {}): RapportMarge => ({
  du: "2026-11-01",
  au: "2026-11-03",
  debutFiabilite: "2026-10-05",
  periodeAvantFiabilite: false,
  nombrePieces: 12,
  chiffreAffairesTotal: 200000,
  chiffreAffairesValorise: 100000,
  coutAlloue: 76500,
  marge: 23500,
  nonValorisable: { nombreVentes: 0, chiffreAffaires: 0 },
  provisoires: { nombreLignes: 0, chiffreAffaires: 0 },
  ...surcharge,
});

/** Laisse les promesses se résoudre sous l'horloge simulée. */
const attendre = () => act(async () => {});

describe("Marge de la période", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-03T10:00:00Z"));
    vi.mocked(getRapportMarge).mockResolvedValue(reponse(rapport()));
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("demande par défaut du 1er du mois à aujourd'hui", async () => {
    render(<MargePeriode structureId="s1" />);
    await attendre();
    expect(getRapportMarge).toHaveBeenCalledWith("s1", { du: "2026-11-01", au: "2026-11-03" });
    expect(screen.getByLabelText("Du")).toHaveValue("2026-11-01");
    expect(screen.getByLabelText("Au")).toHaveValue("2026-11-03");
    expect(screen.getByText("92 jours au plus.")).toBeTruthy();
  });

  it("affiche le taux de marge sur les ventes au coût connu", async () => {
    render(<MargePeriode structureId="s1" />);
    await attendre();
    expect(within(screen.getByRole("group", { name: "Taux de marge" })).getByText(/^23,5\s%$/)).toBeTruthy();
    expect(screen.getByText(/de ventes au coût connu/)).toBeTruthy();
  });

  it("affiche à part les ventes sans coût connu et celles en attente de livraison", async () => {
    vi.mocked(getRapportMarge).mockResolvedValue(
      reponse(
        rapport({
          nonValorisable: { nombreVentes: 1, chiffreAffaires: 4000 },
          provisoires: { nombreLignes: 2, chiffreAffaires: 9000 },
        }),
      ),
    );
    render(<MargePeriode structureId="s1" />);
    await attendre();
    expect(screen.getByText("Ventes sans coût d'achat connu : 1 pour 4 000 GNF, hors marge.")).toBeTruthy();
    expect(screen.getByText("Ventes à régulariser : 2 lignes pour 9 000 GNF, hors marge.")).toBeTruthy();
  });

  it("avertit quand la période commence avant la date de fiabilité", async () => {
    vi.mocked(getRapportMarge).mockResolvedValue(reponse(rapport({ periodeAvantFiabilite: true })));
    render(<MargePeriode structureId="s1" />);
    await attendre();
    expect(
      screen.getByText("Avant le 05/10/2026, les ventes n'ont pas de coût d'achat : la marge de cette période est incomplète."),
    ).toBeTruthy();
    expect(screen.getByText("Marge fiable depuis le 05/10/2026")).toBeTruthy();
  });

  it("affiche la marge inconnue, jamais 0 GNF, quand aucune vente n'a de coût connu", async () => {
    vi.mocked(getRapportMarge).mockResolvedValue(
      reponse(
        rapport({
          chiffreAffairesValorise: 0,
          marge: 0,
          coutAlloue: 0,
          nonValorisable: { nombreVentes: 3, chiffreAffaires: 50000 },
        }),
      ),
    );
    render(<MargePeriode structureId="s1" />);
    await attendre();
    const carte = within(screen.getByRole("group", { name: "Marge" }));
    expect(carte.getByText("inconnue")).toBeTruthy();
    expect(carte.getByText("3 ventes sans coût d'achat connu")).toBeTruthy();
    expect(carte.queryByText(/GNF/)).toBeNull();
    expect(within(screen.getByRole("group", { name: "Taux de marge" })).getByText("inconnu")).toBeTruthy();
  });

  it("garde la marge négative d'une période qui ne compte qu'une annulation, sans taux", async () => {
    vi.mocked(getRapportMarge).mockResolvedValue(
      reponse(rapport({ chiffreAffairesTotal: -7000, chiffreAffairesValorise: -7000, coutAlloue: -5000, marge: -2000 })),
    );
    render(<MargePeriode structureId="s1" />);
    await attendre();
    const carte = within(screen.getByRole("group", { name: "Marge" }));
    expect(carte.getByText(formaterGNF(-2000).replace(/\s/g, " "))).toBeTruthy();
    expect(carte.queryByText("inconnue")).toBeNull();
    expect(within(screen.getByRole("group", { name: "Taux de marge" })).getByText("inconnu")).toBeTruthy();
  });

  const saisir = (du: string, au: string) => {
    fireEvent.change(screen.getByLabelText("Du"), { target: { value: du } });
    fireEvent.change(screen.getByLabelText("Au"), { target: { value: au } });
    fireEvent.click(screen.getByRole("button", { name: "Afficher" }));
  };

  it("refuse sur place une période de plus de 92 jours, sans appeler le serveur", async () => {
    render(<MargePeriode structureId="s1" />);
    await attendre();
    saisir("2026-07-01", "2026-11-03");
    await attendre();
    expect(screen.getByRole("alert").textContent).toContain("La période ne peut pas dépasser 92 jours.");
    expect(getRapportMarge).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Au")).toHaveAttribute("max", "2026-11-03");
  });

  it("accepte exactement 92 jours et refuse des dates inversées", async () => {
    render(<MargePeriode structureId="s1" />);
    await attendre();
    saisir("2026-11-03", "2026-11-01");
    await attendre();
    expect(screen.getByRole("alert").textContent).toContain("La date de début doit être avant la date de fin.");
    expect(getRapportMarge).toHaveBeenCalledTimes(1);
    saisir("2026-08-04", "2026-11-03");
    await attendre();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(getRapportMarge).toHaveBeenLastCalledWith("s1", { du: "2026-08-04", au: "2026-11-03" });
  });

  it("masque le bloc quand l'accès est refusé", async () => {
    vi.mocked(getRapportMarge).mockRejectedValue(new ApiError("Accès refusé", 403));
    const { container } = render(<MargePeriode structureId="s1" />);
    await attendre();
    expect(container.textContent).toBe("");
  });

  it("propose de réessayer après une panne", async () => {
    vi.mocked(getRapportMarge).mockRejectedValueOnce(new Error("Hors connexion")).mockResolvedValue(reponse(rapport()));
    render(<MargePeriode structureId="s1" />);
    await attendre();
    expect(screen.getByRole("alert").textContent).toContain("La marge n'a pas pu être chargée.");
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    await attendre();
    expect(screen.getByRole("group", { name: "Taux de marge" })).toBeTruthy();
    expect(getRapportMarge).toHaveBeenCalledTimes(2);
  });

  it("affiche tel quel le message du serveur quand la période dépasse 92 jours", async () => {
    vi.mocked(getRapportMarge).mockRejectedValue(new ApiError("La période ne peut pas dépasser 92 jours.", 400));
    render(<MargePeriode structureId="s1" />);
    await attendre();
    expect(screen.getByRole("alert").textContent).toContain("La période ne peut pas dépasser 92 jours.");
  });
});
