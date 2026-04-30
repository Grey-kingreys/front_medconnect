import { useState } from "react";
import { X, AlertCircle, Loader2, Save } from "lucide-react";
import { updateMyStructure, MyStructure, UpdateStructurePayload, ApiError } from "@/lib/api_structure";

export function EditStructureModal({ structure, onClose, onSaved }: { structure: MyStructure; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<UpdateStructurePayload>({
    nom: structure.nom, adresse: structure.adresse ?? "", ville: structure.ville ?? "",
    telephone: structure.telephone ?? "", description: structure.description ?? "",
    latitude: structure.latitude ?? undefined, longitude: structure.longitude ?? undefined,
    horaires: structure.horaires ?? "", estDeGarde: structure.estDeGarde ?? false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const cls = "w-full px-4 py-3 bg-slate-900/60 border border-slate-700/50 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-600 focus:outline-none focus:border-primary-500/50 text-sm transition-all";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError("");
    try { await updateMyStructure(form); onSaved(); onClose(); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Erreur lors de la sauvegarde"); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-[#0f172a]/95 border border-slate-200 dark:border-slate-800/60 rounded-3xl shadow-2xl overflow-hidden animate-slide-up">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800/50">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Modifier la structure</h2>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white hover:bg-slate-800/50"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          {error && <div className="flex gap-2 p-3 rounded-xl bg-emergency-500/10 border border-emergency-500/20 text-emergency-400 text-sm"><AlertCircle className="w-4 h-4" />{error}</div>}
          <div><label className="block text-sm text-slate-600 dark:text-slate-300 mb-2">Nom</label><input value={form.nom ?? ""} onChange={e => setForm(p => ({ ...p, nom: e.target.value }))} className={cls} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm text-slate-600 dark:text-slate-300 mb-2">Téléphone</label><input value={form.telephone ?? ""} onChange={e => setForm(p => ({ ...p, telephone: e.target.value }))} className={cls} placeholder="+224 622 000 000" /></div>
            <div><label className="block text-sm text-slate-600 dark:text-slate-300 mb-2">Ville</label><input value={form.ville ?? ""} onChange={e => setForm(p => ({ ...p, ville: e.target.value }))} className={cls} placeholder="Conakry" /></div>
          </div>
          <div><label className="block text-sm text-slate-600 dark:text-slate-300 mb-2">Adresse</label><input value={form.adresse ?? ""} onChange={e => setForm(p => ({ ...p, adresse: e.target.value }))} className={cls} /></div>
          <div><label className="block text-sm text-slate-600 dark:text-slate-300 mb-2">Description</label><textarea rows={2} value={form.description ?? ""} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className={`${cls} resize-none`} /></div>
          
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm text-slate-600 dark:text-slate-300 mb-2">Latitude</label><input type="number" step="any" value={form.latitude ?? ""} onChange={e => setForm(p => ({ ...p, latitude: e.target.value ? parseFloat(e.target.value) : undefined }))} className={cls} placeholder="9.537" /></div>
            <div><label className="block text-sm text-slate-600 dark:text-slate-300 mb-2">Longitude</label><input type="number" step="any" value={form.longitude ?? ""} onChange={e => setForm(p => ({ ...p, longitude: e.target.value ? parseFloat(e.target.value) : undefined }))} className={cls} placeholder="-13.678" /></div>
          </div>
          <div><label className="block text-sm text-slate-600 dark:text-slate-300 mb-2">Horaires (JSON ou Texte)</label><input value={form.horaires ?? ""} onChange={e => setForm(p => ({ ...p, horaires: e.target.value }))} className={cls} placeholder='{"lun":"08:00-18:00"}' /></div>
          
          <div className="flex items-center gap-3">
            <input type="checkbox" id="estDeGarde" checked={form.estDeGarde ?? false} onChange={e => setForm(p => ({ ...p, estDeGarde: e.target.checked }))} className="w-5 h-5 rounded border-slate-700 bg-slate-900 text-primary-500 focus:ring-primary-500/50" />
            <label htmlFor="estDeGarde" className="text-sm text-slate-600 dark:text-slate-300">Cette structure est actuellement de garde</label>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-3 rounded-xl text-sm text-slate-500 dark:text-slate-400 border border-slate-700/50">Annuler</button>
            <button type="submit" disabled={saving} className="flex-1 group relative flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-white overflow-hidden disabled:opacity-60">
              <span className="absolute inset-0 bg-gradient-to-r from-primary-600 to-cyan-500" />
              <span className="relative flex gap-2">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}{saving ? "Sauvegarde..." : "Sauvegarder"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
