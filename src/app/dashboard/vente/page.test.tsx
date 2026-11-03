import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api_auth";
import type { Referentiels, SessionCaisse } from "@/lib/api_caisse";
import type { StockMedicament } from "@/lib/api_pharmacie";
import type { Vente } from "@/lib/api_ventes";
import { formaterGNF } from "@/lib/format_gnf";
import { jourConakry } from "../ventes/affichage";
import NouvelleVentePage from "./page";

const { chargerStock, chargerReferentiels, etatCaisse, creerVente } = vi.hoisted(() => ({
  chargerStock: vi.fn(),
  chargerReferentiels: vi.fn(),
  etatCaisse: vi.fn(),
  creerVente: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "u1", structureId: "p1", email: "u1@exemple.com", nom: "Diallo", prenom: "Mariama", role: "PHARMACIEN" },
    loading: false,
  }),
}));
vi.mock("@/lib/caisse/source_en_ligne", () => ({
  sourceEnLigne: { chargerStock, chargerReferentiels, etatCaisse, creerVente },
}));

const CLE_STOCKAGE = "medconnecte:panier-vente:p1:u1";

const stock = (id: string, nom: string, surcharge: Partial<StockMedicament> = {}, ordonnance = false): StockMedicament => ({
  id,
  medicamentId: `m-${id}`,
  medicament: { id: `m-${id}`, nom, categorie: "Divers", ordonnanceRequise: ordonnance, formes: [] },
  structureId: "p1",
  quantite: 3,
  prixUnitaire: 1500,
  disponible: true,
  ...surcharge,
});

const STOCKS = [
  stock("s1", "Paracétamol"),
  stock("s2", "Amoxicilline", { prixUnitaire: 2500, quantite: 2 }, true),
  stock("s5", "Vitamine C", { prixUnitaire: undefined }),
  stock("sd", "Doliprane 500 mg", {
    quantite: 26,
    quantiteVendable: 26,
    prixUnitaire: 3500,
    prixUnite: 600,
    coefficientBoite: 20,
    uniteMinimale: "COMPRIME",
    deconditionnable: true,
    reliquat: [{ lotId: "l1", unitesRestantes: 6 }],
  }),
  stock("sv", "Ventoline", { quantite: -1, quantiteVendable: 0, prixUnitaire: 4000 }),
  stock("sa", "Augmentin", { quantite: 12, quantiteVendable: 0, prixUnitaire: 5000 }),
];

const PARAMETRES: Referentiels["parametres"] = {
  horizonsPeremptionJours: [90, 30, 7],
  seuilEcartCaisse: 5000,
  seuilAvertissementPrixPct: 30,
  seuilStockBas: 5,
  taillePlageTickets: 500,
  seuilRechargementPlagePct: 20,
  debutCaisse: "2026-09-01",
};
const REFERENTIELS: Referentiels = {
  modesPaiement: [
    { code: "ESPECES", libelle: "Espèces", comptagePhysique: true, referenceAutorisee: false, ordre: 1 },
    { code: "ORANGE_MONEY", libelle: "Orange Money", comptagePhysique: false, referenceAutorisee: true, ordre: 2 },
    { code: "MTN_MOMO", libelle: "MTN MoMo", comptagePhysique: false, referenceAutorisee: true, ordre: 3 },
  ],
  coupures: [],
  parametres: PARAMETRES,
};

const aujourdhui = jourConakry(new Date());
const SESSION: SessionCaisse = {
  id: "sc1",
  poste: { id: "po1", code: "W1", libelle: "Poste web", type: "WEB" },
  utilisateurId: "u1",
  utilisateurNom: "Mariama Diallo",
  statut: "OUVERTE",
  jourMetier: aujourdhui,
  ouverteLe: `${aujourdhui}T08:15:00.000Z`,
  fermeeLe: null,
  commentaireEcart: null,
  fondCaisse: 0,
  fondCompte: false,
  comptageOuverture: null,
  comptageFermeture: null,
};
const ETAT = { poste: SESSION.poste, session: SESSION };

const VENTE: Vente = {
  id: "v1",
  numero: "T1-0000012",
  typePiece: "VENTE",
  numeroTicket: 12,
  jourMetier: aujourdhui,
  provisoire: false,
  poste: { id: "po1", code: "W1" },
  session: { id: "sc1", ouverteAutomatiquement: false },
  paiements: [],
  annulation: null,
  venteOrigine: null,
  motif: null,
  vendeur: { id: "u1", nom: "Mariama Diallo" },
  pharmacie: { id: "p1", nom: "Pharmacie du Centre", adresse: null, ville: "Conakry", telephone: null, logoUrl: null },
  clientNom: null,
  clientTelephone: null,
  ordonnanceVerifiee: false,
  total: 3000,
  statut: "VALIDEE",
  annuleeLe: null,
  annuleeParId: null,
  motifAnnulation: null,
  createdAt: "2026-10-22T10:00:00.000Z",
  lignes: [
    {
      id: "lv1",
      stockId: "s1",
      medicamentId: "m-s1",
      nomMedicament: "Paracétamol",
      prixUnitaire: 1500,
      quantite: 2,
      sousTotal: 3000,
      uniteAffichee: "BOITE",
      nombreAffiche: 2,
      coefficientApplique: 1,
      allocations: [],
    },
  ],
};

const TERMES_INTERDITS = /\b(ID|UUID|null|undefined|NaN|serveur|session|idempotence|localStorage|STOCK_INTROUVABLE|VALIDEE)\b/;

const verifierTermes = () => {
  const contenu = document.body.textContent ?? "";
  expect(contenu).not.toMatch(TERMES_INTERDITS);
  expect(contenu).not.toContain(String.fromCharCode(0x2013));
  expect(contenu).not.toContain(String.fromCharCode(0x2014));
  expect(contenu).not.toContain("requête");
};

/** Cherche un paragraphe par son texte complet : le montant contient des espaces insécables. */
const paragraphe = (attendu: string) => (_contenu: string, element: Element | null) =>
  element?.tagName === "P" && (element.textContent ?? "").replace(/\s+/g, " ") === attendu.replace(/\s+/g, " ");

const ajouter = (nom: string) => fireEvent.click(screen.getByRole("button", { name: `Ajouter ${nom} au panier` }));

const confirmerLaVente = async () => {
  fireEvent.click(screen.getByRole("button", { name: "Valider la vente" }));
  const dialogue = await screen.findByRole("dialog");
  fireEvent.click(within(dialogue).getByRole("button", { name: "Confirmer la vente" }));
};

const succesVente = (donnees: Vente = VENTE) => ({ ...donnees });

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  chargerStock.mockResolvedValue(STOCKS);
  chargerReferentiels.mockResolvedValue(REFERENTIELS);
  etatCaisse.mockResolvedValue(ETAT);
});

afterEach(() => {
  cleanup();
});

describe("Nouvelle vente", () => {
  it("affiche la raison d'un médicament sans prix, sans bouton Ajouter", async () => {
    render(<NouvelleVentePage />);
    await screen.findByText("Vitamine C");

    const ligne = screen.getByText("Vitamine C").closest("li") as HTMLElement;
    expect(within(ligne).getByText("Prix non renseigné")).toBeInTheDocument();
    expect(within(ligne).queryByRole("button")).toBeNull();
    expect(screen.getByRole("button", { name: "Ajouter Paracétamol au panier" })).toBeInTheDocument();
    verifierTermes();
  });

  it("affiche le prix de la boîte, le prix à l'unité et le stock", async () => {
    render(<NouvelleVentePage />);
    const ligne = (await screen.findByText("Doliprane 500 mg")).closest("li") as HTMLElement;

    expect(ligne.textContent).toContain(`Reste : 1 boîte et 6 comprimés`);
    expect(ligne.textContent).toContain(formaterGNF(3500));
    expect(ligne.textContent).toContain(`${formaterGNF(600)} le comprimé`);
  });

  it("le « + » s'arrête au stock (3 boîtes), « - » reste permis, et le total se calcule en direct", async () => {
    render(<NouvelleVentePage />);
    await screen.findByText("Paracétamol");
    ajouter("Paracétamol");

    const moins = screen.getByRole("button", { name: "Diminuer la quantité de Paracétamol" });
    const plus = screen.getByRole("button", { name: "Augmenter la quantité de Paracétamol" });
    expect(moins).toBeDisabled();
    expect(plus).not.toBeDisabled();
    fireEvent.click(plus);
    fireEvent.click(plus);
    fireEvent.click(plus);
    expect(plus).toBeDisabled();
    expect(moins).not.toBeDisabled();
    expect(screen.getByText("Vous avez pris tout le stock disponible.")).toBeInTheDocument();
    expect(screen.getByText("Total").parentElement?.textContent).toBe(`Total${formaterGNF(4500)}`);
    fireEvent.click(moins);
    expect(plus).not.toBeDisabled();
  });

  it("exige l'ordonnance vue pour un médicament sur ordonnance", async () => {
    render(<NouvelleVentePage />);
    await screen.findByText("Amoxicilline");
    ajouter("Amoxicilline");

    fireEvent.click(screen.getByRole("button", { name: "Valider la vente" }));
    expect(screen.getByText("Cochez « J'ai vu l'ordonnance » pour vendre ces médicaments.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByLabelText("J'ai vu l'ordonnance")).toHaveFocus();

    fireEvent.click(screen.getByLabelText("J'ai vu l'ordonnance"));
    fireEvent.click(screen.getByRole("button", { name: "Valider la vente" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Ordonnance vue")).toBeInTheDocument();
  });

  it("refuse un téléphone invalide sans ouvrir la confirmation", async () => {
    render(<NouvelleVentePage />);
    await screen.findByText("Paracétamol");
    ajouter("Paracétamol");
    fireEvent.change(screen.getByLabelText("Téléphone du client"), { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: "Valider la vente" }));

    expect(screen.getByText("Ce numéro de téléphone n'est pas valide.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("enregistre la vente après confirmation et affiche le reçu", async () => {
    creerVente.mockResolvedValue(succesVente());
    render(<NouvelleVentePage />);
    await screen.findByText("Paracétamol");
    ajouter("Paracétamol");
    fireEvent.click(screen.getByRole("button", { name: "Augmenter la quantité de Paracétamol" }));
    expect(localStorage.getItem(CLE_STOCKAGE)).not.toBeNull();

    await confirmerLaVente();

    expect(await screen.findByRole("heading", { name: "Vente enregistrée" })).toHaveFocus();
    expect(creerVente).toHaveBeenCalledWith(
      "p1",
      { lignes: [{ stockId: "s1", quantite: 2, unite: "BOITE" }] },
      expect.any(String),
    );
    expect(screen.getByText("Numéro : T1-0000012")).toBeInTheDocument();
    expect(document.body.textContent).toContain(`Total : ${formaterGNF(3000)}`);
    expect(screen.getByRole("link", { name: "Voir et imprimer le reçu" })).toHaveAttribute("href", "/dashboard/ventes/v1/recu");
    expect(localStorage.getItem(CLE_STOCKAGE)).toBeNull();
    verifierTermes();
  });

  it("vente espèces d'une ligne en quatre interactions", async () => {
    creerVente.mockResolvedValue(succesVente());
    render(<NouvelleVentePage />);
    const champ = await screen.findByLabelText("Rechercher un médicament");

    let interactions = 0;
    const agir = {
      change: (element: Element, init: Parameters<typeof fireEvent.change>[1]) => {
        interactions += 1;
        fireEvent.change(element, init);
      },
      keyDown: (element: Element, init: Parameters<typeof fireEvent.keyDown>[1]) => {
        interactions += 1;
        fireEvent.keyDown(element, init);
      },
      click: (element: Element) => {
        interactions += 1;
        fireEvent.click(element);
      },
    };

    agir.change(champ, { target: { value: "doli" } });
    agir.keyDown(champ, { key: "Enter" });
    expect(champ).toHaveValue("");
    agir.click(screen.getByRole("button", { name: "Valider la vente" }));
    const dialogue = await screen.findByRole("dialog");
    expect(within(dialogue).getByRole("button", { name: "Confirmer la vente" })).toHaveFocus();
    agir.click(within(dialogue).getByRole("button", { name: "Confirmer la vente" }));

    expect(await screen.findByRole("heading", { name: "Vente enregistrée" })).toBeInTheDocument();
    expect(creerVente).toHaveBeenCalledTimes(1);
    const corps = creerVente.mock.calls[0][1];
    expect(corps.lignes).toEqual([{ stockId: "sd", quantite: 1, unite: "UNITE" }]);
    expect("paiements" in corps).toBe(false);
    expect(interactions).toBe(4);
    expect(interactions).toBeLessThanOrEqual(5);
  });

  it("affiche le reliquat de la boîte entamée", async () => {
    render(<NouvelleVentePage />);
    await screen.findByText("Doliprane 500 mg");
    expect(screen.queryByText(/Boîte entamée/)).toBeNull();
    ajouter("Doliprane 500 mg");

    expect(screen.getByText("Boîte entamée : 6 comprimés restants")).toBeInTheDocument();
    verifierTermes();
  });

  it("F2 bascule l'unité de la dernière ligne", async () => {
    render(<NouvelleVentePage />);
    await screen.findByText("Doliprane 500 mg");
    ajouter("Doliprane 500 mg");

    expect(screen.getByRole("button", { name: "Comprimés" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Boîte" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("F2 : passer de la boîte à l'unité pour la dernière ligne")).toBeInTheDocument();

    fireEvent.keyDown(document.body, { key: "F2" });

    expect(screen.getByRole("button", { name: "Boîte" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Comprimés" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("Total").parentElement?.textContent).toBe(`Total${formaterGNF(3500)}`);
  });

  it("désactive l'unité quand la fiche ne se vend qu'à la boîte", async () => {
    render(<NouvelleVentePage />);
    await screen.findByText("Paracétamol");
    ajouter("Paracétamol");

    expect(screen.getByRole("button", { name: "Unités" })).toBeDisabled();
  });

  it("une fiche en rupture n'a pas de bouton d'ajout et montre « Rupture de stock » et la part à régulariser", async () => {
    chargerStock.mockResolvedValue([
      ...STOCKS.filter((s) => s.id !== "sv"),
      stock("sv", "Ventoline", { quantite: 0, quantiteVendable: 0, quantiteARegulariser: 1, prixUnitaire: 4000 }),
    ]);
    render(<NouvelleVentePage />);
    await screen.findByText("Ventoline");

    const ligne = screen.getByText("Ventoline").closest("li") as HTMLElement;
    expect(within(ligne).getByText("Rupture de stock")).toBeInTheDocument();
    expect(ligne.textContent).toContain("Reste : 0 boîte, 1 boîte à régulariser");
    expect(within(ligne).queryByRole("button")).toBeNull();
    expect(document.body.textContent).not.toContain("livraison");
    verifierTermes();
  });

  it("moins d'une boîte en stock : pas de bouton d'ajout, le reste est affiché, Entrée n'ajoute rien et garde la recherche", async () => {
    chargerStock.mockResolvedValue([
      stock("sm", "Spasfon", {
        quantite: 5,
        quantiteVendable: 5,
        prixUnitaire: 3500,
        coefficientBoite: 20,
        uniteMinimale: "COMPRIME",
        deconditionnable: true,
        prixUnite: null,
      }),
    ]);
    render(<NouvelleVentePage />);
    await screen.findByText("Spasfon");

    const ligne = screen.getByText("Spasfon").closest("li") as HTMLElement;
    expect(within(ligne).getByText("Moins d'une boîte en stock")).toBeInTheDocument();
    expect(ligne.textContent).toContain("Reste : 5 comprimés");
    expect(within(ligne).queryByRole("button")).toBeNull();

    const champ = screen.getByLabelText("Rechercher un médicament");
    fireEvent.change(champ, { target: { value: "spas" } });
    fireEvent.keyDown(champ, { key: "Enter" });
    expect(champ).toHaveValue("spas");
    expect(screen.getByText("Le panier est vide. Recherchez un médicament puis appuyez sur « Ajouter ».")).toBeInTheDocument();
  });

  it("au panier : stock restant mais pas assez pour une boîte de plus, ou tout le stock pris", async () => {
    chargerStock.mockResolvedValue([
      stock("sr", "Spasfon", {
        quantite: 25,
        quantiteVendable: 25,
        prixUnitaire: 3500,
        coefficientBoite: 20,
        uniteMinimale: "COMPRIME",
        deconditionnable: true,
        prixUnite: null,
      }),
    ]);
    render(<NouvelleVentePage />);
    await screen.findByText("Spasfon");
    ajouter("Spasfon");

    expect(screen.getByText("Il ne reste pas assez de stock pour une boîte de plus.")).toBeInTheDocument();
    expect(screen.queryByText("Vous avez pris tout le stock disponible.")).toBeNull();
    expect(screen.getByRole("button", { name: "Augmenter la quantité de Spasfon" })).toBeDisabled();
  });

  it("au plafond : plus de bouton d'ajout dans la liste, Entrée ne fait rien", async () => {
    chargerStock.mockResolvedValue([
      stock("sr", "Spasfon", { quantite: 1, quantiteVendable: 1, prixUnitaire: 3500 }),
    ]);
    render(<NouvelleVentePage />);
    await screen.findByText("Spasfon");
    ajouter("Spasfon");

    const ligne = screen.getByRole("button", { name: "Augmenter la quantité de Spasfon" });
    expect(ligne).toBeDisabled();
    expect(screen.getByText("Plus assez de stock à ajouter")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ajouter Spasfon au panier" })).toBeNull();

    const champ = screen.getByLabelText("Rechercher un médicament");
    fireEvent.change(champ, { target: { value: "spas" } });
    fireEvent.keyDown(champ, { key: "Enter" });
    expect(champ).toHaveValue("spas");
  });

  it("périmé seulement : l'avertissement de la liste n'est pas doublé sous la ligne du panier", async () => {
    render(<NouvelleVentePage />);
    await screen.findByText("Augmentin");
    ajouter("Augmentin");

    const aviss = "Il ne reste que des boîtes périmées : vous devrez choisir le lot à sortir.";
    expect(screen.getAllByText(aviss)).toHaveLength(1);
    // Il reste de la place au panier (12 boîtes périmées) : aucun texte de plafond en plus.
    expect(screen.queryByText("Vous avez pris tout le stock disponible.")).toBeNull();
    const plus = screen.getByRole("button", { name: "Augmenter la quantité de Augmentin" });
    for (let i = 0; i < 11; i++) fireEvent.click(plus);
    expect(plus).toBeDisabled();
    expect(screen.getAllByText("Vous avez pris tout le stock disponible.")).toHaveLength(1);
    expect(screen.getAllByText(aviss)).toHaveLength(1);
  });

  it("un stock négatif d'un ancien serveur se lit 0 sans signe moins", async () => {
    render(<NouvelleVentePage />);
    await screen.findByText("Ventoline");

    const ligne = screen.getByText("Ventoline").closest("li") as HTMLElement;
    expect(ligne.textContent).toContain("Reste : 0 boîte");
    expect(ligne.textContent).not.toMatch(/-\d/);
    expect(within(ligne).queryByRole("button")).toBeNull();
  });

  it("STOCK_INSUFFISANT : message du serveur, panier gardé et modifiable, stock relu, nouvelle clé au renvoi", async () => {
    const message = "Stock insuffisant pour Paracétamol : il reste 1 boîte. Corrigez le panier puis validez à nouveau.";
    creerVente
      .mockRejectedValueOnce(
        new ApiError(message, 409, {
          code: "STOCK_INSUFFISANT",
          details: [{ stockId: "s1", nom: "Paracétamol", unite: "BOITE", demande: 3, disponible: 1, disponibleUm: 1 }],
        }),
      )
      .mockResolvedValueOnce(succesVente());
    render(<NouvelleVentePage />);
    await screen.findByText("Paracétamol");
    ajouter("Paracétamol");
    fireEvent.click(screen.getByRole("button", { name: "Augmenter la quantité de Paracétamol" }));
    fireEvent.click(screen.getByRole("button", { name: "Augmenter la quantité de Paracétamol" }));

    // Le stock a baissé entre-temps : la relecture le dit à 1 boîte.
    chargerStock.mockResolvedValue([
      ...STOCKS.filter((s) => s.id !== "s1"),
      stock("s1", "Paracétamol", { quantite: 1, quantiteVendable: 1 }),
    ]);
    await confirmerLaVente();

    const alerte = await screen.findByRole("alert");
    expect(alerte).toHaveTextContent(message);
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(chargerStock).toHaveBeenCalledTimes(2));
    // Le panier est gardé (3 boîtes), le texte dit ce qu'il reste, « + » est bloqué, « - » permis.
    const ligne = (await screen.findByRole("button", { name: "Retirer Paracétamol du panier" })).closest("li") as HTMLElement;
    await waitFor(() => expect(ligne.textContent).toContain("Stock insuffisant : il reste 1 boîte."));
    expect(ligne.textContent).toContain(`${formaterGNF(1500)} × 3`);
    expect(screen.getByRole("button", { name: "Augmenter la quantité de Paracétamol" })).toBeDisabled();
    const moins = screen.getByRole("button", { name: "Diminuer la quantité de Paracétamol" });
    fireEvent.click(moins);
    fireEvent.click(moins);
    expect(ligne.textContent).toContain(`${formaterGNF(1500)} × 1`);
    expect(ligne.textContent).not.toContain("Stock insuffisant");

    await confirmerLaVente();

    expect(await screen.findByRole("heading", { name: "Vente enregistrée" })).toBeInTheDocument();
    expect(creerVente).toHaveBeenCalledTimes(2);
    expect(creerVente.mock.calls[1][2]).not.toBe(creerVente.mock.calls[0][2]);
    expect(creerVente.mock.calls[1][1].lignes).toEqual([{ stockId: "s1", quantite: 1, unite: "BOITE" }]);
  });

  it("sortie d'un lot périmé : le second envoi porte le lot et le motif, avec une autre clé", async () => {
    creerVente
      .mockRejectedValueOnce(
        new ApiError("Il ne reste que des lots périmés.", 409, {
          code: "SORTIE_MANUELLE_REQUISE",
          details: [
            {
              stockId: "sa",
              nom: "Augmentin",
              lots: [{ lotId: "l-p", numeroLot: "AG23C777", dateExpiration: "2026-09-01T00:00:00.000Z", quantite: 12 }],
            },
          ],
        }),
      )
      .mockResolvedValueOnce(succesVente());
    render(<NouvelleVentePage />);
    await screen.findByText("Augmentin");
    expect(screen.getByText("Il ne reste que des boîtes périmées : vous devrez choisir le lot à sortir.")).toBeInTheDocument();
    ajouter("Augmentin");

    await confirmerLaVente();

    const dialogue = await screen.findByRole("dialog", { name: "Sortie d'un lot périmé" });
    expect(dialogue).toHaveTextContent("Il ne reste que des boîtes périmées de Augmentin.");
    fireEvent.click(within(dialogue).getByRole("button", { name: "Vendre ce lot" }));
    expect(within(dialogue).getByText("Choisissez un lot et indiquez un motif de 3 caractères au moins.")).toBeInTheDocument();
    expect(creerVente).toHaveBeenCalledTimes(1);

    fireEvent.click(within(dialogue).getByRole("radio", { name: /AG23C777/ }));
    fireEvent.change(within(dialogue).getByLabelText("Motif"), { target: { value: "Demande du médecin" } });
    fireEvent.click(within(dialogue).getByRole("button", { name: "Vendre ce lot" }));

    expect(await screen.findByRole("heading", { name: "Vente enregistrée" })).toBeInTheDocument();
    expect(creerVente).toHaveBeenCalledTimes(2);
    expect(creerVente.mock.calls[1][1].lignes).toEqual([
      { stockId: "sa", quantite: 1, unite: "BOITE", sortieManuelle: { lotId: "l-p", motif: "Demande du médecin" } },
    ]);
    expect(creerVente.mock.calls[1][2]).not.toBe(creerVente.mock.calls[0][2]);
  });

  it("deux fiches périmées successives : le second dialogue repart sans lot ni motif", async () => {
    const refusSortie = (stockId: string, nom: string, lotId: string, numeroLot: string) =>
      new ApiError("Il ne reste que des lots périmés.", 409, {
        code: "SORTIE_MANUELLE_REQUISE",
        details: [{ stockId, nom, lots: [{ lotId, numeroLot, dateExpiration: "2026-09-01T00:00:00.000Z", quantite: 3 }] }],
      });
    creerVente
      .mockRejectedValueOnce(refusSortie("sa", "Augmentin", "l-a", "AG23C777"))
      .mockRejectedValueOnce(refusSortie("s1", "Paracétamol", "l-b", "PA11B222"))
      .mockResolvedValueOnce(succesVente());
    render(<NouvelleVentePage />);
    await screen.findByText("Augmentin");
    ajouter("Augmentin");
    ajouter("Paracétamol");

    await confirmerLaVente();

    const premier = await screen.findByRole("dialog", { name: "Sortie d'un lot périmé" });
    fireEvent.click(within(premier).getByRole("radio", { name: /AG23C777/ }));
    fireEvent.change(within(premier).getByLabelText("Motif"), { target: { value: "Demande du médecin" } });
    fireEvent.click(within(premier).getByRole("button", { name: "Vendre ce lot" }));

    const second = await screen.findByText(/Il ne reste que des boîtes périmées de Paracétamol\./);
    const dialogue = second.closest("[role='dialog']") as HTMLElement;
    expect(within(dialogue).getByRole("radio", { name: /PA11B222/ })).not.toBeChecked();
    expect(within(dialogue).getByLabelText("Motif")).toHaveValue("");
    fireEvent.click(within(dialogue).getByRole("button", { name: "Vendre ce lot" }));
    expect(within(dialogue).getByText("Choisissez un lot et indiquez un motif de 3 caractères au moins.")).toBeInTheDocument();
    expect(creerVente).toHaveBeenCalledTimes(2);

    fireEvent.click(within(dialogue).getByRole("radio", { name: /PA11B222/ }));
    fireEvent.change(within(dialogue).getByLabelText("Motif"), { target: { value: "Aucun autre lot" } });
    fireEvent.click(within(dialogue).getByRole("button", { name: "Vendre ce lot" }));

    expect(await screen.findByRole("heading", { name: "Vente enregistrée" })).toBeInTheDocument();
    expect(creerVente.mock.calls[2][1].lignes).toEqual([
      { stockId: "sa", quantite: 1, unite: "BOITE", sortieManuelle: { lotId: "l-a", motif: "Demande du médecin" } },
      { stockId: "s1", quantite: 1, unite: "BOITE", sortieManuelle: { lotId: "l-b", motif: "Aucun autre lot" } },
    ]);
  });

  it("paiement partagé : confirmation désactivée tant que la somme diffère du total", async () => {
    creerVente.mockResolvedValue(succesVente());
    render(<NouvelleVentePage />);
    await screen.findByText("Paracétamol");
    ajouter("Paracétamol");
    fireEvent.click(screen.getByRole("button", { name: "Valider la vente" }));
    const dialogue = await screen.findByRole("dialog");
    const confirmer = within(dialogue).getByRole("button", { name: "Confirmer la vente" });

    fireEvent.click(within(dialogue).getByRole("radio", { name: "Paiement partagé" }));
    expect(confirmer).toBeDisabled();
    expect(within(dialogue).getByText(paragraphe(`Reste à répartir : ${formaterGNF(1500)}`))).toBeInTheDocument();

    fireEvent.change(within(dialogue).getByLabelText("Montant en Espèces"), { target: { value: "1000" } });
    expect(confirmer).toBeDisabled();
    expect(within(dialogue).getByText("La somme des montants doit être égale au total.")).toBeInTheDocument();

    fireEvent.change(within(dialogue).getByLabelText("Montant en Orange Money"), { target: { value: "500" } });
    expect(confirmer).not.toBeDisabled();
    fireEvent.change(within(dialogue).getByLabelText("Référence de la transaction (facultatif)"), { target: { value: "OM-778" } });
    fireEvent.click(confirmer);

    await screen.findByRole("heading", { name: "Vente enregistrée" });
    expect(creerVente.mock.calls[0][1].paiements).toEqual([
      { mode: "ESPECES", montant: 1000 },
      { mode: "ORANGE_MONEY", montant: 500, reference: "OM-778" },
    ]);
  });

  it("espèces : montant reçu inférieur au total bloque, supérieur affiche la monnaie à rendre", async () => {
    creerVente.mockResolvedValue(succesVente());
    render(<NouvelleVentePage />);
    await screen.findByText("Paracétamol");
    ajouter("Paracétamol");
    fireEvent.click(screen.getByRole("button", { name: "Valider la vente" }));
    const dialogue = await screen.findByRole("dialog");
    const confirmer = within(dialogue).getByRole("button", { name: "Confirmer la vente" });

    fireEvent.change(within(dialogue).getByLabelText("Montant reçu (facultatif)"), { target: { value: "1000" } });
    expect(within(dialogue).getByText("Le montant reçu est inférieur au total.")).toBeInTheDocument();
    expect(confirmer).toBeDisabled();

    fireEvent.change(within(dialogue).getByLabelText("Montant reçu (facultatif)"), { target: { value: "2000" } });
    expect(within(dialogue).getByText(paragraphe(`Monnaie à rendre : ${formaterGNF(500)}`))).toBeInTheDocument();
    fireEvent.click(confirmer);

    await screen.findByRole("heading", { name: "Vente enregistrée" });
    expect(creerVente.mock.calls[0][1].paiements).toEqual([{ mode: "ESPECES", montant: 1500, montantRecu: 2000 }]);
  });

  it("refus métier : message du serveur et nouvelle clé au renvoi", async () => {
    creerVente
      .mockRejectedValueOnce(new ApiError("La somme des paiements ne correspond pas au total.", 400, { code: "PAIEMENTS_INCOHERENTS" }))
      .mockResolvedValueOnce(succesVente());
    render(<NouvelleVentePage />);
    await screen.findByText("Paracétamol");
    ajouter("Paracétamol");

    await confirmerLaVente();

    const alerte = await screen.findByRole("alert");
    expect(alerte).toHaveTextContent("La somme des paiements ne correspond pas au total.");
    expect(alerte).toHaveTextContent("Le total a été recalculé : vérifiez le paiement puis validez à nouveau.");
    expect(within(alerte).queryByRole("button", { name: "Réessayer" })).toBeNull();
    await waitFor(() => expect(chargerStock).toHaveBeenCalledTimes(2));

    await confirmerLaVente();

    expect(await screen.findByRole("heading", { name: "Vente enregistrée" })).toBeInTheDocument();
    expect(creerVente).toHaveBeenCalledTimes(2);
    expect(creerVente.mock.calls[1][2]).not.toBe(creerVente.mock.calls[0][2]);
  });

  it("après un échec de connexion, « Réessayer » renvoie la même demande avec la même clé", async () => {
    creerVente.mockRejectedValueOnce(new ApiError("Connexion perdue.", 0)).mockResolvedValueOnce(succesVente());
    render(<NouvelleVentePage />);
    await screen.findByText("Paracétamol");
    ajouter("Paracétamol");

    await confirmerLaVente();

    const alerte = await screen.findByRole("alert");
    expect(alerte).toHaveTextContent("La vente n'a peut-être pas été enregistrée.");
    verifierTermes();
    fireEvent.click(within(alerte).getByRole("button", { name: "Réessayer" }));

    expect(await screen.findByRole("heading", { name: "Vente enregistrée" })).toBeInTheDocument();
    expect(creerVente).toHaveBeenCalledTimes(2);
    const premiereCle = creerVente.mock.calls[0][2];
    expect(typeof premiereCle).toBe("string");
    expect(creerVente.mock.calls[1][2]).toBe(premiereCle);
    expect(creerVente.mock.calls[1][1]).toEqual(creerVente.mock.calls[0][1]);
  });

  it("après un échec de connexion, le panier est verrouillé ; « Modifier la saisie » le débloque avec une nouvelle clé", async () => {
    creerVente.mockRejectedValueOnce(new ApiError("Connexion perdue.", 0)).mockResolvedValueOnce(succesVente());
    render(<NouvelleVentePage />);
    await screen.findByText("Doliprane 500 mg");
    ajouter("Paracétamol");

    await confirmerLaVente();

    const alerte = await screen.findByRole("alert");
    expect(alerte).toHaveTextContent("Le panier reste bloqué en attendant");
    // Saisie verrouillée : aucune modification possible sous la même clé.
    expect(screen.getByRole("button", { name: "Augmenter la quantité de Paracétamol" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Retirer Paracétamol du panier" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Ajouter Doliprane 500 mg au panier" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Valider la vente" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Vider le panier" })).toBeDisabled();
    expect(screen.getByLabelText("Nom du client")).toBeDisabled();
    expect(screen.getByLabelText("Téléphone du client")).toBeDisabled();
    expect(within(alerte).queryByRole("button", { name: "Fermer le message" })).toBeNull();
    const champ = screen.getByLabelText("Rechercher un médicament");
    fireEvent.change(champ, { target: { value: "doli" } });
    fireEvent.keyDown(champ, { key: "Enter" });
    expect(screen.queryByRole("button", { name: "Retirer Doliprane 500 mg du panier" })).toBeNull();
    verifierTermes();

    fireEvent.click(within(alerte).getByRole("button", { name: "Modifier la saisie" }));

    expect(screen.queryByRole("button", { name: "Réessayer" })).toBeNull();
    expect(
      screen.getByText(
        "Avant de valider à nouveau, vérifiez dans les ventes du jour que la vente précédente n'a pas été enregistrée : sinon elle serait comptée deux fois.",
      ),
    ).toBeInTheDocument();
    const plus = screen.getByRole("button", { name: "Augmenter la quantité de Paracétamol" });
    expect(plus).not.toBeDisabled();
    fireEvent.click(plus);

    await confirmerLaVente();

    expect(await screen.findByRole("heading", { name: "Vente enregistrée" })).toBeInTheDocument();
    expect(creerVente).toHaveBeenCalledTimes(2);
    expect(creerVente.mock.calls[1][1].lignes).toEqual([{ stockId: "s1", quantite: 2, unite: "BOITE" }]);
    expect(creerVente.mock.calls[1][2]).not.toBe(creerVente.mock.calls[0][2]);
  });

  it("retire du panier un médicament introuvable et affiche le message reçu", async () => {
    creerVente.mockRejectedValue(
      new ApiError("Ce médicament n'est plus dans votre stock.", 404, { code: "STOCK_INTROUVABLE", details: [{ stockId: "s1" }] }),
    );
    chargerStock.mockResolvedValueOnce(STOCKS).mockResolvedValue(STOCKS.filter((s) => s.id !== "s1"));
    render(<NouvelleVentePage />);
    await screen.findByText("Paracétamol");
    ajouter("Paracétamol");

    await confirmerLaVente();

    const alerte = await screen.findByRole("alert");
    expect(alerte).toHaveTextContent("Ce médicament n'est plus dans votre stock.");
    await waitFor(() => expect(chargerStock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Retirer Paracétamol du panier" })).toBeNull());
    verifierTermes();
  });

  it("caisse clôturée : message du serveur, état de la caisse rechargé, pas de « Réessayer »", async () => {
    creerVente.mockRejectedValue(new ApiError("Cette journée est déjà clôturée.", 409, { code: "JOURNEE_CLOTUREE" }));
    render(<NouvelleVentePage />);
    await screen.findByText("Paracétamol");
    ajouter("Paracétamol");

    await confirmerLaVente();

    const alerte = await screen.findByRole("alert");
    expect(alerte).toHaveTextContent("Cette journée est déjà clôturée.");
    expect(within(alerte).queryByRole("button", { name: "Réessayer" })).toBeNull();
    await waitFor(() => expect(etatCaisse).toHaveBeenCalledTimes(2));
  });

  it("badge de caisse : ouverte depuis 08:15 ; état en échec : pas de badge, la vente reste possible", async () => {
    render(<NouvelleVentePage />);
    expect(await screen.findByText("Caisse ouverte depuis 08:15")).toBeInTheDocument();
    cleanup();

    etatCaisse.mockRejectedValue(new ApiError("Indisponible.", 500));
    creerVente.mockResolvedValue(succesVente());
    render(<NouvelleVentePage />);
    await screen.findByText("Paracétamol");
    expect(screen.queryByText(/^Caisse (ouverte|fermée)/)).toBeNull();
    ajouter("Paracétamol");

    await confirmerLaVente();

    expect(await screen.findByRole("heading", { name: "Vente enregistrée" })).toBeInTheDocument();
  });

  it("badge de caisse : fermée, ou ouverte sur un autre jour", async () => {
    etatCaisse.mockResolvedValue({ poste: SESSION.poste, session: null });
    render(<NouvelleVentePage />);
    expect(await screen.findByText("Caisse fermée : elle s'ouvrira à la première vente")).toBeInTheDocument();
    cleanup();

    etatCaisse.mockResolvedValue({ poste: SESSION.poste, session: { ...SESSION, jourMetier: "2026-10-22" } });
    render(<NouvelleVentePage />);
    expect(await screen.findByText(/Caisse ouverte, ventes comptées pour le .*22 octobre 2026/)).toBeInTheDocument();
  });

  it("succès : monnaie à rendre, sans texte d'attente de livraison", async () => {
    creerVente.mockResolvedValue(
      succesVente({
        ...VENTE,
        provisoire: true,
        paiements: [
          { id: "pa1", mode: "ESPECES", libelle: "Espèces", montant: 10000, reference: null, montantRecu: 15000, rendu: 5000 },
          { id: "pa2", mode: "ORANGE_MONEY", libelle: "Orange Money", montant: 5000, reference: "OM-778", montantRecu: null, rendu: null },
        ],
      }),
    );
    render(<NouvelleVentePage />);
    await screen.findByText("Paracétamol");
    ajouter("Paracétamol");

    await confirmerLaVente();

    await screen.findByRole("heading", { name: "Vente enregistrée" });
    expect(screen.getByText(paragraphe(`Espèces : ${formaterGNF(10000)}`))).toBeInTheDocument();
    expect(screen.getByText(paragraphe(`Orange Money : ${formaterGNF(5000)}, référence OM-778`))).toBeInTheDocument();
    expect(screen.getByText(paragraphe(`Monnaie à rendre : ${formaterGNF(5000)}`))).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/attend une livraison|attente de livraison/);
    verifierTermes();
  });

  it("signale une vente déjà enregistrée au rejeu", async () => {
    creerVente.mockResolvedValue(succesVente({ ...VENTE, rejeu: true }));
    render(<NouvelleVentePage />);
    await screen.findByText("Paracétamol");
    ajouter("Paracétamol");

    await confirmerLaVente();

    expect(
      await screen.findByText("Cette vente était déjà enregistrée : elle n'a pas été comptée deux fois."),
    ).toBeInTheDocument();
    verifierTermes();
  });

  it("relit un panier version 1 enregistré", async () => {
    localStorage.setItem(
      CLE_STOCKAGE,
      JSON.stringify({
        version: 1,
        cleIdempotence: "cle-1",
        lignes: [{ stockId: "s1", quantite: 5 }],
        clientNom: "Barry",
        clientTelephone: "",
        ordonnanceVue: false,
      }),
    );
    render(<NouvelleVentePage />);

    const ligne = (await screen.findByRole("button", { name: "Retirer Paracétamol du panier" })).closest("li") as HTMLElement;
    expect(ligne.textContent).toContain(`${formaterGNF(1500)} × 5`);
    expect(screen.getByLabelText("Nom du client")).toHaveValue("Barry");
  });

  it("affiche le bandeau en ligne seulement", async () => {
    render(<NouvelleVentePage />);
    expect(
      await screen.findByText("Cette page a besoin d'internet : sans connexion, aucune vente n'est enregistrée."),
    ).toBeInTheDocument();
  });

  it("propose de réessayer quand le stock ne se charge pas", async () => {
    chargerStock.mockRejectedValueOnce(new ApiError("Impossible de joindre le service.", 0));
    render(<NouvelleVentePage />);

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    expect(await screen.findByText("Paracétamol")).toBeInTheDocument();
  });

  it("guide vers le stock quand il est vide", async () => {
    chargerStock.mockResolvedValue([]);
    render(<NouvelleVentePage />);

    expect(await screen.findByText(/Votre stock est vide/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Aller au stock" })).toHaveAttribute("href", "/dashboard/stock");
  });
});
