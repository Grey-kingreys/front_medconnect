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

  it("exige le choix de conversion d'une fiche non confirmée puis envoie MULTIPLIER", async () => {
    vi.mocked(modifierFiche).mockResolvedValue(reponse({ avertissements: [], conversion: null }) as never);
    const { onClose } = ouvrirModification(ficheNonQualifiee);
    expect(screen.getByText(/pas encore confirmé/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Nombre d'unités par boîte"), { target: { value: "20" } });
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
    fireEvent.click(screen.getByLabelText("Se vend aussi à l'unité (boîte entamée)"));
    expect(screen.queryByLabelText("Prix d'une unité (GNF)")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Mettre à jour" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(modifierFiche).toHaveBeenCalledWith("s1", "d1", { deconditionnable: false, prixUnite: null });
  });

  it("garde la fenêtre ouverte avec l'avertissement d'écart de prix et un seul bouton Fermer", async () => {
    vi.mocked(modifierFiche).mockResolvedValue(
      reponse({ avertissements: [{ code: "ECART_PRIX", ecartPct: 32 }], conversion: null }) as never,
    );
    const { onClose, onSuccess } = ouvrirModification(fiche);
    fireEvent.change(screen.getByLabelText("Prix d'une unité (GNF)"), { target: { value: "300" } });
    fireEvent.click(screen.getByRole("button", { name: "Mettre à jour" }));

    expect(
      await screen.findByText(
        "Enregistré. Le prix d'une unité s'écarte de 32 % du prix de la boîte divisé par le nombre d'unités : vérifiez qu'il n'y a pas d'erreur.",
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
    fireEvent.change(screen.getByLabelText("Nombre d'unités par boîte"), { target: { value: "20" } });
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
});
