"use client";

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
  TrendingUp,
  Heart,
  Clock,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { getMyStructure, MyStructure } from "@/lib/api_structure";

// ─── Types ──────────────────────────────────────────────────────

interface QuickAction {
  label: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  gradient: string;
}

interface StatCard {
  label: string;
  value: string;
  change?: string;
  icon: React.ReactNode;
  color: string;
}

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
    case "ADMIN":
    case "SUPER_ADMIN":
      return "Bienvenue dans le panneau d'administration. Gérez la plateforme MedConnect.";
    default:
      return "Bienvenue sur MedConnect.";
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
          label: "Stock Médicaments",
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
          label: "Recherche Médicaments",
          description: "Recherchez dans la base de médicaments",
          href: "/dashboard/medicaments",
          icon: <Pill className="w-6 h-6" />,
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
        { label: "Consultations", value: "—", icon: <Stethoscope className="w-5 h-5" />, color: "text-primary-400" },
        { label: "Ordonnances", value: "—", icon: <ClipboardList className="w-5 h-5" />, color: "text-secondary-400" },
        { label: "Vaccinations", value: "—", icon: <Activity className="w-5 h-5" />, color: "text-accent-400" },
        { label: "Diagnostics IA", value: "—", icon: <Bot className="w-5 h-5" />, color: "text-cyan-400" },
      ];
    case "MEDECIN":
      return [
        { label: "Patients", value: "—", icon: <Users className="w-5 h-5" />, color: "text-primary-400" },
        { label: "Consultations aujourd'hui", value: "—", icon: <Stethoscope className="w-5 h-5" />, color: "text-secondary-400" },
        { label: "Ordonnances émises", value: "—", icon: <ClipboardList className="w-5 h-5" />, color: "text-accent-400" },
        { label: "Rendez-vous à venir", value: "—", icon: <Calendar className="w-5 h-5" />, color: "text-amber-400" },
      ];
    case "PHARMACIEN":
      return [
        { label: "Médicaments en stock", value: "—", icon: <Package className="w-5 h-5" />, color: "text-primary-400" },
        { label: "Ruptures de stock", value: "—", icon: <Pill className="w-5 h-5" />, color: "text-emergency-500" },
        { label: "Ordonnances traitées", value: "—", icon: <ClipboardList className="w-5 h-5" />, color: "text-secondary-400" },
      ];
    case "ADMIN":
    case "SUPER_ADMIN":
      return [
        { label: "Utilisateurs", value: "—", icon: <Users className="w-5 h-5" />, color: "text-primary-400" },
        { label: "Structures", value: "—", icon: <Building2 className="w-5 h-5" />, color: "text-secondary-400" },
        { label: "Consultations / mois", value: "—", icon: <Stethoscope className="w-5 h-5" />, color: "text-accent-400" },
        { label: "Croissance", value: "—", change: "+0%", icon: <TrendingUp className="w-5 h-5" />, color: "text-cyan-400" },
      ];
    case "STRUCTURE_ADMIN":
      return [
        { label: "Médecins", value: "—", icon: <Stethoscope className="w-5 h-5" />, color: "text-primary-400" },
        { label: "Pharmaciens", value: "—", icon: <Pill className="w-5 h-5" />, color: "text-secondary-400" },
        { label: "Patients Inscrits", value: "—", icon: <Users className="w-5 h-5" />, color: "text-accent-400" },
        { label: "Consultations / mois", value: "—", icon: <Activity className="w-5 h-5" />, color: "text-cyan-400" },
      ];
    default:
      return [];
  }
}

// ─── Components ─────────────────────────────────────────────────

function StatsGrid({ cards }: { cards: StatCard[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="group relative bg-white dark:bg-[#0f172a]/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800/50 rounded-2xl p-5 hover:border-slate-300 dark:hover:border-slate-700/50 transition-all duration-300"
        >
          <div className="flex items-start justify-between mb-3">
            <div className={`p-2 rounded-xl bg-slate-800/50 ${card.color}`}>
              {card.icon}
            </div>
            {card.change && (
              <span className="text-xs font-medium text-secondary-400 bg-secondary-500/10 px-2 py-0.5 rounded-full">
                {card.change}
              </span>
            )}
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mb-1">{card.value}</p>
          <p className="text-xs text-slate-500">{card.label}</p>
        </div>
      ))}
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
  
  const [structureStats, setStructureStats] = useState<{ medecins: number; pharmaciens: number; actifs: number; }>({
    medecins: 0, pharmaciens: 0, actifs: 0
  });

  // Redirect SUPER_ADMIN to their dedicated dashboard
  useEffect(() => {
    if (user?.role === "SUPER_ADMIN") {
      router.replace("/dashboard/super-admin");
    }
  }, [user, router]);

  useEffect(() => {
    if (user?.role === "STRUCTURE_ADMIN") {
      getMyStructure().then((res) => {
        const membres = res.data.membres || [];
        setStructureStats({
          medecins: membres.filter(m => m.role === "MEDECIN").length,
          pharmaciens: membres.filter(m => m.role === "PHARMACIEN").length,
          actifs: membres.filter(m => m.isActive).length,
        });
      }).catch(console.error);
    }
  }, [user]);

  if (!user) return null;
  if (user.role === "SUPER_ADMIN") return null; // Redirecting...

  const welcomeMessage = getWelcomeMessage(user.role);
  const quickActions = getQuickActions(user.role);
  let statsCards = getStatsCards(user.role);

  // Update STRUCTURE_ADMIN stats dynamically
  if (user.role === "STRUCTURE_ADMIN") {
    statsCards = statsCards.map((card) => {
      if (card.label === "Médecins") return { ...card, value: structureStats.medecins.toString() };
      if (card.label === "Pharmaciens") return { ...card, value: structureStats.pharmaciens.toString() };
      if (card.label === "Patients Inscrits") return { ...card, value: "0" }; // TODO: Connect patients
      if (card.label === "Consultations / mois") return { ...card, value: "0" }; // TODO: Connect consultations
      return card;
    });
  }

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
              <span className="gradient-text">{user.prenom}</span>
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

        {/* Membership info for patient */}
        {user.role === "PATIENT" && profile && (
          <div className="relative mt-4 flex items-center gap-2 text-xs text-slate-500">
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
        <section>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4" style={{ fontFamily: "var(--font-outfit, var(--font-inter))" }}>
            Aperçu
          </h2>
          <StatsGrid cards={statsCards} />
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
