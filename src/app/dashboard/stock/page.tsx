"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { 
  Package, 
  Plus, 
  Search, 
  AlertTriangle, 
  ArrowUpRight, 
  ArrowDownRight, 
  History, 
  MoreVertical,
  Trash2,
  Edit,
  Loader2,
  Filter,
  CheckCircle2,
  XCircle,
  Pill,
  ShoppingBag,
  TrendingUp,
  PackageCheck
} from "lucide-react";
import { getMyStock, StockMedicament, StockInfo, removeStockItem, updateStockQuantite } from "@/lib/api_pharmacie";
import StockModal from "@/components/modals/StockModal";

export default function StockPage() {
  const { user } = useAuth();
  const [stockInfo, setStockInfo] = useState<StockInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "low" | "rupture">("all");
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user?.structureId) return;
    setLoading(true);
    try {
      const res = await getMyStock(user.structureId);
      setStockInfo(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user?.structureId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredStocks = stockInfo?.stocks.filter(s => {
    const matchesSearch = s.medicament.nom.toLowerCase().includes(search.toLowerCase()) || 
                          s.medicament.nomGenerique?.toLowerCase().includes(search.toLowerCase());
    
    if (filter === "low") return matchesSearch && s.quantite > 0 && s.quantite < 10;
    if (filter === "rupture") return matchesSearch && s.quantite === 0;
    return matchesSearch;
  }) || [];

  const handleUpdateQuantite = async (stockId: string, variation: number) => {
    if (!user?.structureId) return;
    try {
      await updateStockQuantite(user.structureId, stockId, variation);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemove = async (stockId: string) => {
    if (!user?.structureId || !confirm("Voulez-vous vraiment retirer ce médicament de votre stock ?")) return;
    try {
      await removeStockItem(user.structureId, stockId);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading && !stockInfo) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-10 h-10 text-primary-500 animate-spin" />
        <p className="text-slate-500 animate-pulse">Chargement de l'inventaire...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in pb-20">
      {/* Header Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-[#0f172a]/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800/50 rounded-[2rem] p-6 shadow-xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary-500/10 flex items-center justify-center text-primary-500"><Package className="w-6 h-6" /></div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Total Produits</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white">{stockInfo?.stocks.length || 0}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-[#0f172a]/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800/50 rounded-[2rem] p-6 shadow-xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500"><AlertTriangle className="w-6 h-6" /></div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Stock Bas</p>
            <p className="text-2xl font-black text-amber-500">{stockInfo?.alertes.stockBas.length || 0}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-[#0f172a]/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800/50 rounded-[2rem] p-6 shadow-xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-500"><XCircle className="w-6 h-6" /></div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Rupture</p>
            <p className="text-2xl font-black text-rose-500">{stockInfo?.alertes.rupture.length || 0}</p>
          </div>
        </div>
        <div className="bg-primary-600 rounded-[2rem] p-6 shadow-2xl text-white flex items-center gap-4 relative overflow-hidden group">
          <TrendingUp className="absolute -right-2 -bottom-2 w-20 h-20 opacity-10 group-hover:scale-110 transition-transform" />
          <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center"><ShoppingBag className="w-6 h-6" /></div>
          <div className="relative z-10">
            <p className="text-xs font-bold text-white/70 uppercase tracking-widest">Valeur Stock</p>
            <p className="text-xl font-black">GNF {stockInfo?.stocks.reduce((acc, curr) => acc + (curr.prixUnitaire || 0) * curr.quantite, 0).toLocaleString() || 0}</p>
          </div>
        </div>
      </div>

      {/* Main Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Rechercher un médicament..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm focus:outline-none focus:border-primary-500 transition-all shadow-sm"
            />
          </div>
          <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-1 shadow-sm shrink-0">
             <button onClick={() => setFilter("all")} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${filter === "all" ? "bg-slate-100 dark:bg-slate-800 text-primary-500" : "text-slate-500 hover:text-primary-500"}`}>Tous</button>
             <button onClick={() => setFilter("low")} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${filter === "low" ? "bg-amber-500/10 text-amber-500" : "text-slate-500 hover:text-amber-500"}`}>Alertes</button>
             <button onClick={() => setFilter("rupture")} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${filter === "rupture" ? "bg-rose-500/10 text-rose-500" : "text-slate-500 hover:text-rose-500"}`}>Rupture</button>
          </div>
        </div>
        
        <button 
          onClick={() => setIsModalOpen(true)}
          className="w-full sm:w-auto px-6 py-3.5 bg-primary-500 text-white rounded-2xl font-bold text-sm shadow-xl shadow-primary-500/20 hover:bg-primary-600 transition-all flex items-center justify-center gap-2 group"
        >
          <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
          Ajouter un médicament
        </button>
      </div>

      {/* Stock Table */}
      <div className="bg-white dark:bg-[#0f172a]/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800/50 rounded-[2.5rem] overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800/50">
                <th className="px-8 py-5 text-left text-xs font-black text-slate-400 uppercase tracking-widest">Produit</th>
                <th className="px-8 py-5 text-left text-xs font-black text-slate-400 uppercase tracking-widest">Catégorie</th>
                <th className="px-8 py-5 text-center text-xs font-black text-slate-400 uppercase tracking-widest">Quantité</th>
                <th className="px-8 py-5 text-right text-xs font-black text-slate-400 uppercase tracking-widest">Prix (GNF)</th>
                <th className="px-8 py-5 text-center text-xs font-black text-slate-400 uppercase tracking-widest">Statut</th>
                <th className="px-8 py-5 text-right text-xs font-black text-slate-400 uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
              {filteredStocks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center">
                    <Package className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                    <p className="text-slate-500 font-medium">Aucun médicament trouvé dans votre inventaire.</p>
                  </td>
                </tr>
              ) : (
                filteredStocks.map((s) => (
                  <tr key={s.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${s.quantite === 0 ? 'bg-rose-500/10 text-rose-500' : 'bg-primary-500/10 text-primary-500'}`}>
                          <Pill className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white group-hover:text-primary-500 transition-colors">{s.medicament.nom}</p>
                          <p className="text-[10px] text-slate-500 uppercase tracking-tighter">{s.medicament.nomGenerique || "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-black rounded-full uppercase tracking-widest border border-slate-200 dark:border-slate-700">
                        {s.medicament.categorie}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center justify-center gap-3">
                        <button 
                          onClick={() => handleUpdateQuantite(s.id, -1)}
                          disabled={s.quantite === 0}
                          className="p-1 rounded-lg hover:bg-rose-500/10 text-slate-400 hover:text-rose-500 transition-colors disabled:opacity-30"
                        >
                          <ArrowDownRight className="w-4 h-4" />
                        </button>
                        <span className={`text-sm font-black w-8 text-center ${s.quantite < 10 ? 'text-amber-500' : 'text-slate-900 dark:text-white'}`}>
                          {s.quantite}
                        </span>
                        <button 
                          onClick={() => handleUpdateQuantite(s.id, 1)}
                          className="p-1 rounded-lg hover:bg-emerald-500/10 text-slate-400 hover:text-emerald-500 transition-colors"
                        >
                          <ArrowUpRight className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right font-mono text-sm font-bold text-slate-600 dark:text-slate-400">
                      {s.prixUnitaire?.toLocaleString() || "—"}
                    </td>
                    <td className="px-8 py-5 text-center">
                      <div className="flex justify-center">
                        {s.quantite === 0 ? (
                          <span className="px-2.5 py-1 bg-rose-500/10 text-rose-500 text-[10px] font-black rounded-full border border-rose-500/20 uppercase tracking-widest">Rupture</span>
                        ) : s.quantite < 10 ? (
                          <span className="px-2.5 py-1 bg-amber-500/10 text-amber-500 text-[10px] font-black rounded-full border border-amber-500/20 uppercase tracking-widest">Faible</span>
                        ) : (
                          <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-500 text-[10px] font-black rounded-full border border-emerald-500/20 uppercase tracking-widest">OK</span>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button className="p-2 rounded-xl text-slate-400 hover:text-primary-500 hover:bg-primary-500/10 transition-all"><Edit className="w-4 h-4" /></button>
                        <button 
                          onClick={() => handleRemove(s.id)}
                          className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {user?.structureId && (
        <StockModal 
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          structureId={user.structureId}
          onSuccess={fetchData}
        />
      )}
    </div>
  );
}
