"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { 
  Calendar, 
  Clock, 
  User, 
  MapPin, 
  Plus, 
  ChevronRight, 
  Loader2, 
  AlertCircle,
  CheckCircle2,
  X,
  Building2,
  Filter,
  Search
} from "lucide-react";
import { getRendezVous, RendezVous, updateRendezVousStatus } from "@/lib/api_carnet";
import DoctorAddRecordModal from "@/components/DoctorAddRecordModal";

export default function RendezVousPage() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<RendezVous[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const isDoctor = user?.role === "MEDECIN" || user?.role === "STRUCTURE_ADMIN";

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getRendezVous();
      setAppointments(res.data);
    } catch (err: any) {
      setError("Impossible de charger vos rendez-vous.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleStatusUpdate = async (id: string, status: string) => {
    try {
      await updateRendezVousStatus(id, status);
      fetchData();
    } catch (err) {
      alert("Erreur lors de la mise à jour du statut");
    }
  };

  const filtered = appointments.filter(a => 
    (a.patient?.nom || "").toLowerCase().includes(search.toLowerCase()) ||
    (a.medecin?.nom || "").toLowerCase().includes(search.toLowerCase()) ||
    a.motif.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-10 h-10 text-primary-500 animate-spin" />
        <p className="text-slate-500 animate-pulse">Chargement de vos rendez-vous...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight" style={{ fontFamily: "var(--font-outfit)" }}>
            Mes Rendez-vous
          </h1>
          <p className="text-slate-500 text-sm mt-1">Gérez vos consultations programmées et votre agenda.</p>
        </div>
        
        <div className="flex items-center gap-3">
          {isDoctor && (
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 px-5 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-bold text-sm shadow-lg shadow-primary-500/25 transition-all active:scale-95 whitespace-nowrap"
            >
              <Plus className="w-5 h-5" />
              Nouveau Rendez-vous
            </button>
          )}
          <div className="relative flex-1 sm:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Rechercher un RDV..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm focus:outline-none focus:border-primary-500 transition-all shadow-sm"
            />
          </div>
        </div>
      </div>

      {/* Stats/Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Aujourd&apos;hui</p>
           <p className="text-3xl font-black text-slate-900 dark:text-white">
             {appointments.filter(a => new Date(a.date).toDateString() === new Date().toDateString()).length}
           </p>
        </div>
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">À venir</p>
           <p className="text-3xl font-black text-primary-500">
             {appointments.filter(a => new Date(a.date) > new Date() && a.status === 'PROGRAMME').length}
           </p>
        </div>
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Terminés</p>
           <p className="text-3xl font-black text-emerald-500">
             {appointments.filter(a => a.status === 'TERMINE').length}
           </p>
        </div>
      </div>

      {/* Appointments List */}
      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="bg-white dark:bg-[#0f172a]/80 backdrop-blur-xl border border-dashed border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-20 text-center">
            <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 font-medium">Aucun rendez-vous trouvé.</p>
          </div>
        ) : (
          filtered.map((a) => (
            <div key={a.id} className="group bg-white dark:bg-[#0f172a]/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800/50 rounded-3xl p-6 hover:shadow-xl hover:border-primary-500/30 transition-all">
              <div className="flex flex-col md:flex-row md:items-center gap-6">
                {/* Date/Time Block */}
                <div className="flex items-center gap-4 min-w-[150px]">
                   <div className="w-14 h-14 rounded-2xl bg-primary-500/10 border border-primary-500/20 flex flex-col items-center justify-center text-primary-500">
                      <span className="text-lg font-black leading-none">{new Date(a.date).getDate()}</span>
                      <span className="text-[10px] font-bold uppercase mt-1">{new Date(a.date).toLocaleDateString('fr-FR', { month: 'short' })}</span>
                   </div>
                   <div>
                      <p className="text-sm font-black text-slate-900 dark:text-white">{new Date(a.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{new Date(a.date).toLocaleDateString('fr-FR', { weekday: 'long' })}</p>
                   </div>
                </div>

                {/* Info Block */}
                <div className="flex-1 space-y-2">
                   <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                        a.status === 'PROGRAMME' ? 'bg-blue-500/10 text-blue-500' :
                        a.status === 'CONFIRME' ? 'bg-emerald-500/10 text-emerald-500' :
                        a.status === 'ANNULE' ? 'bg-rose-500/10 text-rose-500' :
                        'bg-slate-500/10 text-slate-500'
                      }`}>
                        {a.status}
                      </span>
                      <h3 className="font-bold text-slate-900 dark:text-white">{a.motif}</h3>
                   </div>
                   <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                      <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> {isDoctor ? `${a.patient?.prenom} ${a.patient?.nom}` : `Dr. ${a.medecin?.prenom} ${a.medecin?.nom}`}</span>
                      {a.structure && <span className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> {a.structure.nom}</span>}
                   </div>
                </div>

                {/* Actions Block */}
                <div className="flex items-center gap-2">
                   {isDoctor && a.status === 'PROGRAMME' && (
                     <>
                       <button 
                         onClick={() => handleStatusUpdate(a.id, 'CONFIRME')}
                         className="p-2 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white rounded-xl transition-all shadow-sm"
                         title="Confirmer"
                       >
                         <CheckCircle2 className="w-5 h-5" />
                       </button>
                       <button 
                         onClick={() => handleStatusUpdate(a.id, 'ANNULE')}
                         className="p-2 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white rounded-xl transition-all shadow-sm"
                         title="Annuler"
                       >
                         <X className="w-5 h-5" />
                       </button>
                     </>
                   )}
                   {isDoctor && a.status === 'CONFIRME' && (
                     <button 
                       onClick={() => handleStatusUpdate(a.id, 'TERMINE')}
                       className="px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-bold transition-all shadow-lg"
                     >
                       Marquer comme terminé
                     </button>
                   )}
                </div>
              </div>
              {a.notes && (
                <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                   <p className="text-xs text-slate-500 italic">"{a.notes}"</p>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <DoctorAddRecordModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        type="rendezvous" 
        onSuccess={fetchData} 
      />
    </div>
  );
}
