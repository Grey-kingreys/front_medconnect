"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { 
  FileText, 
  Calendar, 
  Search, 
  Activity, 
  Download, 
  ExternalLink, 
  Loader2, 
  AlertCircle,
  X,
  Plus,
  Beaker,
  Building2,
  ChevronRight
} from "lucide-react";
import { getAnalyses, ResultatAnalyse } from "@/lib/api_carnet";

export default function AnalysesPage() {
  const { user } = useAuth();
  const [analyses, setAnalyses] = useState<ResultatAnalyse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedAnalyse, setSelectedAnalyse] = useState<ResultatAnalyse | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getAnalyses();
      setAnalyses(res.data);
    } catch (err: any) {
      setError("Impossible de charger vos résultats d'analyses.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = analyses.filter(a => 
    a.typeAnalyse.toLowerCase().includes(search.toLowerCase()) ||
    (a.laboratoire || "").toLowerCase().includes(search.toLowerCase()) ||
    a.resultats.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
        <p className="text-slate-500 animate-pulse">Chargement de vos analyses...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight" style={{ fontFamily: "var(--font-outfit)" }}>
            Résultats d'Analyses
          </h1>
          <p className="text-slate-500 text-sm mt-1">Historique de vos examens biologiques, radiographies et bilans.</p>
        </div>
        
        <div className="relative flex-1 sm:w-80">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Rechercher une analyse, laboratoire..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm focus:outline-none focus:border-indigo-500 transition-all shadow-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.length === 0 ? (
          <div className="col-span-full py-20 text-center bg-white dark:bg-slate-900 rounded-[3rem] border border-dashed border-slate-200 dark:border-slate-800">
             <Beaker className="w-12 h-12 text-slate-300 mx-auto mb-4" />
             <p className="text-slate-500 font-medium">Aucun résultat d'analyse trouvé.</p>
          </div>
        ) : (
          filtered.map((a) => (
            <div 
              key={a.id} 
              onClick={() => setSelectedAnalyse(a)}
              className="group bg-white dark:bg-[#0f172a]/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800/50 rounded-[2.5rem] p-8 hover:border-indigo-500/30 hover:shadow-2xl hover:shadow-indigo-500/5 transition-all duration-300 cursor-pointer"
            >
              <div className="flex items-start justify-between mb-6">
                <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 group-hover:scale-110 transition-transform">
                  <Activity className="w-7 h-7" />
                </div>
                <div className="text-right">
                  <p className="text-xs font-black text-indigo-400 uppercase tracking-widest">
                    {new Date(a.dateAnalyse).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  </p>
                  <p className="text-[10px] text-slate-500 font-bold">
                    {new Date(a.dateAnalyse).getFullYear()}
                  </p>
                </div>
              </div>
              
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white leading-tight group-hover:text-indigo-400 transition-colors">{a.typeAnalyse}</h3>
                <p className="text-sm text-slate-500 flex items-center gap-2"><Building2 className="w-4 h-4 text-slate-400" /> {a.laboratoire || "Labo inconnu"}</p>
                
                <div className="pt-4 flex items-center justify-between border-t border-slate-100 dark:border-slate-800/50">
                   <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                     <FileText className="w-4 h-4" />
                     <span>Rapport prêt</span>
                   </div>
                   <ChevronRight className="w-5 h-5 text-slate-300 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Detail Modal/Overlay */}
      {selectedAnalyse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-[#0f172a] w-full max-w-2xl rounded-[3rem] overflow-hidden shadow-2xl animate-slide-up border border-slate-200 dark:border-slate-800">
            <div className="p-8 bg-indigo-600 text-white relative">
               <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl translate-x-1/2 -translate-y-1/2" />
               <div className="flex items-start justify-between relative">
                 <div className="space-y-1">
                   <p className="text-xs font-black uppercase tracking-widest text-white/70">Détails de l'examen</p>
                   <h2 className="text-3xl font-black">{selectedAnalyse.typeAnalyse}</h2>
                 </div>
                 <button onClick={() => setSelectedAnalyse(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X className="w-6 h-6" /></button>
               </div>
            </div>
            
            <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto scrollbar-thin">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Laboratoire</p>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{selectedAnalyse.laboratoire || "Non spécifié"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date de l'examen</p>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{new Date(selectedAnalyse.dateAnalyse).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2 text-indigo-400">
                  <Activity className="w-4 h-4" />
                  <h4 className="text-xs font-black uppercase tracking-widest">Observations & Résultats</h4>
                </div>
                <div className="p-6 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-3xl">
                  <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{selectedAnalyse.resultats}</p>
                </div>
              </div>

              {selectedAnalyse.notes && (
                <div className="space-y-2">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Notes additionnelles</h4>
                  <p className="text-sm text-slate-500 italic leading-relaxed">"{selectedAnalyse.notes}"</p>
                </div>
              )}
            </div>

            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex gap-3">
              <button className="flex-1 py-4 flex items-center justify-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-600 dark:text-slate-400 hover:shadow-lg transition-all">
                <Download className="w-4 h-4" /> Rapport PDF
              </button>
              <button className="flex-1 py-4 flex items-center justify-center gap-2 bg-indigo-600 text-white rounded-2xl text-sm font-bold shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 transition-all">
                <ExternalLink className="w-4 h-4" /> Partager au médecin
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
