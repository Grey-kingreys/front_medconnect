"use client";

import { useState, useEffect, useCallback } from "react";
import { 
  Search, 
  MapPin, 
  Phone, 
  Clock, 
  ChevronRight, 
  ChevronDown,
  Building2, 
  Map as MapIcon, 
  LayoutGrid,
  Loader2,
  XCircle,
  Stethoscope,
  Mail,
  User as UserIcon
} from "lucide-react";
import { getAllStructures, getPublicStructureDetails, MyStructure } from "@/lib/api_structure";
import GlobePicker from "@/components/GlobePicker";
import { MEDICAL_SPECIALTIES } from "@/components/modals/UserModal";
import { useAuth } from "@/hooks/useAuth";
import { autoriserStructure, designerMedecin, getAutorisations } from "@/lib/api_patients";
import { startConversation } from "@/lib/api_chat";
import { ShieldCheck, ShieldAlert, Star, Check, MessageSquare } from "lucide-react";
import { useRouter } from "next/navigation";

export default function MapPage() {
  const [structures, setStructures] = useState<MyStructure[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [filterSpecialty, setFilterSpecialty] = useState<string>("ALL");
  
  const [selectedStructureId, setSelectedStructureId] = useState<string | null>(null);
  const [structureDetails, setStructureDetails] = useState<MyStructure | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const router = useRouter();

  const { user } = useAuth();
  const [autorisations, setAutorisations] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchAutorisations = useCallback(async () => {
    if (user?.role === 'PATIENT') {
      try {
        const res = await getAutorisations();
        setAutorisations(res.data);
      } catch (err) {
        console.error(err);
      }
    }
  }, [user]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAllStructures();
      setStructures(res.data.filter(s => s.type === "HOPITAL" || s.type === "CLINIQUE"));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchAutorisations();
  }, [fetchData, fetchAutorisations]);

  const handleSelectStructure = async (id: string) => {
    setSelectedStructureId(id);
    setLoadingDetails(true);
    try {
      const res = await getPublicStructureDetails(id);
      setStructureDetails(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const filtered = structures.filter(s => {
    const matchesSearch = s.nom.toLowerCase().includes(search.toLowerCase()) ||
      (s.ville || "").toLowerCase().includes(search.toLowerCase()) ||
      (s.adresse || "").toLowerCase().includes(search.toLowerCase());
    
    const matchesSpecialty = filterSpecialty === "ALL" || s.membres?.some(m => m.specialite === filterSpecialty);
    
    return matchesSearch && matchesSpecialty;
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-10 h-10 text-primary-500 animate-spin" />
        <p className="text-slate-500 animate-pulse">Recherche des établissements de santé...</p>
      </div>
    );
  }

  // Helper to determine if currently open based on "horaires" JSON and manual toggle
  const isOpenNow = (s: MyStructure) => {
    // 1. Si la structure est de garde, elle est forcément ouverte
    if (s.estDeGarde) return true;

    // 2. Si le gérant a forcé le statut manuellement
    if (s.estOuvertManuel === true) return true;
    if (s.estOuvertManuel === false) return false;

    // 3. Sinon, on suit les horaires automatiques
    if (!s.horaires) return true;

    try {
      const schedule = JSON.parse(s.horaires);
      const days = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
      const today = days[new Date().getDay()];
      const timeRange = schedule[today];

      if (!timeRange || timeRange === "Fermé") return false;

      const [open, close] = timeRange.split('-');
      if (!open || !close) return false;

      const now = new Date();
      const currentMins = now.getHours() * 60 + now.getMinutes();
      const [openH, openM] = open.split(':').map(Number);
      const [closeH, closeM] = close.split(':').map(Number);
      const openMins = openH * 60 + (openM || 0);
      const closeMins = closeH * 60 + (closeM || 0);

      return currentMins >= openMins && currentMins <= closeMins;
    } catch {
      return true;
    }
  };

  const handleAutoriserStructure = async (structureId: string) => {
    setActionLoading('struct-' + structureId);
    try {
      await autoriserStructure(structureId);
      await fetchAutorisations();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDesignerMedecin = async (medecinId: string) => {
    setActionLoading('med-' + medecinId);
    try {
      await designerMedecin(medecinId);
      await fetchAutorisations();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const renderDetails = () => {
    if (!structureDetails) return null;
    
    const isCurrentlyOpen = isOpenNow(structureDetails);
    const doctors = structureDetails.membres?.filter(m => m.role === "MEDECIN" || m.role === "STRUCTURE_ADMIN") || [];
    
    let parsedSchedule: Record<string, string> = {};
    try {
      parsedSchedule = JSON.parse(structureDetails.horaires || "{}");
    } catch {
      parsedSchedule = {};
    }

    const isPatient = user?.role === 'PATIENT';
    const hasAuthorizedStructure = autorisations?.autorisationsStructures?.some((a: any) => a.structureId === structureDetails.id);
    const medecinTraitantId = autorisations?.medecinTraitantId;

    return (
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col h-full max-h-[80vh] overflow-y-auto custom-scrollbar">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className={`p-4 rounded-2xl ${structureDetails.type === "HOPITAL" ? "bg-primary-500/10 text-primary-500" : "bg-purple-500/10 text-purple-500"}`}>
              <Building2 className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">{structureDetails.nom}</h3>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">{structureDetails.type}</p>
            </div>
          </div>
          <button onClick={() => {setSelectedStructureId(null); setStructureDetails(null);}} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
            <XCircle className="w-6 h-6 text-slate-400" />
          </button>
        </div>

        <div className="space-y-4 mb-6">
          <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
            <MapPin className="w-4 h-4 text-slate-400" /> {structureDetails.adresse}, {structureDetails.ville}
          </div>
          {structureDetails.telephone && (
            <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
              <Phone className="w-4 h-4 text-slate-400" /> {structureDetails.telephone}
            </div>
          )}
          
          <div className="space-y-2">
            <div className="flex items-center gap-3 text-sm">
              <Clock className="w-4 h-4 text-slate-400" /> 
              <span className="text-slate-600 dark:text-slate-300 font-bold">Statut actuel :</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${isCurrentlyOpen ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                {isCurrentlyOpen ? 'Ouvert' : 'Fermé'}
              </span>
            </div>
            
            {Object.keys(parsedSchedule).length > 0 && (
              <div className="mt-2 ml-7 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Horaires de la semaine</p>
                <div className="grid grid-cols-1 gap-1">
                  {Object.entries(parsedSchedule).map(([day, time]) => {
                    const isToday = day === ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"][new Date().getDay()];
                    return (
                      <div key={day} className={`flex justify-between text-[11px] ${isToday ? 'text-primary-500 font-bold' : 'text-slate-500'}`}>
                        <span>{day}</span>
                        <span>{time}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Authorization Section for Patient */}
          {isPatient && (
            <div className={`mt-4 p-4 rounded-2xl border ${hasAuthorizedStructure ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400' : 'bg-primary-500/10 border-primary-500/20 text-primary-700 dark:text-primary-400'}`}>
              <div className="flex items-start gap-3">
                {hasAuthorizedStructure ? <ShieldCheck className="w-5 h-5 flex-shrink-0 mt-0.5" /> : <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5" />}
                <div>
                  <p className="text-sm font-bold mb-1">Dossier Médical</p>
                  <p className="text-xs opacity-90 mb-3">
                    {hasAuthorizedStructure 
                      ? "Vous avez autorisé cette structure à consulter vos informations médicales basiques (allergies, groupe sanguin, consultations précédentes ici)."
                      : "Partagez votre dossier médical avec cette structure pour une meilleure prise en charge par leur équipe."}
                  </p>
                  {!hasAuthorizedStructure && (
                    <button 
                      onClick={() => handleAutoriserStructure(structureDetails.id)}
                      disabled={actionLoading === 'struct-' + structureDetails.id}
                      className="px-4 py-2 bg-primary-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-primary-500/20 hover:bg-primary-600 transition-all flex items-center gap-2"
                    >
                      {actionLoading === 'struct-' + structureDetails.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                      Autoriser la structure
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1">
          <h4 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
            <Stethoscope className="w-4 h-4" /> Médecins disponibles ({doctors.length})
          </h4>
          
          {loadingDetails ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary-500" /></div>
          ) : doctors.length === 0 ? (
            <p className="text-sm text-slate-500 italic text-center py-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">Aucun médecin enregistré pour le moment.</p>
          ) : (
            <div className="space-y-3">
              {doctors.map(doc => (
                <div key={doc.id} className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-full bg-primary-500/20 flex items-center justify-center text-primary-500 font-bold">
                      {doc.prenom[0]}{doc.nom[0]}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">Dr. {doc.prenom} {doc.nom}</p>
                      <p className="text-[10px] font-bold text-primary-500 uppercase tracking-widest">
                        {doc.specialite || "Médecin"}
                      </p>
                    </div>
                  </div>
                  <div className="pl-13 space-y-3 mt-3">
                    {/* Hide contact info for patients */}
                    {!isPatient && (
                      <div className="space-y-1">
                        {doc.telephone && (
                          <p className="text-xs text-slate-500 flex items-center gap-2"><Phone className="w-3 h-3" /> {doc.telephone}</p>
                        )}
                        <p className="text-xs text-slate-500 flex items-center gap-2"><Mail className="w-3 h-3" /> {doc.email}</p>
                      </div>
                    )}
                    
                    {isPatient && hasAuthorizedStructure && (
                      <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex flex-wrap gap-2">
                        {medecinTraitantId === doc.id ? (
                          <>
                            <div className="flex items-center gap-2 text-xs font-bold text-amber-500 bg-amber-500/10 px-3 py-1.5 rounded-lg w-fit">
                              <Star className="w-4 h-4 fill-amber-500" /> Médecin Traitant
                            </div>
                            <button 
                              onClick={async () => {
                                try {
                                  await startConversation(doc.id, "PRIVE");
                                  router.push('/dashboard/chat');
                                } catch (e) {
                                  console.error(e);
                                }
                              }}
                              className="flex items-center gap-2 text-xs font-bold text-primary-500 bg-primary-500/10 hover:bg-primary-500/20 px-3 py-1.5 rounded-lg transition-all w-fit"
                            >
                              <MessageSquare className="w-4 h-4" /> Message
                            </button>
                          </>
                        ) : (
                          <button 
                            onClick={() => handleDesignerMedecin(doc.id)}
                            disabled={!!actionLoading}
                            className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-amber-500 hover:bg-amber-500/10 px-3 py-1.5 rounded-lg transition-all border border-slate-200 dark:border-slate-700 hover:border-amber-500/30 w-fit"
                          >
                            {actionLoading === 'med-' + doc.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Star className="w-4 h-4" />}
                            Désigner comme médecin
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight" style={{ fontFamily: "var(--font-outfit)" }}>
            Trouver un Médecin
          </h1>
          <p className="text-slate-500 text-sm mt-1">Recherchez les hôpitaux et cliniques pour consulter leurs médecins.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-1 shadow-sm">
            <button 
              onClick={() => {setViewMode("list"); setSelectedStructureId(null);}}
              className={`p-2 rounded-xl transition-all ${viewMode === "list" ? "bg-primary-500 text-white shadow-lg" : "text-slate-500 hover:text-primary-500"}`}
            >
              <LayoutGrid className="w-5 h-5" />
            </button>
            <button 
              onClick={() => {setViewMode("map"); setSelectedStructureId(null);}}
              className={`p-2 rounded-xl transition-all ${viewMode === "map" ? "bg-primary-500 text-white shadow-lg" : "text-slate-500 hover:text-primary-500"}`}
            >
              <MapIcon className="w-5 h-5" />
            </button>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Ville, nom..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm focus:outline-none focus:border-primary-500 transition-all shadow-sm"
            />
          </div>
          
          <div className="relative w-full sm:w-64">
            <Stethoscope className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select 
              value={filterSpecialty}
              onChange={(e) => setFilterSpecialty(e.target.value)}
              className="w-full pl-12 pr-10 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm focus:outline-none focus:border-primary-500 transition-all shadow-sm appearance-none cursor-pointer"
            >
              <option value="ALL">Toutes spécialités</option>
              {MEDICAL_SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {viewMode === "map" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className={`relative h-[600px] rounded-[3rem] overflow-hidden border border-slate-200 dark:border-slate-800 shadow-2xl ${selectedStructureId ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
            <GlobePicker 
              structures={filtered.map(p => ({
                id: p.id,
                lat: p.latitude || 0,
                lng: p.longitude || 0,
                label: p.nom,
                type: p.type
              }))}
              onStructureClick={(id) => handleSelectStructure(id)}
              className="w-full h-full"
            />
          </div>
          
          {/* Side panel for Map mode */}
          {selectedStructureId && (
            <div className="lg:col-span-1 h-[600px] animate-slide-up lg:animate-fade-in">
              {renderDetails()}
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className={`${selectedStructureId ? 'lg:col-span-2' : 'lg:col-span-3'} grid grid-cols-1 md:grid-cols-2 gap-6`}>
            {filtered.length === 0 ? (
              <div className="col-span-full py-20 text-center bg-white dark:bg-slate-900 rounded-[3rem] border border-dashed border-slate-200 dark:border-slate-800">
                <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500 font-medium">Aucun établissement trouvé.</p>
              </div>
            ) : (
              filtered.map((s) => (
                <div 
                  key={s.id} 
                  onClick={() => handleSelectStructure(s.id)}
                  className={`group cursor-pointer bg-white dark:bg-[#0f172a]/80 backdrop-blur-xl border ${selectedStructureId === s.id ? 'border-primary-500 shadow-primary-500/20 shadow-xl' : 'border-slate-200 dark:border-slate-800/50 hover:border-primary-500/30'} rounded-[2.5rem] p-8 transition-all duration-300`}
                >
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform ${s.type === 'HOPITAL' ? 'bg-primary-500/10 text-primary-500' : 'bg-purple-500/10 text-purple-500'}`}>
                        <Building2 className="w-8 h-8" />
                      </div>
                      {isOpenNow(s) && (
                        <div className="px-3 py-1 bg-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase tracking-widest rounded-full">
                          Ouvert
                        </div>
                      )}
                    </div>
                    
                    <div>
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 line-clamp-1">{s.nom}</h3>
                      <div className="space-y-2">
                        <p className="text-sm text-slate-500 flex items-start gap-2"><MapPin className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" /> <span className="line-clamp-1">{s.adresse} · {s.ville}</span></p>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800/50 flex justify-end">
                       <button className="flex items-center gap-2 text-sm font-bold text-primary-500">
                         Voir les médecins <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                       </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Side panel for List mode */}
          {selectedStructureId && (
            <div className="lg:col-span-1 h-[80vh] sticky top-8">
              {renderDetails()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
