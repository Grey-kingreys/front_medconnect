"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Building2, Plus, ShieldAlert, XCircle, Search, MapPin, CheckCircle2, Loader2 } from "lucide-react";
import { 
  getAllStructures, 
  getMesAutorisations, 
  autoriserStructure, 
  revoquerStructure, 
  MyStructure, 
  Autorisation,
  ApiError
} from "@/lib/api_structure";

export default function MesStructuresPage() {
  const { user } = useAuth();
  const [autorisations, setAutorisations] = useState<Autorisation[]>([]);
  const [toutesStructures, setToutesStructures] = useState<MyStructure[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const [authRes, structsRes] = await Promise.all([
        getMesAutorisations(),
        getAllStructures()
      ]);
      setAutorisations(authRes.data.autorisationsStructures || []);
      setToutesStructures(structsRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role === "PATIENT") {
      fetchData();
    }
  }, [user, fetchData]);

  const handleAutoriser = async (structureId: string) => {
    setActionLoading(structureId);
    try {
      await autoriserStructure(structureId);
      await fetchData();
    } catch (err: any) {
      alert(err.message || "Erreur lors de l'autorisation");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRevoquer = async (structureId: string) => {
    if (!confirm("Voulez-vous vraiment révoquer l'accès à cette structure ?")) return;
    setActionLoading(structureId);
    try {
      await revoquerStructure(structureId);
      await fetchData();
    } catch (err: any) {
      alert(err.message || "Erreur lors de la révocation");
    } finally {
      setActionLoading(null);
    }
  };

  if (user?.role !== "PATIENT") {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <ShieldAlert className="w-16 h-16 text-rose-500" />
        <p className="text-xl font-bold text-slate-800">Accès refusé</p>
        <p className="text-slate-500">Seuls les patients peuvent gérer leurs autorisations de structures.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  const autorisedStructureIds = new Set(autorisations.map(a => a.structureId));
  
  const filteredStructures = toutesStructures.filter(s => 
    !autorisedStructureIds.has(s.id) && 
    (s.nom.toLowerCase().includes(search.toLowerCase()) || 
     s.ville?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white" style={{ fontFamily: "var(--font-outfit)" }}>
            Mes Structures Autorisées
          </h1>
          <p className="text-slate-500 mt-2">
            Gérez les hôpitaux et cliniques qui ont le droit de consulter votre dossier médical.
          </p>
        </div>
      </div>

      {/* Structures Autorisées */}
      <div className="bg-white dark:bg-[#0f172a]/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800/50 rounded-3xl p-8 shadow-xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Accès accordés ({autorisations.length})</h2>
        </div>

        {autorisations.length === 0 ? (
          <div className="text-center py-10 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
            <ShieldAlert className="w-10 h-10 text-slate-400 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">Vous n'avez autorisé aucune structure.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {autorisations.map(auth => (
              <div key={auth.id} className="p-5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col justify-between group">
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                      <Building2 className="w-5 h-5 text-emerald-500" />
                    </div>
                    <span className="text-xs font-bold px-2 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-md">
                      Autorisé
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-900 dark:text-white mb-1 line-clamp-1">{auth.structure.nom}</h3>
                  <p className="text-xs text-slate-500 flex items-center gap-1 mb-4">
                    Type : {auth.structure.type}
                  </p>
                </div>
                
                <button 
                  onClick={() => handleRevoquer(auth.structureId)}
                  disabled={actionLoading === auth.structureId}
                  className="w-full py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400 dark:hover:border-rose-500/30 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2"
                >
                  {actionLoading === auth.structureId ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                  Révoquer l'accès
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ajouter une structure */}
      <div className="bg-white dark:bg-[#0f172a]/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800/50 rounded-3xl p-8 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center text-primary-500">
              <Plus className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Autoriser une nouvelle structure</h2>
          </div>
          
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Rechercher (nom, ville)..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-primary-500 transition-all"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStructures.length === 0 ? (
            <div className="col-span-full text-center py-10">
              <p className="text-slate-500 font-medium">Aucune structure trouvée.</p>
            </div>
          ) : (
            filteredStructures.slice(0, 9).map(struct => (
              <div key={struct.id} className="p-5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white mb-1 line-clamp-1">{struct.nom}</h3>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {struct.ville || "Ville inconnue"}</span>
                    <span>•</span>
                    <span>{struct.type}</span>
                  </div>
                </div>
                
                <button 
                  onClick={() => handleAutoriser(struct.id)}
                  disabled={actionLoading === struct.id}
                  className="w-full py-2 bg-slate-900 hover:bg-slate-800 dark:bg-primary-600 dark:hover:bg-primary-500 text-white rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2"
                >
                  {actionLoading === struct.id ? <Loader2 className="w-4 h-4 animate-spin" /> : "Autoriser l'accès"}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
