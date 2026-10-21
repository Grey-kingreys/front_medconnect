"use client";
import { LoadingSpinner } from "@/components/LoadingSpinner";

import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Stethoscope,
  Pill,
  MapPin,
  Calendar,
  Users,
  Building2,
  Activity,
  Bot,
  ClipboardList,
  Package,
  ShieldCheck,
  ArrowRight,
  Heart,
  Clock,
  Sparkles,
  Headset,
  MessageSquare,
} from "lucide-react";
import Link from "next/link";
import { ApiError } from "@/lib/api_auth";
import { sourcesCompteurs, type CleCompteur } from "@/lib/compteurs_tableau_de_bord";
import DashboardCharts from "@/components/DashboardCharts";

// Graphiques « Analyses et Tendances » : données fictives codées en dur dans DashboardCharts.
// Masqués tant qu'aucune route du back ne fournit de vraies séries (ne jamais montrer de chiffres inventés).
const SHOW_CHARTS = false;

// ─── Types ──────────────────────────────────────────────────────

interface QuickAction {
  label: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  gradient: string;
}

interface StatCard {
  cle: CleCompteur;
  label: string;
  icon: React.ReactNode;
  color: string;
}

// État d'affichage d'un compteur (absent = en cours de chargement)
type EtatCompteur =
  | { statut: "chargement" }
  | { statut: "pret"; valeur: number }
  | { statut: "erreur" }
  | { statut: "masque" };

// ─── Contenu par rôle ───────────────────────────────────────────

function getWelcomeMessage(role: string): string {
  switch (role) {
    case "PATIENT":
      return "Votre santé est entre de bonnes mains. Voici un aperçu de votre espace santé.";
    case "MEDECIN":
      return "Bienvenue dans votre espace médecin. Gérez vos patients et consultations.";
    case "PHARMACIEN":
      return "Bienvenue dans votre espace pharmacien. Gérez votre stock et les ordonnances.";
    case "STRUCTURE_ADMIN":
      return "Bienvenue dans votre espace de gestion. Administrez votre structure de santé.";
    case "ACCUEIL":
      return "Accueillez les patients : partage de dossier, orientation et rendez-vous.";
    case "ADMIN":
    case "SUPER_ADMIN":
      return "Bienvenue dans le panneau d'administration. Gérez la plateforme MedConnecte.";
    default:
      return "Bienvenue sur MedConnecte.";
  }
}

function getQuickActions(role: string): QuickAction[] {
  switch (role) {
    case "PATIENT":
      return [
        {
          label: "Mon Carnet de Santé",
          description: "Consultez votre profil médical, allergies, traitements",
          href: "/dashboard/carnet",
          icon: <FileText className="w-6 h-6" />,
          gradient: "from-primary-500 to-cyan-500",
        },
        {
          label: "Auto-Diagnostic IA",
          description: "Décrivez vos symptômes et obtenez une orientation",
          href: "/dashboard/diagnostic",
          icon: <Bot className="w-6 h-6" />,
          gradient: "from-accent-500 to-primary-500",
        },
        {
          label: "Trouver un Médecin",
          description: "Localisez les structures de santé proches de vous",
          href: "/dashboard/map",
          icon: <MapPin className="w-6 h-6" />,
          gradient: "from-secondary-500 to-cyan-500",
        },
        {
          label: "Mes Consultations",
          description: "Historique de vos visites médicales",
          href: "/dashboard/consultations",
          icon: <Stethoscope className="w-6 h-6" />,
          gradient: "from-amber-500 to-orange-500",
        },
        {
          label: "Ordonnances",
          description: "Vos ordonnances et prescriptions médicales",
          href: "/dashboard/ordonnances",
          icon: <ClipboardList className="w-6 h-6" />,
          gradient: "from-rose-500 to-pink-500",
        },
        {
          label: "Pharmacies",
          description: "Trouvez les pharmacies et médicaments disponibles",
          href: "/dashboard/pharmacies",
          icon: <Pill className="w-6 h-6" />,
          gradient: "from-emerald-500 to-teal-500",
        },
      ];

    case "MEDECIN":
      return [
        {
          label: "Mes Patients",
          description: "Liste et gestion de vos patients",
          href: "/dashboard/patients",
          icon: <Users className="w-6 h-6" />,
          gradient: "from-primary-500 to-cyan-500",
        },
        {
          label: "Consultations",
          description: "Gérez vos consultations du jour",
          href: "/dashboard/consultations",
          icon: <Stethoscope className="w-6 h-6" />,
          gradient: "from-secondary-500 to-cyan-500",
        },
        {
          label: "Ordonnances",
          description: "Créez et consultez les ordonnances",
          href: "/dashboard/ordonnances",
          icon: <ClipboardList className="w-6 h-6" />,
          gradient: "from-accent-500 to-primary-500",
        },
        {
          label: "Rendez-vous",
          description: "Gérez votre planning de rendez-vous",
          href: "/dashboard/rendez-vous",
          icon: <Calendar className="w-6 h-6" />,
          gradient: "from-amber-500 to-orange-500",
        },
      ];

    case "PHARMACIEN":
      return [
        {
          label: "Mon Stock",
          description: "Gérez votre inventaire de médicaments",
          href: "/dashboard/stock",
          icon: <Package className="w-6 h-6" />,
          gradient: "from-accent-500 to-primary-500",
        },
        {
          label: "Ordonnances",
          description: "Consultez les ordonnances en attente",
          href: "/dashboard/ordonnances",
          icon: <ClipboardList className="w-6 h-6" />,
          gradient: "from-primary-500 to-cyan-500",
        },
        {
          label: "Ma Pharmacie",
          description: "Gérez les informations de votre structure",
          href: "/dashboard/structure",
          icon: <Building2 className="w-6 h-6" />,
          gradient: "from-secondary-500 to-cyan-500",
        },
      ];

    case "STRUCTURE_ADMIN":
      return [
        {
          label: "Ma Structure",
          description: "Paramètres et informations de votre structure",
          href: "/dashboard/structure",
          icon: <Building2 className="w-6 h-6" />,
          gradient: "from-primary-500 to-cyan-500",
        },
        {
          label: "Membres",
          description: "Gérez l'équipe de votre structure",
          href: "/dashboard/membres",
          icon: <Users className="w-6 h-6" />,
          gradient: "from-secondary-500 to-cyan-500",
        },
        {
          label: "Statistiques",
          description: "Performances et métriques de votre structure",
          href: "/dashboard/stats",
          icon: <Activity className="w-6 h-6" />,
          gradient: "from-accent-500 to-primary-500",
        },
      ];

    case "ACCUEIL":
      return [
        {
          label: "Accueil patient",
          description: "Enregistrer le partage d'un dossier (code / QR / SMS)",
          href: "/dashboard/accueil",
          icon: <Headset className="w-6 h-6" />,
          gradient: "from-violet-500 to-purple-500",
        },
        {
          label: "Rendez-vous",
          description: "Prendre et suivre les rendez-vous de la structure",
          href: "/dashboard/rendez-vous",
          icon: <Calendar className="w-6 h-6" />,
          gradient: "from-amber-500 to-orange-500",
        },
        {
          label: "Messagerie",
          description: "Messages adressés à la structure",
          href: "/dashboard/chat",
          icon: <MessageSquare className="w-6 h-6" />,
          gradient: "from-primary-500 to-cyan-500",
        },
        {
          label: "Patients",
          description: "Fiches d'orientation des patients de la structure",
          href: "/dashboard/patients",
          icon: <Users className="w-6 h-6" />,
          gradient: "from-secondary-500 to-cyan-500",
        },
      ];

    case "ADMIN":
    case "SUPER_ADMIN":
      return [
        {
          label: "Utilisateurs",
          description: "Gérez tous les utilisateurs de la plateforme",
          href: "/dashboard/utilisateurs",
          icon: <Users className="w-6 h-6" />,
          gradient: "from-primary-500 to-cyan-500",
        },
        {
          label: "Structures",
          description: "Gérez les hôpitaux, cliniques et pharmacies",
          href: "/dashboard/structures",
          icon: <Building2 className="w-6 h-6" />,
          gradient: "from-secondary-500 to-cyan-500",
        },
        {
          label: "Statistiques",
          description: "Vue d'ensemble des métriques de la plateforme",
          href: "/dashboard/stats",
          icon: <Activity className="w-6 h-6" />,
          gradient: "from-accent-500 to-primary-500",
        },
        ...(role === "SUPER_ADMIN"
          ? [
              {
                label: "Sécurité",
                description: "Paramètres de sécurité et logs",
                href: "/dashboard/securite",
                icon: <ShieldCheck className="w-6 h-6" />,
                gradient: "from-emergency-500 to-accent-500",
              },
            ]
          : []),
      ];

    default:
      return [];
  }
}

function getStatsCards(role: string): StatCard[] {
  switch (role) {
    case "PATIENT":
      return [
        { cle: "patientConsultations", label: "Consultations", icon: <Stethoscope className="w-5 h-5" />, color: "text-primary-400" },
        { cle: "patientOrdonnances", label: "Ordonnances", icon: <ClipboardList className="w-5 h-5" />, color: "text-secondary-400" },
        { cle: "patientVaccinations", label: "Vaccinations", icon: <Activity className="w-5 h-5" />, color: "text-accent-400" },
        { cle: "patientDiagnosticsIA", label: "Diagnostics IA", icon: <Bot className="w-5 h-5" />, color: "text-cyan-400" },
      ];
    case "MEDECIN":
      return [
        { cle: "medecinPatients", label: "Patients de la structure", icon: <Users className="w-5 h-5" />, color: "text-primary-400" },
        { cle: "medecinConsultationsAujourdhui", label: "Consultations aujourd'hui", icon: <Stethoscope className="w-5 h-5" />, color: "text-secondary-400" },
        { cle: "medecinRendezVousAVenir", label: "Rendez-vous à venir", icon: <Calendar className="w-5 h-5" />, color: "text-amber-400" },
      ];
    case "PHARMACIEN":
      return [
        { cle: "pharmacieMedicamentsEnStock", label: "Médicaments en stock", icon: <Package className="w-5 h-5" />, color: "text-primary-400" },
        { cle: "pharmacieRuptures", label: "Ruptures de stock", icon: <Pill className="w-5 h-5" />, color: "text-emergency-500" },
      ];
    case "ADMIN":
    case "SUPER_ADMIN":
      return [
        { cle: "adminUtilisateurs", label: "Utilisateurs", icon: <Users className="w-5 h-5" />, color: "text-primary-400" },
        { cle: "adminStructures", label: "Structures en service", icon: <Building2 className="w-5 h-5" />, color: "text-secondary-400" },
      ];
    case "STRUCTURE_ADMIN":
      return [
        { cle: "structureMedecins", label: "Médecins", icon: <Stethoscope className="w-5 h-5" />, color: "text-primary-400" },
        { cle: "structurePharmaciens", label: "Pharmaciens", icon: <Pill className="w-5 h-5" />, color: "text-secondary-400" },
        { cle: "structurePatients", label: "Patients de la structure", icon: <Users className="w-5 h-5" />, color: "text-accent-400" },
      ];
    case "ACCUEIL":
      return [
        { cle: "accueilRdvEnAttente", label: "RDV en attente", icon: <Clock className="w-5 h-5" />, color: "text-amber-400" },
        { cle: "accueilRdvAujourdhui", label: "RDV aujourd'hui", icon: <Calendar className="w-5 h-5" />, color: "text-primary-400" },
        { cle: "accueilRdvAVenir", label: "RDV à venir", icon: <Activity className="w-5 h-5" />, color: "text-secondary-400" },
      ];
    default:
      return [];
  }
}

// ─── Components ─────────────────────────────────────────────────

function StatsGrid({ cards, etats }: { cards: StatCard[]; etats: Partial<Record<CleCompteur, EtatCompteur>> }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const etat: EtatCompteur = etats[card.cle] ?? { statut: "chargement" };
        return (
        <div
          key={card.label}
          className="group relative bg-white dark:bg-[#0f172a]/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800/50 rounded-2xl p-5 hover:border-slate-300 dark:hover:border-slate-700/50 transition-all duration-300"
        >
          <div className="flex items-start justify-between mb-3">
            <div className={`p-2 rounded-xl bg-slate-800/50 ${card.color}`}>
              {card.icon}
            </div>
          </div>
          {etat.statut === "pret" && (
            <p className="text-2xl font-bold text-slate-900 dark:text-white mb-1">{etat.valeur.toLocaleString("fr-FR")}</p>
          )}
          {etat.statut === "erreur" && (
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1 h-8 flex items-center">Indisponible</p>
          )}
          {etat.statut === "chargement" && (
            <div className="mb-1 h-8 flex items-center">
              <span aria-hidden="true" className="block h-6 w-12 rounded-md bg-slate-200 dark:bg-slate-700/60 animate-pulse" />
              <span className="sr-only">Chargement</span>
            </div>
          )}
          <p className="text-xs text-slate-500">{card.label}</p>
        </div>
        );
      })}
    </div>
  );
}

function QuickActionsGrid({ actions }: { actions: QuickAction[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {actions.map((action) => (
        <Link
          key={action.href}
          href={action.href}
          className="group relative bg-white dark:bg-[#0f172a]/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800/50 rounded-2xl p-6 hover:border-slate-300 dark:hover:border-slate-700/50 hover:shadow-lg hover:shadow-primary-500/5 transition-all duration-300 overflow-hidden"
        >
          {/* Background glow on hover */}
          <div className={`absolute inset-0 bg-gradient-to-br ${action.gradient} opacity-0 group-hover:opacity-[0.03] transition-opacity duration-500`} />

          <div className="relative">
            <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${action.gradient} flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
              <span className="text-slate-900 dark:text-white">{action.icon}</span>
            </div>

            <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-1.5 group-hover:text-primary-300 transition-colors">
              {action.label}
            </h3>
            <p className="text-sm text-slate-500 leading-relaxed mb-3">
              {action.description}
            </p>

            <div className="flex items-center gap-1.5 text-xs font-medium text-primary-400 opacity-0 group-hover:opacity-100 translate-x-[-4px] group-hover:translate-x-0 transition-all duration-300">
              <span>Accéder</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, profile } = useAuth();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Éviter les erreurs d'hydratation
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  // Redirect SUPER_ADMIN to their dedicated dashboard
  useEffect(() => {
    if (mounted && user?.role === "SUPER_ADMIN") {
      router.replace("/dashboard/super-admin");
    }
  }, [user, router, mounted]);

  const [etatsCompteurs, setEtatsCompteurs] = useState<Partial<Record<CleCompteur, EtatCompteur>>>({});
  const [essaiCompteurs, setEssaiCompteurs] = useState(0);
  const utilisateurId = user?.id;
  const role = user?.role;
  const structureId = user?.structureId;

  // Chaque source se charge indépendamment : un échec ne vide pas les autres cartes
  useEffect(() => {
    if (!utilisateurId || !role) return;
    let actif = true;
    const appliquer = (cles: CleCompteur[], etatDe: (cle: CleCompteur) => EtatCompteur) =>
      setEtatsCompteurs((prec) => {
        const suivant = { ...prec };
        for (const cle of cles) suivant[cle] = etatDe(cle);
        return suivant;
      });
    for (const source of sourcesCompteurs(role, { id: utilisateurId, structureId })) {
      source
        .charger()
        .then((valeurs) => {
          if (!actif) return;
          appliquer(source.cles, (cle) => {
            const valeur = valeurs[cle];
            return typeof valeur === "number" ? { statut: "pret", valeur } : { statut: "erreur" };
          });
        })
        .catch((err: unknown) => {
          if (!actif) return;
          // Droit absent (rôle personnalisé) : la carte disparaît au lieu d'afficher une erreur
          const masque = err instanceof ApiError && err.status === 403;
          appliquer(source.cles, () => (masque ? { statut: "masque" } : { statut: "erreur" }));
        });
    }
    return () => {
      actif = false;
    };
  }, [utilisateurId, role, structureId, essaiCompteurs]);

  // Repasse les cartes en erreur en chargement puis relance toutes les sources
  const reessayerCompteurs = () => {
    setEtatsCompteurs((prec) => {
      const suivant = { ...prec };
      for (const cle of Object.keys(suivant) as CleCompteur[]) {
        if (suivant[cle]?.statut === "erreur") suivant[cle] = { statut: "chargement" };
      }
      return suivant;
    });
    setEssaiCompteurs((n) => n + 1);
  };

  if (!mounted || !user) return <LoadingSpinner fullPage message="Vérification de l'accès..." />;
  if (user.role === "SUPER_ADMIN") return <LoadingSpinner fullPage message="Redirection vers l'espace Super Admin..." />;

  const welcomeMessage = getWelcomeMessage(user.role);
  const quickActions = getQuickActions(user.role);
  const statsCards = getStatsCards(user.role).filter((c) => etatsCompteurs[c.cle]?.statut !== "masque");
  const compteursEnErreur = statsCards.some((c) => etatsCompteurs[c.cle]?.statut === "erreur");
  const compteursEnChargement = statsCards.some((c) => (etatsCompteurs[c.cle]?.statut ?? "chargement") === "chargement");

  // Les graphiques n'existent que pour certains rôles (DashboardCharts renvoie null sinon) et restent masqués par SHOW_CHARTS.
  const showCharts = SHOW_CHARTS && ["PATIENT", "MEDECIN", "PHARMACIEN", "STRUCTURE_ADMIN"].includes(user.role);

  const now = new Date();
  const hour = now.getHours();
  const greeting =
    hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* Welcome Header */}
      <div className="relative overflow-hidden rounded-3xl bg-slate-100 dark:bg-gradient-to-br dark:from-[#0f172a] dark:to-[#1e1b4b] border border-slate-200 dark:border-slate-800/50 p-6 sm:p-8">
        {/* Background decorations */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-cyan-500/8 rounded-full blur-3xl" />
        </div>

        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1
              className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mb-2"
              style={{ fontFamily: "var(--font-outfit, var(--font-inter))" }}
            >
              {greeting},{" "}
              <span className="gradient-text">{user.prenom} {user.nom}</span>
              <span className="inline-block ml-2 text-amber-400">
                <Sparkles className="w-5 h-5 animate-pulse" />
              </span>
            </h1>
            <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 max-w-xl">
              {welcomeMessage}
            </p>
          </div>

          <div className="flex items-center gap-3 text-sm text-slate-500">
            <Clock className="w-4 h-4" />
            <span>
              {now.toLocaleDateString("fr-FR", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
          </div>
        </div>

        {/* Membership info */}
        {user.role === "PATIENT" && profile && (
          <div className="relative mt-6 flex items-center gap-2 text-xs text-slate-500">
            <Heart className="w-3.5 h-3.5 text-primary-400" />
            <span>
              Membre depuis{" "}
              {new Date(profile.createdAt).toLocaleDateString("fr-FR", {
                month: "long",
                year: "numeric",
              })}
            </span>
          </div>
        )}

        {/* Structure info */}
        {profile?.structure && (
          <div className="relative mt-4 flex items-center gap-2 text-xs text-slate-500">
            <Building2 className="w-3.5 h-3.5 text-secondary-400" />
            <span>
              {profile.structure.nom} — {profile.structure.type.toLowerCase()}
            </span>
          </div>
        )}
      </div>

      {/* Stats */}
      {statsCards.length > 0 && (
        <section aria-busy={compteursEnChargement}>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4" style={{ fontFamily: "var(--font-outfit, var(--font-inter))" }}>
            Aperçu
          </h2>
          <StatsGrid cards={statsCards} etats={etatsCompteurs} />
          {compteursEnErreur && (
            <div role="status" className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
              <p>Certains chiffres n&apos;ont pas pu être chargés. Vérifiez votre connexion puis réessayez.</p>
              <button
                type="button"
                onClick={reessayerCompteurs}
                className="self-start sm:self-auto px-4 py-2 rounded-xl text-sm font-medium bg-primary-500/10 text-primary-700 dark:text-primary-400 hover:bg-primary-500/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                Réessayer
              </button>
            </div>
          )}
        </section>
      )}

      {/* Charts Section */}
      {showCharts && (
        <section className="animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white" style={{ fontFamily: "var(--font-outfit, var(--font-inter))" }}>
              Analyses et Tendances
            </h2>
          </div>
          <DashboardCharts role={user.role} />
        </section>
      )}

      {/* Quick Actions */}
      <section>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4" style={{ fontFamily: "var(--font-outfit, var(--font-inter))" }}>
          Accès rapide
        </h2>
        <QuickActionsGrid actions={quickActions} />
      </section>
    </div>
  );
}
