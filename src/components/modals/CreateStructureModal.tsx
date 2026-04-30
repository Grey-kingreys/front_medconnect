import { useState } from "react";
import { X, AlertCircle, Loader2, Send, Mail, ChevronDown } from "lucide-react";
import { createStructure, StructureType, ApiError } from "@/lib/api_admin";

export function CreateStructureModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    nom: "",
    type: "HOPITAL" as StructureType,
    email: "",
    telephone: "",
    adresse: "",
    ville: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await createStructure({
        nom: form.nom,
        type: form.type,
        email: form.email,
        telephone: form.telephone || undefined,
        adresse: form.adresse || undefined,
        ville: form.ville || undefined,
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    "w-full px-4 py-3 bg-slate-900/60 border border-slate-700/50 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-600 focus:outline-none focus:border-primary-500/50 focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 text-sm";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg bg-[#0f172a]/95 backdrop-blur-2xl border border-slate-200 dark:border-slate-800/60 rounded-3xl shadow-2xl shadow-black/30 overflow-hidden animate-slide-up">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800/50">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Créer une structure</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Un email d&apos;invitation sera envoyé automatiquement
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white hover:bg-slate-800/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-emergency-500/10 border border-emergency-500/20 text-emergency-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
              Nom de la structure <span className="text-emergency-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Ex : Hôpital Donka"
              value={form.nom}
              onChange={(e) => setForm((p) => ({ ...p, nom: e.target.value }))}
              required
              className={inputCls}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
                Type <span className="text-emergency-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={form.type}
                  onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as StructureType }))}
                  className={`${inputCls} appearance-none pr-10 cursor-pointer`}
                >
                  <option value="HOPITAL">Hôpital</option>
                  <option value="CLINIQUE">Clinique</option>
                  <option value="PHARMACIE">Pharmacie</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
                Email <span className="text-emergency-500">*</span>
              </label>
              <input
                type="email"
                placeholder="admin@structure.com"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                required
                className={inputCls}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
                Téléphone
              </label>
              <input
                type="tel"
                placeholder="+224 622 000 000"
                value={form.telephone}
                onChange={(e) => setForm((p) => ({ ...p, telephone: e.target.value }))}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
                Ville
              </label>
              <input
                type="text"
                placeholder="Conakry"
                value={form.ville}
                onChange={(e) => setForm((p) => ({ ...p, ville: e.target.value }))}
                className={inputCls}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
              Adresse
            </label>
            <input
              type="text"
              placeholder="Quartier, commune..."
              value={form.adresse}
              onChange={(e) => setForm((p) => ({ ...p, adresse: e.target.value }))}
              className={inputCls}
            />
          </div>
          <div className="flex items-start gap-2 p-3 rounded-xl bg-primary-500/5 border border-primary-500/10 text-xs text-slate-500">
            <Mail className="w-4 h-4 text-primary-400 flex-shrink-0 mt-0.5" />
            <span>
              Un email avec un lien d&apos;invitation (valable 72h) sera envoyé à{" "}
              <strong className="text-slate-500 dark:text-slate-400">{form.email || "l'adresse indiquée"}</strong> pour
              que l&apos;administrateur configure son espace.
            </span>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 rounded-xl text-sm font-medium text-slate-500 dark:text-slate-400 border border-slate-700/50 hover:bg-slate-800/50 transition-all"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 group relative flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-white overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-primary-500/25 disabled:opacity-60"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-primary-600 to-cyan-500" />
              <span className="absolute inset-0 bg-gradient-to-r from-primary-500 to-secondary-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="relative flex items-center gap-2">
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {saving ? "Création..." : "Créer et inviter"}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
