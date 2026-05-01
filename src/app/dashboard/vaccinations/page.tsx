"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { 
  ShieldCheck, 
  Calendar, 
  Plus, 
  ChevronRight, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  User, 
  Syringe,
  Info,
  Clock,
  Search
} from "lucide-react";
import { getVaccinations, Vaccination } from "@/lib/api_carnet";

export default function VaccinationsPage() {
  const { user } = useAuth();
  const [vaccinations, setVaccinations] = useState<Vaccination[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getVaccinations();
      setVaccinations(res.data);
    } catch (err: any) {
      setError("Impossible de charger votre carnet vaccinal.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = vaccinations.filter(v => 
    v.vaccin.toLowerCase().includes(search.toLowerCase()) ||
    (v.administrePar || "").toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-10 h-10 text-cyan-500 animate-spin" />
        <p className="text-slate-500 animate-pulse">Chargement de votre carnet vaccinal...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in pb-20">
      {/* Header */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-cyan-600 to-blue-700 p-8 sm:p-12 text-white shadow-2xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md border border-white/30">
              <ShieldCheck className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-widest">Protection Santé</span>
            </div>
            <h1 className="text-4xl font-black tracking-tight" style={{ fontFamily: "var(--font-outfit)" }}>Mon Carnet Vaccinal</h1>
            <p className="text-cyan-100/80 max-w-md text-sm leading-relaxed">Suivez vos vaccinations, rappels et protégez-vous efficacement contre les maladies infectieuses.</p>
          </div>
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-6 rounded-3xl text-center min-w-[160px]">
             <p className="text-3xl font-black mb-1">{vaccinations.length}</p>
             <p className="text-[10px] font-bold uppercase text-cyan-100/60 tracking-widest">Vaccins enregistrés</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left: Next Rappels */}
        <div className="space-y-6">
           <div className="bg-white dark:bg-[#0f172a]/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800/50 rounded-[2rem] p-8 shadow-xl">
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                <Clock className="w-4 h-4 text-cyan-500" /> Prochains Rappels
              </h3>
              
              <div className="space-y-4">
                {vaccinations.filter(v => v.prochainRappel && new Date(v.prochainRappel) > new Date()).length === 0 ? (
                  <p className="text-xs text-slate-500 italic text-center py-4">Aucun rappel prévu prochainement.</p>
                ) : (
                  vaccinations.filter(v => v.prochainRappel && new Date(v.prochainRappel) > new Date()).map((v, i) => (
                    <div key={i} className="flex items-center gap-4 p-4 bg-cyan-500/5 border border-cyan-500/10 rounded-2xl">
                      <div className="w-10 h-10 rounded-xl bg-cyan-500 text-white flex items-center justify-center shrink-0 shadow-lg shadow-cyan-500/20"><Calendar className="w-5 h-5" /></div>
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{v.vaccin}</p>
                        <p className="text-[10px] text-cyan-500 font-bold uppercase tracking-widest">{new Date(v.prochainRappel!).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
           </div>

           <div className="p-6 bg-slate-900 rounded-[2rem] border border-slate-800 text-white space-y-4 relative overflow-hidden group">
              <Info className="absolute -right-2 -bottom-2 w-20 h-20 text-white/5 group-hover:scale-110 transition-transform" />
              <h4 className="text-sm font-bold flex items-center gap-2 text-cyan-400"><Syringe className="w-4 h-4" /> Bon à savoir</h4>
              <p className="text-xs text-slate-500 leading-relaxed">Pensez à prendre en photo votre carnet de santé papier pour avoir toujours une preuve numérique de vos vaccinations.</p>
           </div>
        </div>

        {/* Right: History */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Rechercher un vaccin..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm focus:outline-none focus:border-cyan-500 transition-all shadow-sm"
              />
            </div>
            <button className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-bold text-slate-600 dark:text-slate-400 hover:text-cyan-500 transition-all shadow-sm">
              <Plus className="w-4 h-4" /> Ajouter
            </button>
          </div>

          <div className="space-y-4">
            {filtered.length === 0 ? (
              <div className="py-20 text-center bg-white dark:bg-slate-900 rounded-[2.5rem] border border-dashed border-slate-200 dark:border-slate-800">
                 <ShieldCheck className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                 <p className="text-slate-500 font-medium">Votre historique vaccinal est vide.</p>
              </div>
            ) : (
              filtered.map((v) => (
                <div key={v.id} className="group bg-white dark:bg-[#0f172a]/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800/50 rounded-[1.5rem] p-6 hover:border-cyan-500/30 transition-all shadow-sm">
                  <div className="flex items-center gap-6">
                    <div className="w-14 h-14 rounded-2xl bg-slate-50 dark:bg-slate-800 flex flex-col items-center justify-center border border-slate-100 dark:border-slate-700">
                      <span className="text-xs font-black text-slate-400 leading-none">{new Date(v.dateVaccin).getFullYear()}</span>
                      <span className="text-lg font-black text-slate-900 dark:text-white leading-none mt-1">{new Date(v.dateVaccin).getDate()}</span>
                      <span className="text-[10px] font-bold text-cyan-500 uppercase leading-none mt-0.5">{new Date(v.dateVaccin).toLocaleDateString('fr-FR', { month: 'short' })}</span>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                       <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{v.vaccin}</h4>
                       <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                         <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> {v.administrePar || "Non spécifié"}</span>
                         {v.lotNumero && <span className="flex items-center gap-1.5">Lot: <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded uppercase">{v.lotNumero}</span></span>}
                       </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {v.prochainRappel && (
                        <div className="px-3 py-1.5 bg-cyan-500/10 border border-cyan-500/20 rounded-xl">
                          <p className="text-[9px] font-black text-cyan-500 uppercase tracking-widest leading-none mb-1">Rappel</p>
                          <p className="text-[10px] font-bold text-slate-700 dark:text-cyan-100 leading-none">{new Date(v.prochainRappel).toLocaleDateString('fr-FR', { year: 'numeric' })}</p>
                        </div>
                      )}
                      <div className="w-8 h-8 rounded-full bg-secondary-500/10 flex items-center justify-center text-secondary-500 border border-secondary-500/20 shadow-sm shadow-secondary-500/10">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                  
                  {v.notes && (
                    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/50">
                      <p className="text-xs text-slate-500 italic leading-relaxed">"{v.notes}"</p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
