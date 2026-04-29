"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import {
  Heart,
  LayoutDashboard,
  Calendar,
  FileText,
  Pill,
  MapPin,
  Stethoscope,
  Building2,
  Users,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  User,
  ShieldCheck,
  ClipboardList,
  Package,
  Activity,
  Bot,
  Loader2,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

// ─── Navigation par rôle ────────────────────────────────────────

function getNavSections(role: string): NavSection[] {
  const common: NavSection = {
    title: "Général",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: <LayoutDashboard className="w-5 h-5" /> },
    ],
  };

  switch (role) {
    case "PATIENT":
      return [
        common,
        {
          title: "Mon Carnet",
          items: [
            { label: "Carnet de Santé", href: "/dashboard/carnet", icon: <FileText className="w-5 h-5" /> },
            { label: "Consultations", href: "/dashboard/consultations", icon: <Stethoscope className="w-5 h-5" /> },
            { label: "Ordonnances", href: "/dashboard/ordonnances", icon: <ClipboardList className="w-5 h-5" /> },
            { label: "Vaccinations", href: "/dashboard/vaccinations", icon: <Activity className="w-5 h-5" /> },
          ],
        },
        {
          title: "Services",
          items: [
            { label: "Auto-Diagnostic IA", href: "/dashboard/diagnostic", icon: <Bot className="w-5 h-5" /> },
            { label: "Trouver un Médecin", href: "/dashboard/map", icon: <MapPin className="w-5 h-5" /> },
            { label: "Pharmacies", href: "/dashboard/pharmacies", icon: <Pill className="w-5 h-5" /> },
            { label: "Rendez-vous", href: "/dashboard/rendez-vous", icon: <Calendar className="w-5 h-5" /> },
          ],
        },
      ];

    case "MEDECIN":
      return [
        common,
        {
          title: "Pratique",
          items: [
            { label: "Mes Patients", href: "/dashboard/patients", icon: <Users className="w-5 h-5" /> },
            { label: "Consultations", href: "/dashboard/consultations", icon: <Stethoscope className="w-5 h-5" /> },
            { label: "Ordonnances", href: "/dashboard/ordonnances", icon: <ClipboardList className="w-5 h-5" /> },
            { label: "Rendez-vous", href: "/dashboard/rendez-vous", icon: <Calendar className="w-5 h-5" /> },
          ],
        },
        {
          title: "Structure",
          items: [
            { label: "Ma Structure", href: "/dashboard/structure", icon: <Building2 className="w-5 h-5" /> },
          ],
        },
      ];

    case "PHARMACIEN":
      return [
        common,
        {
          title: "Pharmacie",
          items: [
            { label: "Stock Médicaments", href: "/dashboard/stock", icon: <Package className="w-5 h-5" /> },
            { label: "Ordonnances", href: "/dashboard/ordonnances", icon: <ClipboardList className="w-5 h-5" /> },
            { label: "Recherche Médicaments", href: "/dashboard/medicaments", icon: <Pill className="w-5 h-5" /> },
          ],
        },
        {
          title: "Structure",
          items: [
            { label: "Ma Pharmacie", href: "/dashboard/structure", icon: <Building2 className="w-5 h-5" /> },
          ],
        },
      ];

    case "STRUCTURE_ADMIN":
      return [
        common,
        {
          title: "Gestion",
          items: [
            { label: "Ma Structure", href: "/dashboard/structure", icon: <Building2 className="w-5 h-5" /> },
            { label: "Membres", href: "/dashboard/membres", icon: <Users className="w-5 h-5" /> },
            { label: "Statistiques", href: "/dashboard/stats", icon: <Activity className="w-5 h-5" /> },
          ],
        },
      ];

    case "ADMIN":
    case "SUPER_ADMIN":
      return [
        common,
        {
          title: "Administration",
          items: [
            { label: "Utilisateurs", href: "/dashboard/utilisateurs", icon: <Users className="w-5 h-5" /> },
            { label: "Structures", href: "/dashboard/structures", icon: <Building2 className="w-5 h-5" /> },
            { label: "Statistiques", href: "/dashboard/stats", icon: <Activity className="w-5 h-5" /> },
          ],
        },
        ...(role === "SUPER_ADMIN"
          ? [
              {
                title: "Super Admin",
                items: [
                  { label: "Configuration", href: "/dashboard/config", icon: <Settings className="w-5 h-5" /> },
                  { label: "Sécurité", href: "/dashboard/securite", icon: <ShieldCheck className="w-5 h-5" /> },
                ],
              },
            ]
          : []),
      ];

    default:
      return [common];
  }
}

function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    PATIENT: "Patient",
    MEDECIN: "Médecin",
    PHARMACIEN: "Pharmacien",
    STRUCTURE_ADMIN: "Admin Structure",
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
  const { user, logout } = useAuth();
  const pathname = usePathname();

  if (!user) return null;

  const sections = getNavSections(user.role);
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
          bg-[#0a0f1e]/95 backdrop-blur-2xl border-r border-slate-800/50
          transition-all duration-300 ease-in-out
          ${collapsed ? "w-[72px]" : "w-[280px]"}
          ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        {/* Header */}
        <div className={`flex items-center ${collapsed ? "justify-center" : "justify-between"} p-4 border-b border-slate-800/50`}>
          {!collapsed && (
            <Link href="/" className="inline-flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-primary-500/25">
                <Heart className="w-4.5 h-4.5 text-white fill-white" />
              </div>
              <span
                className="text-lg font-bold tracking-tight"
                style={{ fontFamily: "var(--font-outfit, var(--font-inter))" }}
              >
                <span className="text-white">Med</span>
                <span className="gradient-text">Connect</span>
              </span>
            </Link>
          )}
          {collapsed && (
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-primary-500/25">
              <Heart className="w-4.5 h-4.5 text-white fill-white" />
            </div>
          )}

          {/* Close button mobile */}
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Collapse button desktop */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800/50 transition-colors"
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* User card */}
        <div className={`p-4 border-b border-slate-800/50 ${collapsed ? "flex justify-center" : ""}`}>
          <Link
            href="/dashboard/profil"
            className={`
              group flex items-center gap-3 rounded-2xl transition-all duration-200
              hover:bg-slate-800/40
              ${collapsed ? "p-2 justify-center" : "p-3"}
            `}
            title="Voir mon profil"
          >
            {/* Avatar */}
            <div className={`relative flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br ${roleGradient} flex items-center justify-center shadow-lg`}>
              <span className="text-sm font-bold text-white">{initials}</span>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-secondary-500 rounded-full border-2 border-[#0a0f1e]" />
            </div>

            {/* Name & role */}
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate group-hover:text-primary-300 transition-colors">
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
            <div key={section.title}>
              {!collapsed && (
                <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                  {section.title}
                </p>
              )}
              <div className="space-y-1">
                {section.items.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      title={collapsed ? item.label : undefined}
                      className={`
                        group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium
                        transition-all duration-200
                        ${
                          isActive
                            ? "bg-primary-500/10 text-primary-400 shadow-sm shadow-primary-500/5"
                            : "text-slate-400 hover:bg-slate-800/40 hover:text-white"
                        }
                        ${collapsed ? "justify-center" : ""}
                      `}
                    >
                      {/* Active indicator */}
                      {isActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full bg-gradient-to-b from-primary-400 to-cyan-400" />
                      )}
                      <span className={`flex-shrink-0 transition-colors ${isActive ? "text-primary-400" : "text-slate-500 group-hover:text-white"}`}>
                        {item.icon}
                      </span>
                      {!collapsed && <span>{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-slate-800/50">
          <button
            onClick={logout}
            title={collapsed ? "Se déconnecter" : undefined}
            className={`
              group flex items-center gap-3 w-full rounded-xl px-3 py-2.5 text-sm font-medium
              text-slate-400 hover:bg-emergency-500/10 hover:text-emergency-500
              transition-all duration-200
              ${collapsed ? "justify-center" : ""}
            `}
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span>Se déconnecter</span>}
          </button>
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
  const { user, loading } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen gradient-hero flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500 to-cyan-500 flex items-center justify-center animate-pulse-glow">
            <Heart className="w-6 h-6 text-white fill-white" />
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Chargement...</span>
          </div>
        </div>
      </div>
    );
  }

  // Non connecté — le hook redirigera vers /auth/login
  if (!user) {
    return (
      <div className="min-h-screen gradient-hero flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-6 h-6 text-primary-400 animate-spin" />
          <p className="text-sm text-slate-400">Redirection...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#030712]">
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
        <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between p-4 bg-[#030712]/80 backdrop-blur-xl border-b border-slate-800/50">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-cyan-500 flex items-center justify-center">
              <Heart className="w-4 h-4 text-white fill-white" />
            </div>
            <span
              className="text-base font-bold"
              style={{ fontFamily: "var(--font-outfit, var(--font-inter))" }}
            >
              <span className="text-white">Med</span>
              <span className="gradient-text">Connect</span>
            </span>
          </Link>
          <div className="w-9" /> {/* Spacer */}
        </header>

        {/* Page content */}
        <main className="p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
