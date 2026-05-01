"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useSearchParams } from "next/navigation";
import { 
  Search, 
  Pill, 
  MapPin, 
  Phone, 
  Clock, 
  ChevronRight, 
  Filter, 
  Loader2,
  Navigation,
  ExternalLink,
  Navigation2,
  Map as MapIcon,
  LayoutGrid,
  Info,
  DollarSign,
  LocateFixed,
  XCircle,
  AlertTriangle
} from "lucide-react";
import { StockMedicament, rechercherMedicaments } from "@/lib/api_pharmacie";
import GlobePicker from "@/components/GlobePicker";

function MedicamentsContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const pharmacieId = searchParams.get("pharmacieId");

  const [results, setResults] = useState<StockMedicament[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [selectedStock, setSelectedStock] = useState<StockMedicament | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  
  const [sortBy, setSortBy] = useState<"distance" | "price">("distance");

  // Get user location on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setLocationError(null);
        },
        (err) => {
          console.error("Geolocation error:", err);
          setLocationError("Accès à la position refusé. Tri par prix activé par défaut.");
          setSortBy("price");
        }
      );
    } else {
      setLocationError("Géolocalisation non supportée par votre navigateur.");
      setSortBy("price");
    }
  }, []);

  const handleSearch = useCallback(async (searchQuery: string, pId?: string | null) => {
    setLoading(true);
    try {
      const res = await rechercherMedicaments(
        searchQuery || undefined, 
        userLocation?.lat, 
        userLocation?.lng,
        undefined,
        pId || undefined
      );
      setResults(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [userLocation]);

  // Initial load or search query change
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      // Load if we have a search query OR if it's the initial load (empty query but we want to show something)
      handleSearch(q, pharmacieId);
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [q, pharmacieId, handleSearch]);

  const sortedResults = [...results].sort((a, b) => {
    if (sortBy === "distance") {
      if (a.distanceKm === null || a.distanceKm === undefined) return 1;
      if (b.distanceKm === null || b.distanceKm === undefined) return -1;
      return a.distanceKm - b.distanceKm;
    } else {
      return (a.prixUnitaire || 0) - (b.prixUnitaire || 0);
    }
  });

  const handleSelectOnMap = (stock: StockMedicament) => {
    setSelectedStock(stock);
    setViewMode("map");
  };

  const handleRoute = (stock: StockMedicament) => {
    if (!stock.structure?.latitude || !stock.structure?.longitude) return;
    const origin = userLocation ? `&origin=${userLocation.lat},${userLocation.lng}` : "";
    const url = `https://www.google.com/maps/dir/?api=1&destination=${stock.structure.latitude},${stock.structure.longitude}${origin}`;
    window.open(url, '_blank');
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in pb-20">
      {/* Header & Search */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight" style={{ fontFamily: "var(--font-outfit)" }}>
              Trouver un médicament
            </h1>
            <p className="text-slate-500 text-sm mt-1">Recherchez la disponibilité et comparez les prix à proximité.</p>
          </div>
          
          <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-1 shadow-sm shrink-0">
             <button 
              onClick={() => setViewMode("list")} 
              className={`p-2 rounded-xl transition-all ${viewMode === "list" ? "bg-primary-500 text-white shadow-lg" : "text-slate-500 hover:text-primary-500"}`}
             >
              <LayoutGrid className="w-5 h-5" />
             </button>
             <button 
              onClick={() => setViewMode("map")} 
              className={`p-2 rounded-xl transition-all ${viewMode === "map" ? "bg-primary-500 text-white shadow-lg" : "text-slate-500 hover:text-primary-500"}`}
             >
              <MapIcon className="w-5 h-5" />
             </button>
          </div>
        </div>

        {locationError && (
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center gap-3 text-amber-600 text-xs font-bold animate-fade-in">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <p>{locationError}</p>
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1 group">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary-500 to-cyan-500 rounded-2xl blur opacity-20 group-focus-within:opacity-40 transition-all" />
            <div className="relative flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input 
                type="text" 
                placeholder="Nom du médicament (ex: Coartem, Paracétamol...)" 
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-full pl-14 pr-4 py-4 bg-transparent rounded-2xl text-base focus:outline-none focus:ring-0 transition-all"
              />
              {loading && <Loader2 className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-primary-500 animate-spin" />}
            </div>
          </div>
          
          <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-1.5 shadow-sm shrink-0">
            <button 
              onClick={() => setSortBy("distance")}
              disabled={!!locationError}
              className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all ${sortBy === "distance" ? "bg-primary-500 text-white shadow-lg shadow-primary-500/20" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed"}`}
            >
              <LocateFixed className="w-4 h-4" /> Distance
            </button>
            <button 
              onClick={() => setSortBy("price")}
              className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all ${sortBy === "price" ? "bg-primary-500 text-white shadow-lg shadow-primary-500/20" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"}`}
            >
              <DollarSign className="w-4 h-4" /> Prix
            </button>
          </div>
        </div>
      </div>

      {viewMode === "map" ? (
        <div className="relative h-[650px] rounded-[3rem] overflow-hidden border border-slate-200 dark:border-slate-800 shadow-2xl">
          <GlobePicker 
            structures={sortedResults.map(r => ({
              id: r.id,
              lat: r.structure?.latitude || 0,
              lng: r.structure?.longitude || 0,
              label: r.structure?.nom || "",
              type: "PHARMACIE"
            }))}
            initialLat={selectedStock?.structure?.latitude}
            initialLng={selectedStock?.structure?.longitude}
            onStructureClick={(id) => {
              const s = results.find(x => x.id === id);
              if (s) setSelectedStock(s);
            }}
            className="w-full h-full"
          />
          
          {selectedStock && (
            <div className="absolute bottom-8 left-8 right-8 sm:left-auto sm:right-8 sm:w-96 animate-slide-up">
              <div className="bg-white dark:bg-slate-900/90 backdrop-blur-xl rounded-[2.5rem] p-6 shadow-2xl border border-white/20 dark:border-slate-700/30 overflow-hidden relative group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                
                <div className="relative space-y-5">
                  <div className="flex items-center justify-between">
                    <div className="p-3 bg-primary-500/10 rounded-2xl text-primary-500"><Pill className="w-6 h-6" /></div>
                    <button onClick={() => setSelectedStock(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 transition-colors">
                      <XCircle className="w-6 h-6" />
                    </button>
                  </div>
                  
                  <div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white leading-tight">{selectedStock.medicament.nom}</h3>
                    <p className="text-sm font-bold text-primary-500 mt-1">{selectedStock.structure?.nom}</p>
                    <p className="text-xs text-slate-500 flex items-center gap-2 mt-2"><MapPin className="w-4 h-4" /> {selectedStock.structure?.adresse}, {selectedStock.structure?.ville}</p>
                  </div>

                  <div className="flex items-center justify-between py-4 border-y border-slate-100 dark:border-slate-800/50">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Prix</p>
                      <p className="text-lg font-black text-slate-900 dark:text-white">GNF {selectedStock.prixUnitaire?.toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Distance</p>
                      <p className="text-lg font-black text-slate-900 dark:text-white">{selectedStock.distanceKm?.toFixed(1) || "—"} km</p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button 
                      onClick={() => handleRoute(selectedStock)}
                      className="flex-1 py-4 bg-primary-500 text-white rounded-2xl font-bold shadow-xl shadow-primary-500/20 hover:bg-primary-600 transition-all flex items-center justify-center gap-2"
                    >
                      <Navigation2 className="w-4 h-4" /> Itinéraire
                    </button>
                    <button className="p-4 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl hover:text-primary-500 transition-all">
                      <Phone className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {sortedResults.length === 0 && !loading ? (
            <div className="col-span-full py-32 text-center space-y-6 bg-white dark:bg-slate-900/50 rounded-[4rem] border border-dashed border-slate-200 dark:border-slate-800">
              <div className="w-24 h-24 rounded-[2.5rem] bg-primary-500/10 flex items-center justify-center mx-auto text-primary-500">
                <Info className="w-10 h-10" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Aucun médicament disponible</h3>
                <p className="text-slate-500 text-sm mt-2">Réessayez avec un autre nom ou changez vos filtres.</p>
              </div>
            </div>
          ) : (
            sortedResults.map((s) => (
              <div key={s.id} className="group bg-white dark:bg-[#0f172a]/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800/50 rounded-[3rem] p-8 hover:border-primary-500/30 hover:shadow-2xl transition-all duration-500 relative overflow-hidden flex flex-col">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                
                <div className="flex-1 space-y-6">
                  <div className="flex items-start justify-between">
                    <div className="w-16 h-16 rounded-[1.5rem] bg-primary-500/10 flex items-center justify-center text-primary-500 group-hover:scale-110 transition-transform">
                      <Pill className="w-8 h-8" />
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Prix Unitaire</p>
                      <p className="text-xl font-black text-slate-900 dark:text-white group-hover:text-primary-500 transition-colors">
                        GNF {s.prixUnitaire?.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white leading-tight">{s.medicament.nom}</h3>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1 opacity-60">{s.medicament.nomGenerique || "Catégorie: " + s.medicament.categorie}</p>
                  </div>

                  <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700">
                        <MapPin className="w-4 h-4 text-primary-500" />
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Structure</p>
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">{s.structure?.nom}</p>
                      </div>
                      <div className="text-right">
                         <span className="text-[10px] font-black text-primary-500 bg-primary-500/10 px-2 py-1 rounded-md">
                           {s.distanceKm?.toFixed(1) || "—"} km
                         </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800/50 flex gap-3">
                  <button 
                    onClick={() => handleSelectOnMap(s)}
                    className="flex-1 py-4 bg-slate-900 dark:bg-slate-800 text-white rounded-2xl text-xs font-bold hover:opacity-90 transition-all flex items-center justify-center gap-2"
                  >
                    <MapIcon className="w-4 h-4" /> Voir Carte
                  </button>
                  <button 
                    onClick={() => handleRoute(s)}
                    className="flex-1 py-4 bg-primary-500 text-white rounded-2xl text-xs font-bold shadow-lg shadow-primary-500/20 hover:bg-primary-600 transition-all flex items-center justify-center gap-2"
                  >
                    <Navigation className="w-4 h-4" /> Itinéraire
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

export default function MedicamentsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-10 h-10 text-primary-500 animate-spin" />
      </div>
    }>
      <MedicamentsContent />
    </Suspense>
  );
}
