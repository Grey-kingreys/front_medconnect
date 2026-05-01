"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { 
  Plus, 
  Search, 
  Pill, 
  Edit, 
  Trash2, 
  Loader2, 
  Filter,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Package,
  Info
} from "lucide-react";
import { getCatalogue, Medicament, createMedicament } from "@/lib/api_pharmacie";

export default function CataloguePage() {
  const { user } = useAuth();
  const [medicaments, setMedicaments] = useState<Medicament[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    nom: "",
    nomGenerique: "",
    categorie: "",
    description: "",
    ordonnanceRequise: false
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getCatalogue(search);
      setMedicaments(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData();
    }, 500);
    return () => clearTimeout(timer);
  }, [fetchData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await createMedicament(form);
      setIsModalOpen(false);
      setForm({ nom: "", nomGenerique: "", categorie: "", description: "", ordonnanceRequise: false });
      fetchData();
    } catch (err: any) {
      setError(err.message || "Erreur lors de la création");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight" style={{ fontFamily: "var(--font-outfit)" }}>
            Catalogue Global
          </h1>
          <p className="text-slate-500 text-sm mt-1">Gérez la liste de référence des médicaments pour toutes les pharmacies.</p>
        </div>
        
        <button 
          onClick={() => setIsModalOpen(true)}
          className="w-full sm:w-auto px-6 py-3.5 bg-primary-500 text-white rounded-2xl font-bold text-sm shadow-xl shadow-primary-500/20 hover:bg-primary-600 transition-all flex items-center justify-center gap-2 group"
        >
          <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
          Ajouter au catalogue
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative group">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input 
          type="text" 
          placeholder="Rechercher un médicament dans le catalogue..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-14 pr-4 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm focus:outline-none focus:border-primary-500 transition-all"
        />
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#0f172a]/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800/50 rounded-[2.5rem] overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800/50">
                <th className="px-8 py-5 text-left text-xs font-black text-slate-400 uppercase tracking-widest">Médicament</th>
                <th className="px-8 py-5 text-left text-xs font-black text-slate-400 uppercase tracking-widest">Générique (DCI)</th>
                <th className="px-8 py-5 text-left text-xs font-black text-slate-400 uppercase tracking-widest">Catégorie</th>
                <th className="px-8 py-5 text-center text-xs font-black text-slate-400 uppercase tracking-widest">Ordonnance</th>
                <th className="px-8 py-5 text-right text-xs font-black text-slate-400 uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
              {loading && medicaments.length === 0 ? (
                 <tr>
                  <td colSpan={5} className="px-8 py-20 text-center">
                    <Loader2 className="w-10 h-10 text-primary-500 animate-spin mx-auto mb-4" />
                    <p className="text-slate-500">Chargement du catalogue...</p>
                  </td>
                </tr>
              ) : medicaments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center">
                    <Package className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                    <p className="text-slate-500 font-medium">Aucun médicament trouvé.</p>
                  </td>
                </tr>
              ) : (
                medicaments.map((m) => (
                  <tr key={m.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-primary-500/10 text-primary-500 flex items-center justify-center">
                          <Pill className="w-5 h-5" />
                        </div>
                        <p className="font-bold text-slate-900 dark:text-white">{m.nom}</p>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-sm text-slate-500 italic">
                      {m.nomGenerique || "—"}
                    </td>
                    <td className="px-8 py-5">
                      <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-black rounded-full uppercase tracking-widest border border-slate-200 dark:border-slate-700">
                        {m.categorie}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-center">
                      {m.ordonnanceRequise ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 text-amber-500 text-[10px] font-black rounded-full border border-amber-500/20 uppercase tracking-widest">
                          Requis
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 text-emerald-500 text-[10px] font-black rounded-full border border-emerald-500/20 uppercase tracking-widest">
                          Libre
                        </span>
                      )}
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button className="p-2 rounded-xl text-slate-400 hover:text-primary-500 hover:bg-primary-500/10 transition-all"><Edit className="w-4 h-4" /></button>
                        <button className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-all"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
          <div className="bg-white dark:bg-[#0f172a] w-full max-w-xl rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-scale-in">
            <div className="p-8 border-b border-slate-100 dark:border-slate-800/50 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-primary-500/10 flex items-center justify-center text-primary-500"><Pill className="w-6 h-6" /></div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white">Nouveau Médicament</h2>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                <XCircle className="w-6 h-6 text-slate-400" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Nom commercial</label>
                <input 
                  type="text" 
                  required
                  placeholder="Ex: Coartem 20/120"
                  value={form.nom}
                  onChange={(e) => setForm({...form, nom: e.target.value})}
                  className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm focus:outline-none focus:border-primary-500 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">DCI (Générique)</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Artémether"
                    value={form.nomGenerique}
                    onChange={(e) => setForm({...form, nomGenerique: e.target.value})}
                    className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm focus:outline-none focus:border-primary-500 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Catégorie</label>
                  <input 
                    type="text" 
                    required
                    placeholder="Ex: Antipaludéen"
                    value={form.categorie}
                    onChange={(e) => setForm({...form, categorie: e.target.value})}
                    className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm focus:outline-none focus:border-primary-500 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Description</label>
                <textarea 
                  placeholder="Usage, contre-indications..."
                  value={form.description}
                  onChange={(e) => setForm({...form, description: e.target.value})}
                  className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm focus:outline-none focus:border-primary-500 transition-all h-24 resize-none"
                />
              </div>

              <label className="flex items-center gap-3 cursor-pointer group">
                <input 
                  type="checkbox"
                  checked={form.ordonnanceRequise}
                  onChange={(e) => setForm({...form, ordonnanceRequise: e.target.checked})}
                  className="w-5 h-5 rounded border-slate-300 text-primary-500 focus:ring-primary-500"
                />
                <span className="text-sm font-bold text-slate-600 dark:text-slate-400 group-hover:text-primary-500 transition-colors">Vendu uniquement sur ordonnance ?</span>
              </label>

              {error && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3 text-rose-500 text-sm">
                  <AlertCircle className="w-5 h-5" />
                  <p>{error}</p>
                </div>
              )}

              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl font-bold hover:bg-slate-200 transition-all">Annuler</button>
                <button type="submit" disabled={saving} className="flex-[2] py-4 bg-primary-500 text-white rounded-2xl font-bold shadow-xl shadow-primary-500/20 hover:bg-primary-600 transition-all flex items-center justify-center gap-2">
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                  Enregistrer au catalogue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
