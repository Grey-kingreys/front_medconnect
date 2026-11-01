import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api_auth";
import type { Inventaire, LotEnStock, StockMedicament } from "@/lib/api_pharmacie";
import InventairePage from "./page";

const { getMyStock, listerLotsFiche, enregistrerInventaire } = vi.hoisted(() => ({
  getMyStock: vi.fn(),
  listerLotsFiche: vi.fn(),
  enregistrerInventaire: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "u1", structureId: "p1", email: "u1@exemple.com", nom: "Baldé", prenom: "Djénabou", role: "STRUCTURE_ADMIN" },
    loading: false,
    profile: null,
  }),
}));
vi.mock("@/lib/api_pharmacie", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api_pharmacie")>()),
  getMyStock,
  listerLotsFiche,
  enregistrerInventaire,
}));

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const fiche = (id: string, nom: string, surcharge: Partial<StockMedicament> = {}): StockMedicament => ({
  id,
  medicamentId: `m-${id}`,
  medicament: { id: `m-${id}`, nom, categorie: "Divers", ordonnanceRequise: false, formes: [] },
  structureId: "p1",
  quantite: 0,
  prixUnitaire: 1500,
  disponible: true,
  coefficientBoite: 1,
  uniteMinimale: "UNITE",
  qualifie: true,
  ...surcharge,
});

const STOCKS = [
  fiche("s1", "Doliprane", { coefficientBoite: 10, uniteMinimale: "COMPRIME" }),
  fiche("s5", "Spasfon"),
];

const lot = (id: string, numeroLot: string | null, dateExpiration: string | null, surcharge: Partial<LotEnStock> = {}): LotEnStock => ({
  id,
  numeroLot,
  dateExpiration,
  dateReception: "2026-01-10T00:00:00.000Z",
  quantite: 250,
  reliquat: 0,
  coefficientReception: 10,
  lotTechnique: false,
  perime: false,
  ...surcharge,
});

const LOTS_DOLIPRANE = [
  lot("l1", "DL23K052", "2028-06-30T00:00:00.000Z"),
  lot("l2", null, "2029-01-31T00:00:00.000Z"),
];

const reponse = (surcharge: Partial<Inventaire> = {}, message = "Inventaire enregistré : 1 écart signalé.") => ({
  data: {
    id: "i1",
    createdAt: "2026-10-22T10:00:00.000Z",
    commentaire: null,
    auteurId: "u1",
    lignes: [],
    cree: true,
    avertissements: [],
    ...surcharge,
  } as Inventaire,
  message,
  success: true,
});

const TERMES_INTERDITS = /\b(ID|UUID|null|undefined|NaN|coefficient|UM|théorique)\b/;

const verifierTermes = () => {
  const contenu = document.body.textContent ?? "";
  expect(contenu).not.toMatch(TERMES_INTERDITS);
  expect(contenu).not.toContain(String.fromCharCode(0x2013));
  expect(contenu).not.toContain(String.fromCharCode(0x2014));
};

const ajouter = async (recherche: string, intitule: RegExp) => {
  const champ = screen.getByLabelText("Nom ou nom générique");
  fireEvent.change(champ, { target: { value: recherche } });
  fireEvent.keyDown(champ, { key: "Enter" });
  return screen.findAllByRole("group", { name: intitule });
};

const groupe = (intitule: RegExp) => within(screen.getByRole("group", { name: intitule }));

const enregistrer = () => fireEvent.click(screen.getByRole("button", { name: "Enregistrer l'inventaire" }));

const attendrePage = async () => {
  await screen.findByLabelText("Nom ou nom générique");
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-22T10:00:00Z"));
  getMyStock.mockResolvedValue({ data: { stocks: STOCKS, alertes: { stockBas: [], rupture: [] } }, message: "ok", success: true });
  listerLotsFiche.mockImplementation((_: string, stockId: string) =>
    Promise.resolve({ data: stockId === "s1" ? LOTS_DOLIPRANE : [], message: "ok", success: true }),
  );
  enregistrerInventaire.mockResolvedValue(reponse());
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Inventaire", () => {
  it("propose les lots de la fiche, sans champ de numéro de lot ni stock attendu", async () => {
    render(<InventairePage />);
    await attendrePage();
    await ajouter("dolip", /DL23K052/);
    expect(screen.getByRole("group", { name: "Lot DL23K052, expire le 30/06/2028" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Lot sans numéro, expire le 31/01/2029" })).toBeInTheDocument();
    expect(screen.queryByLabelText(/numéro de lot/i)).toBeNull();
    expect(screen.queryByLabelText(/^Lot/)).toBeNull();
    // Comptage à l'aveugle : la quantité en stock n'est pas montrée.
    expect(document.body.textContent).not.toContain("25 boîtes");
    expect(screen.getAllByText("Un lot laissé vide n'est pas modifié. Saisissez 0 pour un lot absent du rayon.").length).toBeGreaterThan(0);
    verifierTermes();
  });

  it("envoie un lot proposé compté en boîtes et unités en plus", async () => {
    render(<InventairePage />);
    await attendrePage();
    await ajouter("dolip", /DL23K052/);
    const l1 = groupe(/DL23K052/);
    fireEvent.change(l1.getByLabelText("Boîtes"), { target: { value: "2" } });
    fireEvent.change(l1.getByLabelText("comprimés en plus"), { target: { value: "6" } });
    enregistrer();
    await waitFor(() => expect(enregistrerInventaire).toHaveBeenCalledTimes(1));
    const [structureId, corps] = enregistrerInventaire.mock.calls[0];
    expect(structureId).toBe("p1");
    expect(corps.id).toMatch(UUID);
    expect(corps.lignes).toEqual([{ stockId: "s1", lotId: "l1", nombreBoites: 2, unitesEnPlus: 6 }]);
  });

  it("n'envoie pas un lot laissé vide et envoie un lot à 0", async () => {
    render(<InventairePage />);
    await attendrePage();
    await ajouter("dolip", /DL23K052/);
    fireEvent.change(groupe(/Lot sans numéro/).getByLabelText("Boîtes"), { target: { value: "0" } });
    enregistrer();
    await waitFor(() => expect(enregistrerInventaire).toHaveBeenCalledTimes(1));
    expect(enregistrerInventaire.mock.calls[0][1].lignes).toEqual([{ stockId: "s1", lotId: "l2", nombreBoites: 0 }]);
  });

  it("ajoute un autre lot trouvé en rayon par sa seule date, lue en 6/28", async () => {
    render(<InventairePage />);
    await attendrePage();
    await ajouter("dolip", /DL23K052/);
    fireEvent.click(screen.getByRole("button", { name: "Autre lot trouvé en rayon" }));
    const autre = groupe(/^Autre lot trouvé en rayon$/);
    fireEvent.change(autre.getByLabelText("Péremption"), { target: { value: "6/28" } });
    fireEvent.change(autre.getByLabelText("Boîtes"), { target: { value: "3" } });
    expect(screen.queryByLabelText(/numéro de lot/i)).toBeNull();
    enregistrer();
    await waitFor(() => expect(enregistrerInventaire).toHaveBeenCalledTimes(1));
    const corps = enregistrerInventaire.mock.calls[0][1];
    expect(corps.lignes).toEqual([{ stockId: "s1", dateExpiration: "2028-06-30", nombreBoites: 3 }]);
    expect(JSON.stringify(corps)).not.toContain("numeroLot");
  });

  it("refuse un autre lot sans date ni case « Sans date »", async () => {
    render(<InventairePage />);
    await attendrePage();
    await ajouter("dolip", /DL23K052/);
    fireEvent.click(screen.getByRole("button", { name: "Autre lot trouvé en rayon" }));
    fireEvent.change(groupe(/^Autre lot trouvé en rayon$/).getByLabelText("Boîtes"), { target: { value: "3" } });
    enregistrer();
    expect(await screen.findByText("Saisissez au moins un comptage, et la date de péremption des lots ajoutés.")).toBeInTheDocument();
    expect(enregistrerInventaire).not.toHaveBeenCalled();
    expect(groupe(/^Autre lot trouvé en rayon$/).getByLabelText("Péremption")).toHaveAttribute("aria-invalid", "true");
  });

  it("envoie la ligne « Stock de ce médicament » sans lot pour une fiche sans lot", async () => {
    render(<InventairePage />);
    await attendrePage();
    await ajouter("spasf", /Stock de ce médicament/);
    fireEvent.change(groupe(/Stock de ce médicament/).getByLabelText("Boîtes"), { target: { value: "4" } });
    enregistrer();
    await waitFor(() => expect(enregistrerInventaire).toHaveBeenCalledTimes(1));
    expect(enregistrerInventaire.mock.calls[0][1].lignes).toEqual([{ stockId: "s5", nombreBoites: 4 }]);
  });

  it("montre le résultat avec l'écart signalé et le message du serveur en titre", async () => {
    enregistrerInventaire.mockResolvedValue(
      reponse({
        lignes: [
          {
            id: "x1",
            stockId: "s1",
            nom: "Doliprane",
            lotId: "l1",
            numeroLot: "DL23K052",
            dateExpiration: "2028-06-30T00:00:00.000Z",
            lotTechnique: false,
            quantiteTheorique: 25,
            quantiteComptee: 20,
            ecart: -5,
            sousTolerance: false,
            anomalieId: "a1",
          },
        ],
      }),
    );
    render(<InventairePage />);
    await attendrePage();
    await ajouter("dolip", /DL23K052/);
    fireEvent.change(groupe(/DL23K052/).getByLabelText("Boîtes"), { target: { value: "2" } });
    enregistrer();
    expect(await screen.findByRole("heading", { name: "Inventaire enregistré : 1 écart signalé." })).toBeInTheDocument();
    const ligne = screen.getByRole("row", { name: /Doliprane/ });
    expect(within(ligne).getByText("-5 comprimés")).toHaveClass("text-rose-700");
    expect(within(ligne).getByText("Oui")).toBeInTheDocument();
    expect(within(ligne).getByText("2 boîtes et 5 comprimés")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nouvel inventaire" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voir le stock" })).toBeInTheDocument();
    verifierTermes();
  });

  it("rejoue le même identifiant après un échec réseau", async () => {
    enregistrerInventaire.mockRejectedValueOnce(new ApiError("Réseau", 0));
    render(<InventairePage />);
    await attendrePage();
    await ajouter("dolip", /DL23K052/);
    fireEvent.change(groupe(/DL23K052/).getByLabelText("Boîtes"), { target: { value: "2" } });
    enregistrer();
    fireEvent.click(await screen.findByRole("button", { name: "Réessayer l'envoi" }));
    await waitFor(() => expect(enregistrerInventaire).toHaveBeenCalledTimes(2));
    expect(enregistrerInventaire.mock.calls[1][1].id).toBe(enregistrerInventaire.mock.calls[0][1].id);
    expect(await screen.findByRole("heading", { name: "Inventaire enregistré : 1 écart signalé." })).toBeInTheDocument();
  });

  const REFUS_LOT_REQUIS = (stockId: string, nom: string, lots: Record<string, unknown>[]) =>
    new ApiError("Ce médicament a plusieurs lots en stock : précisez le lot compté.", 409, {
      code: "LOT_REQUIS",
      details: [{ stockId, nom, lots }],
    });

  const RAPPEL_4_BOITES = "Vous aviez compté 4 boîtes pour ce médicament : répartissez ce comptage entre les lots ci-dessous.";

  it("après un refus « lot requis », relit les lots de la fiche et rappelle le comptage sans le répartir", async () => {
    listerLotsFiche
      .mockResolvedValueOnce({ data: [], message: "ok", success: true })
      .mockResolvedValueOnce({
        data: [lot("l9", "SP1", "2028-06-30T00:00:00.000Z", { quantite: 30 }), lot("l8", null, "2029-03-31T00:00:00.000Z", { quantite: 10 })],
        message: "ok",
        success: true,
      });
    enregistrerInventaire
      .mockRejectedValueOnce(
        REFUS_LOT_REQUIS("s5", "Spasfon", [
          { lotId: "l9", numeroLot: "SP1", dateExpiration: "2028-06-30T00:00:00.000Z", quantite: 30 },
          { lotId: "l8", numeroLot: null, dateExpiration: "2029-03-31T00:00:00.000Z", quantite: 10 },
        ]),
      )
      .mockResolvedValueOnce(reponse());
    render(<InventairePage />);
    await attendrePage();
    await ajouter("spasf", /Stock de ce médicament/);
    fireEvent.change(groupe(/Stock de ce médicament/).getByLabelText("Boîtes"), { target: { value: "4" } });
    enregistrer();
    expect(await screen.findByText("Ce médicament a plusieurs lots en stock : précisez le lot compté.")).toBeInTheDocument();
    const sp1 = within(await screen.findByRole("group", { name: "Lot SP1, expire le 30/06/2028" }));
    expect(screen.getByRole("group", { name: "Lot sans numéro, expire le 31/03/2029" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: /Stock de ce médicament/ })).toBeNull();
    // Lots relus depuis la fiche : unités par boîte du lot (10), alors que la fiche n'en a qu'une.
    expect(listerLotsFiche).toHaveBeenCalledTimes(2);
    expect(listerLotsFiche).toHaveBeenLastCalledWith("p1", "s5");
    expect(sp1.getByLabelText("unités en plus")).toBeInTheDocument();
    // Rappel du comptage, aucune répartition : les champs des lots restent vides.
    expect(screen.getByText(RAPPEL_4_BOITES)).toBeInTheDocument();
    for (const champ of screen.getAllByLabelText("Boîtes")) expect(champ).toHaveValue("");
    // Comptage à l'aveugle : ni la quantité en stock, ni celle du refus.
    for (const quantite of ["3 boîtes", "1 boîte", "30 unités", "10 unités"]) expect(document.body.textContent).not.toContain(quantite);
    verifierTermes();

    fireEvent.change(sp1.getByLabelText("Boîtes"), { target: { value: "3" } });
    fireEvent.change(groupe(/Lot sans numéro/).getByLabelText("Boîtes"), { target: { value: "1" } });
    expect(screen.getByText(RAPPEL_4_BOITES)).toBeInTheDocument();
    enregistrer();
    await waitFor(() => expect(enregistrerInventaire).toHaveBeenCalledTimes(2));
    expect(enregistrerInventaire.mock.calls[1][1].lignes).toEqual([
      { stockId: "s5", lotId: "l9", nombreBoites: 3 },
      { stockId: "s5", lotId: "l8", nombreBoites: 1 },
    ]);
  });

  it("reprend les lots cités par le refus si la relecture des lots échoue", async () => {
    listerLotsFiche
      .mockResolvedValueOnce({ data: [], message: "ok", success: true })
      .mockRejectedValueOnce(new ApiError("Réseau", 0));
    enregistrerInventaire.mockRejectedValueOnce(
      REFUS_LOT_REQUIS("s5", "Spasfon", [{ lotId: "l9", numeroLot: "SP1", dateExpiration: "2028-06-30T00:00:00.000Z", quantite: 3 }]),
    );
    render(<InventairePage />);
    await attendrePage();
    await ajouter("spasf", /Stock de ce médicament/);
    fireEvent.change(groupe(/Stock de ce médicament/).getByLabelText("Boîtes"), { target: { value: "4" } });
    enregistrer();
    expect(await screen.findByRole("group", { name: "Lot SP1, expire le 30/06/2028" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: /Stock de ce médicament/ })).toBeNull();
    expect(screen.getByText(RAPPEL_4_BOITES)).toBeInTheDocument();
    expect(groupe(/SP1/).getByLabelText("Boîtes")).toHaveValue("");
    expect(document.body.textContent).not.toContain("3 boîtes");
  });

  it("garde le comptage des lots déjà saisis quand un refus « lot requis » relit la fiche", async () => {
    enregistrerInventaire.mockRejectedValueOnce(
      REFUS_LOT_REQUIS("s1", "Doliprane", [
        { lotId: "l1", numeroLot: "DL23K052", dateExpiration: "2028-06-30T00:00:00.000Z", quantite: 250 },
        { lotId: "l2", numeroLot: null, dateExpiration: "2029-01-31T00:00:00.000Z", quantite: 250 },
      ]),
    );
    render(<InventairePage />);
    await attendrePage();
    await ajouter("dolip", /DL23K052/);
    fireEvent.change(groupe(/DL23K052/).getByLabelText("Boîtes"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Autre lot trouvé en rayon" }));
    fireEvent.change(groupe(/^Autre lot trouvé en rayon$/).getByLabelText("Péremption"), { target: { value: "6/28" } });
    fireEvent.change(groupe(/^Autre lot trouvé en rayon$/).getByLabelText("Boîtes"), { target: { value: "3" } });
    enregistrer();
    await screen.findByText("Ce médicament a plusieurs lots en stock : précisez le lot compté.");
    await waitFor(() => expect(listerLotsFiche).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(groupe(/DL23K052/).getByLabelText("Boîtes")).toHaveValue("2"));
    expect(screen.getAllByRole("group", { name: /DL23K052/ })).toHaveLength(1);
    expect(groupe(/^Autre lot trouvé en rayon$/).getByLabelText("Boîtes")).toHaveValue("3");
    // Aucun rappel : il n'y avait pas de ligne « Stock de ce médicament ».
    expect(screen.queryByText(/Vous aviez compté/)).toBeNull();
  });

  it("affiche les deux messages d'une ligne en erreur sur les boîtes et les unités", async () => {
    render(<InventairePage />);
    await attendrePage();
    await ajouter("dolip", /DL23K052/);
    const l1 = groupe(/DL23K052/);
    fireEvent.change(l1.getByLabelText("Boîtes"), { target: { value: "deux" } });
    fireEvent.change(l1.getByLabelText("comprimés en plus"), { target: { value: "-1" } });
    enregistrer();
    await screen.findByText("Saisissez au moins un comptage, et la date de péremption des lots ajoutés.");
    expect(enregistrerInventaire).not.toHaveBeenCalled();
    const boites = l1.getByLabelText("Boîtes");
    const unites = l1.getByLabelText("comprimés en plus");
    expect(boites).toHaveAccessibleDescription("Indiquez un nombre entier de boîtes, 0 ou plus.");
    expect(unites).toHaveAccessibleDescription("Indiquez un nombre entier, 0 ou plus.");
    expect(unites).toHaveAttribute("aria-invalid", "true");
  });
});
