"use client";
// Dette préexistante, backlog points 21 et 22
/* eslint-disable react-hooks/set-state-in-effect */
import { LoadingSpinner } from "@/components/LoadingSpinner";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
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
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full z-50 flex flex-col
          bg-white dark:bg-[#0a0f1e]/95 backdrop-blur-2xl border-r border-slate-200 dark:border-slate-800/50
          transition-all duration-300 ease-in-out overflow-visible
          ${collapsed ? "w-[72px]" : "w-[280px]"}
          ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        {/* Header */}
        <div className={`flex items-center ${collapsed ? "justify-center" : "justify-between"} p-4 border-b border-slate-200 dark:border-slate-800/50`}>
          {!collapsed && (
            <Link href="/" className="inline-flex items-center gap-2.5 group">
              <Image
                src="/images/logo.png"
                alt="MedConnecte Logo"
                width={36}
                height={36}
                className="rounded-lg group-hover:scale-105 transition-transform duration-300"
              />
              <span
                className="text-lg font-bold tracking-tight"
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
              width={36}
              height={36}
              className="rounded-lg"
            />
          )}

          {/* Close button mobile */}
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white hover:bg-slate-800/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Notification Bell + Collapse button desktop */}
          <div className="hidden lg:flex items-center gap-1">
            <NotificationBell align="left" />
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-white hover:bg-slate-800/50 transition-colors"
            >
              {collapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* User card */}
        <div className={`p-4 border-b border-slate-200 dark:border-slate-800/50 ${collapsed ? "flex justify-center" : ""}`}>
          <Link
            href="/dashboard/profil"
            className={`
              group flex items-center gap-3 rounded-2xl transition-all duration-200
              hover:bg-slate-100 dark:hover:bg-slate-800/40
              ${collapsed ? "p-2 justify-center" : "p-3"}
            `}
            title="Voir mon profil"
          >
            {/* Avatar */}
            <div className={`relative flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br ${roleGradient} flex items-center justify-center shadow-lg`}>
              <span className="text-sm font-bold text-slate-900 dark:text-white">{initials}</span>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-secondary-500 rounded-full border-2 border-white dark:border-[#0a0f1e]" />
            </div>

            {/* Name & role */}
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate group-hover:text-primary-300 transition-colors">
                  {user.prenom} {user.nom}
                </p>
                <p className={`text-xs font-medium bg-gradient-to-r ${roleGradient} bg-clip-text text-transparent`}>
                  {roleLabel}
                </p>
              </div>
            )}

            {/* Arrow */}
            {!collapsed && (
              <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-primary-400 transition-colors" />
            )}
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6 scrollbar-thin">
          {sections.map((section) => (
            <div key={section.id}>
              {!collapsed && (
                <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-600">
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
                        group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium
                        transition-all duration-200
                        ${
                          isActive
                            ? "bg-primary-500/10 text-primary-500 shadow-sm shadow-primary-500/5"
                            : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/40 hover:text-slate-900 dark:hover:text-white"
                        }
                        ${collapsed ? "justify-center" : ""}
                      `}
                    >
                      {/* Active indicator */}
                      {isActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full bg-gradient-to-b from-primary-400 to-cyan-400" />
                      )}
                      <span className={`flex-shrink-0 transition-colors ${isActive ? "text-primary-400" : "text-slate-500 group-hover:text-slate-900 dark:text-white"}`}>
                        <lien.icone className="w-5 h-5" />
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
        <div className="p-3 border-t border-slate-200 dark:border-slate-800/50 space-y-2">
          {!collapsed && <PWAInstallButton />}
          <button
            onClick={logout}
            title={collapsed ? "Se déconnecter" : undefined}
            className={`
              group flex items-center gap-3 w-full rounded-xl px-3 py-2.5 text-sm font-medium
              text-slate-500 dark:text-slate-400 hover:bg-emergency-500/10 hover:text-emergency-600 dark:hover:text-emergency-500
              transition-all duration-200
              ${collapsed ? "justify-center" : ""}
            `}
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span>Se déconnecter</span>}
          </button>
          
          <div className={`mt-2 ${collapsed ? "flex justify-center" : "flex items-center justify-between px-3"}`}>
            {!collapsed && <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Thème</span>}
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

  // Non connecté — le hook redirigera vers /auth/login
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
    <div className="min-h-screen bg-slate-50 dark:bg-[#030712] transition-colors duration-300">
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      {/* Main content */}
      <div
        className={`
          transition-all duration-300
          ${collapsed ? "lg:ml-[72px]" : "lg:ml-[280px]"}
        `}
      >
        {/* Top bar mobile */}
        <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between p-4 bg-white/80 dark:bg-[#030712]/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800/50">
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
        <main className="p-4 sm:p-6 lg:p-8">
          {pageNonDisponible ? <PageNonDisponible /> : children}
        </main>
      </div>
      <EmergencyButton />
      <EmergencyListener />
    </div>
    </NotificationsProvider>
    </ToastProvider>
  );
}
