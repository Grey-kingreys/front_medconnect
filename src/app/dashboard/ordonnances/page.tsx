"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { 
  ClipboardList, 
  Calendar, 
  Search, 
  Pill, 
  User, 
  ChevronRight, 
  Download, 
  Eye, 
  Loader2, 
  AlertCircle,
  X,
  FileText,
  Clock,
  Printer,
  Plus
} from "lucide-react";
import { getOrdonnances, Ordonnance } from "@/lib/api_carnet";
import DoctorAddRecordModal from "@/components/DoctorAddRecordModal";

interface MedicamentItem {
  nom: string;
  dosage: string;
  duree: string;
  instructions: string;
}

export default function OrdonnancesPage() {
  const { user } = useAuth();
  const [ordonnances, setOrdonnances] = useState<Ordonnance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedOrdonnance, setSelectedOrdonnance] = useState<Ordonnance | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const isDoctor = user?.role === "MEDECIN" || user?.role === "STRUCTURE_ADMIN";

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getOrdonnances();
      setOrdonnances(res.data);
    } catch (err: any) {
      setError("Impossible de charger vos ordonnances.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = ordonnances.filter(o => 
    (o.medecinNom || "").toLowerCase().includes(search.toLowerCase()) ||
    o.medicaments.toLowerCase().includes(search.toLowerCase()) ||
    (o.notes || "").toLowerCase().includes(search.toLowerCase())
  );

  const parseMedicaments = (json: string): MedicamentItem[] => {
    try {
      return JSON.parse(json);
    } catch {
      return [];
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-10 h-10 text-secondary-500 animate-spin" />
        <p className="text-slate-500 animate-pulse">Chargement de vos ordonnances...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight" style={{ fontFamily: "var(--font-outfit)" }}>
            Mes Ordonnances
          </h1>
          <p className="text-slate-500 text-sm mt-1">Consultez et gérez vos prescriptions médicales.</p>
        </div>
        
        <div className="flex items-center gap-3">
          {isDoctor && (
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 px-5 py-3 bg-secondary-600 hover:bg-secondary-700 text-white rounded-2xl font-bold text-sm shadow-lg shadow-secondary-500/25 transition-all active:scale-95 whitespace-nowrap"
            >
              <Plus className="w-5 h-5" />
              Nouvelle Ordonnance
            </button>
          )}
          <div className="relative flex-1 sm:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Rechercher un médicament, médecin..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm focus:outline-none focus:border-secondary-500 transition-all shadow-sm"
            />
          </div>
        </div>
      </div>
      
      <DoctorAddRecordModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        type="ordonnance" 
        onSuccess={fetchData} 
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* List Column */}
        <div className={`space-y-4 ${selectedOrdonnance ? 'lg:col-span-5' : 'lg:col-span-12'}`}>
          {filtered.length === 0 ? (
            <div className="bg-white dark:bg-[#0f172a]/80 backdrop-blur-xl border border-dashed border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-16 text-center">
              <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 font-medium">Aucune ordonnance trouvée.</p>
            </div>
          ) : (
            filtered.map((o) => {
              const meds = parseMedicaments(o.medicaments);
              const isExpired = o.dateExpiration && new Date(o.dateExpiration) < new Date();
              
              return (
                <div 
                  key={o.id}
                  onClick={() => setSelectedOrdonnance(o)}
                  className={`group bg-white dark:bg-[#0f172a]/80 backdrop-blur-xl border transition-all duration-300 rounded-3xl p-5 cursor-pointer ${selectedOrdonnance?.id === o.id ? 'border-secondary-500 shadow-xl' : 'border-slate-200 dark:border-slate-800/50 hover:border-secondary-500/30 shadow-sm'}`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${selectedOrdonnance?.id === o.id ? 'bg-secondary-500 text-white' : 'bg-secondary-500/10 text-secondary-500 group-hover:bg-secondary-500/20'}`}>
                      <FileText className="w-6 h-6" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-black text-secondary-500 uppercase tracking-widest">
                          {new Date(o.dateEmission).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                        {isExpired && <span className="px-2 py-0.5 bg-rose-500/10 text-rose-500 text-[10px] font-bold rounded-full">Expirée</span>}
                      </div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">Ordonnance • Dr. {o.medecinNom || "Inconnu"}</h3>
                      <p className="text-xs text-slate-500 mt-1 truncate">
                        {meds.map(m => m.nom).join(', ')}
                      </p>
                    </div>
                    
                    <div className="self-center">
                      <ChevronRight className={`w-5 h-5 transition-transform ${selectedOrdonnance?.id === o.id ? 'translate-x-1 text-secondary-500' : 'text-slate-300'}`} />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Detail Column */}
        {selectedOrdonnance && (
          <div className="lg:col-span-7 animate-slide-up sticky top-8">
            <div className="bg-white dark:bg-[#0f172a]/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800/50 rounded-[2.5rem] overflow-hidden shadow-2xl">
              
              {/* Header */}
              <div className="p-8 bg-secondary-500 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl translate-x-1/2 -translate-y-1/2" />
                <div className="relative flex items-start justify-between">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white/20 backdrop-blur-md rounded-xl border border-white/30"><ClipboardList className="w-5 h-5" /></div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70">Prescription Médicale</p>
                        <p className="text-xl font-black">Dr. {selectedOrdonnance.medecinNom || "Inconnu"}</p>
                      </div>
                    </div>
                    
                    <div className="flex gap-6">
                      <div>
                        <p className="text-[10px] font-bold uppercase text-white/60 mb-1">Date d&apos;émission</p>
                        <p className="text-sm font-bold">{new Date(selectedOrdonnance.dateEmission).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                      </div>
                      {selectedOrdonnance.dateExpiration && (
                        <div>
                          <p className="text-[10px] font-bold uppercase text-white/60 mb-1">Expire le</p>
                          <p className="text-sm font-bold">{new Date(selectedOrdonnance.dateExpiration).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <button onClick={() => setSelectedOrdonnance(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X className="w-6 h-6" /></button>
                </div>
              </div>

              {/* Body */}
              <div className="p-8 space-y-8 max-h-[60vh] overflow-y-auto scrollbar-thin">
                
                {/* Medicaments List */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-secondary-500">
                    <Pill className="w-4 h-4" />
                    <h4 className="text-xs font-black uppercase tracking-widest">Traitements prescrits</h4>
                  </div>
                  
                  <div className="space-y-3">
                    {parseMedicaments(selectedOrdonnance.medicaments).map((m, i) => (
                      <div key={i} className="p-5 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-3xl group hover:border-secondary-500/30 transition-colors">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <h5 className="text-lg font-black text-slate-900 dark:text-white group-hover:text-secondary-400 transition-colors">{m.nom}</h5>
                          <span className="px-3 py-1 bg-secondary-500/10 text-secondary-500 text-[10px] font-black rounded-full border border-secondary-500/20">{m.dosage}</span>
                        </div>
                        <div className="flex gap-4 text-xs text-slate-500">
                          <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Pendant {m.duree}</span>
                        </div>
                        <div className="mt-3 pt-3 border-t border-slate-200/50 dark:border-slate-800/50">
                          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed italic">"{m.instructions}"</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                {selectedOrdonnance.notes && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Notes du médecin</h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{selectedOrdonnance.notes}</p>
                  </div>
                )}
              </div>

              {/* Footer Actions */}
              <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex gap-3">
                <button className="flex-1 py-4 flex items-center justify-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-600 dark:text-slate-400 hover:shadow-lg transition-all">
                  <Printer className="w-4 h-4" /> Imprimer
                </button>
                <button className="flex-1 py-4 flex items-center justify-center gap-2 bg-secondary-500 text-white rounded-2xl text-sm font-bold shadow-xl shadow-secondary-500/20 hover:bg-secondary-600 transition-all">
                  <Download className="w-4 h-4" /> Télécharger PDF
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
