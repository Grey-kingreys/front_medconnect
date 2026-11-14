"use client";
// Dette préexistante, backlog points 21 et 22
/* eslint-disable react-hooks/set-state-in-effect */
import { LoadingSpinner } from "@/components/LoadingSpinner";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { BandeauPoste } from "@/components/caisse/BandeauPoste";
import ActionEnLigne, { VersLaVente } from "@/components/caisse/ActionEnLigne";
import { horsLigneSurPoste, useEtatPoste } from "@/lib/caisse/etat_poste";
import { routeHorsLigneAutorisee } from "@/lib/caisse/routes_hors_ligne";
import { useAuth } from "@/hooks/useAuth";
import { LogOut, ChevronLeft, ChevronRight, Menu, X } from "lucide-react";
import { lireContexteAcces, EVENEMENT_ACCES_REFUSE } from "@/lib/acces";
import { estRouteAutorisee, sectionsMenu } from "@/lib/navigation_tableau_de_bord";
import PageNonDisponible from "@/components/PageNonDisponible";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { PWAInstallButton } from "@/components/PWAInstallButton";
import EmergencyButton from "@/components/EmergencyButton";
import EmergencyListener from "@/components/EmergencyListener";
import NotificationBell from "@/components/NotificationBell";
import ToastProvider from "@/components/Toast";
import { NotificationsProvider } from "@/hooks/useNotifications";
import { ui } from "@/theme/ui";

function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    PATIENT: "Patient",
    MEDECIN: "Médecin",
    PHARMACIEN: "Pharmacien",
    STRUCTURE_ADMIN: "Admin Structure",
    ACCUEIL: "Accueil",
    ADMIN: "Administrateur",
    SUPER_ADMIN: "Super Admin",
  };
  return labels[role] || role;
}

function getRoleColor(role: string): string {
  const colors: Record<string, string> = {
    PATIENT: "from-primary-500 to-cyan-500",
    MEDECIN: "from-secondary-500 to-cyan-500",
    PHARMACIEN: "from-accent-500 to-primary-500",
    STRUCTURE_ADMIN: "from-amber-500 to-orange-500",
    ACCUEIL: "from-violet-500 to-purple-500",
    ADMIN: "from-primary-600 to-accent-500",
    SUPER_ADMIN: "from-emergency-500 to-accent-500",
  };
  return colors[role] || "from-primary-500 to-cyan-500";
}

// ─── Sidebar Component ─────────────────────────────────────────

function Sidebar({
  collapsed,
  setCollapsed,
  mobileOpen,
  setMobileOpen,
}: {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
}) {
  const { user, profile, logout } = useAuth();
  const pathname = usePathname();

  if (!user) return null;

  const sections = sectionsMenu(lireContexteAcces(user, profile));
  const roleLabel = getRoleLabel(user.role);
  const roleGradient = getRoleColor(user.role);
  const initials = `${user.prenom[0] || ""}${user.nom[0] || ""}`.toUpperCase();

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className={ui.menu.superposition}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          ${ui.menu.cadre}
          ${collapsed ? ui.menu.cadreReplie : ui.menu.cadreOuvert}
          ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        {/* Header */}
        <div className={`${ui.menu.enTete} ${collapsed ? "justify-center" : "justify-between"}`}>
          {!collapsed && (
            <Link href="/" className="inline-flex items-center gap-2 group">
              <Image
                src="/images/logo.png"
                alt="MedConnecte Logo"
                width={32}
                height={32}
                className={ui.menu.logoImage}
              />
              <span
                className={ui.menu.logoTexte}
                style={{ fontFamily: "var(--font-outfit, var(--font-inter))" }}
              >
                <span className="text-slate-900 dark:text-white">Med</span>
                <span className="gradient-text">Connecte</span>
              </span>
            </Link>
          )}
          {collapsed && (
            <Image
              src="/images/logo.png"
              alt="MedConnecte"
              width={32}
              height={32}
              className="rounded-mc-moyen"
            />
          )}

          {/* Close button mobile */}
          <button
            onClick={() => setMobileOpen(false)}
            className={`${ui.bouton.iconePetit} lg:hidden`}
          >
            <X className={ui.menu.icone} />
          </button>

          {/* Notification Bell + Collapse button desktop */}
          <div className="hidden lg:flex items-center gap-1">
            <NotificationBell align="left" />
            <button
              onClick={() => setCollapsed(!collapsed)}
              className={ui.bouton.iconePetit}
            >
              {collapsed ? (
                <ChevronRight className={ui.menu.icone} />
              ) : (
                <ChevronLeft className={ui.menu.icone} />
              )}
            </button>
          </div>
        </div>

        {/* User card */}
        <div className={`${ui.menu.zoneProfil} ${collapsed ? "flex justify-center" : ""}`}>
          <Link
            href="/dashboard/profil"
            className={`${ui.menu.profil} ${collapsed ? "justify-center" : ""}`}
            title="Voir mon profil"
          >
            {/* Avatar */}
            <div className={`${ui.menu.avatar} ${roleGradient}`}>
              <span className={ui.menu.avatarInitiales}>{initials}</span>
              <div className={ui.menu.avatarPastille} />
            </div>

            {/* Name & role */}
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className={ui.menu.profilNom}>
                  {user.prenom} {user.nom}
                </p>
                <p className={`${ui.menu.profilRole} ${roleGradient}`}>
                  {roleLabel}
                </p>
              </div>
            )}

            {/* Arrow */}
            {!collapsed && (
              <ChevronRight className={`${ui.menu.icone} text-slate-600 group-hover:text-primary-400 transition-colors`} />
            )}
          </Link>
        </div>

        {/* Navigation */}
        <nav className={ui.menu.navigation}>
          {sections.map((section) => (
            <div key={section.id}>
              {!collapsed && (
                <p className={ui.menu.titreGroupe}>
                  {section.titre}
                </p>
              )}
              <div className="space-y-1">
                {section.liens.map((lien) => {
                  // Exact match for root-level items, startsWith for sub-pages
                  const isActive =
                    lien.href === "/dashboard" || lien.href === "/dashboard/super-admin"
                      ? pathname === lien.href
                      : pathname === lien.href || pathname.startsWith(lien.href + "/");
                  return (
                    <Link
                      key={lien.href}
                      href={lien.href}
                      onClick={() => setMobileOpen(false)}
                      title={collapsed ? lien.libelle : undefined}
                      className={`
                        ${isActive ? ui.menu.lienActif : ui.menu.lien}
                        ${collapsed ? "justify-center px-0" : ""}
                      `}
                    >
                      {isActive && <div className={ui.menu.indicateurActif} />}
                      <span className="flex-shrink-0">
                        <lien.icone className={ui.menu.icone} />
                      </span>
                      {!collapsed && <span>{lien.libelle}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className={ui.menu.bas}>
          {!collapsed && <PWAInstallButton />}
          <button
            onClick={logout}
            title={collapsed ? "Se déconnecter" : undefined}
            className={`
              ${ui.menu.lienDanger}
              ${collapsed ? "justify-center px-0" : ""}
            `}
          >
            <LogOut className={ui.menu.icone} />
            {!collapsed && <span>Se déconnecter</span>}
          </button>

          <div className={collapsed ? "flex justify-center" : ui.menu.ligneTheme}>
            {!collapsed && <span className={ui.menu.ligneThemeTexte}>Thème</span>}
            <ThemeSwitcher up={true} />
          </div>
        </div>
      </aside>
    </>
  );
}

// ─── Layout ─────────────────────────────────────────────────────

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile, loading } = useAuth();
  const pathname = usePathname();
  const poste = useEtatPoste();
  const horsLigne = horsLigneSurPoste(poste);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [refusSur, setRefusSur] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);


  // Le serveur a refusé une lecture faute de droit : la page affichée est remplacée par un message
  useEffect(() => {
    const surRefus = () => setRefusSur(window.location.pathname);
    window.addEventListener(EVENEMENT_ACCES_REFUSE, surRefus);
    return () => window.removeEventListener(EVENEMENT_ACCES_REFUSE, surRefus);
  }, []);

  // Remise à zéro à chaque changement d'adresse
  useEffect(() => {
    setRefusSur(null);
  }, [pathname]);

  // Loading state (server or client before mount)
  if (!mounted || loading) {
    return <LoadingSpinner fullPage message="Chargement du dashboard..." />;
  }

  // Non connecté : le hook redirigera vers /auth/login
  if (!user) {
    return <LoadingSpinner fullPage message="Redirection vers la connexion..." />;
  }

  const contexte = lireContexteAcces(user, profile);
  const pageNonDisponible =
    (contexte.mode === "permissions" && !estRouteAutorisee(pathname, contexte)) ||
    (refusSur === pathname && pathname !== "/dashboard");

  return (
    <ToastProvider>
    <NotificationsProvider key={user.id}>
    <div className="min-h-screen bg-slate-50 dark:bg-[#030712] transition-colors duration-300 print:min-h-0 print:bg-white">
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      {/* Main content */}
      <div
        className={`
          transition-all duration-300 print:ml-0
          ${collapsed ? ui.menu.decalageReplie : ui.menu.decalageOuvert}
        `}
      >
        {/* Top bar mobile */}
        <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between p-4 print:hidden bg-white/80 dark:bg-[#030712]/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800/50">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white hover:bg-slate-800/50 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <Link href="/" className="inline-flex items-center gap-2">
            <Image
              src="/images/logo.png"
              alt="MedConnecte Logo"
              width={32}
              height={32}
              className="rounded-lg"
              priority
            />
            <span
              className="text-base font-bold"
              style={{ fontFamily: "var(--font-outfit, var(--font-inter))" }}
            >
              <span className="text-slate-900 dark:text-white">Med</span>
              <span className="gradient-text">Connecte</span>
            </span>
          </Link>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <ThemeSwitcher />
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 sm:p-6 lg:p-8 print:p-0">
          <BandeauPoste />
          {pageNonDisponible ? (
            <PageNonDisponible />
          ) : horsLigne && !routeHorsLigneAutorisee(pathname) ? (
            pathname === "/dashboard" ? <VersLaVente /> : <ActionEnLigne />
          ) : (
            children
          )}
        </main>
      </div>
      <div className="print:hidden">
        <EmergencyButton />
        <EmergencyListener />
      </div>
    </div>
    </NotificationsProvider>
    </ToastProvider>
  );
}
