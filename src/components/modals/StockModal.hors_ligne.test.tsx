import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PontDesktop } from "@/lib/caisse/contrat_desktop";
import type { StockMedicament } from "@/lib/api_pharmacie";
import StockModal from "./StockModal";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ profile: { permissions: ["stock:read", "stock:write", "reception:write"] } }),
}));

const ok = <T,>(data: T, message = "ok") => Promise.resolve({ ok: true as const, data, message });

const fiche: StockMedicament = {
  id: "d1",
  medicamentId: "m1",
  structureId: "s1",
  quantite: 40,
  disponible: true,
  prixUnitaire: 3500,
  coefficientBoite: 20,
  uniteMinimale: "COMPRIME",
  qualifie: true,
  notes: "",
  medicament: { id: "m1", nom: "Doliprane", categorie: "Antalgique", ordonnanceRequise: false, formes: [] },
  lots: [],
};

function installerPont() {
  const rechercher = vi.fn().mockImplementation(() =>
    ok([{ id: "mA", nom: "Amoxicilline 500 mg", categorie: "ANTIBIOTIQUE", ordonnanceRequise: true, formes: [] }]),
  );
  const creer = vi.fn().mockImplementation(() => ok({ fiche, cree: true }, "Médicament ajouté au stock de ce poste."));
  const modifier = vi.fn().mockImplementation(() => ok({ fiche, modifiee: true }, "Fiche produit enregistrée sur ce poste."));
  window.medconnecteDesktop = {
    version: "0.1.0",
    etat: () => Promise.resolve({ horsLigne: true, enLigne: false }),
    surEtat: () => () => undefined,
    catalogue: { rechercher },
    fiche: { creer, modifier },
  } as unknown as PontDesktop;
  return { rechercher, creer, modifier };
}

afterEach(() => {
  cleanup();
  delete window.medconnecteDesktop;
  vi.clearAllMocks();
});

describe("StockModal sur le poste hors ligne", () => {
  it("cherche dans le catalogue du poste, ajoute sans quantité et désactive les champs qui demandent une connexion", async () => {
    const { rechercher, creer } = installerPont();
    const onSuccess = vi.fn();
    render(<StockModal isOpen onClose={vi.fn()} structureId="s1" onSuccess={onSuccess} horsLigne />);
    fireEvent.change(screen.getByLabelText("Médicament"), { target: { value: "amox" } });
    fireEvent.click(await screen.findByText("Amoxicilline 500 mg", undefined, { timeout: 3000 }));
    await waitFor(() => expect(rechercher).toHaveBeenCalledWith("s1", "amox"));

    expect((screen.getByLabelText("Nombre d'unités par boîte") as HTMLInputElement).disabled).toBe(true);
    expect(screen.queryByLabelText("Quantité de départ (en boîtes)")).toBeNull();
    expect(screen.getByText(/enregistrez ensuite une réception/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Prix de la boîte (GNF)"), { target: { value: "2500" } });
    fireEvent.click(screen.getByRole("button", { name: "Ajouter au stock" }));
    await waitFor(() => expect(creer).toHaveBeenCalledWith("s1", { id: expect.any(String), medicamentId: "mA", prixUnitaire: 2500 }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
  });

  it("modifie seulement les champs sûrs qui ont changé", async () => {
    const { modifier } = installerPont();
    const onSuccess = vi.fn();
    render(<StockModal isOpen onClose={vi.fn()} structureId="s1" onSuccess={onSuccess} editItem={fiche} horsLigne />);
    fireEvent.change(screen.getByLabelText("Prix de la boîte (GNF)"), { target: { value: "4000" } });
    fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "étagère 3" } });
    fireEvent.click(screen.getByRole("button", { name: "Mettre à jour" }));
    await waitFor(() => expect(modifier).toHaveBeenCalledWith("s1", "d1", { prixUnitaire: 4000, notes: "étagère 3" }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
  });
});
