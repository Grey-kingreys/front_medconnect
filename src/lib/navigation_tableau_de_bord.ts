/**
 * Source unique du menu latéral (ordinateur et téléphone), des raccourcis et des compteurs
 * de l'accueil du tableau de bord, et de la garde des pages. Une entrée sans le droit requis
 * n'apparaît nulle part.
 */
import type { ComponentType } from "react";
import {
  Activity,
  Bot,
  Building2,
  Calendar,
  ClipboardList,
  Clock,
  FileSpreadsheet,
  FileText,
  Headset,
  LayoutDashboard,
  MapPin,
  MessageSquare,
  Package,
  Pill,
  Receipt,
  ShoppingCart,
  Stethoscope,
  Syringe,
  Users,
} from "lucide-react";
import type { CodePermission, ContexteAcces, RoleUtilisateur } from "./acces";
import type { StructureType } from "./api_admin";
import type { CleCompteur } from "./compteurs_tableau_de_bord";

type IconeComposant = ComponentType<{ className?: string }>;
type TexteSelonType = { defaut: string } & Partial<Record<StructureType, string>>;
type IdSection = "general" | "carnet" | "services" | "activite" | "etablissement" | "administration";

export type RegleAcces =
  | { genre: "tous" }
  | { genre: "patient" }
  | {
      genre: "permissions";
      auMoinsUne: readonly CodePermission[];
      sauf?: readonly CodePermission[];
      typesStructure?: readonly StructureType[];
    };

interface EntreeTableauDeBord {
  id: string;
  section: IdSection;
  href: string;
  icone: IconeComposant;
  libelle: TexteSelonType;
  acces: RegleAcces;
  /** Ancien serveur (sans structureType) : rôles qui voient l'entrée, comme avant F9. */
  rolesRepli: readonly RoleUtilisateur[];
  raccourci?: {
    libelle?: TexteSelonType;
    description: TexteSelonType;
    degrade: string;
    rolesRepli: readonly RoleUtilisateur[];
  };
}

interface DefinitionCarte {
  cle: CleCompteur;
  libelle: string;
  icone: IconeComposant;
  couleur: string;
  acces: RegleAcces;
  rolesRepli: readonly RoleUtilisateur[];
}

export interface LienMenu {
  id: string;
  libelle: string;
  href: string;
  icone: IconeComposant;
}
export interface SectionMenu {
  id: IdSection;
  titre: string;
  liens: LienMenu[];
}
export interface Raccourci {
  id: string;
  libelle: string;
  description: string;
  href: string;
  icone: IconeComposant;
  degrade: string;
}
export interface CarteCompteur {
  cle: CleCompteur;
  libelle: string;
  icone: IconeComposant;
  couleur: string;
}

const HC: readonly StructureType[] = ["HOPITAL", "CLINIQUE"];
const HCP: readonly StructureType[] = ["HOPITAL", "CLINIQUE", "PHARMACIE"];
const P: readonly StructureType[] = ["PHARMACIE"];

const TOUS_LES_ROLES: readonly RoleUtilisateur[] = [
  "PATIENT",
  "MEDECIN",
  "PHARMACIEN",
  "STRUCTURE_ADMIN",
  "ACCUEIL",
  "ADMIN",
  "SUPER_ADMIN",
];
const PATIENT: readonly RoleUtilisateur[] = ["PATIENT"];
const ADMINS: readonly RoleUtilisateur[] = ["ADMIN", "SUPER_ADMIN"];

const perm = (
  auMoinsUne: readonly CodePermission[],
  options: { sauf?: readonly CodePermission[]; typesStructure?: readonly StructureType[] } = {},
): RegleAcces => ({ genre: "permissions", auMoinsUne, ...options });

const patient: RegleAcces = { genre: "patient" };

const TITRES_SECTIONS: Record<IdSection, TexteSelonType> = {
  general: { defaut: "Général" },
  carnet: { defaut: "Mon Carnet" },
  services: { defaut: "Services" },
  activite: { defaut: "Activité", PHARMACIE: "Pharmacie" },
  etablissement: { defaut: "Établissement" },
  administration: { defaut: "Administration" },
};

const ORDRE_SECTIONS: readonly IdSection[] = [
  "general",
  "carnet",
  "services",
  "activite",
  "etablissement",
  "administration",
];

// Page pas encore créée = pas d'entrée ici (statistiques, configuration, sécurité).
const ENTREES: readonly EntreeTableauDeBord[] = [
  {
    id: "tableau-de-bord",
    section: "general",
    href: "/dashboard",
    icone: LayoutDashboard,
    libelle: { defaut: "Tableau de bord" },
    acces: { genre: "tous" },
    rolesRepli: TOUS_LES_ROLES,
  },
  {
    id: "carnet",
    section: "carnet",
    href: "/dashboard/carnet",
    icone: FileText,
    libelle: { defaut: "Carnet de Santé" },
    acces: patient,
    rolesRepli: PATIENT,
    raccourci: {
      libelle: { defaut: "Mon Carnet de Santé" },
      description: { defaut: "Consultez votre profil médical, allergies, traitements" },
      degrade: "from-primary-500 to-cyan-500",
      rolesRepli: PATIENT,
    },
  },
  {
    id: "consultations-patient",
    section: "carnet",
    href: "/dashboard/consultations",
    icone: Stethoscope,
    libelle: { defaut: "Consultations" },
    acces: patient,
    rolesRepli: PATIENT,
    raccourci: {
      libelle: { defaut: "Mes Consultations" },
      description: { defaut: "Historique de vos visites médicales" },
      degrade: "from-amber-500 to-orange-500",
      rolesRepli: PATIENT,
    },
  },
  {
    id: "ordonnances-patient",
    section: "carnet",
    href: "/dashboard/ordonnances",
    icone: Pill,
    libelle: { defaut: "Ordonnances" },
    acces: patient,
    rolesRepli: PATIENT,
    raccourci: {
      description: { defaut: "Vos ordonnances et prescriptions médicales" },
      degrade: "from-rose-500 to-pink-500",
      rolesRepli: PATIENT,
    },
  },
  {
    id: "analyses-patient",
    section: "carnet",
    href: "/dashboard/analyses",
    icone: Activity,
    libelle: { defaut: "Analyses" },
    acces: patient,
    rolesRepli: PATIENT,
  },
  {
    id: "vaccinations-patient",
    section: "carnet",
    href: "/dashboard/vaccinations",
    icone: Syringe,
    libelle: { defaut: "Vaccinations" },
    acces: patient,
    rolesRepli: PATIENT,
  },
  {
    id: "messagerie-patient",
    section: "services",
    href: "/dashboard/chat",
    icone: MessageSquare,
    libelle: { defaut: "Messagerie" },
    acces: patient,
    rolesRepli: PATIENT,
  },
  {
    id: "diagnostic",
    section: "services",
    href: "/dashboard/diagnostic",
    icone: Bot,
    libelle: { defaut: "Auto-Diagnostic IA" },
    acces: patient,
    rolesRepli: PATIENT,
    raccourci: {
      description: { defaut: "Décrivez vos symptômes et obtenez une orientation" },
      degrade: "from-accent-500 to-primary-500",
      rolesRepli: PATIENT,
    },
  },
  {
    id: "carte",
    section: "services",
    href: "/dashboard/map",
    icone: MapPin,
    libelle: { defaut: "Trouver un Médecin" },
    acces: patient,
    rolesRepli: PATIENT,
    raccourci: {
      description: { defaut: "Localisez les structures de santé proches de vous" },
      degrade: "from-secondary-500 to-cyan-500",
      rolesRepli: PATIENT,
    },
  },
  {
    id: "medicaments",
    section: "services",
    href: "/dashboard/medicaments",
    icone: Pill,
    libelle: { defaut: "Recherche Médicaments" },
    acces: patient,
    rolesRepli: PATIENT,
  },
  {
    id: "pharmacies",
    section: "services",
    href: "/dashboard/pharmacies",
    icone: Building2,
    libelle: { defaut: "Pharmacies" },
    acces: patient,
    rolesRepli: PATIENT,
    raccourci: {
      description: { defaut: "Trouvez les pharmacies et médicaments disponibles" },
      degrade: "from-emerald-500 to-teal-500",
      rolesRepli: PATIENT,
    },
  },
  {
    id: "mes-structures",
    section: "services",
    href: "/dashboard/mes-structures",
    icone: Building2,
    libelle: { defaut: "Mes Structures" },
    acces: patient,
    rolesRepli: PATIENT,
  },
  {
    id: "rendez-vous-patient",
    section: "services",
    href: "/dashboard/rendez-vous",
    icone: Calendar,
    libelle: { defaut: "Rendez-vous" },
    acces: patient,
    rolesRepli: PATIENT,
  },
  {
    id: "messagerie-pro",
    section: "activite",
    href: "/dashboard/chat",
    icone: MessageSquare,
    libelle: { defaut: "Messagerie" },
    acces: perm(["chat:structure", "carnet:read"], { typesStructure: HCP }),
    rolesRepli: ["MEDECIN", "ACCUEIL"],
    raccourci: {
      description: { defaut: "Messages adressés à la structure" },
      degrade: "from-primary-500 to-cyan-500",
      rolesRepli: ["ACCUEIL"],
    },
  },
  {
    id: "accueil-patient",
    section: "activite",
    href: "/dashboard/accueil",
    icone: Headset,
    libelle: { defaut: "Accueil patient" },
    acces: perm(["patient:read"], { sauf: ["carnet:read"], typesStructure: HC }),
    rolesRepli: ["ACCUEIL"],
    raccourci: {
      description: { defaut: "Enregistrer le partage d'un dossier (code / QR / SMS)" },
      degrade: "from-violet-500 to-purple-500",
      rolesRepli: ["ACCUEIL"],
    },
  },
  {
    id: "patients",
    section: "activite",
    href: "/dashboard/patients",
    icone: Users,
    libelle: { defaut: "Patients" },
    acces: perm(["patient:read", "carnet:read"], { typesStructure: HC }),
    rolesRepli: ["MEDECIN", "STRUCTURE_ADMIN", "ACCUEIL"],
    raccourci: {
      description: { defaut: "Liste des patients suivis par la structure" },
      degrade: "from-primary-500 to-cyan-500",
      rolesRepli: ["MEDECIN", "ACCUEIL"],
    },
  },
  {
    id: "consultations-soins",
    section: "activite",
    href: "/dashboard/consultations",
    icone: Stethoscope,
    libelle: { defaut: "Consultations" },
    acces: perm(["consultation:write", "carnet:read"], { typesStructure: HC }),
    rolesRepli: ["MEDECIN"],
    raccourci: {
      description: { defaut: "Gérez vos consultations du jour" },
      degrade: "from-secondary-500 to-cyan-500",
      rolesRepli: ["MEDECIN"],
    },
  },
  {
    id: "ordonnances-soins",
    section: "activite",
    href: "/dashboard/ordonnances",
    icone: Pill,
    libelle: { defaut: "Ordonnances" },
    acces: perm(["ordonnance:write", "carnet:read"], { typesStructure: HC }),
    rolesRepli: ["MEDECIN"],
    raccourci: {
      description: { defaut: "Créez et consultez les ordonnances" },
      degrade: "from-accent-500 to-primary-500",
      rolesRepli: ["MEDECIN"],
    },
  },
  {
    id: "vente",
    section: "activite",
    href: "/dashboard/vente",
    icone: ShoppingCart,
    libelle: { defaut: "Nouvelle vente" },
    acces: perm(["vente:write"], { typesStructure: P }),
    rolesRepli: [],
    raccourci: {
      description: { defaut: "Enregistrez la vente de médicaments de votre stock" },
      degrade: "from-emerald-500 to-teal-500",
      rolesRepli: [],
    },
  },
  {
    id: "ventes",
    section: "activite",
    href: "/dashboard/ventes",
    icone: Receipt,
    libelle: { defaut: "Ventes du jour" },
    acces: perm(["vente:read"], { typesStructure: P }),
    rolesRepli: [],
    raccourci: {
      description: { defaut: "Retrouvez les ventes, réimprimez un reçu" },
      degrade: "from-primary-500 to-cyan-500",
      rolesRepli: [],
    },
  },
  {
    id: "ordonnances-recues",
    section: "activite",
    href: "/dashboard/ordonnances",
    icone: ClipboardList,
    libelle: { defaut: "Ordonnances reçues" },
    acces: perm(["stock:read", "stock:write"], { typesStructure: P }),
    rolesRepli: ["PHARMACIEN"],
    raccourci: {
      description: { defaut: "Consultez les ordonnances en attente" },
      degrade: "from-primary-500 to-cyan-500",
      rolesRepli: ["PHARMACIEN"],
    },
  },
  {
    id: "analyses-soins",
    section: "activite",
    href: "/dashboard/analyses",
    icone: Activity,
    libelle: { defaut: "Analyses" },
    acces: perm(["analyse:write", "carnet:read"], { typesStructure: HC }),
    rolesRepli: ["MEDECIN"],
  },
  {
    id: "stock",
    section: "activite",
    href: "/dashboard/stock",
    icone: Package,
    libelle: { defaut: "Stock Médicaments" },
    acces: perm(["stock:read", "stock:write"], { typesStructure: P }),
    rolesRepli: ["PHARMACIEN"],
    raccourci: {
      libelle: { defaut: "Mon Stock" },
      description: { defaut: "Gérez votre inventaire de médicaments" },
      degrade: "from-accent-500 to-primary-500",
      rolesRepli: ["PHARMACIEN"],
    },
  },
  {
    id: "catalogue",
    section: "activite",
    href: "/dashboard/catalogue",
    icone: Pill,
    libelle: { defaut: "Catalogue Médicaments" },
    acces: perm(["catalogue:write", "catalogue:manage", "stock:read", "stock:write", "ordonnance:write"], {
      typesStructure: HCP,
    }),
    rolesRepli: ["MEDECIN", "PHARMACIEN"],
  },
  {
    id: "rendez-vous-pro",
    section: "activite",
    href: "/dashboard/rendez-vous",
    icone: Calendar,
    libelle: { defaut: "Rendez-vous" },
    acces: perm(["rendezvous:write", "patient:read"], { typesStructure: HC }),
    rolesRepli: ["MEDECIN", "ACCUEIL"],
    raccourci: {
      description: { defaut: "Prenez et suivez les rendez-vous de la structure" },
      degrade: "from-amber-500 to-orange-500",
      rolesRepli: ["MEDECIN", "ACCUEIL"],
    },
  },
  {
    id: "structure",
    section: "etablissement",
    href: "/dashboard/structure",
    icone: Building2,
    libelle: { defaut: "Ma structure", PHARMACIE: "Ma pharmacie" },
    acces: perm(["structure:read", "structure:write"], { typesStructure: HCP }),
    rolesRepli: ["MEDECIN", "PHARMACIEN", "STRUCTURE_ADMIN"],
    raccourci: {
      description: {
        defaut: "Paramètres et informations de votre structure",
        PHARMACIE: "Gérez les informations de votre pharmacie",
      },
      degrade: "from-primary-500 to-cyan-500",
      rolesRepli: ["PHARMACIEN", "STRUCTURE_ADMIN"],
    },
  },
  {
    id: "equipe",
    section: "etablissement",
    href: "/dashboard/membres",
    icone: Users,
    libelle: { defaut: "Équipe médicale", PHARMACIE: "Équipe de la pharmacie" },
    acces: perm(["membre:read", "membre:manage"], { typesStructure: HCP }),
    rolesRepli: ["STRUCTURE_ADMIN"],
    raccourci: {
      description: {
        defaut: "Gérez l'équipe de votre structure",
        PHARMACIE: "Gérez l'équipe de votre pharmacie",
      },
      degrade: "from-secondary-500 to-cyan-500",
      rolesRepli: ["STRUCTURE_ADMIN"],
    },
  },
  {
    id: "utilisateurs",
    section: "administration",
    href: "/dashboard/utilisateurs",
    icone: Users,
    libelle: { defaut: "Utilisateurs" },
    acces: perm(["user:admin"]),
    rolesRepli: ADMINS,
    raccourci: {
      description: { defaut: "Gérez tous les utilisateurs de la plateforme" },
      degrade: "from-primary-500 to-cyan-500",
      rolesRepli: ADMINS,
    },
  },
  {
    id: "structures",
    section: "administration",
    href: "/dashboard/structures",
    icone: Building2,
    libelle: { defaut: "Structures" },
    acces: perm(["platform:structures"]),
    rolesRepli: ADMINS,
    raccourci: {
      description: { defaut: "Gérez les hôpitaux, cliniques et pharmacies" },
      degrade: "from-secondary-500 to-cyan-500",
      rolesRepli: ADMINS,
    },
  },
  {
    id: "catalogue-plateforme",
    section: "administration",
    href: "/dashboard/catalogue",
    icone: Pill,
    libelle: { defaut: "Catalogue Médicaments" },
    acces: perm(["catalogue:write", "catalogue:manage"]),
    rolesRepli: ADMINS,
  },
];

/** Raccourci de l'accueil sans entrée de menu, placé juste après l'entrée `apres`. Invisible sur un ancien serveur. */
interface RaccourciSupplementaire {
  id: string;
  apres: string;
  href: string;
  icone: IconeComposant;
  libelle: TexteSelonType;
  description: TexteSelonType;
  degrade: string;
  acces: RegleAcces;
}

const RACCOURCIS_SUPPLEMENTAIRES: readonly RaccourciSupplementaire[] = [
  {
    id: "importer-stock",
    apres: "stock",
    href: "/dashboard/stock?importer=1",
    icone: FileSpreadsheet,
    libelle: { defaut: "Importer le stock" },
    description: { defaut: "Mettez à jour votre stock depuis un fichier Excel" },
    degrade: "from-secondary-500 to-cyan-500",
    acces: perm(["stock:read", "stock:write"], { typesStructure: P }),
  },
  {
    id: "catalogue-pharmacie",
    apres: "stock",
    href: "/dashboard/catalogue",
    icone: Pill,
    libelle: { defaut: "Catalogue des médicaments" },
    description: { defaut: "Cherchez un médicament et ajoutez-le à votre stock" },
    degrade: "from-amber-500 to-orange-500",
    acces: perm(["catalogue:write", "catalogue:manage", "stock:read", "stock:write"], { typesStructure: P }),
  },
];

const CARTES: readonly DefinitionCarte[] = [
  { cle: "patientConsultations", libelle: "Consultations", icone: Stethoscope, couleur: "text-primary-400", acces: patient, rolesRepli: PATIENT },
  { cle: "patientOrdonnances", libelle: "Ordonnances", icone: ClipboardList, couleur: "text-secondary-400", acces: patient, rolesRepli: PATIENT },
  { cle: "patientVaccinations", libelle: "Vaccinations", icone: Activity, couleur: "text-accent-400", acces: patient, rolesRepli: PATIENT },
  { cle: "patientDiagnosticsIA", libelle: "Diagnostics IA", icone: Bot, couleur: "text-cyan-400", acces: patient, rolesRepli: PATIENT },
  { cle: "medecinPatients", libelle: "Patients de la structure", icone: Users, couleur: "text-primary-400", acces: perm(["carnet:read"], { typesStructure: HC }), rolesRepli: ["MEDECIN"] },
  { cle: "medecinConsultationsAujourdhui", libelle: "Consultations aujourd'hui", icone: Stethoscope, couleur: "text-secondary-400", acces: perm(["consultation:write", "carnet:read"], { typesStructure: HC }), rolesRepli: ["MEDECIN"] },
  { cle: "medecinRendezVousAVenir", libelle: "Rendez-vous à venir", icone: Calendar, couleur: "text-amber-400", acces: perm(["carnet:read"], { typesStructure: HC }), rolesRepli: ["MEDECIN"] },
  { cle: "pharmacieMedicamentsEnStock", libelle: "Médicaments en stock", icone: Package, couleur: "text-primary-400", acces: perm(["stock:read", "stock:write"], { typesStructure: P }), rolesRepli: ["PHARMACIEN"] },
  { cle: "pharmacieRuptures", libelle: "Ruptures de stock", icone: Pill, couleur: "text-emergency-500", acces: perm(["stock:read", "stock:write"], { typesStructure: P }), rolesRepli: ["PHARMACIEN"] },
  { cle: "adminUtilisateurs", libelle: "Utilisateurs", icone: Users, couleur: "text-primary-400", acces: perm(["user:admin"]), rolesRepli: ADMINS },
  { cle: "adminStructures", libelle: "Structures en service", icone: Building2, couleur: "text-secondary-400", acces: perm(["platform:structures", "user:admin"]), rolesRepli: ADMINS },
  { cle: "structureMedecins", libelle: "Médecins", icone: Stethoscope, couleur: "text-primary-400", acces: perm(["membre:manage"], { typesStructure: HC }), rolesRepli: ["STRUCTURE_ADMIN"] },
  { cle: "structurePharmaciens", libelle: "Pharmaciens", icone: Pill, couleur: "text-secondary-400", acces: perm(["membre:manage"], { typesStructure: P }), rolesRepli: ["STRUCTURE_ADMIN"] },
  { cle: "structurePatients", libelle: "Patients de la structure", icone: Users, couleur: "text-accent-400", acces: perm(["patient:read"], { sauf: ["carnet:read"], typesStructure: HC }), rolesRepli: ["STRUCTURE_ADMIN"] },
  { cle: "accueilRdvEnAttente", libelle: "RDV en attente", icone: Clock, couleur: "text-amber-400", acces: perm(["rendezvous:write"], { sauf: ["carnet:read"], typesStructure: HC }), rolesRepli: ["ACCUEIL"] },
  { cle: "accueilRdvAujourdhui", libelle: "RDV aujourd'hui", icone: Calendar, couleur: "text-primary-400", acces: perm(["rendezvous:write"], { sauf: ["carnet:read"], typesStructure: HC }), rolesRepli: ["ACCUEIL"] },
  { cle: "accueilRdvAVenir", libelle: "RDV à venir", icone: Activity, couleur: "text-secondary-400", acces: perm(["rendezvous:write"], { sauf: ["carnet:read"], typesStructure: HC }), rolesRepli: ["ACCUEIL"] },
];

// ─── Évaluation ─────────────────────────────────────────────────

function estVisible(acces: RegleAcces, rolesRepli: readonly RoleUtilisateur[], ctx: ContexteAcces): boolean {
  if (ctx.mode === "repli") return (rolesRepli as readonly string[]).includes(ctx.role);
  if (acces.genre === "tous") return true;
  if (acces.genre === "patient") return ctx.role === "PATIENT";
  return (
    acces.auMoinsUne.some((code) => ctx.permissions.has(code)) &&
    !(acces.sauf ?? []).some((code) => ctx.permissions.has(code)) &&
    (acces.typesStructure === undefined ||
      (ctx.typeStructure !== null && acces.typesStructure.includes(ctx.typeStructure)))
  );
}

function texte(t: TexteSelonType, ctx: ContexteAcces): string {
  return (ctx.typeStructure !== null ? t[ctx.typeStructure] : undefined) ?? t.defaut;
}

// ─── Fonctions exportées ────────────────────────────────────────

export function sectionsMenu(ctx: ContexteAcces): SectionMenu[] {
  const dejaVus = new Set<string>();
  const liens = new Map<IdSection, LienMenu[]>();
  for (const entree of ENTREES) {
    if (!estVisible(entree.acces, entree.rolesRepli, ctx)) continue;
    if (dejaVus.has(entree.href)) continue;
    dejaVus.add(entree.href);
    const href =
      entree.id === "tableau-de-bord" && ctx.role === "SUPER_ADMIN" ? "/dashboard/super-admin" : entree.href;
    const groupe = liens.get(entree.section) ?? [];
    groupe.push({ id: entree.id, libelle: texte(entree.libelle, ctx), href, icone: entree.icone });
    liens.set(entree.section, groupe);
  }
  return ORDRE_SECTIONS.filter((id) => (liens.get(id)?.length ?? 0) > 0).map((id) => ({
    id,
    titre: texte(TITRES_SECTIONS[id], ctx),
    liens: liens.get(id) ?? [],
  }));
}

export function raccourcis(ctx: ContexteAcces): Raccourci[] {
  const dejaVus = new Set<string>();
  const resultat: Raccourci[] = [];
  const ajouter = (r: Raccourci) => {
    if (dejaVus.has(r.href)) return;
    dejaVus.add(r.href);
    resultat.push(r);
  };
  for (const entree of ENTREES) {
    const raccourci = entree.raccourci;
    if (raccourci && estVisible(entree.acces, raccourci.rolesRepli, ctx)) {
      ajouter({
        id: entree.id,
        libelle: texte(raccourci.libelle ?? entree.libelle, ctx),
        description: texte(raccourci.description, ctx),
        href: entree.href,
        icone: entree.icone,
        degrade: raccourci.degrade,
      });
    }
    for (const sup of RACCOURCIS_SUPPLEMENTAIRES) {
      if (sup.apres !== entree.id || !estVisible(sup.acces, [], ctx)) continue;
      ajouter({
        id: sup.id,
        libelle: texte(sup.libelle, ctx),
        description: texte(sup.description, ctx),
        href: sup.href,
        icone: sup.icone,
        degrade: sup.degrade,
      });
    }
  }
  return resultat;
}

export function cartesCompteurs(ctx: ContexteAcces): CarteCompteur[] {
  return CARTES.filter((carte) => estVisible(carte.acces, carte.rolesRepli, ctx)).map(
    ({ cle, libelle, icone, couleur }) => ({ cle, libelle, icone, couleur }),
  );
}

export function estRouteAutorisee(chemin: string, ctx: ContexteAcces): boolean {
  const propre = chemin.length > 1 && chemin.endsWith("/") ? chemin.slice(0, -1) : chemin;
  if (propre === "/dashboard") return true;
  const entrees = ENTREES.filter((entree) => entree.href === propre);
  if (entrees.length === 0) return true;
  return entrees.some((entree) => estVisible(entree.acces, entree.rolesRepli, ctx));
}
