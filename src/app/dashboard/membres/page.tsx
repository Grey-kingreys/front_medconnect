"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  Users, Plus, Search, RefreshCw, CheckCircle2, XCircle,
  Power, AlertCircle, Loader2, X, ChevronDown, Stethoscope, Pill, Mail, Phone, Trash2,
} from "lucide-react";
import { getMembres, createMembre, toggleMembreActive, Membre, MembreRole, ApiError } from "@/lib/api_structure";
import { UserModal } from "@/components/modals/UserModal";
import { MemberDeleteModal } from "@/components/modals/MemberDeleteModal";

const ROLE_CONFIG: Record<MembreRole, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  MEDECIN: { label: "Médecin", color: "text-blue-400", bg: "bg-blue-500/10", icon: <Stethoscope className="w-4 h-4" /> },
  PHARMACIEN: { label: "Pharmacien", color: "text-emerald-400", bg: "bg-emerald-500/10", icon: <Pill className="w-4 h-4" /> },
  STRUCTURE_ADMIN: { label: "Admin Structure", color: "text-amber-400", bg: "bg-amber-500/10", icon: <Users className="w-4 h-4" /> },
};



export default function MembresPage() {
  const { user, profile } = useAuth();
  const structureId = profile?.structureId ?? user?.structureId ?? "";
  const structureType = profile?.structure?.type ?? "";

  const [membres, setMembres] = useState<Membre[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<"ALL" | MembreRole>("ALL");
  const [filterStatus, setFilterStatus] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [showCreate, setShowCreate] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<Membre | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = useCallback(async () => {
    if (!structureId) return;
    setLoading(true); setError("");
    try { setMembres((await getMembres(structureId)).data); }
    catch { setError("Impossible de charger l'équipe."); }
    finally { setLoading(false); }
  }, [structureId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleToggle = async (m: Membre) => {
    setActionLoading(m.id);
    try {
      await toggleMembreActive(structureId, m.id);
      showToast(`${m.prenom} ${m.nom} ${m.isActive ? "désactivé" : "activé"}`);
      fetchData();
    } catch { showToast("Erreur lors de la modification", false); }
    finally { setActionLoading(null); }
  };

  const filtered = membres.filter(m => {
    const q = search.toLowerCase();
    return (
      (m.nom.toLowerCase().includes(q) || m.prenom.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)) &&
      (filterRole === "ALL" || m.role === filterRole) &&
      (filterStatus === "ALL" || (filterStatus === "ACTIVE" ? m.isActive : !m.isActive))
    );
  });

  const stats = {
    total: membres.length,
    medecins: membres.filter(m => m.role === "MEDECIN").length,
    pharmaciens: membres.filter(m => m.role === "PHARMACIEN").length,
    actifs: membres.filter(m => m.isActive).length,
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      {toast && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl text-sm font-medium animate-slide-up ${toast.ok ? "bg-secondary-500/20 border border-secondary-500/30 text-secondary-300" : "bg-emergency-500/20 border border-emergency-500/30 text-emergency-300"}`}>
          {toast.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}{toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white" style={{ fontFamily: "var(--font-outfit, var(--font-inter))" }}>Équipe médicale</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{stats.total} membre{stats.total > 1 ? "s" : ""} dans votre structure</p>
        </div>
        <div className="flex gap-3">
          <button onClick={fetchData} className="p-2.5 rounded-xl text-slate-500 dark:text-slate-400 border border-slate-700/50 hover:text-slate-900 dark:text-white hover:bg-slate-800/50"><RefreshCw className="w-4 h-4" /></button>
          {user?.role === "STRUCTURE_ADMIN" && (
            <button onClick={() => setShowCreate(true)} className="group relative flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-900 dark:text-white overflow-hidden hover:shadow-lg hover:shadow-primary-500/25">
              <span className="absolute inset-0 bg-gradient-to-r from-primary-600 to-cyan-500" />
              <span className="absolute inset-0 bg-gradient-to-r from-primary-500 to-secondary-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              <Plus className="relative w-4 h-4" /><span className="relative">Ajouter un membre</span>
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total", value: stats.total, color: "text-slate-900 dark:text-white" },
          { label: "Médecins", value: stats.medecins, color: "text-blue-400" },
          { label: "Pharmaciens", value: stats.pharmaciens, color: "text-emerald-400" },
          { label: "Actifs", value: stats.actifs, color: "text-secondary-400" },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-[#0f172a]/60 border border-slate-200 dark:border-slate-800/50 rounded-xl p-3.5 text-center">
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-slate-600 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input type="text" placeholder="Rechercher par nom, email..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/50 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-500 focus:outline-none focus:border-primary-500/50 text-sm transition-all" />
        </div>
        <div className="flex gap-2">
          {(["ALL", "MEDECIN", "PHARMACIEN", "STRUCTURE_ADMIN"] as const).map(r => (
            <button key={r} onClick={() => setFilterRole(r)} className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${filterRole === r ? "bg-primary-500/20 text-primary-300 border border-primary-500/30" : "text-slate-500 border border-slate-200 dark:border-slate-800/50 hover:text-slate-600 dark:text-slate-300"}`}>
              {r === "ALL" ? "Tous" : r === "MEDECIN" ? "Médecins" : r === "PHARMACIEN" ? "Pharmaciens" : "Admins"}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {(["ALL", "ACTIVE", "INACTIVE"] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${filterStatus === s ? "bg-accent-500/20 text-accent-300 border border-accent-500/30" : "text-slate-500 border border-slate-200 dark:border-slate-800/50 hover:text-slate-600 dark:text-slate-300"}`}>
              {s === "ALL" ? "Tout" : s === "ACTIVE" ? "Actifs" : "Inactifs"}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="flex gap-3 p-4 rounded-2xl bg-emergency-500/10 border border-emergency-500/20 text-emergency-400 text-sm"><AlertCircle className="w-5 h-5 flex-shrink-0" />{error}</div>}

      {/* Table */}
      <div className="bg-white dark:bg-[#0f172a]/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800/50 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 text-primary-400 animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-600">
            <Users className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm">{membres.length === 0 ? "Aucun membre dans votre structure" : "Aucun résultat"}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800/50">
                  {["Membre", "Email", "Rôle", "Téléphone", "Statut", "Depuis le"].map(h => (
                    <th key={h} className="px-5 py-4 text-left text-[10px] font-bold uppercase tracking-wider text-slate-600">{h}</th>
                  ))}
                  {user?.role === "STRUCTURE_ADMIN" && <th className="px-5 py-4 text-left text-[10px] font-bold uppercase tracking-wider text-slate-600">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/30">
                {filtered.map(m => {
                  const role = ROLE_CONFIG[m.role];
                  const initials = `${m.prenom[0] ?? ""}${m.nom[0] ?? ""}`.toUpperCase();
                  const isToggling = actionLoading === m.id;
                  return (
                    <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl ${role.bg} flex items-center justify-center flex-shrink-0`}>
                            <span className={`text-xs font-bold ${role.color}`}>{initials}</span>
                          </div>
                          <p className="text-sm font-medium text-slate-900 dark:text-white">{m.prenom} {m.nom}</p>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-slate-600" />
                          <span className="text-xs text-slate-500 dark:text-slate-400">{m.email}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-lg w-fit ${role.bg} ${role.color}`}>
                          {role.icon}{role.label}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {m.telephone
                          ? <div className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-slate-600" /><span className="text-xs text-slate-500 dark:text-slate-400">{m.telephone}</span></div>
                          : <span className="text-xs text-slate-700">—</span>}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full ${m.isActive ? "bg-secondary-500/10 text-secondary-500 dark:text-secondary-400" : "bg-slate-100 dark:bg-slate-700/50 text-slate-500"}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${m.isActive ? "bg-secondary-500" : "bg-slate-300 dark:bg-slate-600"}`} />
                          {m.isActive ? "Actif" : "Inactif"}
                        </span>
                      </td>
                      <td className="px-5 py-4"><span className="text-xs text-slate-600">{new Date(m.createdAt).toLocaleDateString("fr-FR")}</span></td>
                      {user?.role === "STRUCTURE_ADMIN" && (
                        <td className="px-5 py-4">
                          <button onClick={() => handleToggle(m)} disabled={!!actionLoading} title={m.isActive ? "Désactiver" : "Activer"}
                            className={`p-2 rounded-lg transition-all disabled:opacity-50 ${m.isActive ? "text-slate-500 hover:text-emergency-400 hover:bg-emergency-500/10" : "text-slate-500 hover:text-secondary-400 hover:bg-secondary-500/10"}`}>
                            {isToggling ? <Loader2 className="w-4 h-4 animate-spin" /> : m.isActive ? <XCircle className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                          </button>
                          <button onClick={() => setMemberToDelete(m)} disabled={!!actionLoading} title="Supprimer"
                            className="p-2 rounded-lg text-slate-500 hover:text-emergency-500 hover:bg-emergency-500/10 transition-all disabled:opacity-50">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!loading && filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800/50 text-xs text-slate-600">
            {filtered.length} membre{filtered.length > 1 ? "s" : ""}{membres.length !== filtered.length && ` sur ${membres.length}`}
          </div>
        )}
      </div>

      {showCreate && structureId && (
        <UserModal
          mode="create_membre"
          structureId={structureId}
          structureType={structureType}
          onClose={() => setShowCreate(false)}
          onSuccess={fetchData}
        />
      )}

      {memberToDelete && structureId && (
        <MemberDeleteModal
          member={memberToDelete}
          structureId={structureId}
          onClose={() => setMemberToDelete(null)}
          onDeleted={fetchData}
        />
      )}
    </div>
  );
}
