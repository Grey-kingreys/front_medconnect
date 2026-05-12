"use client";

import { useState, useEffect, useCallback } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { 
  Search, 
  Pill, 
  ChevronRight, 
  Loader2, 
  Filter,
  Package,
  Info,
  ExternalLink,
  ArrowRight,
  ShieldCheck,
  Stethoscope,
  Sparkles
} from "lucide-react";
import { getCatalogue, getCategories, Medicament } from "@/lib/api_pharmacie";
import Link from "next/link";
import Image from "next/image";

export default function PublicCataloguePage() {
  const [medicaments, setMedicaments] = useState<Medicament[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [medsRes, catsRes] = await Promise.all([
        getCatalogue(search, selectedCategory),
        getCategories()
      ]);
      setMedicaments(medsRes.data);
      setCategories(catsRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search, selectedCategory]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData();
    }, 500);
    return () => clearTimeout(timer);
  }, [fetchData]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#030712] transition-colors duration-500">
      <Navbar />

      <main className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* Hero Section */}
        <div className="relative mb-16 text-center space-y-6 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-500/10 text-primary-500 text-xs font-bold uppercase tracking-widest border border-primary-500/20 mb-4">
            <Sparkles className="w-4 h-4" />
            Base de données officielle
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-slate-900 dark:text-white tracking-tight" style={{ fontFamily: "var(--font-outfit)" }}>
            Catalogue des <span className="gradient-text">Médicaments</span>
          </h1>
          <p className="text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Consultez la liste complète des médicaments autorisés, leurs dosages, 
            et vérifiez s'ils nécessitent une ordonnance.
          </p>
        </div>

        {/* Search & Filter Bar */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-12">
          <div className="lg:col-span-3 relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary-500 to-cyan-500 rounded-[2rem] blur opacity-20 group-focus-within:opacity-40 transition-all duration-500" />
            <div className="relative flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/50 rounded-[2rem] shadow-xl overflow-hidden backdrop-blur-xl">
              <Search className="absolute left-6 w-6 h-6 text-slate-400" />
              <input 
                type="text" 
                placeholder="Rechercher par nom, DCI ou catégorie..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-16 pr-6 py-6 bg-transparent text-lg focus:outline-none placeholder:text-slate-400 dark:text-white"
              />
              {loading && <Loader2 className="absolute right-6 w-6 h-6 text-primary-500 animate-spin" />}
            </div>
          </div>

          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-primary-500 rounded-[2rem] blur opacity-10 group-focus-within:opacity-30 transition-all duration-500" />
            <div className="relative flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/50 rounded-[2rem] shadow-xl overflow-hidden h-full backdrop-blur-xl">
              <Filter className="absolute left-6 w-5 h-5 text-slate-400" />
              <select 
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full pl-14 pr-6 py-6 bg-transparent text-sm font-bold uppercase tracking-wider focus:outline-none appearance-none dark:text-white cursor-pointer"
              >
                <option value="">Toutes les catégories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Results Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {loading && medicaments.length === 0 ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-64 rounded-[2.5rem] bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 animate-pulse" />
            ))
          ) : medicaments.length === 0 ? (
            <div className="col-span-full py-32 text-center bg-white dark:bg-slate-900/50 rounded-[4rem] border border-dashed border-slate-200 dark:border-slate-800">
              <div className="w-24 h-24 rounded-[2.5rem] bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400 mb-6">
                <Package className="w-12 h-12" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Aucun médicament trouvé</h3>
              <p className="text-slate-500 mt-2">Réessayez avec d'autres mots-clés ou filtres.</p>
            </div>
          ) : (
            medicaments.map((med) => (
              <div 
                key={med.id} 
                className="group relative bg-white dark:bg-[#0f172a]/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800/50 rounded-[3rem] p-8 hover:border-primary-500/40 hover:shadow-2xl transition-all duration-500 flex flex-col overflow-hidden"
              >
                {/* Background Decoration */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-primary-500/10 transition-colors" />
                
                <div className="flex-1 space-y-6 relative">
                  <div className="flex items-center justify-between">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500/10 to-cyan-500/10 flex items-center justify-center text-primary-500 group-hover:scale-110 transition-transform duration-500">
                      <Pill className="w-7 h-7" />
                    </div>
                    {med.ordonnanceRequise ? (
                      <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 text-amber-500 text-[10px] font-black rounded-full border border-amber-500/20 uppercase tracking-widest">
                        Ordonnance Requise
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-500 text-[10px] font-black rounded-full border border-emerald-500/20 uppercase tracking-widest">
                        Vente Libre
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white leading-tight group-hover:text-primary-500 transition-colors">
                      {med.nom}
                    </h3>
                    <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mt-1 opacity-60">
                      {med.nomGenerique || "Dénomination Commune"}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-black rounded-lg uppercase tracking-wider border border-slate-200 dark:border-slate-700">
                      {med.categorie}
                    </span>
                    {med.formes.map(forme => (
                      <span key={forme} className="px-3 py-1 bg-primary-500/5 text-primary-600 dark:text-primary-400 text-[10px] font-black rounded-lg uppercase tracking-wider border border-primary-500/10">
                        {forme}
                      </span>
                    ))}
                  </div>

                  <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-3 leading-relaxed">
                    {med.description || "Aucune description détaillée disponible pour ce médicament dans notre base de données."}
                  </p>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800/50 flex flex-col gap-3">
                  <Link 
                    href={`/dashboard/medicaments?q=${encodeURIComponent(med.nom)}`}
                    className="w-full py-4 bg-slate-900 dark:bg-slate-800 text-white rounded-2xl text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-700 transition-all flex items-center justify-center gap-2 group/btn"
                  >
                    Trouver en pharmacie
                    <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Info Section */}
        <div className="mt-32 grid grid-cols-1 md:grid-cols-3 gap-12 border-t border-slate-200 dark:border-slate-800 pt-20">
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-secondary-500/10 flex items-center justify-center text-secondary-500">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h4 className="text-xl font-bold text-slate-900 dark:text-white">Fiabilité Totale</h4>
            <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
              Les données de notre catalogue sont mises à jour quotidiennement en collaboration avec les autorités sanitaires.
            </p>
          </div>
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-primary-500/10 flex items-center justify-center text-primary-500">
              <Stethoscope className="w-6 h-6" />
            </div>
            <h4 className="text-xl font-bold text-slate-900 dark:text-white">Conseil Médical</h4>
            <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
              Ne pratiquez jamais l'automédication. Consultez toujours un professionnel de santé avant de prendre un traitement.
            </p>
          </div>
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-accent-500/10 flex items-center justify-center text-accent-500">
              <Info className="w-6 h-6" />
            </div>
            <h4 className="text-xl font-bold text-slate-900 dark:text-white">Accessibilité</h4>
            <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
              Trouvez instantanément la pharmacie la plus proche disposant de votre médicament au meilleur prix.
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
