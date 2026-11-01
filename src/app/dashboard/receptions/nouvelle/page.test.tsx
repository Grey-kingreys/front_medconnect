import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api_auth";
import type { Reception, StockMedicament } from "@/lib/api_pharmacie";
import NouvelleReceptionPage from "./page";

const { getMyStock, listerFournisseurs, creerFournisseur, enregistrerReception } = vi.hoisted(() => ({
  getMyStock: vi.fn(),
  listerFournisseurs: vi.fn(),
  creerFournisseur: vi.fn(),
  enregistrerReception: vi.fn(),
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
  listerFournisseurs,
  creerFournisseur,
  enregistrerReception,
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
  fiche("s2", "Amoxicilline", { coefficientBoite: 12, uniteMinimale: "GELULE", qualifie: false }),
  fiche("s3", "Ancienne fiche", { archiveLe: "2026-09-01T00:00:00.000Z" }),
  // Fiche neuve : 1 unité par boîte, non confirmée (aucun choix d'unité proposé).
  fiche("s4", "Spasfon", { qualifie: false }),
];

const reponseStock = (stocks: StockMedicament[]) => ({
  data: { stocks, alertes: { stockBas: [], rupture: [] } },
  message: "ok",
  success: true,
});

const reponse = (surcharge: Partial<Reception> = {}, message = "Réception enregistrée : 1 lot.") => ({
  data: {
    id: "r1",
    reference: null,
    recueLe: "2026-10-22T10:00:00.000Z",
    createdAt: "2026-10-22T10:00:00.000Z",
    auteurId: "u1",
    fournisseur: null,
    lots: [],
    cree: true,
    avertissements: [],
    ...surcharge,
  } as Reception,
  message,
  success: true,
});

const TERMES_INTERDITS = /\b(ID|UUID|null|undefined|NaN|coefficient|UM|STOCK_INTROUVABLE|DATE_PEREMPTION_PASSEE)\b/;

const verifierTermes = () => {
  const contenu = document.body.textContent ?? "";
  expect(contenu).not.toMatch(TERMES_INTERDITS);
  expect(contenu).not.toContain("réception provisoire");
  expect(contenu).not.toContain(String.fromCharCode(0x2013));
  expect(contenu).not.toContain(String.fromCharCode(0x2014));
};

const saisir = (libelle: string | RegExp, valeur: string) =>
  fireEvent.change(screen.getByLabelText(libelle), { target: { value: valeur } });

const choisirMedicament = (ligne: number, recherche: string) => {
  const champ = screen.getByLabelText(`Médicament, ligne ${ligne}`);
  fireEvent.change(champ, { target: { value: recherche } });
  fireEvent.keyDown(champ, { key: "Enter" });
};

const remplirLigne = (ligne: number, recherche: string, quantite: string, peremption = "6/28") => {
  choisirMedicament(ligne, recherche);
  saisir(`Quantité, ligne ${ligne}`, quantite);
  saisir(`Péremption, ligne ${ligne}`, peremption);
  fireEvent.blur(screen.getByLabelText(`Péremption, ligne ${ligne}`));
};

const enregistrer = () => fireEvent.click(screen.getByRole("button", { name: "Enregistrer la réception" }));

const attendrePage = async () => {
  await screen.findByLabelText("Médicament, ligne 1");
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-22T10:00:00Z"));
  getMyStock.mockResolvedValue(reponseStock(STOCKS));
  listerFournisseurs.mockResolvedValue({
    data: [{ id: "f1", nom: "UbiPharm", telephone: null, createdAt: "2026-10-01T00:00:00.000Z" }],
    message: "ok",
    success: true,
  });
  enregistrerReception.mockResolvedValue(reponse());
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Nouvelle réception", () => {
  it("permet de recopier une facture entièrement au clavier", async () => {
    render(<NouvelleReceptionPage />);
    await attendrePage();

    fireEvent.change(screen.getByLabelText("Fournisseur"), { target: { value: "f1" } });
    choisirMedicament(1, "dolip");
    expect(screen.getByLabelText("Médicament, ligne 1")).toHaveValue("Doliprane");
    await waitFor(() => expect(screen.getByLabelText("Quantité, ligne 1")).toHaveFocus());
    saisir("Quantité, ligne 1", "10");
    saisir("Péremption, ligne 1", "6/28");
    fireEvent.blur(screen.getByLabelText("Péremption, ligne 1"));
    expect(screen.getByText("30/06/2028")).toBeInTheDocument();

    fireEvent.keyDown(screen.getByLabelText(/Coût d'achat d'une boîte \(GNF, facultatif\), ligne 1/), { key: "Enter" });
    await waitFor(() => expect(screen.getByLabelText("Médicament, ligne 2")).toHaveFocus());

    enregistrer();

    await waitFor(() => expect(enregistrerReception).toHaveBeenCalledTimes(1));
    const [structureId, corps] = enregistrerReception.mock.calls[0];
    expect(structureId).toBe("p1");
    expect(corps.id).toMatch(UUID);
    expect(corps.fournisseurId).toBe("f1");
    expect(corps.lignes).toEqual([{ stockId: "s1", nombreBoites: 10, dateExpiration: "2028-06-30" }]);
    expect(await screen.findByRole("heading", { name: "Réception enregistrée : 1 lot." })).toBeInTheDocument();
  });

  it("envoie sansPeremption quand la case « Sans date » est cochée", async () => {
    render(<NouvelleReceptionPage />);
    await attendrePage();

    choisirMedicament(1, "doli");
    saisir("Quantité, ligne 1", "5");
    fireEvent.click(screen.getByLabelText("Sans date, ligne 1"));
    expect(screen.getByLabelText("Péremption, ligne 1")).toBeDisabled();
    enregistrer();

    await waitFor(() => expect(enregistrerReception).toHaveBeenCalledTimes(1));
    expect(enregistrerReception.mock.calls[0][1].lignes).toEqual([{ stockId: "s1", nombreBoites: 5, sansPeremption: true }]);
  });

  it("refuse une péremption illisible sans rien envoyer", async () => {
    render(<NouvelleReceptionPage />);
    await attendrePage();

    remplirLigne(1, "doli", "5", "13/28");
    enregistrer();

    expect(
      await screen.findAllByText("Date de péremption illisible : écrivez par exemple 06/28 ou 30/06/2028."),
    ).not.toHaveLength(0);
    expect(screen.getByText("Complétez les lignes signalées avant d'enregistrer.")).toBeInTheDocument();
    expect(screen.getByLabelText("Péremption, ligne 1")).toHaveAttribute("aria-invalid", "true");
    expect(enregistrerReception).not.toHaveBeenCalled();
  });

  it("avertit d'une fiche non confirmée avant l'envoi, jusqu'au passage en unités", async () => {
    render(<NouvelleReceptionPage />);
    await attendrePage();

    choisirMedicament(1, "amox");
    expect(screen.getByText(/Le nombre d'unités par boîte de Amoxicilline n'est pas encore confirmé/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Unité de la quantité, ligne 1"), { target: { value: "UNITE" } });
    expect(screen.queryByText(/n'est pas encore confirmé/)).toBeNull();

    saisir("Quantité, ligne 1", "24");
    saisir("Péremption, ligne 1", "10/27");
    enregistrer();

    await waitFor(() => expect(enregistrerReception).toHaveBeenCalledTimes(1));
    expect(enregistrerReception.mock.calls[0][1].lignes).toEqual([
      { stockId: "s2", quantiteUnites: 24, dateExpiration: "2027-10-31" },
    ]);
  });

  it("sur une fiche à 1 unité par boîte, conseille de confirmer la fiche puis s'efface une fois confirmée", async () => {
    render(<NouvelleReceptionPage />);
    await attendrePage();

    choisirMedicament(1, "spasf");
    const avertissement = screen.getByText(/Le nombre d'unités par boîte de Spasfon n'est pas encore confirmé\./);
    expect(avertissement).toHaveTextContent("Si une boîte en contient plusieurs, indiquez-le dans sa fiche");
    // Aucun conseil irréalisable : pas de choix d'unité sur cette ligne.
    expect(screen.queryByText(/saisissez la quantité en/)).toBeNull();
    expect(screen.queryByLabelText("Unité de la quantité, ligne 1")).toBeNull();
    expect(screen.getByRole("link", { name: "Ouvrir le stock dans un nouvel onglet" })).toHaveAttribute("target", "_blank");

    // La fiche a été confirmée dans un autre onglet (10 comprimés par boîte) : l'actualisation efface l'avertissement.
    getMyStock.mockResolvedValue(
      reponseStock(STOCKS.map((s) => (s.id === "s4" ? { ...s, qualifie: true, coefficientBoite: 10, uniteMinimale: "COMPRIME" } : s))),
    );
    fireEvent.click(screen.getByRole("button", { name: "J'ai confirmé la fiche : actualiser" }));

    await waitFor(() => expect(screen.queryByText(/n'est pas encore confirmé/)).toBeNull());
    expect(getMyStock).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText("Médicament, ligne 1")).toHaveValue("Spasfon");
    expect(screen.getByLabelText("Unité de la quantité, ligne 1")).toBeInTheDocument();
    verifierTermes();
  });

  it("passe au champ suivant avec Entrée dans Quantité, Péremption et Lot sans rien envoyer", async () => {
    render(<NouvelleReceptionPage />);
    await attendrePage();

    choisirMedicament(1, "doli");
    saisir("Quantité, ligne 1", "10");
    fireEvent.keyDown(screen.getByLabelText("Quantité, ligne 1"), { key: "Enter" });
    expect(screen.getByLabelText("Péremption, ligne 1")).toHaveFocus();

    saisir("Péremption, ligne 1", "6/28");
    fireEvent.keyDown(screen.getByLabelText("Péremption, ligne 1"), { key: "Enter" });
    expect(screen.getByLabelText("Lot (facultatif), ligne 1")).toHaveFocus();
    expect(screen.getByText("30/06/2028")).toBeInTheDocument();

    saisir("Lot (facultatif), ligne 1", "A123");
    fireEvent.keyDown(screen.getByLabelText("Lot (facultatif), ligne 1"), { key: "Enter" });
    expect(screen.getByLabelText(/Coût d'achat d'une boîte \(GNF, facultatif\), ligne 1/)).toHaveFocus();

    // « Sans date » cochée : Entrée dans Quantité saute la péremption désactivée.
    fireEvent.click(screen.getByLabelText("Sans date, ligne 1"));
    fireEvent.keyDown(screen.getByLabelText("Quantité, ligne 1"), { key: "Enter" });
    expect(screen.getByLabelText("Lot (facultatif), ligne 1")).toHaveFocus();

    expect(enregistrerReception).not.toHaveBeenCalled();
  });

  it("refuse localement une quantité au-delà du plafond du serveur", async () => {
    render(<NouvelleReceptionPage />);
    await attendrePage();

    remplirLigne(1, "doli", "1000001");
    enregistrer();

    // Le comparateur de Testing Library ramène les espaces insécables à des espaces simples.
    expect(await screen.findByText("Une ligne ne peut pas dépasser 1 000 000 boîtes : vérifiez la quantité.")).toBeInTheDocument();
    expect(screen.getByLabelText("Quantité, ligne 1")).toHaveFocus();
    expect(enregistrerReception).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Unité de la quantité, ligne 1"), { target: { value: "UNITE" } });
    saisir("Quantité, ligne 1", "1000000001");
    enregistrer();
    expect(
      await screen.findByText("Une ligne ne peut pas dépasser 1 000 000 000 comprimés : vérifiez la quantité."),
    ).toBeInTheDocument();
    expect(enregistrerReception).not.toHaveBeenCalled();

    saisir("Quantité, ligne 1", "1000000000");
    enregistrer();
    await waitFor(() => expect(enregistrerReception).toHaveBeenCalledTimes(1));
    expect(enregistrerReception.mock.calls[0][1].lignes[0].quantiteUnites).toBe(1000000000);
  });

  it("après un refus du serveur, met le focus sur la première ligne en erreur et annonce le bandeau près des lignes", async () => {
    enregistrerReception.mockRejectedValueOnce(
      new ApiError("Certaines lignes sont incorrectes.", 400, {
        code: "VALIDATION",
        champs: [
          { champ: "lignes.2.coutAchatBoite", contraintes: ["max"] },
          { champ: "lignes.1.nombreBoites", contraintes: ["max"] },
        ],
      }),
    );
    render(<NouvelleReceptionPage />);
    await attendrePage();

    remplirLigne(1, "doli", "5");
    fireEvent.click(screen.getByRole("button", { name: "Ajouter une ligne" }));
    remplirLigne(2, "doli", "7", "10/27");
    fireEvent.click(screen.getByRole("button", { name: "Ajouter une ligne" }));
    remplirLigne(3, "doli", "2");
    saisir(/Coût d'achat d'une boîte \(GNF, facultatif\), ligne 3/, "900");
    enregistrer();

    const bandeau = await screen.findByRole("alert");
    expect(bandeau).toHaveTextContent("Certaines lignes sont incorrectes.");
    // Le bandeau est dans la carte des lignes, juste sous son titre.
    expect(bandeau.closest("section")).toHaveAccessibleName("Médicaments reçus");
    await waitFor(() => expect(screen.getByLabelText("Quantité, ligne 2")).toHaveFocus());
    expect(screen.getByLabelText("Quantité, ligne 2")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText(/Coût d'achat d'une boîte \(GNF, facultatif\), ligne 3/)).toHaveAttribute("aria-invalid", "true");
  });

  it("verrouille la saisie après un échec réseau puis rejoue avec le même identifiant", async () => {
    enregistrerReception.mockRejectedValueOnce(new ApiError("Réseau", 503));
    render(<NouvelleReceptionPage />);
    await attendrePage();

    remplirLigne(1, "doli", "5");
    enregistrer();

    expect(await screen.findByText(/La réception n'a peut-être pas été enregistrée/)).toBeInTheDocument();
    expect(screen.getByLabelText("Médicament, ligne 1")).toHaveAttribute("readonly");
    expect(screen.getByLabelText("Quantité, ligne 1")).toHaveAttribute("readonly");
    expect(screen.getByLabelText("Unité de la quantité, ligne 1")).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Réessayer l'envoi" }));

    expect(await screen.findByRole("heading", { name: "Réception enregistrée : 1 lot." })).toBeInTheDocument();
    expect(enregistrerReception).toHaveBeenCalledTimes(2);
    expect(enregistrerReception.mock.calls[1][1].id).toBe(enregistrerReception.mock.calls[0][1].id);
    verifierTermes();
  });

  it("change d'identifiant quand on modifie la saisie après confirmation", async () => {
    enregistrerReception.mockRejectedValueOnce(new ApiError("Réseau", 503));
    render(<NouvelleReceptionPage />);
    await attendrePage();

    remplirLigne(1, "doli", "5");
    enregistrer();
    fireEvent.click(await screen.findByRole("button", { name: "Modifier la saisie" }));

    expect(
      screen.getByText("Avant de modifier, vérifiez dans la liste des réceptions que cette livraison n'a pas déjà été enregistrée. Continuer ?"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Modifier" }));
    expect(screen.getByLabelText("Quantité, ligne 1")).not.toHaveAttribute("readonly");

    saisir("Quantité, ligne 1", "6");
    enregistrer();

    await waitFor(() => expect(enregistrerReception).toHaveBeenCalledTimes(2));
    const premier = enregistrerReception.mock.calls[0][1];
    const second = enregistrerReception.mock.calls[1][1];
    expect(second.id).toMatch(UUID);
    expect(second.id).not.toBe(premier.id);
    expect(second.lignes[0].nombreBoites).toBe(6);
  });

  it("signale la date de péremption refusée par le serveur", async () => {
    enregistrerReception.mockRejectedValueOnce(
      new ApiError("La date de péremption de Doliprane est déjà dépassée.", 400, {
        code: "DATE_PEREMPTION_PASSEE",
        details: [{ stockId: "s1", nom: "Doliprane" }],
      }),
    );
    render(<NouvelleReceptionPage />);
    await attendrePage();

    remplirLigne(1, "doli", "5", "1/20");
    enregistrer();

    expect(await screen.findByText("La date de péremption de Doliprane est déjà dépassée.")).toBeInTheDocument();
    expect(screen.getByLabelText("Péremption, ligne 1")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Péremption, ligne 1")).not.toHaveAttribute("readonly");
  });

  it("remet la date à aujourd'hui quand la journée est clôturée", async () => {
    enregistrerReception.mockRejectedValueOnce(
      new ApiError("La journée du 20/10/2026 est clôturée.", 409, { code: "JOURNEE_CLOTUREE" }),
    );
    render(<NouvelleReceptionPage />);
    await attendrePage();

    fireEvent.change(screen.getByLabelText("Date de réception"), { target: { value: "2026-10-20" } });
    remplirLigne(1, "doli", "5");
    enregistrer();

    expect(await screen.findByText("La journée du 20/10/2026 est clôturée.")).toBeInTheDocument();
    expect(enregistrerReception.mock.calls[0][1].recueLe).toBe("2026-10-20T12:00:00.000Z");
    expect(screen.getByLabelText("Date de réception")).toHaveValue("2026-10-22");
  });

  it("affiche le résultat, les avertissements et le rejeu", async () => {
    enregistrerReception.mockResolvedValue(
      reponse(
        {
          cree: false,
          avertissements: [
            {
              code: "FICHE_NON_QUALIFIEE",
              stockId: "s2",
              nom: "Amoxicilline",
              message: "Le nombre d'unités par boîte n'est pas confirmé.",
            },
          ],
        },
        "Cette réception était déjà enregistrée.",
      ),
    );
    render(<NouvelleReceptionPage />);
    await attendrePage();

    remplirLigne(1, "doli", "5");
    enregistrer();

    expect(await screen.findByRole("heading", { name: "Cette réception était déjà enregistrée." })).toBeInTheDocument();
    expect(screen.getByText(/Le nombre d'unités par boîte n'est pas confirmé\./)).toBeInTheDocument();
    expect(screen.getByText("Cette réception était déjà enregistrée : rien n'a été ajouté deux fois.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voir la réception" })).toHaveAttribute("href", "/dashboard/receptions/r1");
    expect(screen.getByRole("link", { name: "Retour aux réceptions" })).toHaveAttribute("href", "/dashboard/receptions");
    expect(screen.getByRole("button", { name: "Nouvelle réception" })).toBeInTheDocument();
  });
});
