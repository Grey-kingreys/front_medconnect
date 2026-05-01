"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Building2, Users, MapPin, Phone, Mail, Edit3, Save, X,
  AlertCircle, Loader2, Stethoscope, Pill, Activity,
} from "lucide-react";
import { DonutChart } from "@/components/charts/DonutChart";
import { StatCard } from "@/components/charts/StatCard";
import { getMyStructure, updateMyStructure, MyStructure, UpdateStructurePayload, ApiError } from "@/lib/api_structure";
import { StructureModal } from "@/components/modals/StructureModal";
import { useAuth } from "@/hooks/useAuth";
import Link from "next/link";

const TYPE_LABEL: Record<string, string> = { HOPITAL: "Hôpital", CLINIQUE: "Clinique", PHARMACIE: "Pharmacie" };
const TYPE_GRADIENT: Record<string, string> = {
  HOPITAL: "from-blue-500 to-cyan-500",
  CLINIQUE: "from-cyan-500 to-teal-500",
  PHARMACIE: "from-emerald-500 to-green-500",
};



export default function MyStructurePage() {
  const { user } = useAuth();
  const [structure, setStructure] = useState<MyStructure | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showEdit, setShowEdit] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true); setError("");
    try { setStructure((await getMyStructure()).data); }
    catch { setError("Impossible de charger les informations de votre structure."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  if (loading) return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="w-7 h-7 text-primary-400 animate-spin" /></div>;
  if (error || !structure) return <div className="max-w-2xl mx-auto mt-12"><div className="flex gap-3 p-4 rounded-2xl bg-emergency-500/10 border border-emergency-500/20 text-emergency-400 text-sm"><AlertCircle className="w-5 h-5" />{error || "Structure introuvable"}</div></div>;

  const medecins = structure.membres.filter(m => m.role === "MEDECIN");
  const pharmaciens = structure.membres.filter(m => m.role === "PHARMACIEN");
  const actifs = structure.membres.filter(m => m.isActive);
  const donutData = [
    { label: "Médecins", value: medecins.length, color: "#3b82f6" },
    { label: "Pharmaciens", value: pharmaciens.length, color: "#10b981" },
  ].filter(d => d.value > 0);
  const gradient = TYPE_GRADIENT[structure.type] ?? "from-primary-500 to-cyan-500";

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl bg-slate-100 dark:bg-gradient-to-br dark:from-[#0f172a] dark:to-[#1e1b4b] border border-slate-200 dark:border-slate-800/50 p-6 sm:p-8">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/8 rounded-full blur-3xl pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg flex-shrink-0`}>
              <Building2 className="w-7 h-7 text-slate-900 dark:text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/10 text-slate-600 dark:text-slate-300">{TYPE_LABEL[structure.type]}</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${structure.isActive ? "bg-secondary-500/10 text-secondary-400" : "bg-slate-700/50 text-slate-500"}`}>{structure.isActive ? "Active" : "Inactive"}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">{structure.nom}</h1>
              {(structure.ville || structure.adresse) && (
                <div className="flex items-center gap-1.5 mt-1 text-sm text-slate-500 dark:text-slate-400"><MapPin className="w-3.5 h-3.5" />{[structure.ville, structure.adresse].filter(Boolean).join(" · ")}</div>
              )}
            </div>
          </div>
          {user?.role === 'STRUCTURE_ADMIN' && (
            <button onClick={() => setShowEdit(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm text-slate-600 dark:text-slate-300 border border-slate-700/50 hover:border-primary-500/30 hover:text-slate-900 dark:text-white transition-all">
              <Edit3 className="w-4 h-4" />Modifier
            </button>
          )}
        </div>
        <div className="relative mt-4 flex flex-wrap gap-4">
          {structure.email && <div className="flex items-center gap-2 text-sm text-slate-500"><Mail className="w-4 h-4 text-slate-600" />{structure.email}</div>}
          {structure.telephone && <div className="flex items-center gap-2 text-sm text-slate-500"><Phone className="w-4 h-4 text-slate-600" />{structure.telephone}</div>}
        </div>
        {structure.description && <p className="relative mt-3 text-sm text-slate-500 max-w-2xl">{structure.description}</p>}
      </div>

      {/* Stats */}
      <section>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Vue d&apos;ensemble</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Membres total" value={structure.membres.length} icon={<Users className="w-5 h-5" />} iconColor="text-primary-400" iconBg="bg-primary-500/10" accentColor="#3b82f6" gradient />
          <StatCard label="Médecins" value={medecins.length} icon={<Stethoscope className="w-5 h-5" />} iconColor="text-cyan-400" iconBg="bg-cyan-500/10" accentColor="#06b6d4" gradient />
          <StatCard label="Pharmaciens" value={pharmaciens.length} icon={<Pill className="w-5 h-5" />} iconColor="text-emerald-400" iconBg="bg-emerald-500/10" accentColor="#10b981" gradient />
          <StatCard label="Membres actifs" value={actifs.length} icon={<Activity className="w-5 h-5" />} iconColor="text-secondary-400" iconBg="bg-secondary-500/10" accentColor="#10b981" gradient />
        </div>
      </section>

      {/* Chart + Actions */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-[#0f172a]/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800/50 rounded-2xl p-6">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-6">Composition de l&apos;équipe</h3>
          {donutData.length > 0
            ? <DonutChart data={donutData} centerLabel={String(structure.membres.length)} centerSub="membres" size={160} thickness={28} />
            : <div className="flex flex-col items-center justify-center h-32 text-slate-600 text-sm"><Users className="w-8 h-8 mb-2 opacity-30" /><p>Aucun membre encore</p></div>
          }
        </div>
        <div className="bg-white dark:bg-[#0f172a]/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800/50 rounded-2xl p-6">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">Actions rapides</h3>
          <div className="space-y-3">
            <Link href="/dashboard/membres" className="group flex items-center gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 hover:border-primary-500/30 transition-all">
              <Users className="w-5 h-5 text-primary-500" />
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  {user?.role === 'STRUCTURE_ADMIN' ? "Gérer l'équipe" : "Voir l'équipe"}
                </p>
                <p className="text-xs text-slate-500">
                  {user?.role === 'STRUCTURE_ADMIN' ? "Ajouter médecins & pharmaciens" : "Consulter la liste des membres"}
                </p>
              </div>
            </Link>
          </div>
          {structure.admin && (
            <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800/50">
              <p className="text-xs text-slate-600 mb-2">Administrateur</p>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{structure.admin.prenom[0]}{structure.admin.nom[0]}</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{structure.admin.prenom} {structure.admin.nom}</p>
                  <p className="text-xs text-slate-600">{structure.admin.email}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {showEdit && (
        <StructureModal 
          mode="edit" 
          structure={structure} 
          onClose={() => setShowEdit(false)} 
          onSuccess={fetch} 
        />
      )}
    </div>
  );
}
