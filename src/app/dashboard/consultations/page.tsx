"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { 
  Stethoscope, 
  Calendar, 
  Search, 
  Filter, 
  Building2, 
  ChevronRight, 
  FileText, 
  ClipboardList, 
  Loader2, 
  Activity,
  AlertCircle,
  X,
  Plus
} from "lucide-react";
import { getConsultations, Consultation } from "@/lib/api_carnet";

export default function ConsultationsPage() {
  const { user } = useAuth();
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedConsultation, setSelectedConsultation] = useState<Consultation | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getConsultations();
      setConsultations(res.data);
    } catch (err: any) {
      setError("Impossible de charger l'historique des consultations.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = consultations.filter(c => 
    c.motif.toLowerCase().includes(search.toLowerCase()) ||
    (c.diagnostic || "").toLowerCase().includes(search.toLowerCase()) ||
    (c.medecinNom || "").toLowerCase().includes(search.toLowerCase()) ||
    (c.structure?.nom || "").toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-10 h-10 text-primary-500 animate-spin" />
        <p className="text-slate-500 animate-pulse">Chargement de vos consultations...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight" style={{ fontFamily: "var(--font-outfit)" }}>
            Mes Consultations
          </h1>
          <p className="text-slate-500 text-sm mt-1">Historique complet de vos visites médicales et diagnostics.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative flex-1 sm:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Rechercher un motif, médecin..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm focus:outline-none focus:border-primary-500 transition-all shadow-sm"
            />
          </div>
          <button className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-500 hover:text-primary-500 transition-colors shadow-sm">
            <Filter className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* List of Consultations */}
        <div className={`space-y-4 ${selectedConsultation ? 'lg:col-span-5' : 'lg:col-span-12'}`}>
          {filtered.length === 0 ? (
            <div className="bg-white dark:bg-[#0f172a]/80 backdrop-blur-xl border border-dashed border-slate-200 dark:border-slate-800 rounded-[2rem] p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                <Stethoscope className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-slate-500 font-medium">Aucune consultation trouvée.</p>
            </div>
          ) : (
            filtered.map((c) => (
              <div 
                key={c.id}
                onClick={() => setSelectedConsultation(c)}
                className={`group relative bg-white dark:bg-[#0f172a]/80 backdrop-blur-xl border transition-all duration-300 rounded-[1.5rem] p-5 cursor-pointer hover:shadow-xl hover:shadow-primary-500/5 ${selectedConsultation?.id === c.id ? 'border-primary-500 shadow-lg' : 'border-slate-200 dark:border-slate-800/50 hover:border-primary-500/30'}`}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${selectedConsultation?.id === c.id ? 'bg-primary-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 group-hover:bg-primary-500/10 group-hover:text-primary-400'}`}>
                    <Calendar className="w-6 h-6" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-xs font-bold text-primary-400 uppercase tracking-wider">
                        {new Date(c.dateConsultation).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                      <span className="text-[10px] text-slate-500 flex items-center gap-1">
                        {new Date(c.dateConsultation).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white truncate mb-1">{c.motif}</h3>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1.5"><Stethoscope className="w-3 h-3" /> Dr. {c.medecinNom || "Inconnu"}</span>
                      {c.structure && <span className="flex items-center gap-1.5"><Building2 className="w-3 h-3" /> {c.structure.nom}</span>}
                    </div>
                  </div>
                  
                  <div className="flex items-center self-center">
                    <ChevronRight className={`w-5 h-5 transition-transform duration-300 ${selectedConsultation?.id === c.id ? 'translate-x-1 text-primary-500' : 'text-slate-300 group-hover:translate-x-1'}`} />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Details View */}
        {selectedConsultation && (
          <div className="lg:col-span-7 animate-slide-up sticky top-8">
            <div className="bg-white dark:bg-[#0f172a]/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800/50 rounded-[2.5rem] overflow-hidden shadow-2xl">
              {/* Top Bar */}
              <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary-500 text-white flex items-center justify-center"><FileText className="w-5 h-5" /></div>
                  <h2 className="font-bold text-slate-900 dark:text-white">Détails Consultation</h2>
                </div>
                <button 
                  onClick={() => setSelectedConsultation(null)}
                  className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              {/* Content */}
              <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto scrollbar-thin">
                
                {/* Header Info */}
                <div className="space-y-4">
                  <div className="flex flex-col gap-1">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Motif de visite</p>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white leading-tight">{selectedConsultation.motif}</h3>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                      <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Médecin</p>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">Dr. {selectedConsultation.medecinNom || "Inconnu"}</p>
                    </div>
                    <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                      <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Structure</p>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{selectedConsultation.structure?.nom || "Non spécifiée"}</p>
                    </div>
                  </div>
                </div>

                {/* Diagnostic */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-primary-400">
                    <Activity className="w-4 h-4" />
                    <h4 className="text-xs font-black uppercase tracking-widest">Diagnostic</h4>
                  </div>
                  <div className="p-6 bg-primary-500/5 border border-primary-500/10 rounded-3xl">
                    <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
                      {selectedConsultation.diagnostic || "Aucun diagnostic spécifié pour cette consultation."}
                    </p>
                  </div>
                </div>

                {/* Notes */}
                {selectedConsultation.notes && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-amber-400">
                      <ClipboardList className="w-4 h-4" />
                      <h4 className="text-xs font-black uppercase tracking-widest">Notes médicales</h4>
                    </div>
                    <p className="text-slate-500 text-sm italic leading-relaxed pl-6 border-l-2 border-slate-200 dark:border-slate-800">
                      "{selectedConsultation.notes}"
                    </p>
                  </div>
                )}

                {/* Links to prescriptions/analysis */}
                <div className="pt-4 grid grid-cols-1 gap-3">
                  <button className="flex items-center justify-between p-4 bg-secondary-500/10 hover:bg-secondary-500/20 border border-secondary-500/20 rounded-2xl transition-all group">
                    <div className="flex items-center gap-3 text-secondary-400">
                      <ClipboardList className="w-5 h-5" />
                      <span className="text-sm font-bold">Voir l'ordonnance liée</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-secondary-400 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>
              
              {/* Footer Actions */}
              <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex gap-3">
                <button className="flex-1 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 transition-all">Télécharger PDF</button>
                <button className="flex-1 py-3 bg-primary-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-primary-500/20 hover:bg-primary-600 transition-all">Partager</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
