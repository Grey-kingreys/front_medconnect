import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api_auth";
import type { BilanCaisse, ModePaiement, SessionCaisse } from "@/lib/api_caisse";
import { formaterGNF } from "@/lib/format_gnf";
import { CaisseFermee, FermetureCaisse } from "./FermetureCaisse";

const { fermerSession } = vi.hoisted(() => ({ fermerSession: vi.fn() }));
vi.mock("@/lib/api_caisse", () => ({ fermerSession }));

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const MODES: ModePaiement[] = [
  { code: "ESPECES", libelle: "Espèces", comptagePhysique: true, referenceAutorisee: false, ordre: 1 },
  { code: "ORANGE_MONEY", libelle: "Orange Money", comptagePhysique: false, referenceAutorisee: true, ordre: 2 },
];
const SESSION: SessionCaisse = {
  id: "sc1",
  poste: { id: "po1", code: "W1", libelle: "Poste web", type: "WEB" },
  utilisateurId: "u1",
  utilisateurNom: "Ousmane Keita",
  statut: "OUVERTE",
  jourMetier: "2026-11-03",
  ouverteLe: "2026-11-03T08:00:00.000Z",
  fermeeLe: null,
  commentaireEcart: null,
  fondCaisse: 0,
  fondCompte: true,
  comptageOuverture: null,
  comptageFermeture: null,
};
const bilan = (especes: number, seuil = 5000): BilanCaisse => ({
  activite: { nombreVentes: 3, nombreAnnulations: 1, montantEncaisse: 137000, parMode: [] },
  session: SESSION,
  fond: { montant: 0, compte: true },
  mouvements: [],
  theorique: [
    { mode: "ESPECES", libelle: "Espèces", montant: especes },
    { mode: "ORANGE_MONEY", libelle: "Orange Money", montant: 87000 },
  ],
  compte: [],
  ecarts: [],
  ecartEspeces: null,
  seuilEcartCaisse: seuil,
  commentaireRequis: false,
  fige: false,
});

const onFermee = vi.fn();
const onRefus = vi.fn();
const afficher = (b: BilanCaisse) =>
  render(
    <FermetureCaisse
      structureId="p1"
      sessionId="sc1"
      bilan={b}
      modes={MODES}
      jourPasse={null}
      onFermee={onFermee}
      onRefus={onRefus}
    />,
  );
// Le testeur normalise les espaces insécables du texte affiché : on fait de même pour les attendus.
const gnf = (montant: number) => formaterGNF(montant).replace(/\s/g, " ");
const especes = () => screen.getByLabelText("Espèces dans le tiroir (GNF)") as HTMLInputElement;
const actif = () => document.activeElement as HTMLElement;
const entree = () => fireEvent.keyDown(actif(), { key: "Enter" });
const saisir = (valeur: string) => fireEvent.change(actif(), { target: { value: valeur } });

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Fermeture de la caisse", () => {
  it("se fait au clavier seul, de la saisie des espèces à la confirmation", async () => {
    fermerSession.mockResolvedValue({ data: { ...bilan(50000), fige: true }, message: "ok", success: true });
    afficher(bilan(50000));
    expect(actif()).toBe(especes());
    saisir("50 000");
    entree();
    expect(actif()).toBe(screen.getByLabelText("Relevé Orange Money (facultatif)"));
    saisir("87000");
    entree();
    expect(actif()).toBe(screen.getByRole("button", { name: "Fermer ma caisse" }));
    entree();
    const confirmer = await screen.findByRole("button", { name: "Confirmer la fermeture" });
    expect(actif()).toBe(confirmer);
    entree();
    await waitFor(() => expect(fermerSession).toHaveBeenCalledTimes(1));
    const [structureId, sessionId, corps] = fermerSession.mock.calls[0];
    expect(structureId).toBe("p1");
    expect(sessionId).toBe("sc1");
    expect(corps.comptageFermeture.id).toMatch(UUID);
    expect(corps.comptageFermeture.montantEspeces).toBe(50000);
    expect(corps.comptageFermeture.coupures).toBeUndefined();
    expect(corps.comptageFermeture.releves).toEqual([{ mode: "ORANGE_MONEY", montant: 87000 }]);
    expect(corps.commentaire).toBeUndefined();
    await waitFor(() => expect(onFermee).toHaveBeenCalledTimes(1));
  });

  it("une touche Entrée maintenue n'ouvre pas la confirmation et ne confirme pas", async () => {
    afficher(bilan(0));
    fireEvent.change(especes(), { target: { value: "0" } });
    const fermer = screen.getByRole("button", { name: "Fermer ma caisse" });
    fireEvent.keyDown(fermer, { key: "Enter", repeat: true });
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.keyDown(fermer, { key: "Enter" });
    const confirmer = await screen.findByRole("button", { name: "Confirmer la fermeture" });
    fireEvent.keyDown(confirmer, { key: "Enter", repeat: true });
    expect(fermerSession).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("montre l'écart des espèces par simple soustraction de l'attendu", () => {
    afficher(bilan(500000, 20000));
    expect(screen.queryByLabelText(/Nombre de billets/)).toBeNull();
    expect(screen.getByText("Écart espèces : saisissez le montant du tiroir")).toBeTruthy();
    fireEvent.change(especes(), { target: { value: "490 000" } });
    expect(screen.getByText(`Écart espèces : ${gnf(-10000)}`)).toBeTruthy();
    expect(gnf(-10000)).toBe("-10 000 GNF");
  });

  it("bloque les lettres, accepte les séparateurs de milliers et refuse un champ vide", () => {
    afficher(bilan(0));
    fireEvent.change(especes(), { target: { value: "12ab3,4 5" } });
    expect(especes().value).toBe("12 345");
    fireEvent.click(screen.getByRole("button", { name: "Fermer ma caisse" }));
    fireEvent.change(especes(), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Fermer ma caisse" }));
    expect(screen.getByRole("alert").textContent).toMatch(/Indiquez les espèces comptées/);
    expect(fermerSession).not.toHaveBeenCalled();
  });

  it("n'affiche aucun écart pour un mode sans relevé", () => {
    afficher(bilan(50000));
    expect(screen.getByText("Orange Money : non rapproché")).toBeTruthy();
    expect(screen.queryByText(/Écart Orange Money/)).toBeNull();
    fireEvent.change(screen.getByLabelText("Relevé Orange Money (facultatif)"), { target: { value: "90000" } });
    expect(screen.getByText(`Écart Orange Money : +${gnf(3000)}`)).toBeTruthy();
  });

  it("exige un commentaire au-delà du seuil et refuse la fermeture sans lui", () => {
    afficher(bilan(50000, 5000));
    fireEvent.change(especes(), { target: { value: "0" } });
    expect(screen.getByLabelText(`Commentaire (obligatoire : écart supérieur à ${gnf(5000)})`)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Fermer ma caisse" }));
    expect(screen.queryByRole("button", { name: "Confirmer la fermeture" })).toBeNull();
    expect(screen.getByRole("alert").textContent).toMatch(/commentaire est obligatoire/);
    expect(fermerSession).not.toHaveBeenCalled();
    expect(actif()).toBe(screen.getByRole("textbox", { name: /Commentaire/ }));
  });

  it("affiche le message du serveur et place le focus sur le commentaire", async () => {
    const message = "L'écart d'espèces est de 50 000 GNF, au-delà du seuil : ajoutez un commentaire pour fermer la caisse.";
    fermerSession.mockRejectedValueOnce(new ApiError(message, 400, { code: "COMMENTAIRE_ECART_REQUIS" }));
    afficher(bilan(50000));
    fireEvent.change(especes(), { target: { value: "50000" } });
    fireEvent.click(screen.getByRole("button", { name: "Fermer ma caisse" }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirmer la fermeture" }));
    expect(await screen.findByText(message)).toBeTruthy();
    expect(actif()).toBe(screen.getByRole("textbox", { name: /Commentaire/ }));
    expect(onRefus).not.toHaveBeenCalled();
  });

  it("refuse localement un relevé au-delà du plafond", () => {
    afficher(bilan(0));
    fireEvent.change(especes(), { target: { value: "0" } });
    fireEvent.change(screen.getByLabelText("Relevé Orange Money (facultatif)"), { target: { value: "1000000001" } });
    fireEvent.click(screen.getByRole("button", { name: "Fermer ma caisse" }));
    expect(screen.getByRole("alert").textContent).toBe(`Le relevé Orange Money ne peut pas dépasser ${formaterGNF(1000000000)}.`);
    expect(screen.queryByRole("button", { name: "Confirmer la fermeture" })).toBeNull();
    expect(fermerSession).not.toHaveBeenCalled();
  });

  it("rejoue le même corps après une coupure et obtient le bilan figé", async () => {
    fermerSession.mockRejectedValueOnce(new ApiError("Réseau", 0));
    fermerSession.mockResolvedValueOnce({ data: { ...bilan(0), fige: true }, message: "ok", success: true });
    afficher(bilan(0));
    fireEvent.change(especes(), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Fermer ma caisse" }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirmer la fermeture" }));
    const reessayer = await screen.findByRole("button", { name: "Réessayer" });
    expect(screen.getByText(/ne sera pas faite deux fois/)).toBeTruthy();
    expect(especes().matches(":disabled")).toBe(true);
    fireEvent.click(reessayer);
    await waitFor(() => expect(fermerSession).toHaveBeenCalledTimes(2));
    expect(fermerSession.mock.calls[1][2]).toEqual(fermerSession.mock.calls[0][2]);
    await waitFor(() => expect(onFermee).toHaveBeenCalledTimes(1));
    expect(onFermee.mock.calls[0][0].fige).toBe(true);
    expect(onRefus).not.toHaveBeenCalled();
  });
});

describe("Caisse fermée", () => {
  it("affiche non rapproché pour un compté nul et le fond non compté", () => {
    const figee: BilanCaisse = {
      ...bilan(50000),
      fige: true,
      fond: { montant: 0, compte: false },
      compte: [
        { mode: "ESPECES", libelle: "Espèces", montant: 48000 },
        { mode: "ORANGE_MONEY", libelle: "Orange Money", montant: null },
      ],
      ecarts: [
        { mode: "ESPECES", libelle: "Espèces", ecart: -2000 },
        { mode: "ORANGE_MONEY", libelle: "Orange Money", ecart: null },
      ],
      ecartEspeces: -2000,
      session: { ...SESSION, commentaireEcart: "Monnaie rendue en trop" },
    };
    render(<CaisseFermee bilan={figee} jourPasse={null} onNouvelleCaisse={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Caisse fermée" })).toBeTruthy();
    expect(screen.getByText("Compté : non rapproché")).toBeTruthy();
    expect(screen.getByText(`Écart : ${gnf(-2000)}`)).toBeTruthy();
    expect(screen.getAllByText(/^Écart :/)).toHaveLength(1);
    expect(screen.getByText("Commentaire : Monnaie rendue en trop")).toBeTruthy();
    expect(screen.getByText("Le fond n'avait pas été compté : il est enregistré à 0 et signalé au titulaire.")).toBeTruthy();
  });
});
