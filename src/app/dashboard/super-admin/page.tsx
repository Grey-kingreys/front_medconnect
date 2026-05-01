"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import Link from "next/link";
import {
  Users,
  Building2,
  Activity,
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertCircle,
  Hospital,
  Plus,
  ArrowRight,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { DonutChart } from "@/components/charts/DonutChart";
import { BarChart } from "@/components/charts/BarChart";
import { StatCard } from "@/components/charts/StatCard";
import {
  getGlobalStats,
  getUserStats,
  getStructures,
  GlobalStats,
  UserStats,
  Structure,
} from "@/lib/api_admin";
import GlobePicker from "@/components/GlobePicker";
import { StructureModal } from "@/components/modals/StructureModal";

// ─── Color palette ──────────────────────────────────────────────
const STRUCTURE_COLORS: Record<string, string> = {
  HOPITAL: "#3b82f6",
  CLINIQUE: "#06b6d4",
  PHARMACIE: "#10b981",
};

const ROLE_COLORS: Record<string, string> = {
  PATIENT: "#3b82f6",
  MEDECIN: "#06b6d4",
  PHARMACIEN: "#10b981",
  STRUCTURE_ADMIN: "#f59e0b",
  ADMIN: "#8b5cf6",
  SUPER_ADMIN: "#ef4444",
};

const ROLE_LABELS: Record<string, string> = {
  PATIENT: "Patients",
  MEDECIN: "Médecins",
  PHARMACIEN: "Pharmaciens",
  STRUCTURE_ADMIN: "Admins Structure",
  ADMIN: "Administrateurs",
  SUPER_ADMIN: "Super Admins",
};

// ─── Super Admin Dashboard ───────────────────────────────────────

export default function SuperAdminDashboard() {
  const { user } = useAuth();
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [structures, setStructures] = useState<Structure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStructure, setSelectedStructure] = useState<Structure | null>(null);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError("");

    try {
      const [statsRes, userStatsRes, structuresRes] = await Promise.all([
        getGlobalStats(),
        getUserStats(),
        getStructures(),
      ]);
      setGlobalStats(statsRes.data);
      setUserStats(userStatsRes.data);
      setStructures(structuresRes.data);
    } catch {
      setError("Impossible de charger les données. Vérifiez votre connexion.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";

  // ── Donut data : structures par type ────────────────────────────
  const structureDonutData = globalStats
    ? ["HOPITAL", "CLINIQUE", "PHARMACIE"].map((type) => ({
        label: type === "HOPITAL" ? "Hôpitaux" : type === "CLINIQUE" ? "Cliniques" : "Pharmacies",
        value: globalStats.parType.find((p) => p.type === type as any)?._count ?? 0,
        color: STRUCTURE_COLORS[type],
      }))
    : [];

  // ── Bar data : utilisateurs par rôle ────────────────────────────
  const userBarData = userStats
    ? userStats.parRole
        .filter((r) => r.role !== "SUPER_ADMIN")
        .map((r) => ({
          label: ROLE_LABELS[r.role] ?? r.role,
          value: r._count,
          color: ROLE_COLORS[r.role] ?? "#64748b",
        }))
    : [];

  // ── Recent structures (last 5) ───────────────────────────────────
  const recentStructures = structures.slice(0, 5);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
            <p className="text-sm text-slate-500 dark:text-slate-400">Chargement des statistiques...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-slate-100 dark:bg-gradient-to-br dark:from-[#0f172a] dark:via-[#1e1b4b] dark:to-[#0f172a] border border-slate-200 dark:border-slate-800/50 p-6 sm:p-8">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-80 h-80 bg-primary-500/8 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent-500/6 rounded-full blur-3xl" />
        </div>

        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-emergency-500/10 border border-emergency-500/20 text-emergency-400">
                <ShieldCheck className="w-3 h-3" />
                Super Administrateur
              </span>
            </div>
            <h1
              className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mb-2"
              style={{ fontFamily: "var(--font-outfit, var(--font-inter))" }}
            >
              {greeting},{" "}
              <span className="gradient-text">{user?.prenom} {user?.nom}</span>
              <span className="inline-block ml-2 text-amber-400">
                <Sparkles className="w-5 h-5 animate-pulse" />
              </span>
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xl">
              Vue d&apos;ensemble de la plateforme MedConnect — statistiques globales et gestion des structures.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-500 dark:text-slate-400 border border-slate-700/50 hover:border-slate-600 hover:text-slate-900 dark:text-white transition-all duration-200 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
              Actualiser
            </button>
            <Link
              href="/dashboard/structures"
              className="group relative flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-900 dark:text-white overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-primary-500/25"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-primary-600 to-cyan-500" />
              <span className="absolute inset-0 bg-gradient-to-r from-primary-500 to-secondary-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <Plus className="relative w-4 h-4" />
              <span className="relative">Nouvelle structure</span>
            </Link>
          </div>
        </div>

        {/* Date */}
        <div className="relative mt-4 flex items-center gap-2 text-xs text-slate-600">
          <Clock className="w-3.5 h-3.5" />
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

      {/* ── Error ──────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-emergency-500/10 border border-emergency-500/20 text-emergency-400 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
          <button
            onClick={() => fetchData()}
            className="ml-auto text-xs underline hover:no-underline"
          >
            Réessayer
          </button>
        </div>
      )}

      {/* ── Stat Cards ─────────────────────────────────────────── */}
      <section>
        <h2
          className="text-lg font-semibold text-slate-900 dark:text-white mb-4"
          style={{ fontFamily: "var(--font-outfit, var(--font-inter))" }}
        >
          Vue d&apos;ensemble
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Utilisateurs total"
            value={globalStats?.totalUsers ?? "—"}
            icon={<Users className="w-5 h-5" />}
            iconColor="text-primary-400"
            iconBg="bg-primary-500/10"
            accentColor="#3b82f6"
            gradient
          />
          <StatCard
            label="Structures enregistrées"
            value={globalStats?.totalStructures ?? "—"}
            icon={<Building2 className="w-5 h-5" />}
            iconColor="text-cyan-400"
            iconBg="bg-cyan-500/10"
            accentColor="#06b6d4"
            gradient
          />
          <StatCard
            label="Structures configurées"
            value={globalStats?.structuresConfigurees ?? "—"}
            icon={<CheckCircle2 className="w-5 h-5" />}
            iconColor="text-secondary-400"
            iconBg="bg-secondary-500/10"
            sublabel="Espace activé"
            accentColor="#10b981"
            gradient
          />
          <StatCard
            label="En attente de config."
            value={globalStats?.structuresEnAttente ?? "—"}
            icon={<Clock className="w-5 h-5" />}
            iconColor="text-amber-400"
            iconBg="bg-amber-500/10"
            sublabel="Invitation envoyée"
            accentColor="#f59e0b"
            gradient
          />
        </div>
      </section>

      {/* ── Global Coverage Map ──────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2
            className="text-lg font-semibold text-slate-900 dark:text-white"
            style={{ fontFamily: "var(--font-outfit, var(--font-inter))" }}
          >
            Couverture Globale
          </h2>
          <div className="hidden sm:flex items-center gap-4 text-[10px] uppercase tracking-widest font-bold text-slate-500">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span>Hôpitaux</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-purple-500" />
              <span>Cliniques</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Pharmacies</span>
            </div>
          </div>
        </div>
        <div className="relative h-[400px] rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800/50 shadow-2xl group">
          <GlobePicker
            structures={structures
              .filter(s => s.latitude != null && s.longitude != null)
              .map(s => ({
                id: s.id,
                lat: s.latitude!,
                lng: s.longitude!,
                label: s.nom,
                type: s.type
              }))}
            onStructureClick={(id) => {
              const s = structures.find(x => x.id === id);
              if (s) setSelectedStructure(s);
            }}
            className="w-full h-full rounded-none"
          />
          
          {/* Stats Overlay */}
          <div className="absolute right-6 bottom-6 flex flex-col gap-2 pointer-events-none">
            <div className="p-4 bg-slate-900/80 backdrop-blur-md border border-slate-700/50 rounded-2xl pointer-events-auto">
              <p className="text-[10px] text-slate-500 font-bold uppercase mb-2">Géolocalisés</p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-white">
                  {structures.filter(s => s.latitude && s.longitude).length}
                </span>
                <span className="text-xs text-slate-400">sites</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Charts ─────────────────────────────────────────────── */}
      <section>
        <h2
          className="text-lg font-semibold text-slate-900 dark:text-white mb-4"
          style={{ fontFamily: "var(--font-outfit, var(--font-inter))" }}
        >
          Répartition
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Donut : structures par type */}
          <div className="bg-white dark:bg-[#0f172a]/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800/50 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">Structures par type</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {globalStats?.totalStructures ?? 0} structures au total
                </p>
              </div>
              <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
                <Building2 className="w-5 h-5" />
              </div>
            </div>
            <DonutChart
              data={structureDonutData}
              centerLabel={String(globalStats?.totalStructures ?? 0)}
              centerSub="Structures"
              size={160}
              thickness={28}
            />
          </div>

          {/* Bar : utilisateurs par rôle */}
          <div className="bg-white dark:bg-[#0f172a]/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800/50 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">Utilisateurs par rôle</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {userStats?.total ?? 0} comptes inscrits
                </p>
              </div>
              <div className="p-2 rounded-xl bg-primary-500/10 text-primary-400">
                <Users className="w-5 h-5" />
              </div>
            </div>
            {userBarData.length > 0 ? (
              <BarChart data={userBarData} />
            ) : (
              <div className="flex items-center justify-center h-32 text-slate-600 text-sm">
                Aucune donnée
              </div>
            )}

            {/* Actifs / Inactifs */}
            {userStats && (
              <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800/50 grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-secondary-500/5 border border-secondary-500/10">
                  <p className="text-xl font-bold text-secondary-400">{userStats.actifs}</p>
                  <p className="text-xs text-slate-600">Comptes actifs</p>
                </div>
                <div className="p-3 rounded-xl bg-emergency-500/5 border border-emergency-500/10">
                  <p className="text-xl font-bold text-emergency-500">{userStats.inactifs}</p>
                  <p className="text-xs text-slate-600">Comptes inactifs</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Recent Structures + Quick Actions ─────────────────── */}
      <section>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Recent Structures (2/3) */}
          <div className="lg:col-span-2 bg-white dark:bg-[#0f172a]/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800/50 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800/50">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">Structures récentes</h3>
                <p className="text-xs text-slate-500 mt-0.5">5 dernières enregistrées</p>
              </div>
              <Link
                href="/dashboard/structures"
                className="flex items-center gap-1.5 text-xs font-medium text-primary-400 hover:text-primary-300 transition-colors"
              >
                Voir tout <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="divide-y divide-slate-800/50">
              {recentStructures.length === 0 ? (
                <div className="p-8 text-center text-slate-600 text-sm">
                  Aucune structure enregistrée
                </div>
              ) : (
                recentStructures.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{
                          backgroundColor: `${STRUCTURE_COLORS[s.type]}15`,
                          color: STRUCTURE_COLORS[s.type],
                        }}
                      >
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{s.nom}</p>
                        <p className="text-xs text-slate-500">
                          {s.type} {s.ville ? `· ${s.ville}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span
                        className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                          s.isConfigured
                            ? "bg-secondary-500/10 text-secondary-400"
                            : "bg-amber-500/10 text-amber-400"
                        }`}
                      >
                        {s.isConfigured ? "Configurée" : "En attente"}
                      </span>
                      <span
                        className={`w-2 h-2 rounded-full ${
                          s.isActive ? "bg-secondary-500" : "bg-slate-600"
                        }`}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick Actions (1/3) */}
          <div className="bg-white dark:bg-[#0f172a]/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800/50 rounded-2xl p-6">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">Actions rapides</h3>
            <div className="space-y-3">
              {[
                {
                  href: "/dashboard/structures",
                  icon: <Building2 className="w-5 h-5" />,
                  label: "Gérer les structures",
                  desc: "Créer, activer, inviter",
                  color: "from-primary-500/10 to-cyan-500/10",
                  border: "border-primary-500/20",
                  iconColor: "text-primary-400",
                },
                {
                  href: "/dashboard/utilisateurs",
                  icon: <Users className="w-5 h-5" />,
                  label: "Gérer les utilisateurs",
                  desc: "Comptes, rôles, accès",
                  color: "from-secondary-500/10 to-cyan-500/10",
                  border: "border-secondary-500/20",
                  iconColor: "text-secondary-400",
                },
                {
                  href: "/dashboard/securite",
                  icon: <ShieldCheck className="w-5 h-5" />,
                  label: "Sécurité",
                  desc: "Configuration avancée",
                  color: "from-emergency-500/10 to-accent-500/10",
                  border: "border-emergency-500/20",
                  iconColor: "text-emergency-400",
                },
              ].map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className={`group flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r ${action.color} border ${action.border} hover:border-opacity-40 transition-all duration-200`}
                >
                  <span className={`${action.iconColor} flex-shrink-0`}>{action.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{action.label}</p>
                    <p className="text-xs text-slate-500">{action.desc}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-slate-500 dark:text-slate-400 transition-colors" />
                </Link>
              ))}
            </div>

            {/* Activity indicator */}
            <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800/50">
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <Activity className="w-3.5 h-3.5 text-secondary-500" />
                <span>Plateforme opérationnelle</span>
                <span className="ml-auto w-2 h-2 rounded-full bg-secondary-500 animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* View Modal */}
      {selectedStructure && (
        <StructureModal
          mode="view"
          structure={selectedStructure}
          onClose={() => setSelectedStructure(null)}
        />
      )}
    </div>
  );
}
