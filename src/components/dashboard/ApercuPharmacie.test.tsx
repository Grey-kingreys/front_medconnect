import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api_auth";
import type { StockMedicament } from "@/lib/api_pharmacie";
import { getMyStock } from "@/lib/api_pharmacie";
import { getMyStructure } from "@/lib/api_structure";
import ApercuPharmacie, { type ApercuPharmacieProps } from "./ApercuPharmacie";

vi.mock("@/lib/api_pharmacie", () => ({ getMyStock: vi.fn() }));
vi.mock("@/lib/api_structure", () => ({ getMyStructure: vi.fn() }));

const MAINTENANT = new Date("2026-10-22T10:00:00Z");

const reponse = (data: unknown) => ({ data, message: "ok", success: true }) as never;

const ligne = (id: string, nom: string, quantite: number, prixUnitaire?: number | null, dateExpiration?: string): StockMedicament => ({
  id,
  medicamentId: `m-${id}`,
  structureId: "s1",
  quantite,
  disponible: quantite > 0,
  prixUnitaire: prixUnitaire as never,
  dateExpiration,
  medicament: { id: `m-${id}`, nom, categorie: "Antalgique", ordonnanceRequise: false, formes: [] },
});

const reference = () => [
  ligne("a", "Doliprane 500", 50, 1000, "2027-06-01"),
  ligne("b", "Amoxicilline 500", 0, 2500),
  ligne("c", "Ibuprofène 400", 4, 1500, "2027-01-01"),
  ligne("d", "Paracétamol sirop", 20, null, "2026-11-03"),
  ligne("e", "Vitamine C", 8, 500, "2026-10-01"),
  ligne("f", "Métronidazole", 30, 2000),
];

const stockDe = (stocks: StockMedicament[]) => reponse({ stocks, alertes: { stockBas: [], rupture: [] } });

const MESSAGE_SANS_ACCES = /^Le stock de la pharmacie n'est pas ouvert à votre profil/;
const MESSAGE_ERREUR = "Les chiffres du stock n'ont pas pu être chargés. Vérifiez votre connexion puis réessayez.";
const TERMES_INTERDITS = /\b(token|payload|endpoint|API|null|undefined|NaN|UUID|exception|serveur|requête|session|cache|permission|403|500)\b/i;

const afficher = (props: Partial<ApercuPharmacieProps> = {}) =>
  render(
    <ApercuPharmacie structureId="s1" peutVoirStock peutVoirEquipe={false} maintenant={MAINTENANT} {...props} />,
  );

const groupe = (nom: string) => within(screen.getByRole("group", { name: nom }));
const attendre = (nom: string, texte: string) => waitFor(() => groupe(nom).getByText(texte));

describe("Aperçu de la pharmacie", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });
  afterEach(() => {
    cleanup();
  });

  it("affiche un état de chargement", () => {
    vi.mocked(getMyStock).mockReturnValue(new Promise(() => {}));
    const { container } = afficher();
    expect(screen.getByRole("status").textContent).toContain("Chargement du stock...");
    expect(screen.getAllByText("Chargement").length).toBeGreaterThanOrEqual(6);
    expect(container.querySelector("section")?.getAttribute("aria-busy")).toBe("true");
  });

  it("affiche les chiffres du stock", async () => {
    vi.mocked(getMyStock).mockResolvedValue(stockDe(reference()));
    afficher();
    expect(await attendre("Médicaments disponibles", "4")).toBeTruthy();
    expect(groupe("En rupture de stock").getByText("1")).toBeTruthy();
    expect(groupe("Stock bas").getByText("2")).toBeTruthy();
    expect(groupe("Expirent dans les 60 jours").getByText("1")).toBeTruthy();
    expect(groupe("Périmés encore en stock").getByText("1")).toBeTruthy();
    expect(groupe("Valeur indicative du stock").getByText((_, el) => el?.tagName === "P" && el.textContent === "116 000 GNF")).toBeTruthy();
    expect(groupe("Valeur indicative du stock").getByText(/1 médicament sans prix n'est pas compté\./)).toBeTruthy();
    expect(getMyStock).toHaveBeenCalledWith("s1");
  });

  it("liste les médicaments à surveiller dans l'ordre", async () => {
    vi.mocked(getMyStock).mockResolvedValue(stockDe(reference()));
    afficher();
    await screen.findByText("À surveiller");
    const noms = screen.getAllByRole("listitem").map((li) => li.querySelector("p")?.textContent);
    expect(noms).toEqual(["Vitamine C", "Amoxicilline 500", "Ibuprofène 400", "Paracétamol sirop"]);
    expect(screen.getByRole("link", { name: /Voir tout le stock/ }).getAttribute("href")).toBe("/dashboard/stock");
  });

  it("limite la liste à 5 lignes et annonce les autres", async () => {
    const ruptures = Array.from({ length: 7 }, (_, i) => ligne(`r${i}`, `Produit ${i}`, 0));
    vi.mocked(getMyStock).mockResolvedValue(stockDe(ruptures));
    afficher();
    expect(await screen.findByText("Et 2 autres médicaments à vérifier dans le stock.")).toBeTruthy();
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
  });

  it("indique quand il n'y a rien à signaler", async () => {
    vi.mocked(getMyStock).mockResolvedValue(stockDe([ligne("a", "Doliprane 500", 50, 1000)]));
    afficher();
    expect(
      await screen.findByText("Rien à signaler : aucun médicament en rupture, en stock bas, périmé ou proche de la péremption."),
    ).toBeTruthy();
  });

  it("invite à remplir un stock vide", async () => {
    vi.mocked(getMyStock).mockResolvedValue(stockDe([]));
    afficher();
    expect(await screen.findByText("Votre stock est vide")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ouvrir le stock" }).getAttribute("href")).toBe("/dashboard/stock");
    expect(screen.getByRole("link", { name: "Importer un fichier Excel" }).getAttribute("href")).toBe(
      "/dashboard/stock?importer=1",
    );
    expect(screen.queryByText("À surveiller")).toBeNull();
    expect(screen.queryByRole("group", { name: "Médicaments disponibles" })).toBeNull();
  });

  it("signale l'erreur puis recharge au clic sur Réessayer", async () => {
    vi.mocked(getMyStock)
      .mockRejectedValueOnce(new ApiError("Hors connexion", 0))
      .mockResolvedValue(stockDe(reference()));
    afficher();
    expect((await screen.findByRole("alert")).textContent).toContain(MESSAGE_ERREUR);
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    expect(await attendre("Médicaments disponibles", "4")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("explique calmement un refus d'accès", async () => {
    vi.mocked(getMyStock).mockRejectedValue(new ApiError("Refus", 403));
    afficher();
    expect(await screen.findByText(MESSAGE_SANS_ACCES)).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("n'appelle pas le stock sans accès au stock", () => {
    afficher({ peutVoirStock: false });
    expect(getMyStock).not.toHaveBeenCalled();
    expect(screen.getByText(MESSAGE_SANS_ACCES)).toBeTruthy();
  });

  it("affiche la carte de l'équipe selon l'accès", async () => {
    vi.mocked(getMyStock).mockResolvedValue(stockDe(reference()));
    vi.mocked(getMyStructure).mockResolvedValue(reponse({ membres: [{}, {}, {}] }));
    afficher({ peutVoirEquipe: true });
    expect(await attendre("Membres de l'équipe", "3")).toBeTruthy();
    cleanup();

    vi.mocked(getMyStructure).mockClear();
    afficher({ peutVoirEquipe: false });
    expect(screen.queryByRole("group", { name: "Membres de l'équipe" })).toBeNull();
    expect(getMyStructure).not.toHaveBeenCalled();
  });

  it("masque la carte de l'équipe sur un refus et propose de réessayer sur un échec", async () => {
    vi.mocked(getMyStock).mockResolvedValue(stockDe(reference()));
    vi.mocked(getMyStructure).mockRejectedValue(new ApiError("Refus", 403));
    afficher({ peutVoirEquipe: true });
    await attendre("Médicaments disponibles", "4");
    await waitFor(() => expect(screen.queryByRole("group", { name: "Membres de l'équipe" })).toBeNull());
    cleanup();

    vi.mocked(getMyStructure)
      .mockRejectedValueOnce(new ApiError("Hors connexion", 0))
      .mockResolvedValue(reponse({ membres: [{}, {}] }));
    afficher({ peutVoirEquipe: true });
    expect(await attendre("Membres de l'équipe", "Indisponible")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Réessayer de charger l'équipe" }));
    expect(await attendre("Membres de l'équipe", "2")).toBeTruthy();
  });

  it("affiche les liens de vente quand le profil y a droit, même sans accès au stock", async () => {
    vi.mocked(getMyStock).mockResolvedValue(stockDe(reference()));
    afficher({ peutVendre: true, peutVoirVentes: true, peutVoirStock: false });
    expect(screen.getByRole("link", { name: "Nouvelle vente" })).toHaveAttribute("href", "/dashboard/vente");
    expect(screen.getByRole("link", { name: "Ventes du jour" })).toHaveAttribute("href", "/dashboard/ventes");
  });

  it("n'affiche aucun lien de vente par défaut", async () => {
    vi.mocked(getMyStock).mockResolvedValue(stockDe(reference()));
    afficher();
    await attendre("Médicaments disponibles", "4");
    expect(screen.queryByRole("link", { name: "Nouvelle vente" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Ventes du jour" })).toBeNull();
  });

  it("n'emploie aucun terme technique", async () => {
    vi.mocked(getMyStock).mockResolvedValue(stockDe(reference()));
    const pret = afficher();
    await attendre("Médicaments disponibles", "4");
    expect(pret.container.textContent).not.toMatch(TERMES_INTERDITS);
    cleanup();

    vi.mocked(getMyStock).mockRejectedValue(new ApiError("Hors connexion", 0));
    const erreur = afficher();
    await screen.findByRole("alert");
    expect(erreur.container.textContent).not.toMatch(TERMES_INTERDITS);
    cleanup();

    const sansAcces = afficher({ peutVoirStock: false });
    expect(sansAcces.container.textContent).not.toMatch(TERMES_INTERDITS);
  });
});
