import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api_auth";
import { createMedicament, getCatalogue, modifierFiche, upsertStock, type StockMedicament } from "@/lib/api_pharmacie";
import StockModal from "./StockModal";

vi.mock("@/lib/api_pharmacie", () => ({
  getCatalogue: vi.fn(),
  createMedicament: vi.fn(),
  upsertStock: vi.fn(),
  modifierFiche: vi.fn(),
}));

const acces = vi.hoisted(() => ({ permissions: [] as string[] }));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ profile: { permissions: acces.permissions } }),
}));

const medicament = { id: "m1", nom: "Doliprane", categorie: "Antalgique", ordonnanceRequise: false, formes: [] };

const fiche: StockMedicament = {
  id: "d1",
  medicamentId: "m1",
  structureId: "s1",
  quantite: 60,
  disponible: true,
  prixUnitaire: 3500,
  coefficientBoite: 20,
  uniteMinimale: "COMPRIME",
  deconditionnable: true,
  prixUnite: 175,
  qualifie: true,
  medicament,
};

const ficheNonQualifiee: StockMedicament = {
  ...fiche,
  quantite: 12,
  coefficientBoite: 1,
  deconditionnable: false,
  prixUnite: null,
  qualifie: false,
};

function reponse<T>(data: T) {
  return { data, message: "ok", success: true };
}

function ouvrirModification(editItem: StockMedicament) {
  const onClose = vi.fn();
  const onSuccess = vi.fn();
  render(<StockModal isOpen onClose={onClose} structureId="s1" onSuccess={onSuccess} editItem={editItem} />);
  return { onClose, onSuccess };
}

const nouvelleFiche = { id: "st1", quantite: 0, lots: [], archiveLe: null };

async function ouvrirAjout(options: { fichesActives?: StockMedicament[] } = {}) {
  vi.mocked(getCatalogue).mockResolvedValue(reponse([medicament]));
  vi.mocked(upsertStock).mockResolvedValue(reponse(nouvelleFiche) as never);
  vi.mocked(modifierFiche).mockResolvedValue(reponse({ avertissements: [], conversion: null }) as never);
  const onClose = vi.fn();
  const onSuccess = vi.fn();
  render(
    <StockModal
      isOpen
      onClose={onClose}
      structureId="s1"
      onSuccess={onSuccess}
      editItem={null}
      fichesActives={options.fichesActives}
    />,
  );
  fireEvent.change(screen.getByLabelText("Médicament"), { target: { value: "Dolip" } });
  fireEvent.click(await screen.findByText("Doliprane", {}, { timeout: 3000 }));
  return { onClose, onSuccess };
}

const soumettre = () => fireEvent.click(screen.getByRole("button", { name: "Ajouter au stock" }));

describe("StockModal", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    acces.permissions = [];
  });

  describe("avertissement de vente au détail moins chère", () => {
    const saisir = (libelle: string, valeur: string) =>
      fireEvent.change(screen.getByLabelText(libelle), { target: { value: valeur } });
    const MESSAGE = /^Vendue au détail, cette boîte rapporte 15\s000\sGNF, soit 3\s000\sGNF de moins que son prix de 18\s000\sGNF\. Vérifiez vos prix\.$/;

    it("affiche les montants pendant la saisie, puis disparaît quand le prix est corrigé", () => {
      ouvrirModification(fiche);
      expect(screen.queryByRole("status")).toBeNull();
      saisir("Prix de la boîte (GNF)", "18000");
      saisir("Nombre de comprimés par boîte", "10");
      saisir("Prix d'un comprimé (GNF)", "1500");
      expect(screen.getByRole("status").textContent).toMatch(MESSAGE);

      saisir("Prix d'un comprimé (GNF)", "1800");
      expect(screen.queryByRole("status")).toBeNull();
    });

    it("est absent quand la vente à l'unité n'est pas cochée", () => {
      ouvrirModification(fiche);
      saisir("Prix de la boîte (GNF)", "18000");
      saisir("Nombre de comprimés par boîte", "10");
      saisir("Prix d'un comprimé (GNF)", "1500");
      expect(screen.getByRole("status")).toBeTruthy();
      fireEvent.click(screen.getByLabelText("Se vend aussi au comprimé (boîte entamée)"));
      expect(screen.queryByRole("status")).toBeNull();
    });

    it("ne bloque pas l'enregistrement", async () => {
      vi.mocked(modifierFiche).mockResolvedValue(reponse({ avertissements: [], conversion: null }) as never);
      vi.mocked(upsertStock).mockResolvedValue(reponse(nouvelleFiche) as never);
      const { onSuccess } = ouvrirModification(fiche);
      saisir("Prix de la boîte (GNF)", "18000");
      saisir("Nombre de comprimés par boîte", "10");
      saisir("Prix d'un comprimé (GNF)", "1500");
      expect(screen.getByRole("status").textContent).toMatch(MESSAGE);
      fireEvent.click(screen.getByRole("button", { name: "Mettre à jour" }));
      await waitFor(() => expect(onSuccess).toHaveBeenCalled());
      expect(modifierFiche).toHaveBeenCalledWith("s1", "d1", {
        prixUnitaire: 18000,
        coefficientBoite: 10,
        prixUnite: 1500,
      });
    });

    it("s'affiche aussi à l'ajout", async () => {
      await ouvrirAjout();
      fireEvent.click(screen.getByLabelText("Se vend aussi à l'unité (boîte entamée)"));
      saisir("Prix de la boîte (GNF)", "18000");
      saisir("Nombre d'unités par boîte", "10");
      saisir("Prix d'une unité (GNF)", "1500");
      expect(screen.getByRole("status").textContent).toMatch(MESSAGE);
    });
  });

  describe("lots en stock en modification", () => {
    const ficheAvecLots: StockMedicament = {
      ...fiche,
      lots: [
        { id: "l1", numeroLot: "A1", dateExpiration: "2027-06-30T00:00:00.000Z", quantite: 40, lotTechnique: false },
        { id: "l2", numeroLot: null, dateExpiration: null, quantite: 20, lotTechnique: false, coefficientReception: 10 },
        { id: "l3", numeroLot: "Z9", dateExpiration: "2026-01-01T00:00:00.000Z", quantite: 0, lotTechnique: false },
      ],
    };

    it("liste les lots en lecture seule, sans champ de date", () => {
      ouvrirModification(ficheAvecLots);
      expect(screen.getByRole("heading", { name: "Lots en stock" })).toBeTruthy();
      const lots = screen.getAllByRole("listitem");
      expect(lots).toHaveLength(2);
      expect(lots[0].textContent).toContain("A1");
      expect(lots[0].textContent).toContain("30/06/2027");
      expect(lots[0].textContent).toContain("2 boîtes");
      expect(lots[1].textContent).toContain("Sans numéro");
      expect(lots[1].textContent).toContain("Sans date");
      expect(lots[1].textContent).toContain("2 boîtes");
      expect(screen.queryByLabelText(/péremption/i)).toBeNull();
      expect(screen.queryByDisplayValue("30/06/2027")).toBeNull();
    });

    it("n'affiche pas la phrase de correction sans la permission de réception", () => {
      ouvrirModification(ficheAvecLots);
      expect(screen.queryByText("Pour corriger une date, ouvrez la réception du lot.")).toBeNull();
    });

    it("affiche la phrase de correction avec la permission reception:write", () => {
      acces.permissions = ["reception:write"];
      ouvrirModification(ficheAvecLots);
      expect(screen.getByText("Pour corriger une date, ouvrez la réception du lot.")).toBeTruthy();
    });

    it("dit qu'il n'y a aucun lot quand la fiche n'en a pas", () => {
      ouvrirModification(fiche);
      expect(screen.getByText("Aucun lot en stock.")).toBeTruthy();
    });

    it("n'affiche pas les lots à l'ajout", async () => {
      await ouvrirAjout();
      expect(screen.queryByRole("heading", { name: "Lots en stock" })).toBeNull();
    });
  });

  it("refuse une quantité de départ sans date ni case, sans aucun appel", async () => {
    await ouvrirAjout();
    fireEvent.change(screen.getByLabelText("Quantité de départ (en boîtes)"), { target: { value: "3" } });
    soumettre();

    expect(
      await screen.findByText("Indiquez la date de péremption, ou cochez « Sans date de péremption »."),
    ).toBeTruthy();
    expect(upsertStock).not.toHaveBeenCalled();
    expect(modifierFiche).not.toHaveBeenCalled();
    expect(createMedicament).not.toHaveBeenCalled();
  });

  it("ajoute avec la péremption 6/28 : fiche vide, fiche confirmée, puis 60 unités datées du 30/06/2028", async () => {
    const { onSuccess, onClose } = await ouvrirAjout();
    fireEvent.change(screen.getByLabelText("Nombre d'unités par boîte"), { target: { value: "20" } });
    fireEvent.change(screen.getByLabelText("Quantité de départ (en boîtes)"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("Date de péremption"), { target: { value: "6/28" } });
    expect(screen.getByText("Péremption : 30/06/2028")).toBeTruthy();
    soumettre();

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
    expect(upsertStock).toHaveBeenCalledTimes(2);
    expect(vi.mocked(upsertStock).mock.calls[0][1]).toEqual({ medicamentId: "m1" });
    expect(modifierFiche).toHaveBeenCalledWith("s1", "st1", { qualifie: true, coefficientBoite: 20 });
    expect(vi.mocked(upsertStock).mock.calls[1][1]).toEqual({
      medicamentId: "m1",
      quantite: 60,
      dateExpiration: "2028-06-30",
    });
    const ordre = [
      vi.mocked(upsertStock).mock.invocationCallOrder[0],
      vi.mocked(modifierFiche).mock.invocationCallOrder[0],
      vi.mocked(upsertStock).mock.invocationCallOrder[1],
    ];
    expect(ordre).toEqual([...ordre].sort((a, b) => a - b));
  });

  it("ajoute « Sans date de péremption » avec sansPeremption et sans dateExpiration", async () => {
    const { onSuccess } = await ouvrirAjout();
    fireEvent.change(screen.getByLabelText("Quantité de départ (en boîtes)"), { target: { value: "2" } });
    fireEvent.click(screen.getByLabelText("Sans date de péremption"));
    soumettre();

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    const dernier = vi.mocked(upsertStock).mock.calls.at(-1)![1];
    expect(dernier).toEqual({ medicamentId: "m1", quantite: 2, sansPeremption: true });
    expect("dateExpiration" in dernier).toBe(false);
  });

  it("n'offre plus ni quantité ni date en modification et n'envoie que le prix de la boîte changé", async () => {
    vi.mocked(modifierFiche).mockResolvedValue(reponse({ avertissements: [], conversion: null }) as never);
    const { onClose, onSuccess } = ouvrirModification(fiche);
    expect(screen.queryByLabelText(/Quantité de départ/)).toBeNull();
    expect(screen.queryByLabelText(/Date de péremption/)).toBeNull();
    expect(screen.getByText("Stock actuel : 3 boîtes")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Prix de la boîte (GNF)"), { target: { value: "4000" } });
    fireEvent.click(screen.getByRole("button", { name: "Mettre à jour" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(modifierFiche).toHaveBeenCalledWith("s1", "d1", { prixUnitaire: 4000 });
    expect(upsertStock).not.toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalled();
  });

  it("fiche à régulariser (stock 0, 1 boîte à régulariser) : mention, sans signe moins, et le choix de conversion reste", async () => {
    vi.mocked(modifierFiche).mockResolvedValue(reponse({ avertissements: [], conversion: null }) as never);
    const aRegulariser: StockMedicament = { ...ficheNonQualifiee, quantite: 0, quantiteARegulariser: 1 };
    const { onClose } = ouvrirModification(aRegulariser);
    expect(screen.getByText("Stock actuel : 0 boîte")).toBeTruthy();
    expect(screen.getByText("1 boîte à régulariser")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Nombre de comprimés par boîte"), { target: { value: "20" } });
    // Le choix de conversion apparaît bien que la quantité soit 0.
    expect(screen.getByLabelText(/^des boîtes : les convertir en unités/)).toBeTruthy();
    expect(screen.getByText(/Le stock actuel de 0 boîte, avec 1 boîte à régulariser, compte/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Mettre à jour" }));
    expect(await screen.findByText("Indiquez si le stock actuel compte des boîtes ou des unités.")).toBeTruthy();
    expect(modifierFiche).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText("déjà des unités : ne rien changer"));
    fireEvent.click(screen.getByRole("button", { name: "Mettre à jour" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(modifierFiche).toHaveBeenCalledWith("s1", "d1", {
      coefficientBoite: 20,
      conversionStock: "CONSERVER",
      qualifie: true,
    });
  });

  it("fiche à stock 0 sans part à régulariser : aucun choix de conversion", () => {
    ouvrirModification({ ...ficheNonQualifiee, quantite: 0 });
    fireEvent.change(screen.getByLabelText("Nombre de comprimés par boîte"), { target: { value: "20" } });
    expect(screen.queryByLabelText(/^des boîtes : les convertir en unités/)).toBeNull();
  });

  it("exige le choix de conversion d'une fiche non confirmée puis envoie MULTIPLIER", async () => {
    vi.mocked(modifierFiche).mockResolvedValue(reponse({ avertissements: [], conversion: null }) as never);
    const { onClose } = ouvrirModification(ficheNonQualifiee);
    expect(screen.getByText(/pas encore confirmé/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Nombre de comprimés par boîte"), { target: { value: "20" } });
    fireEvent.click(screen.getByRole("button", { name: "Mettre à jour" }));
    expect(await screen.findByText("Indiquez si le stock actuel compte des boîtes ou des unités.")).toBeTruthy();
    expect(modifierFiche).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText(/^des boîtes : les convertir en unités/));
    fireEvent.click(screen.getByRole("button", { name: "Mettre à jour" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(modifierFiche).toHaveBeenCalledWith("s1", "d1", {
      coefficientBoite: 20,
      conversionStock: "MULTIPLIER",
      qualifie: true,
    });
  });

  it("décocher la vente à l'unité envoie deconditionnable false et prixUnite null", async () => {
    vi.mocked(modifierFiche).mockResolvedValue(reponse({ avertissements: [], conversion: null }) as never);
    const { onClose } = ouvrirModification(fiche);
    fireEvent.click(screen.getByLabelText("Se vend aussi au comprimé (boîte entamée)"));
    expect(screen.queryByLabelText("Prix d'un comprimé (GNF)")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Mettre à jour" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(modifierFiche).toHaveBeenCalledWith("s1", "d1", { deconditionnable: false, prixUnite: null });
  });

  it("garde la fenêtre ouverte avec l'avertissement d'écart de prix et un seul bouton Fermer", async () => {
    vi.mocked(modifierFiche).mockResolvedValue(
      reponse({ avertissements: [{ code: "ECART_PRIX", ecartPct: 32 }], conversion: null }) as never,
    );
    const { onClose, onSuccess } = ouvrirModification(fiche);
    fireEvent.change(screen.getByLabelText("Prix d'un comprimé (GNF)"), { target: { value: "300" } });
    fireEvent.click(screen.getByRole("button", { name: "Mettre à jour" }));

    expect(
      await screen.findByText(
        "Enregistré. Le prix d'un comprimé s'écarte de 32 % du prix de la boîte divisé par le nombre de comprimés : vérifiez qu'il n'y a pas d'erreur.",
      ),
    ).toBeTruthy();
    const dialogue = screen.getByRole("dialog");
    expect(within(dialogue).getByRole("button", { name: "Fermer" })).toBeTruthy();
    expect(within(dialogue).queryByRole("button", { name: "Mettre à jour" })).toBeNull();
    expect(onSuccess).toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(within(dialogue).getByRole("button", { name: "Fermer" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("affiche le message du serveur pour une conversion impossible et garde la fenêtre ouverte", async () => {
    vi.mocked(modifierFiche).mockRejectedValue(
      new ApiError("Le stock de ce médicament ne peut pas être converti : une partie est ailleurs.", 409, {
        code: "CONVERSION_IMPOSSIBLE",
      }),
    );
    const { onClose, onSuccess } = ouvrirModification(ficheNonQualifiee);
    fireEvent.change(screen.getByLabelText("Nombre de comprimés par boîte"), { target: { value: "20" } });
    fireEvent.click(screen.getByLabelText(/^des boîtes : les convertir en unités/));
    fireEvent.click(screen.getByRole("button", { name: "Mettre à jour" }));

    expect(
      await screen.findByText("Le stock de ce médicament ne peut pas être converti : une partie est ailleurs."),
    ).toBeTruthy();
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("modification : les notes partent sans quantité (aucun mouvement de stock)", async () => {
    vi.mocked(upsertStock).mockResolvedValue(reponse(nouvelleFiche) as never);
    const { onClose } = ouvrirModification(fiche);
    fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "Étagère du fond" } });
    fireEvent.click(screen.getByRole("button", { name: "Mettre à jour" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(upsertStock).toHaveBeenCalledTimes(1);
    const corps = vi.mocked(upsertStock).mock.calls[0][1];
    expect(corps).toEqual({ medicamentId: "m1", notes: "Étagère du fond" });
    expect("quantite" in corps).toBe(false);
    expect(modifierFiche).not.toHaveBeenCalled();
  });

  it("ajout : un médicament déjà en stock (quantité, archivé ou lots) n'écrit aucune quantité et affiche le message", async () => {
    const cas = [
      { id: "st1", quantite: 12, lots: [], archiveLe: null },
      { id: "st1", quantite: 0, lots: [], archiveLe: "2026-10-01T00:00:00.000Z" },
      { id: "st1", quantite: 0, lots: [{ id: "l1" }], archiveLe: null },
      // Fiche à -1 lue à 0 sans lot : la part à régulariser suffit à la voir comme déjà présente (D713).
      { id: "st1", quantite: 0, lots: [], archiveLe: null, quantiteARegulariser: 1 },
    ];
    for (const existante of cas) {
      const { onSuccess } = await ouvrirAjout();
      vi.mocked(upsertStock).mockResolvedValue(reponse(existante) as never);
      fireEvent.change(screen.getByLabelText("Quantité de départ (en boîtes)"), { target: { value: "3" } });
      fireEvent.click(screen.getByLabelText("Sans date de péremption"));
      soumettre();

      expect(
        await screen.findByText("Ce médicament est déjà dans votre stock. Pour ajouter des boîtes, utilisez « Réception »."),
      ).toBeTruthy();
      expect(upsertStock).toHaveBeenCalledTimes(1);
      // Seulement l'identifiant : ni prix, ni notes, ni quantité sur une fiche existante
      expect(vi.mocked(upsertStock).mock.calls[0][1]).toEqual({ medicamentId: "m1" });
      expect(modifierFiche).not.toHaveBeenCalled();
      expect(onSuccess).not.toHaveBeenCalled();
      cleanup();
      vi.clearAllMocks();
    }
  });

  it("ajout : un médicament déjà en stock saisi avec prix et notes n'écrit ni prix ni notes", async () => {
    await ouvrirAjout();
    vi.mocked(upsertStock).mockResolvedValue(reponse({ id: "st1", quantite: 12, lots: [], archiveLe: null }) as never);
    fireEvent.change(screen.getByLabelText("Prix de la boîte (GNF)"), { target: { value: "4000" } });
    fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "Étagère 3" } });
    soumettre();

    expect(
      await screen.findByText("Ce médicament est déjà dans votre stock. Pour ajouter des boîtes, utilisez « Réception »."),
    ).toBeTruthy();
    expect(upsertStock).toHaveBeenCalledTimes(1);
    expect(vi.mocked(upsertStock).mock.calls[0][1]).toEqual({ medicamentId: "m1" });
    expect(modifierFiche).not.toHaveBeenCalled();
  });

  it("ajout : le prix part par la fiche, les notes par un upsert sans quantité, puis la quantité de départ", async () => {
    const { onSuccess } = await ouvrirAjout();
    fireEvent.change(screen.getByLabelText("Prix de la boîte (GNF)"), { target: { value: "4000" } });
    fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "Étagère 3" } });
    fireEvent.change(screen.getByLabelText("Quantité de départ (en boîtes)"), { target: { value: "2" } });
    fireEvent.click(screen.getByLabelText("Sans date de péremption"));
    soumettre();

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    const appels = vi.mocked(upsertStock).mock.calls.map((c) => c[1]);
    expect(appels).toEqual([
      { medicamentId: "m1" },
      { medicamentId: "m1", notes: "Étagère 3" },
      { medicamentId: "m1", quantite: 2, sansPeremption: true },
    ]);
    expect(modifierFiche).toHaveBeenCalledWith("s1", "st1", { qualifie: true, prixUnitaire: 4000 });
    const ordre = [
      vi.mocked(upsertStock).mock.invocationCallOrder[0],
      vi.mocked(modifierFiche).mock.invocationCallOrder[0],
      vi.mocked(upsertStock).mock.invocationCallOrder[1],
      vi.mocked(upsertStock).mock.invocationCallOrder[2],
    ];
    expect(ordre).toEqual([...ordre].sort((a, b) => a - b));
  });

  it("ajout : un échec réseau sur les notes verrouille, et « Réessayer » ne refait pas les étapes réussies", async () => {
    const { onSuccess } = await ouvrirAjout();
    vi.mocked(upsertStock)
      .mockResolvedValueOnce(reponse(nouvelleFiche) as never)
      .mockRejectedValueOnce(new ApiError("Réseau indisponible", 0))
      .mockResolvedValue(reponse(nouvelleFiche) as never);
    fireEvent.change(screen.getByLabelText("Prix de la boîte (GNF)"), { target: { value: "4000" } });
    fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "Étagère 3" } });
    fireEvent.change(screen.getByLabelText("Quantité de départ (en boîtes)"), { target: { value: "2" } });
    fireEvent.click(screen.getByLabelText("Sans date de péremption"));
    soumettre();

    expect(
      await screen.findByText("L'enregistrement n'a peut-être pas abouti. Vérifiez votre connexion puis appuyez sur Réessayer."),
    ).toBeTruthy();
    expect(screen.getByLabelText("Notes")).toBeDisabled();
    expect(onSuccess).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    const appels = vi.mocked(upsertStock).mock.calls.map((c) => c[1]);
    expect(appels).toEqual([
      { medicamentId: "m1" },
      { medicamentId: "m1", notes: "Étagère 3" },
      { medicamentId: "m1", notes: "Étagère 3" },
      { medicamentId: "m1", quantite: 2, sansPeremption: true },
    ]);
    expect(modifierFiche).toHaveBeenCalledTimes(1);
  });

  it("ajout : un échec réseau sur la quantité de départ ne refait au « Réessayer » que la quantité", async () => {
    const { onSuccess } = await ouvrirAjout();
    vi.mocked(upsertStock)
      .mockResolvedValueOnce(reponse(nouvelleFiche) as never)
      .mockResolvedValueOnce(reponse(nouvelleFiche) as never)
      .mockRejectedValueOnce(new ApiError("Réseau indisponible", 503))
      .mockResolvedValue(reponse(nouvelleFiche) as never);
    fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "Étagère 3" } });
    fireEvent.change(screen.getByLabelText("Quantité de départ (en boîtes)"), { target: { value: "2" } });
    fireEvent.click(screen.getByLabelText("Sans date de péremption"));
    soumettre();

    fireEvent.click(await screen.findByRole("button", { name: "Réessayer" }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(upsertStock).toHaveBeenCalledTimes(4);
    expect(vi.mocked(upsertStock).mock.calls[3][1]).toEqual({ medicamentId: "m1", quantite: 2, sansPeremption: true });
    expect(modifierFiche).toHaveBeenCalledTimes(1);
  });

  it("ajout : la quantité de départ utilise le nombre d'unités par boîte renvoyé par le serveur", async () => {
    const { onSuccess } = await ouvrirAjout();
    vi.mocked(modifierFiche).mockResolvedValue(
      reponse({ avertissements: [], conversion: null, coefficientBoite: 10 }) as never,
    );
    fireEvent.change(screen.getByLabelText("Nombre d'unités par boîte"), { target: { value: "20" } });
    fireEvent.change(screen.getByLabelText("Quantité de départ (en boîtes)"), { target: { value: "3" } });
    fireEvent.click(screen.getByLabelText("Sans date de péremption"));
    soumettre();

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(vi.mocked(upsertStock).mock.calls.at(-1)![1]).toMatchObject({ quantite: 30 });
  });

  it("ajout : un médicament déjà présent dans la liste de la page est refusé dès la recherche", async () => {
    await ouvrirAjout({ fichesActives: [fiche] });

    expect(
      await screen.findByText("Ce médicament est déjà dans votre stock. Pour ajouter des boîtes, utilisez « Réception »."),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ajouter au stock" })).toBeDisabled();
    expect(upsertStock).not.toHaveBeenCalled();
  });

  describe("unité plaquette (D723, D725)", () => {
    const choisirUnite = (valeur: string) =>
      fireEvent.change(screen.getByLabelText("Unité de vente au détail"), { target: { value: valeur } });
    const AIDE_STOCK = "Ce médicament a du stock : pour changer d'unité, comptez-le d'abord à 0 par un inventaire.";
    const AIDE_NOMBRE =
      "Indiquez aussi combien de plaquettes contient la boîte : après l'enregistrement, ce nombre ne pourra plus convertir le stock.";
    const ficheReprise: StockMedicament = { ...ficheNonQualifiee, uniteMinimale: "UNITE", quantite: 12 };

    it("propose « Plaquette » après « Ampoule » et accorde les libellés de la fiche", async () => {
      await ouvrirAjout();
      const options = within(screen.getByLabelText("Unité de vente au détail")).getAllByRole("option");
      const noms = options.map((o) => o.textContent);
      expect(noms).toContain("Plaquette");
      expect(noms.indexOf("Plaquette")).toBe(noms.indexOf("Ampoule") + 1);

      expect(screen.getByLabelText("Nombre d'unités par boîte")).toBeTruthy();
      choisirUnite("PLAQUETTE");
      expect(screen.getByLabelText("Nombre de plaquettes par boîte")).toBeTruthy();
      expect(screen.getByLabelText("Écart toléré à l'inventaire (en plaquettes)")).toBeTruthy();
      expect(screen.getByLabelText("Se vend aussi à la plaquette (boîte entamée)")).toBeTruthy();
      fireEvent.click(screen.getByLabelText("Se vend aussi à la plaquette (boîte entamée)"));
      expect(screen.getByLabelText("Prix d'une plaquette (GNF)")).toBeTruthy();

      choisirUnite("AMPOULE");
      expect(screen.getByLabelText("Nombre d'ampoules par boîte")).toBeTruthy();
      expect(screen.getByLabelText("Prix d'une ampoule (GNF)")).toBeTruthy();
      expect(screen.getByLabelText("Se vend aussi à l'ampoule (boîte entamée)")).toBeTruthy();
    });

    it("envoie uniteMinimale PLAQUETTE, le nombre par boîte et le prix de la plaquette", async () => {
      const { onSuccess } = await ouvrirAjout();
      fireEvent.change(screen.getByLabelText("Prix de la boîte (GNF)"), { target: { value: "25000" } });
      choisirUnite("PLAQUETTE");
      fireEvent.change(screen.getByLabelText("Nombre de plaquettes par boîte"), { target: { value: "10" } });
      fireEvent.click(screen.getByLabelText("Se vend aussi à la plaquette (boîte entamée)"));
      fireEvent.change(screen.getByLabelText("Prix d'une plaquette (GNF)"), { target: { value: "3000" } });
      soumettre();

      await waitFor(() => expect(onSuccess).toHaveBeenCalled());
      expect(modifierFiche).toHaveBeenCalledWith("s1", "st1", {
        qualifie: true,
        prixUnitaire: 25000,
        uniteMinimale: "PLAQUETTE",
        coefficientBoite: 10,
        deconditionnable: true,
        prixUnite: 3000,
      });
    });

    it("dit le nombre attendu dans l'erreur de saisie, accordé à l'unité", async () => {
      await ouvrirAjout();
      choisirUnite("PLAQUETTE");
      fireEvent.change(screen.getByLabelText("Nombre de plaquettes par boîte"), { target: { value: "0" } });
      soumettre();
      expect(
        await screen.findByText("Nombre de plaquettes par boîte : indiquez un nombre entier d'au moins 1."),
      ).toBeTruthy();
      expect(modifierFiche).not.toHaveBeenCalled();
    });

    it("fiche avec stock, unité changée : aide « comptez-le d'abord à 0 », sélecteur actif", () => {
      ouvrirModification(fiche);
      expect(screen.queryByText(AIDE_STOCK)).toBeNull();
      const choix = screen.getByLabelText("Unité de vente au détail");
      expect(choix).not.toBeDisabled();
      choisirUnite("PLAQUETTE");
      expect(screen.getByText(AIDE_STOCK)).toBeTruthy();
      expect(choix.getAttribute("aria-describedby")).toBe("stock-aide-unite");
      choisirUnite("COMPRIME");
      expect(screen.queryByText(AIDE_STOCK)).toBeNull();
    });

    it("fiche sans stock, unité changée : pas d'aide", () => {
      ouvrirModification({ ...fiche, quantite: 0 });
      choisirUnite("PLAQUETTE");
      expect(screen.queryByText(AIDE_STOCK)).toBeNull();
    });

    it("409 UNITE_CHANGEMENT_AVEC_STOCK : message du serveur au bandeau, fenêtre ouverte, saisie gardée", async () => {
      vi.mocked(modifierFiche).mockRejectedValue(
        new ApiError("Ce médicament a du stock en comprimés : comptez-le d'abord à 0 par un inventaire, puis changez l'unité.", 409, {
          code: "UNITE_CHANGEMENT_AVEC_STOCK",
        }),
      );
      const { onClose, onSuccess } = ouvrirModification(fiche);
      choisirUnite("PLAQUETTE");
      fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "Étagère 2" } });
      fireEvent.click(screen.getByRole("button", { name: "Mettre à jour" }));

      const bandeau = await screen.findByRole("alert");
      expect(bandeau.textContent).toBe(
        "Ce médicament a du stock en comprimés : comptez-le d'abord à 0 par un inventaire, puis changez l'unité.",
      );
      expect(screen.getByRole("dialog")).toBeTruthy();
      expect((screen.getByLabelText("Unité de vente au détail") as HTMLSelectElement).value).toBe("PLAQUETTE");
      expect((screen.getByLabelText("Notes") as HTMLInputElement).value).toBe("Étagère 2");
      expect(onClose).not.toHaveBeenCalled();
      expect(onSuccess).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "Mettre à jour" })).not.toBeDisabled();
    });

    it("reprise non qualifiée en « Unité » à 1 par boîte avec stock : l'unité peut changer, l'aide demande le nombre", async () => {
      vi.mocked(modifierFiche).mockResolvedValue(reponse({ avertissements: [], conversion: null }) as never);
      const { onClose } = ouvrirModification(ficheReprise);
      expect(screen.queryByText(AIDE_NOMBRE)).toBeNull();

      choisirUnite("PLAQUETTE");
      expect(screen.getByText(AIDE_NOMBRE)).toBeTruthy();
      expect(screen.queryByText(AIDE_STOCK)).toBeNull();
      expect(screen.getByLabelText("Nombre de plaquettes par boîte").getAttribute("aria-describedby")).toBe("stock-aide-nombre");

      // Le choix de conversion apparaît dès que le nombre change, et l'aide disparaît.
      fireEvent.change(screen.getByLabelText("Nombre de plaquettes par boîte"), { target: { value: "10" } });
      expect(screen.queryByText(AIDE_NOMBRE)).toBeNull();
      expect(screen.getByLabelText(/^des boîtes : les convertir en unités \(12 boîtes deviennent 120 plaquettes\)/)).toBeTruthy();
      fireEvent.change(screen.getByLabelText("Nombre de plaquettes par boîte"), { target: { value: "1" } });
      expect(screen.getByText(AIDE_NOMBRE)).toBeTruthy();

      // Revenir à « Unité » : plus d'unité changée, plus d'aide.
      choisirUnite("UNITE");
      expect(screen.queryByText(AIDE_NOMBRE)).toBeNull();

      // L'enregistrement n'est pas bloqué par l'aide.
      choisirUnite("PLAQUETTE");
      fireEvent.click(screen.getByRole("button", { name: "Mettre à jour" }));
      await waitFor(() => expect(onClose).toHaveBeenCalled());
      expect(modifierFiche).toHaveBeenCalledWith("s1", "d1", { uniteMinimale: "PLAQUETTE" });
    });

    it("reprise en « Unité » à 1 sans stock ou unité d'origine autre : pas d'aide sur le nombre", () => {
      ouvrirModification({ ...ficheReprise, quantite: 0 });
      choisirUnite("PLAQUETTE");
      expect(screen.queryByText(AIDE_NOMBRE)).toBeNull();
      cleanup();
      ouvrirModification(ficheNonQualifiee);
      choisirUnite("PLAQUETTE");
      expect(screen.queryByText(AIDE_NOMBRE)).toBeNull();
      expect(screen.getByText(AIDE_STOCK)).toBeTruthy();
    });

    it("fiche qualifiée dont le nombre change : comportement inchangé, aucune aide d'unité", () => {
      ouvrirModification(fiche);
      fireEvent.change(screen.getByLabelText("Nombre de comprimés par boîte"), { target: { value: "30" } });
      expect(screen.queryByText(AIDE_STOCK)).toBeNull();
      expect(screen.queryByText(AIDE_NOMBRE)).toBeNull();
      expect(screen.getByText("S'applique aux prochaines réceptions et aux ventes à la boîte.")).toBeTruthy();
    });
  });
});
