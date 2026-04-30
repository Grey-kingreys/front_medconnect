import { useState } from "react";
import { X, AlertCircle, Loader2, Save, Send, Mail, ChevronDown } from "lucide-react";
import { createStructure, StructureType } from "@/lib/api_admin";
import { updateMyStructure, MyStructure, UpdateStructurePayload } from "@/lib/api_structure";
import { ApiError } from "@/lib/api_auth";
import { MapModal } from "./MapModal";
import { MapPin, Navigation } from "lucide-react";

type StructureModalMode = "create" | "edit";

interface StructureModalProps {
  mode: StructureModalMode;
  structure?: MyStructure; // Only needed in edit mode
  onClose: () => void;
  onSuccess: () => void;
}

export function StructureModal({ mode, structure, onClose, onSuccess }: StructureModalProps) {
  const [form, setForm] = useState({
    nom: structure?.nom || "",
    type: structure?.type || "HOPITAL" as StructureType,
    email: structure?.email || "",
    telephone: structure?.telephone || "",
    ville: structure?.ville || "",
    adresse: structure?.adresse || "",
    description: structure?.description || "",
    latitude: structure?.latitude,
    longitude: structure?.longitude,
    horaires: structure?.horaires || "08:00-18:00",
    estDeGarde: structure?.estDeGarde || false,
  });

  const [openingTime, setOpeningTime] = useState(structure?.horaires?.split('-')[0] || "08:00");
  const [closingTime, setClosingTime] = useState(structure?.horaires?.split('-')[1] || "18:00");
  const [showMap, setShowMap] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      if (mode === "create") {
        await createStructure({
          nom: form.nom,
          type: form.type as StructureType,
          email: form.email,
          telephone: form.telephone || undefined,
          adresse: form.adresse || undefined,
          ville: form.ville || undefined,
          latitude: form.latitude,
          longitude: form.longitude,
          horaires: `${openingTime}-${closingTime}`,
          estDeGarde: form.estDeGarde,
        });
      } else {
        await updateMyStructure({
          nom: form.nom,
          telephone: form.telephone || undefined,
          ville: form.ville || undefined,
          adresse: form.adresse || undefined,
          description: form.description || undefined,
          latitude: form.latitude,
          longitude: form.longitude,
          horaires: `${openingTime}-${closingTime}`,
          estDeGarde: form.estDeGarde,
        });
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue");
    } finally {
      setSaving(false);
    }
  };

  const cls = "w-full px-4 py-3 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/50 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-500 focus:outline-none focus:border-primary-500/50 text-sm transition-all";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div 
        className="relative w-full max-w-2xl bg-white dark:bg-[#0f172a]/95 border border-slate-200 dark:border-slate-800/60 rounded-3xl shadow-2xl overflow-hidden animate-slide-up max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-shrink-0 flex items-center justify-between p-5 bg-white dark:bg-[#0f172a]/95 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800/50">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              {mode === "create" ? "Créer une structure" : "Modifier la structure"}
            </h2>
            {mode === "create" && (
              <p className="text-xs text-slate-500 mt-0.5">Un email d&apos;invitation sera envoyé automatiquement</p>
            )}
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white hover:bg-slate-800/50 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 overflow-y-auto custom-scrollbar flex-1 space-y-4">
          {error && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-emergency-500/10 border border-emergency-500/20 text-emergency-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-300 mb-1.5">Nom <span className="text-emergency-500">*</span></label>
              <input required value={form.nom} onChange={e => setForm(p => ({ ...p, nom: e.target.value }))} className={cls} placeholder="Ex: Hôpital Donka" />
            </div>

            {mode === "create" ? (
              <div>
                <label className="block text-sm text-slate-600 dark:text-slate-300 mb-1.5">Type <span className="text-emergency-500">*</span></label>
                <div className="relative">
                  <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value as StructureType }))} className={`${cls} appearance-none pr-10 cursor-pointer`}>
                    <option value="HOPITAL">Hôpital</option>
                    <option value="CLINIQUE">Clinique</option>
                    <option value="PHARMACIE">Pharmacie</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-sm text-slate-600 dark:text-slate-300 mb-1.5">Téléphone</label>
                <input type="tel" value={form.telephone} onChange={e => setForm(p => ({ ...p, telephone: e.target.value }))} className={cls} placeholder="+224 622 000 000" />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {mode === "create" && (
              <>
                <div>
                  <label className="block text-sm text-slate-600 dark:text-slate-300 mb-1.5">Email Administrateur <span className="text-emergency-500">*</span></label>
                  <input required type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} className={cls} placeholder="admin@structure.com" />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 dark:text-slate-300 mb-1.5">Téléphone Admin</label>
                  <input type="tel" value={form.telephone} onChange={e => setForm(p => ({ ...p, telephone: e.target.value }))} className={cls} placeholder="+224 622 000 000" />
                </div>
              </>
            )}
            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-300 mb-1.5">Ville</label>
              <input value={form.ville} onChange={e => setForm(p => ({ ...p, ville: e.target.value }))} className={cls} placeholder="Conakry" />
            </div>
            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-300 mb-1.5">Adresse</label>
              <input value={form.adresse} onChange={e => setForm(p => ({ ...p, adresse: e.target.value }))} className={cls} placeholder="Quartier, commune..." />
            </div>
          </div>

          {/* Location Trigger */}
          <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-800/50">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-semibold text-slate-900 dark:text-white">
                Position Géographique
              </label>
              {form.latitude && (
                <span className="text-[10px] font-mono text-primary-500 bg-primary-500/10 px-2 py-0.5 rounded-full">
                  Configuré
                </span>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider ml-1">Latitude</span>
                <div className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-600 dark:text-slate-400 font-mono">
                  {form.latitude?.toFixed(6) || "—"}
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider ml-1">Longitude</span>
                <div className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-600 dark:text-slate-400 font-mono">
                  {form.longitude?.toFixed(6) || "—"}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowMap(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm group"
            >
              <Navigation className="w-4 h-4 text-primary-500 group-hover:scale-110 transition-transform" />
              {form.latitude ? "Modifier la position sur la carte" : "Définir la position sur la carte"}
            </button>
          </div>

          <MapModal
            isOpen={showMap}
            onClose={() => setShowMap(false)}
            mode="picker"
            initialLat={form.latitude}
            initialLng={form.longitude}
            onLocationSelect={(lat, lng) => setForm(p => ({ ...p, latitude: lat, longitude: lng }))}
          />

          {mode === "edit" && (
            <>
              <div>
                <label className="block text-sm text-slate-600 dark:text-slate-300 mb-1.5">Description</label>
                <textarea rows={2} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className={`${cls} resize-none`} placeholder="Description de la structure..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-600 dark:text-slate-300 mb-1.5">Ouverture</label>
                  <input 
                    type="time" 
                    value={openingTime} 
                    onChange={e => setOpeningTime(e.target.value)} 
                    className={cls} 
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 dark:text-slate-300 mb-1.5">Fermeture</label>
                  <input 
                    type="time" 
                    value={closingTime} 
                    onChange={e => setClosingTime(e.target.value)} 
                    className={cls} 
                  />
                </div>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <input type="checkbox" id="estDeGarde" checked={form.estDeGarde} onChange={e => setForm(p => ({ ...p, estDeGarde: e.target.checked }))} className="w-5 h-5 rounded border-slate-700 bg-slate-900 text-primary-500 focus:ring-primary-500/50" />
                <label htmlFor="estDeGarde" className="text-sm text-slate-600 dark:text-slate-300 cursor-pointer select-none">Cette structure est actuellement de garde</label>
              </div>
            </>
          )}

          {mode === "create" && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-primary-500/5 border border-primary-500/10 text-xs text-slate-500">
              <Mail className="w-4 h-4 text-primary-400 flex-shrink-0 mt-0.5" />
              <span>Un email avec un lien d&apos;invitation (valable 72h) sera envoyé à <strong className="text-slate-500 dark:text-slate-400">{form.email || "l'adresse indiquée"}</strong>.</span>
            </div>
          )}

          <div className="flex gap-3 pt-3 mt-2 border-t border-slate-200 dark:border-slate-800/50 flex-shrink-0">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-3 rounded-xl text-sm font-medium text-slate-500 dark:text-slate-400 border border-slate-700/50 hover:bg-slate-800/50 transition-all">
              Annuler
            </button>
            <button type="submit" disabled={saving} className="flex-[2] group relative flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-white overflow-hidden disabled:opacity-60">
              <span className="absolute inset-0 bg-gradient-to-r from-primary-600 to-cyan-500" />
              <span className="absolute inset-0 bg-gradient-to-r from-primary-500 to-secondary-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="relative flex items-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (mode === "create" ? <Send className="w-4 h-4" /> : <Save className="w-4 h-4" />)}
                {saving ? "Chargement..." : (mode === "create" ? "Créer et inviter" : "Sauvegarder")}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
