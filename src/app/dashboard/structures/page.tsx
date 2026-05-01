"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  Building2,
  Plus,
  Search,
  RefreshCw,
  Mail,
  CheckCircle2,
  Clock,
  XCircle,
  Send,
  Power,
  AlertCircle,
  Loader2,
  X,
  ChevronDown,
  MapPin,
  Phone,
  Map as MapIcon,
  LayoutGrid,
  Trash2,
} from "lucide-react";
import {
  getStructures,
  createStructure,
  toggleStructureActive,
  resendStructureInvitation,
  Structure,
  StructureType,
  ApiError,
} from "@/lib/api_admin";
import { StructureModal } from "@/components/modals/StructureModal";
import { StructureDeleteModal } from "@/components/modals/StructureDeleteModal";
import GlobePicker from "@/components/GlobePicker";

// ─── Constants ──────────────────────────────────────────────────

const TYPE_LABELS: Record<StructureType, string> = {
  HOPITAL: "Hôpital",
  CLINIQUE: "Clinique",
  PHARMACIE: "Pharmacie",
};

const TYPE_COLORS: Record<StructureType, { bg: string; text: string; dot: string }> = {
  HOPITAL: { bg: "bg-blue-500/10", text: "text-blue-400", dot: "bg-blue-500" },
  CLINIQUE: { bg: "bg-purple-500/10", text: "text-purple-400", dot: "bg-purple-500" },
  PHARMACIE: { bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-500" },
};



// ─── Structures Page ─────────────────────────────────────────────

export default function StructuresPage() {
  const { user } = useAuth();
  const [structures, setStructures] = useState<Structure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"ALL" | StructureType>("ALL");
  const [filterStatus, setFilterStatus] = useState<"ALL" | "CONFIGURED" | "PENDING" | "INACTIVE">("ALL");
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [selectedStructure, setSelectedStructure] = useState<Structure | null>(null);
  const [structureToDelete, setStructureToDelete] = useState<Structure | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getStructures();
      setStructures(res.data);
    } catch {
      setError("Impossible de charger les structures.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleToggleActive = async (s: Structure) => {
    setActionLoading(s.id + "-toggle");
    try {
      await toggleStructureActive(s.id);
      showToast(`Structure ${s.isActive ? "désactivée" : "activée"} avec succès`);
      fetchData();
    } catch {
      showToast("Erreur lors de la modification", false);
    } finally {
      setActionLoading(null);
    }
  };

  const handleResend = async (s: Structure) => {
    setActionLoading(s.id + "-resend");
    try {
      await resendStructureInvitation(s.id);
      showToast(`Invitation renvoyée à ${s.email}`);
    } catch {
      showToast("Erreur lors de l'envoi", false);
    } finally {
      setActionLoading(null);
    }
  };

  // Filtered list
  const filtered = structures.filter((s) => {
    const matchSearch =
      s.nom.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase()) ||
      (s.ville ?? "").toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === "ALL" || s.type === filterType;
    const matchStatus =
      filterStatus === "ALL" ||
      (filterStatus === "CONFIGURED" && s.isConfigured && s.isActive) ||
      (filterStatus === "PENDING" && !s.isConfigured) ||
      (filterStatus === "INACTIVE" && !s.isActive);
    return matchSearch && matchType && matchStatus;
  });

  // Stats summary
  const stats = {
    total: structures.length,
    hopitaux: structures.filter((s) => s.type === "HOPITAL").length,
    cliniques: structures.filter((s) => s.type === "CLINIQUE").length,
    pharmacies: structures.filter((s) => s.type === "PHARMACIE").length,
    configured: structures.filter((s) => s.isConfigured).length,
    pending: structures.filter((s) => !s.isConfigured).length,
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">

      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl text-sm font-medium transition-all animate-slide-up ${
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
            Structures de santé
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Gérez hôpitaux, cliniques et pharmacies de la plateforme
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/50 rounded-xl p-1 mr-2">
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-lg transition-all ${viewMode === "list" ? "bg-primary-500 text-white shadow-lg" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
              title="Vue liste"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("map")}
              className={`p-1.5 rounded-lg transition-all ${viewMode === "map" ? "bg-primary-500 text-white shadow-lg" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
              title="Vue carte"
            >
              <MapIcon className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={() => fetchData()}
            className="p-2.5 rounded-xl text-slate-500 dark:text-slate-400 border border-slate-700/50 hover:text-slate-900 dark:text-white hover:bg-slate-800/50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="group relative flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-900 dark:text-white overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-primary-500/25"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-primary-600 to-cyan-500" />
            <span className="absolute inset-0 bg-gradient-to-r from-primary-500 to-secondary-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            <Plus className="relative w-4 h-4" />
            <span className="relative">Nouvelle structure</span>
          </button>
        </div>
      </div>

      {/* Mini Stats */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {[
          { label: "Total", value: stats.total, color: "text-slate-900 dark:text-white" },
          { label: "Hôpitaux", value: stats.hopitaux, color: "text-blue-400" },
          { label: "Cliniques", value: stats.cliniques, color: "text-cyan-400" },
          { label: "Pharmacies", value: stats.pharmacies, color: "text-emerald-400" },
          { label: "Configurées", value: stats.configured, color: "text-secondary-400" },
          { label: "En attente", value: stats.pending, color: "text-amber-400" },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-white dark:bg-[#0f172a]/60 border border-slate-200 dark:border-slate-800/50 rounded-xl p-3 text-center"
          >
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-slate-600 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Rechercher par nom, email, ville..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/50 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-500 focus:outline-none focus:border-primary-500/50 text-sm transition-all"
          />
        </div>

        <div className="flex gap-2">
          {(["ALL", "HOPITAL", "CLINIQUE", "PHARMACIE"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                filterType === t
                  ? "bg-primary-500/20 text-primary-300 border border-primary-500/30"
                  : "text-slate-500 border border-slate-200 dark:border-slate-800/50 hover:text-slate-600 dark:text-slate-300"
              }`}
            >
              {t === "ALL" ? "Tous" : TYPE_LABELS[t]}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          {(["ALL", "CONFIGURED", "PENDING", "INACTIVE"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                filterStatus === s
                  ? "bg-accent-500/20 text-accent-300 border border-accent-500/30"
                  : "text-slate-500 border border-slate-200 dark:border-slate-800/50 hover:text-slate-600 dark:text-slate-300"
              }`}
            >
              {s === "ALL" ? "Tout statut" : s === "CONFIGURED" ? "Actives" : s === "PENDING" ? "En attente" : "Inactives"}
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

      {/* Main Content */}
      {viewMode === "list" ? (
        <div className="bg-white dark:bg-[#0f172a]/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800/50 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 text-primary-400 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-600">
              <Building2 className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">Aucune structure trouvée</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800/50">
                    {["Structure", "Type", "Email", "Localisation", "Statut", "Actions"].map((h) => (
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
                  {filtered.map((s) => {
                    const typeStyle = TYPE_COLORS[s.type];
                    const isTogglingActive = actionLoading === s.id + "-toggle";
                    const isResending = actionLoading === s.id + "-resend";

                    return (
                      <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                        {/* Name */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${typeStyle.bg}`}
                            >
                              <Building2 className={`w-4 h-4 ${typeStyle.text}`} />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-900 dark:text-white">{s.nom}</p>
                              {s.admin && (
                                <p className="text-xs text-slate-600">
                                  Admin: {s.admin.prenom} {s.admin.nom}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Type */}
                        <td className="px-5 py-4">
                          <span className={`flex items-center gap-1.5 text-xs font-medium ${typeStyle.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${typeStyle.dot}`} />
                            {TYPE_LABELS[s.type]}
                          </span>
                        </td>

                        {/* Email */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1.5">
                            <Mail className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
                            <span className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[160px]">{s.email}</span>
                          </div>
                          {s.telephone && (
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <Phone className="w-3 h-3 text-slate-700 flex-shrink-0" />
                              <span className="text-xs text-slate-600">{s.telephone}</span>
                            </div>
                          )}
                        </td>

                        {/* Localisation */}
                        <td className="px-5 py-4">
                          {s.ville || s.adresse ? (
                            <div className="flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                {[s.ville, s.adresse].filter(Boolean).join(" · ")}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-700">—</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-5 py-4">
                          <div className="flex flex-col gap-1.5">
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full w-fit ${
                                s.isConfigured
                                  ? "bg-secondary-500/10 text-secondary-400"
                                  : "bg-amber-500/10 text-amber-400"
                              }`}
                            >
                              {s.isConfigured ? (
                                <CheckCircle2 className="w-3 h-3" />
                              ) : (
                                <Clock className="w-3 h-3" />
                              )}
                              {s.isConfigured ? "Configurée" : "En attente"}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full w-fit ${
                                s.isActive
                                  ? "bg-green-500/10 text-green-400"
                                  : "bg-slate-700/50 text-slate-500"
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${s.isActive ? "bg-green-500" : "bg-slate-600"}`}
                              />
                              {s.isActive ? "Active" : "Inactive"}
                            </span>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            {/* Resend invitation */}
                            {!s.isConfigured && (
                              <button
                                type="button"
                                onClick={() => handleResend(s)}
                                disabled={!!actionLoading}
                                title="Renvoyer l'invitation"
                                className="p-2 rounded-lg text-slate-500 hover:text-primary-400 hover:bg-primary-500/10 transition-all disabled:opacity-50"
                              >
                                {isResending ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Send className="w-4 h-4" />
                                )}
                              </button>
                            )}

                            {/* Toggle active */}
                            <button
                              type="button"
                              onClick={() => handleToggleActive(s)}
                              disabled={!!actionLoading}
                              title={s.isActive ? "Désactiver" : "Activer"}
                              className={`p-2 rounded-lg transition-all disabled:opacity-50 ${
                                s.isActive
                                  ? "text-slate-500 hover:text-emergency-400 hover:bg-emergency-500/10"
                                  : "text-slate-500 hover:text-secondary-400 hover:bg-secondary-500/10"
                              }`}
                            >
                              {isTogglingActive ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : s.isActive ? (
                                <XCircle className="w-4 h-4" />
                              ) : (
                                <Power className="w-4 h-4" />
                              )}
                            </button>

                            {/* Delete structure */}
                            <button
                              type="button"
                              onClick={() => setStructureToDelete(s)}
                              disabled={!!actionLoading}
                              title="Supprimer la structure"
                              className="p-2 rounded-lg text-slate-500 hover:text-emergency-500 hover:bg-emergency-500/10 transition-all disabled:opacity-50"
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

          {/* Footer count */}
          {!loading && filtered.length > 0 && (
            <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800/50 text-xs text-slate-600">
              {filtered.length} structure{filtered.length > 1 ? "s" : ""} affichée{filtered.length > 1 ? "s" : ""}
              {structures.length !== filtered.length && ` sur ${structures.length}`}
            </div>
          )}
        </div>
      ) : (
        <div className="relative h-[600px] rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800/50 shadow-2xl">
          <GlobePicker
            structures={filtered
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
          
          {/* Legend Overlay */}
          <div className="absolute left-6 bottom-6 space-y-2 pointer-events-none">
            <div className="p-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-slate-700/50 rounded-2xl flex flex-col gap-3 pointer-events-auto shadow-2xl">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Légende</p>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-xs text-slate-900 dark:text-slate-200 font-medium">
                  <div className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                  <span>Hôpitaux ({filtered.filter(s => s.type === "HOPITAL").length})</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-900 dark:text-slate-200 font-medium">
                  <div className="w-3 h-3 rounded-full bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]" />
                  <span>Cliniques ({filtered.filter(s => s.type === "CLINIQUE").length})</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-900 dark:text-slate-200 font-medium">
                  <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                  <span>Pharmacies ({filtered.filter(s => s.type === "PHARMACIE").length})</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <StructureModal
          mode="create"
          onClose={() => setShowCreateModal(false)}
          onSuccess={fetchData}
        />
      )}

      {/* View Modal */}
      {selectedStructure && (
        <StructureModal
          mode="view"
          structure={selectedStructure}
          onClose={() => setSelectedStructure(null)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {structureToDelete && (
        <StructureDeleteModal
          structure={structureToDelete}
          onClose={() => setStructureToDelete(null)}
          onDeleted={fetchData}
        />
      )}
    </div>
  );
}
