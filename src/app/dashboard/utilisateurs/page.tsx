"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  Users, Plus, Search, RefreshCw, CheckCircle2, XCircle, Trash2,
  AlertCircle, Loader2, X, ChevronDown, Shield, Power, ShieldCheck,
} from "lucide-react";
import {
  getUsers, getUserStats, createUser, toggleUserActive, deleteUser,
  AdminUser, UserStats, ApiError,
} from "@/lib/api_admin";
import { UserModal } from "@/components/modals/UserModal";
import { DeleteConfirmModal } from "@/components/modals/DeleteConfirmModal";

// ─── Constants ──────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  PATIENT: "Patient",
  MEDECIN: "Médecin",
  PHARMACIEN: "Pharmacien",
  STRUCTURE_ADMIN: "Admin Structure",
  ADMIN: "Administrateur",
  SUPER_ADMIN: "Super Admin",
};

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  PATIENT: { bg: "bg-blue-500/10", text: "text-blue-400" },
  MEDECIN: { bg: "bg-cyan-500/10", text: "text-cyan-400" },
  PHARMACIEN: { bg: "bg-emerald-500/10", text: "text-emerald-400" },
  STRUCTURE_ADMIN: { bg: "bg-amber-500/10", text: "text-amber-400" },
  ADMIN: { bg: "bg-violet-500/10", text: "text-violet-400" },
  SUPER_ADMIN: { bg: "bg-emergency-500/10", text: "text-emergency-400" },
};

// Roles that admin can create (not SUPER_ADMIN)
const CREATABLE_ROLES = ["PATIENT", "MEDECIN", "PHARMACIEN", "ADMIN"];



// ─── Utilisateurs Page ───────────────────────────────────────────

export default function UtilisateursPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSuperAdminModal, setShowSuperAdminModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [usersRes, statsRes] = await Promise.all([getUsers(), getUserStats()]);
      setUsers(usersRes.data);
      setUserStats(statsRes.data);
    } catch {
      setError("Impossible de charger les utilisateurs.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleToggle = async (u: AdminUser) => {
    setActionLoading(u.id + "-toggle");
    try {
      await toggleUserActive(u.id);
      showToast(`Compte ${u.isActive ? "désactivé" : "activé"} avec succès`);
      fetchData();
    } catch {
      showToast("Erreur lors de la modification", false);
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    const matchSearch =
      u.nom.toLowerCase().includes(q) ||
      u.prenom.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q);
    const matchRole = filterRole === "ALL" || u.role === filterRole;
    const matchStatus =
      filterStatus === "ALL" ||
      (filterStatus === "ACTIVE" && u.isActive) ||
      (filterStatus === "INACTIVE" && !u.isActive);
    return matchSearch && matchRole && matchStatus;
  });

  const allRoles = ["ALL", "PATIENT", "MEDECIN", "PHARMACIEN", "STRUCTURE_ADMIN", "ADMIN"];

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">

      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl text-sm font-medium animate-slide-up ${
            toast.ok
              ? "bg-secondary-500/20 border border-secondary-500/30 text-secondary-300"
              : "bg-emergency-500/20 border border-emergency-500/30 text-emergency-300"
          }`}
        >
          {toast.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1
            className="text-2xl font-extrabold text-slate-900 dark:text-white"
            style={{ fontFamily: "var(--font-outfit, var(--font-inter))" }}
          >
            Utilisateurs
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {userStats?.total ?? "—"} comptes inscrits sur la plateforme
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchData} className="p-2.5 rounded-xl text-slate-500 dark:text-slate-400 border border-slate-700/50 hover:text-slate-900 dark:text-white hover:bg-slate-800/50 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
          {isSuperAdmin && (
            <button
              onClick={() => setShowSuperAdminModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-emergency-300 border border-emergency-500/30 bg-emergency-500/10 hover:bg-emergency-500/20 transition-all"
            >
              <ShieldCheck className="w-4 h-4" />
              Créer Super Admin
            </button>
          )}
          {!isSuperAdmin && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="group relative flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-900 dark:text-white overflow-hidden transition-all hover:shadow-lg hover:shadow-primary-500/25"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-primary-600 to-cyan-500" />
              <span className="absolute inset-0 bg-gradient-to-r from-primary-500 to-secondary-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              <Plus className="relative w-4 h-4" />
              <span className="relative">Nouvel utilisateur</span>
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      {userStats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total", value: userStats.total, color: "text-slate-900 dark:text-white" },
            { label: "Actifs", value: userStats.actifs, color: "text-secondary-400" },
            { label: "Inactifs", value: userStats.inactifs, color: "text-emergency-400" },
            {
              label: "Patients",
              value: userStats.parRole.find((r) => r.role === "PATIENT")?._count ?? 0,
              color: "text-primary-400",
            },
          ].map((s) => (
            <div
              key={s.label}
              className="bg-white dark:bg-[#0f172a]/60 border border-slate-200 dark:border-slate-800/50 rounded-xl p-3.5"
            >
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-slate-600 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Rechercher par nom, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/50 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-500 focus:outline-none focus:border-primary-500/50 text-sm transition-all"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {allRoles.map((r) => (
            <button
              key={r}
              onClick={() => setFilterRole(r)}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                filterRole === r
                  ? "bg-primary-500/20 text-primary-300 border border-primary-500/30"
                  : "text-slate-500 border border-slate-200 dark:border-slate-800/50 hover:text-slate-600 dark:text-slate-300"
              }`}
            >
              {r === "ALL" ? "Tous" : ROLE_LABELS[r]}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {(["ALL", "ACTIVE", "INACTIVE"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                filterStatus === s
                  ? "bg-accent-500/20 text-accent-300 border border-accent-500/30"
                  : "text-slate-500 border border-slate-200 dark:border-slate-800/50 hover:text-slate-600 dark:text-slate-300"
              }`}
            >
              {s === "ALL" ? "Tout" : s === "ACTIVE" ? "Actifs" : "Inactifs"}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-emergency-500/10 border border-emergency-500/20 text-emergency-400 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-[#0f172a]/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800/50 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-primary-400 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-600">
            <Users className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm">Aucun utilisateur trouvé</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800/50">
                  {["Utilisateur", "Email", "Rôle", "Structure", "Statut", "Inscrit le", "Actions"].map((h) => (
                    <th
                      key={h}
                      className="px-5 py-4 text-left text-[10px] font-bold uppercase tracking-wider text-slate-600"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/30">
                {filtered.map((u) => {
                  const roleStyle = ROLE_COLORS[u.role] ?? { bg: "bg-slate-800/50", text: "text-slate-500 dark:text-slate-400" };
                  const initials = `${u.prenom[0] ?? ""}${u.nom[0] ?? ""}`.toUpperCase();
                  const isToggling = actionLoading === u.id + "-toggle";

                  return (
                    <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                      {/* Name */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl ${roleStyle.bg} flex items-center justify-center flex-shrink-0`}>
                            <span className={`text-xs font-bold ${roleStyle.text}`}>{initials}</span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-900 dark:text-white">
                              {u.prenom} {u.nom}
                            </p>
                            {u.telephone && (
                              <p className="text-xs text-slate-600">{u.telephone}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="px-5 py-4">
                        <span className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[180px] block">{u.email}</span>
                      </td>

                      {/* Role */}
                      <td className="px-5 py-4">
                        <span className={`flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-lg w-fit ${roleStyle.bg} ${roleStyle.text}`}>
                          <Shield className="w-3 h-3" />
                          {ROLE_LABELS[u.role] ?? u.role}
                        </span>
                      </td>

                      {/* Structure */}
                      <td className="px-5 py-4">
                        {u.structure ? (
                          <span className="text-xs text-slate-500 dark:text-slate-400">{u.structure.nom}</span>
                        ) : (
                          <span className="text-xs text-slate-700">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full ${
                            u.isActive
                              ? "bg-secondary-500/10 text-secondary-400"
                              : "bg-slate-700/50 text-slate-500"
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${u.isActive ? "bg-secondary-500" : "bg-slate-600"}`} />
                          {u.isActive ? "Actif" : "Inactif"}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="px-5 py-4">
                        <span className="text-xs text-slate-600">
                          {new Date(u.createdAt).toLocaleDateString("fr-FR")}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          {/* Toggle */}
                          <button
                            onClick={() => handleToggle(u)}
                            disabled={!!actionLoading || (u.role === "SUPER_ADMIN" && u.id === user?.id)}
                            title={u.isActive ? "Désactiver" : "Activer"}
                            className={`p-2 rounded-lg transition-all disabled:opacity-30 ${
                              u.isActive
                                ? "text-slate-500 hover:text-emergency-400 hover:bg-emergency-500/10"
                                : "text-slate-500 hover:text-secondary-400 hover:bg-secondary-500/10"
                            }`}
                          >
                            {isToggling ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : u.isActive ? (
                              <XCircle className="w-4 h-4" />
                            ) : (
                              <Power className="w-4 h-4" />
                            )}
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => setDeleteTarget(u)}
                            disabled={u.role === "SUPER_ADMIN" && u.id === user?.id}
                            title="Supprimer"
                            className="p-2 rounded-lg text-slate-500 hover:text-emergency-400 hover:bg-emergency-500/10 transition-all disabled:opacity-30"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800/50 text-xs text-slate-600">
            {filtered.length} utilisateur{filtered.length > 1 ? "s" : ""} affiché{filtered.length > 1 ? "s" : ""}
            {users.length !== filtered.length && ` sur ${users.length}`}
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreateModal && (
        <UserModal mode="create_admin_user" onClose={() => setShowCreateModal(false)} onSuccess={fetchData} />
      )}
      {showSuperAdminModal && (
        <UserModal mode="create_super_admin" onClose={() => setShowSuperAdminModal(false)} onSuccess={fetchData} />
      )}
      {deleteTarget && (
        <DeleteConfirmModal user={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={fetchData} />
      )}
    </div>
  );
}
