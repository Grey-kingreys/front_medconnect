import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, type AuthUser, type UserProfile } from "@/lib/api_auth";
import { getConsultations, getRendezVous } from "@/lib/api_carnet";
import { getMyPatients } from "@/lib/api_patients";
import { getMyStock } from "@/lib/api_pharmacie";
import { getMyStructure } from "@/lib/api_structure";
import { listerVentes } from "@/lib/api_ventes";
import DashboardPage from "./page";

const medecin = { id: "m1", email: "medecin@exemple.com", nom: "Camara", prenom: "Awa", role: "MEDECIN", structureId: "s1" };
const etat = vi.hoisted(() => ({
  utilisateur: null as AuthUser | null,
  profil: null as UserProfile | null,
}));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: etat.utilisateur, profile: etat.profil }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("@/lib/api_structure", () => ({ getMyStructure: vi.fn(), getAllStructures: vi.fn() }));
const { graphiquesRendus } = vi.hoisted(() => ({ graphiquesRendus: vi.fn() }));
vi.mock("@/components/DashboardCharts", () => ({ default: graphiquesRendus }));
vi.mock("@/lib/api_carnet", () => ({ getConsultations: vi.fn(), getRendezVous: vi.fn() }));
vi.mock("@/lib/api_patients", () => ({ getMyPatients: vi.fn() }));
vi.mock("@/lib/api_pharmacie", () => ({ getMyStock: vi.fn() }));
vi.mock("@/lib/api_ventes", () => ({ listerVentes: vi.fn() }));

// Réponse d'API simulée (le type exact n'importe pas pour ces tests)
const reponse = (data: unknown) => ({ data, message: "ok", success: true }) as never;

const journeeVide = () =>
  reponse({ date: "2026-10-22", totalJour: 0, nombre: 0, page: 1, parPage: 50, totalPages: 1, ventes: [] });

const MESSAGE_ERREUR = "Certains chiffres n'ont pas pu être chargés. Vérifiez votre connexion puis réessayez.";

const carteDe = (label: string) => screen.getByText(label).parentElement as HTMLElement;

const aujourdhui = () => new Date().toISOString();
const dansUnAn = () => new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString();

const consultationsDuJour = () =>
  reponse([{ dateConsultation: aujourdhui() }, { dateConsultation: aujourdhui() }, { dateConsultation: aujourdhui() }]);

const rendezVousAVenir = () =>
  reponse([
    { medecinId: "m1", date: dansUnAn(), status: "PROGRAMME" },
    { medecinId: "m1", date: dansUnAn(), status: "CONFIRME" },
    { medecinId: "m2", date: dansUnAn(), status: "PROGRAMME" },
  ]);

describe("Aperçu du tableau de bord", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    etat.utilisateur = medecin;
    etat.profil = null;
  });

  afterEach(() => {
    cleanup();
  });

  it("affiche un état de chargement et aucune carte retirée", () => {
    vi.mocked(getMyPatients).mockReturnValue(new Promise(() => {}));
    vi.mocked(getConsultations).mockReturnValue(new Promise(() => {}));
    vi.mocked(getRendezVous).mockReturnValue(new Promise(() => {}));
    render(<DashboardPage />);
    expect(screen.getAllByText("Chargement")).toHaveLength(3);
    expect(screen.queryByText("Ordonnances émises")).toBeNull();
  });

  it("affiche la valeur de chaque carte une fois les données reçues", async () => {
    vi.mocked(getMyPatients).mockResolvedValue(reponse(Array.from({ length: 7 }, () => ({}))));
    vi.mocked(getConsultations).mockResolvedValue(consultationsDuJour());
    vi.mocked(getRendezVous).mockResolvedValue(rendezVousAVenir());
    render(<DashboardPage />);
    expect(await within(carteDe("Patients de la structure")).findByText("7")).toBeTruthy();
    expect(await within(carteDe("Consultations aujourd'hui")).findByText("3")).toBeTruthy();
    expect(await within(carteDe("Rendez-vous à venir")).findByText("2")).toBeTruthy();
    expect(screen.queryByText(MESSAGE_ERREUR)).toBeNull();
  });

  it("signale une carte indisponible puis la recharge au clic sur Réessayer", async () => {
    vi.mocked(getMyPatients).mockResolvedValue(reponse(Array.from({ length: 7 }, () => ({}))));
    vi.mocked(getConsultations)
      .mockRejectedValueOnce(new ApiError("Hors connexion", 0))
      .mockResolvedValue(consultationsDuJour());
    vi.mocked(getRendezVous).mockResolvedValue(rendezVousAVenir());
    render(<DashboardPage />);
    expect(await within(carteDe("Consultations aujourd'hui")).findByText("Indisponible")).toBeTruthy();
    expect(screen.getByText(MESSAGE_ERREUR)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));

    expect(await within(carteDe("Consultations aujourd'hui")).findByText("3")).toBeTruthy();
    await waitFor(() => expect(screen.queryByText(MESSAGE_ERREUR)).toBeNull());
    expect(within(carteDe("Patients de la structure")).getByText("7")).toBeTruthy();
    expect(within(carteDe("Rendez-vous à venir")).getByText("2")).toBeTruthy();
  });

  it("n'affiche ni graphiques fictifs ni badge « En direct »", async () => {
    vi.mocked(getMyPatients).mockResolvedValue(reponse(Array.from({ length: 7 }, () => ({}))));
    vi.mocked(getConsultations).mockResolvedValue(consultationsDuJour());
    vi.mocked(getRendezVous).mockResolvedValue(rendezVousAVenir());
    render(<DashboardPage />);
    expect(await within(carteDe("Patients de la structure")).findByText("7")).toBeTruthy();
    expect(screen.queryByText("Analyses et Tendances")).toBeNull();
    expect(screen.queryByText("En direct")).toBeNull();
    expect(graphiquesRendus).not.toHaveBeenCalled();
    expect(screen.getByText("Accès rapide")).toBeTruthy();
  });

  it("masque la carte dont le droit est absent sans afficher d'erreur", async () => {
    vi.mocked(getMyPatients).mockRejectedValue(new ApiError("Accès refusé", 403));
    vi.mocked(getConsultations).mockResolvedValue(consultationsDuJour());
    vi.mocked(getRendezVous).mockResolvedValue(rendezVousAVenir());
    render(<DashboardPage />);
    expect(await within(carteDe("Consultations aujourd'hui")).findByText("3")).toBeTruthy();
    expect(within(carteDe("Rendez-vous à venir")).getByText("2")).toBeTruthy();
    expect(screen.queryByText("Patients de la structure")).toBeNull();
    expect(screen.queryByText(MESSAGE_ERREUR)).toBeNull();
  });

  it("n'affiche à l'administrateur de pharmacie que ce qui concerne sa pharmacie", async () => {
    etat.utilisateur = { id: "a1", email: "admin@exemple.com", nom: "Bah", prenom: "Fanta", role: "STRUCTURE_ADMIN", structureId: "s2" };
    etat.profil = {
      id: "a1",
      email: "admin@exemple.com",
      nom: "Bah",
      prenom: "Fanta",
      role: "STRUCTURE_ADMIN",
      isActive: true,
      permissions: ["structure:read", "structure:write", "membre:read", "membre:manage", "role:manage"],
      structureType: "PHARMACIE",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    vi.mocked(getMyStructure).mockResolvedValue(
      reponse({ membres: [{ role: "PHARMACIEN", isActive: true }, { role: "PHARMACIEN", isActive: true }] }),
    );
    render(<DashboardPage />);
    await waitFor(() => expect(within(screen.getByRole("group", { name: "Membres actifs" })).getByText("2")).toBeTruthy());
    expect(screen.getByText(/^Le stock de la pharmacie n'est pas ouvert à votre profil/)).toBeTruthy();
    expect(screen.getByText("Votre stock")).toBeTruthy();
    expect(screen.queryByText("Pharmaciens")).toBeNull();
    expect(screen.queryByText("Patients de la structure")).toBeNull();
    expect(screen.queryByText("Médecins")).toBeNull();
    expect(screen.getByRole("link", { name: "Modifier ma pharmacie" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Équipe" })).toBeTruthy();
    expect(screen.queryByText("Accès rapide")).toBeNull();
    expect(screen.queryByText("Autres accès")).toBeNull();
    expect(getMyStock).not.toHaveBeenCalled();
    expect(getMyPatients).not.toHaveBeenCalled();
    expect(listerVentes).not.toHaveBeenCalled();
  });

  it("montre les liens de vente au pharmacien qui a les droits de vente", async () => {
    etat.utilisateur = { id: "p2", email: "vendeur@exemple.com", nom: "Bah", prenom: "Ali", role: "PHARMACIEN", structureId: "s3" };
    etat.profil = {
      id: "p2",
      email: "vendeur@exemple.com",
      nom: "Bah",
      prenom: "Ali",
      role: "PHARMACIEN",
      isActive: true,
      permissions: ["stock:read", "stock:write", "vente:read", "vente:write", "structure:read", "membre:read"],
      structureType: "PHARMACIE",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    vi.mocked(getMyStock).mockResolvedValue(reponse({ stocks: [], alertes: { stockBas: [], rupture: [] } }));
    vi.mocked(getMyStructure).mockResolvedValue(reponse({ membres: [] }));
    vi.mocked(listerVentes).mockResolvedValue(journeeVide());
    render(<DashboardPage />);
    const comptoir = (await screen.findByText("Au comptoir")).closest("section") as HTMLElement;
    expect(within(comptoir).getByRole("link", { name: "Nouvelle vente" })).toHaveAttribute("href", "/dashboard/vente");
    expect(within(comptoir).getByRole("link", { name: /Voir toutes les ventes du jour/ })).toHaveAttribute("href", "/dashboard/ventes");
  });

  it("montre au pharmacien l'aperçu de son stock et ses accès rapides", async () => {
    etat.utilisateur = { id: "p1", email: "pharmacien@exemple.com", nom: "Bah", prenom: "Ali", role: "PHARMACIEN", structureId: "s3" };
    etat.profil = {
      id: "p1",
      email: "pharmacien@exemple.com",
      nom: "Bah",
      prenom: "Ali",
      role: "PHARMACIEN",
      isActive: true,
      permissions: ["stock:read", "stock:write", "catalogue:write", "chat:structure", "structure:read", "membre:read"],
      structureType: "PHARMACIE",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const medicament = (id: string, nom: string) => ({ id, nom, categorie: "Antalgique", ordonnanceRequise: false, formes: [] });
    vi.mocked(getMyStock).mockResolvedValue(
      reponse({
        stocks: [
          { id: "a", medicamentId: "ma", structureId: "s3", quantite: 12, prixUnitaire: 1000, disponible: true, medicament: medicament("ma", "Doliprane") },
          { id: "b", medicamentId: "mb", structureId: "s3", quantite: 0, prixUnitaire: null, disponible: false, medicament: medicament("mb", "Amoxicilline") },
        ],
        alertes: { stockBas: [], rupture: [] },
      }),
    );
    vi.mocked(getMyStructure).mockResolvedValue(reponse({ membres: [{ role: "PHARMACIEN" }] }));
    render(<DashboardPage />);
    await waitFor(() =>
      expect(within(screen.getByRole("group", { name: "Médicaments disponibles" })).getByText("1")).toBeTruthy(),
    );
    expect(within(screen.getByRole("group", { name: "En rupture de stock" })).getByText("1")).toBeTruthy();
    expect(getMyStock).toHaveBeenCalledTimes(1);
    expect(getMyStock).toHaveBeenCalledWith("s3");
    expect(screen.queryByText("Médicaments en stock")).toBeNull();
    expect(screen.queryByText("Ruptures de stock")).toBeNull();
    const acces = screen.getByText("Autres accès").parentElement as HTMLElement;
    expect(within(acces).getByText("Mon Stock")).toBeTruthy();
    expect(within(acces).getByText("Importer le stock")).toBeTruthy();
    expect(within(acces).getByText("Catalogue des médicaments")).toBeTruthy();
  });

  describe("pharmacie de démonstration", () => {
    const profilDemo = (role: string, id: string, permissions: string[]) => {
      etat.utilisateur = { id, email: `${id}@demo.exemple.com`, nom: "Demo", prenom: "Compte", role, structureId: "s9" };
      etat.profil = {
        id,
        email: `${id}@demo.exemple.com`,
        nom: "Demo",
        prenom: "Compte",
        role,
        isActive: true,
        permissions,
        structureType: "PHARMACIE",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      };
      vi.mocked(getMyStock).mockResolvedValue(reponse({ stocks: [], alertes: { stockBas: [], rupture: [] } }));
      vi.mocked(getMyStructure).mockResolvedValue(reponse({ membres: [{ isActive: true }] }));
    };
    const ADMIN_DEMO = [
      "membre:manage", "membre:read", "role:manage", "stock:read", "stock:write", "structure:read", "structure:write",
      "vente:annuler", "vente:read", "vente:write",
    ];
    const PHARMACIEN_DEMO = [
      "catalogue:write", "chat:structure", "membre:read", "stock:read", "stock:write", "structure:read", "vente:read", "vente:write",
    ];

    it("donne la vue de pilotage à l'administrateur", async () => {
      profilDemo("STRUCTURE_ADMIN", "a9", ADMIN_DEMO);
      vi.mocked(listerVentes).mockResolvedValue(journeeVide());
      render(<DashboardPage />);
      expect(await screen.findByText("Pilotage de la pharmacie")).toBeTruthy();
      expect(screen.queryByText("Au comptoir")).toBeNull();
      expect(screen.getByText("Suivez l'activité de votre pharmacie : ventes du jour, équipe et stock.")).toBeTruthy();
      const acces = screen.getByText("Autres accès").parentElement as HTMLElement;
      expect(within(acces).queryByText("Ma pharmacie")).toBeNull();
      expect(within(acces).queryByText("Équipe de la pharmacie")).toBeNull();
      expect(within(acces).queryByText("Ventes du jour")).toBeNull();
      expect(within(acces).getByText("Nouvelle vente")).toBeTruthy();
    });

    it("donne la vue du comptoir au pharmacien", async () => {
      profilDemo("PHARMACIEN", "p9", PHARMACIEN_DEMO);
      vi.mocked(listerVentes).mockResolvedValue(journeeVide());
      render(<DashboardPage />);
      expect(await screen.findByText("Au comptoir")).toBeTruthy();
      expect(screen.queryByText("Pilotage de la pharmacie")).toBeNull();
      expect(screen.getByText("Enregistrez vos ventes et gardez un œil sur les ruptures de stock.")).toBeTruthy();
      const acces = screen.getByText("Autres accès").parentElement as HTMLElement;
      expect(within(acces).getByText("Ma pharmacie")).toBeTruthy();
      expect(within(acces).getByText("Messagerie")).toBeTruthy();
    });

    it("garde le stock affiché quand les ventes ne chargent pas", async () => {
      profilDemo("STRUCTURE_ADMIN", "a9", ADMIN_DEMO);
      vi.mocked(listerVentes).mockRejectedValue(new Error("Hors connexion"));
      render(<DashboardPage />);
      expect((await screen.findByRole("alert")).textContent).toContain("Les ventes du jour n'ont pas pu être chargées.");
      expect(screen.getByText("Votre stock")).toBeTruthy();
    });
  });
});
