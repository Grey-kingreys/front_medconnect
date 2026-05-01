"use client";

import { useState, useEffect, useCallback } from "react";
import { 
  Pill, 
  Search, 
  MapPin, 
  Phone, 
  Clock, 
  ChevronRight, 
  Filter, 
  Building2, 
  Map as MapIcon, 
  LayoutGrid,
  Loader2,
  CheckCircle2,
  XCircle,
  Package,
  ExternalLink
} from "lucide-react";
import { getAllStructures, MyStructure } from "@/lib/api_structure";
import GlobePicker from "@/components/GlobePicker";

export default function PharmaciesPage() {
  const [pharmacies, setPharmacies] = useState<MyStructure[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [selectedPharmacy, setSelectedPharmacy] = useState<MyStructure | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAllStructures();
      // Filter only configured and active pharmacies
      setPharmacies(res.data.filter(s => s.type === "PHARMACIE"));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = pharmacies.filter(p => 
    p.nom.toLowerCase().includes(search.toLowerCase()) ||
    (p.ville || "").toLowerCase().includes(search.toLowerCase()) ||
    (p.adresse || "").toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
        <p className="text-slate-500 animate-pulse">Recherche des pharmacies...</p>
      </div>
    );
  }

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

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight" style={{ fontFamily: "var(--font-outfit)" }}>
            Pharmacies Proches
          </h1>
          <p className="text-slate-500 text-sm mt-1">Trouvez les pharmacies de garde et vérifiez la disponibilité des médicaments.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-1 shadow-sm">
            <button 
              onClick={() => setViewMode("list")}
              className={`p-2 rounded-xl transition-all ${viewMode === "list" ? "bg-emerald-500 text-white shadow-lg" : "text-slate-500 hover:text-emerald-500"}`}
            >
              <LayoutGrid className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setViewMode("map")}
              className={`p-2 rounded-xl transition-all ${viewMode === "map" ? "bg-emerald-500 text-white shadow-lg" : "text-slate-500 hover:text-emerald-500"}`}
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
              className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm focus:outline-none focus:border-emerald-500 transition-all shadow-sm"
            />
          </div>
        </div>
      </div>

      {viewMode === "map" ? (
        <div className="relative h-[600px] rounded-[3rem] overflow-hidden border border-slate-200 dark:border-slate-800 shadow-2xl">
          <GlobePicker 
            structures={filtered.map(p => ({
              id: p.id,
              lat: p.latitude || 0,
              lng: p.longitude || 0,
              label: p.nom,
              type: p.type
            }))}
            onStructureClick={(id) => {
              const p = pharmacies.find(x => x.id === id);
              if (p) setSelectedPharmacy(p);
            }}
            className="w-full h-full"
          />
          
          {/* Overlay info if selected from map */}
          {selectedPharmacy && (
            <div className="absolute bottom-8 left-8 right-8 sm:left-auto sm:right-8 sm:w-96 animate-slide-up">
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-500"><Pill className="w-6 h-6" /></div>
                  <button onClick={() => setSelectedPharmacy(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"><XCircle className="w-5 h-5 text-slate-400" /></button>
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{selectedPharmacy.nom}</h3>
                <p className="text-sm text-slate-500 mb-4 flex items-center gap-2"><MapPin className="w-4 h-4" /> {selectedPharmacy.adresse}, {selectedPharmacy.ville}</p>
                
                <div className="flex items-center gap-2 text-xs font-bold mb-6">
                  <span className={`px-2 py-0.5 rounded-full uppercase tracking-widest ${isOpenNow(selectedPharmacy) ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                    {isOpenNow(selectedPharmacy) ? 'Ouvert' : 'Fermé'}
                  </span>
                  {selectedPharmacy.estDeGarde && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 uppercase tracking-widest">De Garde</span>
                  )}
                </div>

                <button className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-bold shadow-xl shadow-emerald-500/20 hover:bg-emerald-600 transition-all flex items-center justify-center gap-2">
                  Consulter le stock <Package className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.length === 0 ? (
            <div className="col-span-full py-20 text-center bg-white dark:bg-slate-900 rounded-[3rem] border border-dashed border-slate-200 dark:border-slate-800">
               <Pill className="w-12 h-12 text-slate-300 mx-auto mb-4" />
               <p className="text-slate-500 font-medium">Aucune pharmacie trouvée dans cette zone.</p>
            </div>
          ) : (
            filtered.map((p) => (
              <div key={p.id} className="group bg-white dark:bg-[#0f172a]/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800/50 rounded-[2.5rem] p-8 hover:border-emerald-500/30 hover:shadow-2xl hover:shadow-emerald-500/5 transition-all duration-300 relative overflow-hidden">
                {p.estDeGarde && (
                  <div className="absolute top-0 right-0 px-6 py-2 bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest rounded-bl-3xl shadow-lg">
                    De Garde
                  </div>
                )}
                
                <div className="space-y-6">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform">
                    <Building2 className="w-8 h-8" />
                  </div>
                  
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{p.nom}</h3>
                    <div className="space-y-2">
                      <p className="text-sm text-slate-500 flex items-start gap-2"><MapPin className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" /> {p.adresse} · {p.ville}</p>
                      <p className="text-sm text-slate-500 flex items-center gap-2"><Phone className="w-4 h-4 text-slate-400" /> {p.telephone || "Non renseigné"}</p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800/50 flex items-center justify-between">
                    <div className={`flex items-center gap-2 text-xs font-bold ${isOpenNow(p) ? 'text-emerald-500' : 'text-rose-500'}`}>
                      <Clock className="w-4 h-4" />
                      <span>{isOpenNow(p) ? 'Ouvert' : 'Fermé'}</span>
                    </div>
                    <button className="p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl text-slate-400 group-hover:text-emerald-500 group-hover:bg-emerald-500/10 transition-all">
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <button className="w-full py-4 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2">
                    Voir les stocks <Package className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
