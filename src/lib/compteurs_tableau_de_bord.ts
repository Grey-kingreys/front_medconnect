/**
 * Compteurs de l'aperçu du tableau de bord. Chaque source est un appel existant
 * qui alimente un ou plusieurs compteurs. Pas de source = pas de carte (aucune valeur inventée).
 */
import { getAutoDiagnostics, getCarnetResume, getConsultations, getRendezVous } from "./api_carnet";
import { getMyPatients } from "./api_patients";
import { getMyStock } from "./api_pharmacie";
import { getUserStats } from "./api_admin";
import { getAllStructures, getMyStructure } from "./api_structure";

export type CleCompteur =
  | "patientConsultations"
  | "patientOrdonnances"
  | "patientVaccinations"
  | "patientDiagnosticsIA"
  | "medecinPatients"
  | "medecinConsultationsAujourdhui"
  | "medecinRendezVousAVenir"
  | "pharmacieMedicamentsEnStock"
  | "pharmacieRuptures"
  | "adminUtilisateurs"
  | "adminStructures"
  | "structureMedecins"
  | "structurePharmaciens"
  | "structurePatients"
  | "accueilRdvEnAttente"
  | "accueilRdvAujourdhui"
  | "accueilRdvAVenir";

export type ValeursCompteurs = Partial<Record<CleCompteur, number>>;

/** Un appel qui alimente les compteurs listés dans `cles`. */
export interface SourceCompteurs {
  cles: CleCompteur[];
  charger: () => Promise<ValeursCompteurs>;
}

// Même jour calendaire, en heure locale
const memeJour = (date: string, maintenant: Date) =>
  new Date(date).toDateString() === maintenant.toDateString();

export function sourcesCompteurs(
  role: string,
  utilisateur: { id: string; structureId?: string },
  maintenant: Date = new Date(),
): SourceCompteurs[] {
  switch (role) {
    case "PATIENT":
      return [
        {
          cles: ["patientConsultations", "patientOrdonnances", "patientVaccinations"],
          charger: async () => {
            const { data } = await getCarnetResume();
            return {
              patientConsultations: data.stats.consultations,
              patientOrdonnances: data.stats.ordonnances,
              patientVaccinations: data.stats.vaccinations,
            };
          },
        },
        {
          cles: ["patientDiagnosticsIA"],
          charger: async () => {
            const { data } = await getAutoDiagnostics();
            return { patientDiagnosticsIA: data.length };
          },
        },
      ];
    case "MEDECIN":
      return [
        {
          cles: ["medecinPatients"],
          charger: async () => {
            const { data } = await getMyPatients();
            return { medecinPatients: data.length };
          },
        },
        {
          cles: ["medecinConsultationsAujourdhui"],
          charger: async () => {
            const { data } = await getConsultations();
            return {
              medecinConsultationsAujourdhui: data.filter((c) => memeJour(c.dateConsultation, maintenant)).length,
            };
          },
        },
        {
          cles: ["medecinRendezVousAVenir"],
          charger: async () => {
            const { data } = await getRendezVous();
            return {
              medecinRendezVousAVenir: data.filter(
                (rv) =>
                  rv.medecinId === utilisateur.id &&
                  new Date(rv.date) > maintenant &&
                  (rv.status === "PROGRAMME" || rv.status === "CONFIRME"),
              ).length,
            };
          },
        },
      ];
    case "PHARMACIEN":
      return [
        {
          cles: ["pharmacieMedicamentsEnStock", "pharmacieRuptures"],
          charger: async () => {
            if (!utilisateur.structureId) throw new Error("Aucune structure rattachée");
            const { data } = await getMyStock(utilisateur.structureId);
            return {
              pharmacieMedicamentsEnStock: data.stocks.filter((s) => s.quantite > 0).length,
              pharmacieRuptures: data.alertes.rupture.length,
            };
          },
        },
      ];
    case "ADMIN":
      return [
        {
          cles: ["adminUtilisateurs"],
          charger: async () => {
            const { data } = await getUserStats();
            return { adminUtilisateurs: data.total };
          },
        },
        {
          cles: ["adminStructures"],
          charger: async () => {
            const { data } = await getAllStructures();
            return { adminStructures: data.length };
          },
        },
      ];
    case "STRUCTURE_ADMIN":
      return [
        {
          cles: ["structureMedecins", "structurePharmaciens"],
          charger: async () => {
            const { data } = await getMyStructure();
            const membres = data.membres ?? [];
            return {
              structureMedecins: membres.filter((m) => m.role === "MEDECIN").length,
              structurePharmaciens: membres.filter((m) => m.role === "PHARMACIEN").length,
            };
          },
        },
        {
          cles: ["structurePatients"],
          charger: async () => {
            const { data } = await getMyPatients();
            return { structurePatients: data.length };
          },
        },
      ];
    case "ACCUEIL":
      return [
        {
          cles: ["accueilRdvEnAttente", "accueilRdvAujourdhui", "accueilRdvAVenir"],
          charger: async () => {
            const { data } = await getRendezVous();
            const rv = data || [];
            return {
              accueilRdvEnAttente: rv.filter((a) => a.status === "EN_ATTENTE").length,
              accueilRdvAujourdhui: rv.filter((a) => memeJour(a.date, maintenant)).length,
              accueilRdvAVenir: rv.filter(
                (a) => new Date(a.date) > maintenant && ["PROGRAMME", "CONFIRME", "EN_ATTENTE"].includes(a.status),
              ).length,
            };
          },
        },
      ];
    default:
      return [];
  }
}
