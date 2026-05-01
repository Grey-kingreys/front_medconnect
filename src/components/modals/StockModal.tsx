"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { X, Search, Pill, Loader2, Save, Plus, Package, Info, AlertCircle, ChevronDown, CheckCircle2 } from "lucide-react";
import { getCatalogue, Medicament, upsertStock, createMedicament } from "@/lib/api_pharmacie";

interface StockModalProps {
  isOpen: boolean;
  onClose: () => void;
  structureId: string;
  onSuccess: () => void;
}

export default function StockModal({ isOpen, onClose, structureId, onSuccess }: StockModalProps) {
  const [search, setSearch] = useState("");
  const [catalogue, setCatalogue] = useState<Medicament[]>([]);
  const [loadingCatalogue, setLoadingCatalogue] = useState(false);
  const [selectedMed, setSelectedMed] = useState<Medicament | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState({
    quantite: 1,
    prixUnitaire: "",
    dateExpiration: "",
    notes: "",
    // Fields for new medicament
    categorie: "Générique",
    nomGenerique: "",
    ordonnanceRequise: false
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const searchCatalogue = useCallback(async (q: string) => {
    if (q.length < 2) {
      setCatalogue([]);
      return;
    }
    setLoadingCatalogue(true);
    try {
      const res = await getCatalogue(q);
      setCatalogue(res.data);
      setShowDropdown(true);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingCatalogue(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (search && !selectedMed && !isCreatingNew) searchCatalogue(search);
    }, 500);
    return () => clearTimeout(timer);
  }, [search, searchCatalogue, selectedMed, isCreatingNew]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectMed = (med: Medicament) => {
    setSelectedMed(med);
    setSearch(med.nom);
    setShowDropdown(false);
    setIsCreatingNew(false);
  };

  const handleStartCreate = () => {
    setIsCreatingNew(true);
    setShowDropdown(false);
    setSelectedMed(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!selectedMed && !isCreatingNew) {
      setError("Veuillez sélectionner un médicament ou en créer un nouveau.");
      return;
    }

    setSaving(true);
    try {
      let finalMedId = selectedMed?.id;

      // 1. Create medicament if new
      if (isCreatingNew) {
        const newMed = await createMedicament({
          nom: search,
          nomGenerique: form.nomGenerique,
          categorie: form.categorie,
          ordonnanceRequise: form.ordonnanceRequise
        });
        finalMedId = newMed.data.id;
      }

      if (!finalMedId) throw new Error("ID du médicament manquant");

      // 2. Add to stock
      await upsertStock(structureId, {
        medicamentId: finalMedId,
        quantite: form.quantite,
        prixUnitaire: form.prixUnitaire ? parseFloat(form.prixUnitaire) : undefined,
        dateExpiration: form.dateExpiration || undefined,
        notes: form.notes || undefined
      });

      onSuccess();
      onClose();
      // Reset
      reset();
    } catch (err: any) {
      setError(err.message || "Une erreur est survenue");
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setSelectedMed(null);
    setIsCreatingNew(false);
    setSearch("");
    setForm({
      quantite: 1,
      prixUnitaire: "",
      dateExpiration: "",
      notes: "",
      categorie: "Générique",
      nomGenerique: "",
      ordonnanceRequise: false
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
      <div className="bg-white dark:bg-[#0f172a] w-full max-w-xl rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-scale-in">
        
        {/* Header */}
        <div className="p-8 border-b border-slate-100 dark:border-slate-800/50 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary-500/10 flex items-center justify-center text-primary-500">
              <Plus className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">
                Ajouter au stock
              </h2>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Nouvel arrivage de médicament</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors">
            <X className="w-6 h-6 text-slate-400" />
          </button>
        </div>

        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Medicament Selection Field */}
            <div className="space-y-2 relative" ref={dropdownRef}>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Médicament</label>
              <div className="relative group">
                <Pill className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors ${selectedMed || isCreatingNew ? 'text-primary-500' : 'text-slate-400 group-focus-within:text-primary-500'}`} />
                <input 
                  type="text" 
                  placeholder="Tapez le nom du médicament..." 
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    if (selectedMed) setSelectedMed(null);
                    if (isCreatingNew) setIsCreatingNew(false);
                  }}
                  onFocus={() => search.length >= 2 && !selectedMed && setShowDropdown(true)}
                  className={`w-full pl-12 pr-12 py-4 bg-slate-50 dark:bg-slate-900 border rounded-2xl text-sm focus:outline-none transition-all shadow-inner ${selectedMed || isCreatingNew ? 'border-primary-500/50 ring-2 ring-primary-500/10' : 'border-slate-200 dark:border-slate-800 focus:border-primary-500'}`}
                />
                {loadingCatalogue ? (
                  <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-primary-500 animate-spin" />
                ) : (
                  <ChevronDown className={`absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
                )}
              </div>

              {/* Search Results Dropdown */}
              {showDropdown && (
                <div className="absolute z-50 left-0 right-0 top-full mt-2 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-h-[300px] overflow-y-auto scrollbar-thin animate-slide-down">
                  {catalogue.map((med) => (
                    <button
                      key={med.id}
                      type="button"
                      onClick={() => handleSelectMed(med)}
                      className="w-full p-4 flex items-center gap-4 hover:bg-primary-500/5 border-b border-slate-50 dark:border-slate-800 last:border-0 transition-colors text-left group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-primary-500 group-hover:text-white transition-all">
                        <Pill className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-slate-900 dark:text-white group-hover:text-primary-500 transition-colors">{med.nom}</p>
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest">{med.nomGenerique || med.categorie}</p>
                      </div>
                    </button>
                  ))}
                  
                  {/* Create New Option */}
                  {search.length >= 2 && (
                    <button
                      type="button"
                      onClick={handleStartCreate}
                      className="w-full p-6 flex items-center gap-4 bg-primary-500 text-white hover:bg-primary-600 transition-colors text-left"
                    >
                      <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                        <Plus className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="font-black">"{search}" n&apos;existe pas ?</p>
                        <p className="text-[10px] uppercase font-bold opacity-80">Cliquer ici pour le créer dans le catalogue</p>
                      </div>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Fields for New Medicament (Conditional) */}
            {isCreatingNew && (
              <div className="p-6 bg-primary-500/5 border border-primary-500/20 rounded-[2rem] space-y-4 animate-fade-in">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-4 h-4 text-primary-500" />
                  <p className="text-xs font-black uppercase tracking-widest text-primary-500">Nouveau médicament à enregistrer</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Catégorie</label>
                    <input 
                      type="text" 
                      placeholder="Ex: Antipaludéen"
                      value={form.categorie}
                      onChange={(e) => setForm({...form, categorie: e.target.value})}
                      className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-primary-500 transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1">DCI (Générique)</label>
                    <input 
                      type="text" 
                      placeholder="Ex: Paracétamol"
                      value={form.nomGenerique}
                      onChange={(e) => setForm({...form, nomGenerique: e.target.value})}
                      className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-primary-500 transition-all"
                    />
                  </div>
                </div>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input 
                    type="checkbox"
                    checked={form.ordonnanceRequise}
                    onChange={(e) => setForm({...form, ordonnanceRequise: e.target.checked})}
                    className="w-5 h-5 rounded border-slate-300 text-primary-500 focus:ring-primary-500"
                  />
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-400 group-hover:text-primary-500 transition-colors">Ordonnance obligatoire ?</span>
                </label>
              </div>
            )}

            {/* Common Stock Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Quantité</label>
                <input 
                  type="number" 
                  min="1"
                  required
                  value={form.quantite || ''}
                  onChange={(e) => setForm({...form, quantite: e.target.value === '' ? 0 : parseInt(e.target.value)})}
                  className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm focus:outline-none focus:border-primary-500 transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Prix Unitaire (GNF)</label>
                <input 
                  type="number" 
                  placeholder="Ex: 35000"
                  value={form.prixUnitaire}
                  onChange={(e) => setForm({...form, prixUnitaire: e.target.value})}
                  className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm focus:outline-none focus:border-primary-500 transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Date d'expiration</label>
                <input 
                  type="date" 
                  value={form.dateExpiration}
                  onChange={(e) => setForm({...form, dateExpiration: e.target.value})}
                  className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm focus:outline-none focus:border-primary-500 transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Notes</label>
                <input 
                  type="text"
                  placeholder="Emplacement..."
                  value={form.notes}
                  onChange={(e) => setForm({...form, notes: e.target.value})}
                  className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm focus:outline-none focus:border-primary-500 transition-all"
                />
              </div>
            </div>

            {error && (
              <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3 text-rose-500 text-sm animate-shake">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <div className="flex gap-4 pt-4">
              <button 
                type="button" 
                onClick={onClose}
                className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl font-bold hover:bg-slate-200 transition-all"
              >
                Annuler
              </button>
              <button 
                type="submit" 
                disabled={saving || (!selectedMed && !isCreatingNew)}
                className="flex-[2] py-4 bg-primary-500 text-white rounded-2xl font-bold shadow-xl shadow-primary-500/20 hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                {saving ? "Enregistrement..." : (isCreatingNew ? "Créer et ajouter" : "Ajouter au stock")}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
