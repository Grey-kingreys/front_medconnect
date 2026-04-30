import { useState } from "react";
import { X, AlertCircle, Loader2, Plus, Mail, ChevronDown, ShieldAlert, Stethoscope, Pill } from "lucide-react";
import { createUser, ApiError as ApiAdminError } from "@/lib/api_admin";
import { createMembre, createSuperAdmin, MembreRole, ApiError as ApiStructureError } from "@/lib/api_structure";

type UserModalMode = "create_super_admin" | "create_admin_user" | "create_membre";

interface UserModalProps {
  mode: UserModalMode;
  structureId?: string;
  structureType?: string;
  onClose: () => void;
  onSuccess: () => void;
}

const ROLE_LABELS: Record<string, string> = {
  PATIENT: "Patient",
  MEDECIN: "Médecin",
  PHARMACIEN: "Pharmacien",
  STRUCTURE_ADMIN: "Admin Structure",
  ADMIN: "Administrateur",
};

export function UserModal({ mode, structureId, structureType, onClose, onSuccess }: UserModalProps) {
  const isMembreMode = mode === "create_membre";
  const isSuperAdminMode = mode === "create_super_admin";
  const isAdminUserMode = mode === "create_admin_user";

  const allowedMembreRoles: MembreRole[] = structureType === "PHARMACIE" 
    ? ["PHARMACIEN", "STRUCTURE_ADMIN"] 
    : ["MEDECIN", "PHARMACIEN", "STRUCTURE_ADMIN"];
  const adminUserRoles = ["PATIENT", "MEDECIN", "PHARMACIEN", "ADMIN"];

  const [form, setForm] = useState({
    nom: "",
    prenom: "",
    email: "",
    password: "",
    role: isMembreMode ? allowedMembreRoles[0] : "PATIENT",
    telephone: "",
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isMembreMode && form.password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    setSaving(true);
    setError("");

    try {
      if (isMembreMode) {
        if (!structureId) throw new Error("structureId manquant");
        await createMembre(structureId, {
          nom: form.nom, prenom: form.prenom, email: form.email,
          role: form.role as MembreRole, telephone: form.telephone || undefined
        });
      } else if (isSuperAdminMode) {
        await createSuperAdmin({
          nom: form.nom, prenom: form.prenom, email: form.email,
          password: form.password, telephone: form.telephone || undefined
        });
      } else if (isAdminUserMode) {
        await createUser({
          nom: form.nom, prenom: form.prenom, email: form.email,
          password: form.password, role: form.role, telephone: form.telephone || undefined
        });
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Une erreur est survenue.");
    } finally {
      setSaving(false);
    }
  };

  const cls = "w-full px-4 py-3 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/50 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-500 focus:outline-none focus:border-primary-500/50 text-sm transition-all";

  const getTitle = () => {
    if (isSuperAdminMode) return "Nouveau Super Admin";
    if (isAdminUserMode) return "Créer un utilisateur";
    return "Ajouter un membre";
  };

  const getSubtitle = () => {
    if (isSuperAdminMode) return "Création d'un accès avec droits maximaux";
    if (isAdminUserMode) return "Un email de bienvenue sera envoyé";
    return "Les identifiants seront envoyés par email";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white dark:bg-[#0f172a]/95 border border-slate-200 dark:border-slate-800/60 rounded-3xl shadow-2xl overflow-hidden animate-slide-up">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800/50">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{getTitle()}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{getSubtitle()}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white hover:bg-slate-800/50"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={submit} className="p-6 space-y-4">
          {error && (
            <div className="flex gap-2 p-3 rounded-xl bg-emergency-500/10 border border-emergency-500/20 text-emergency-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
            </div>
          )}

          {isSuperAdminMode && (
            <div className="flex items-center gap-3 p-4 mb-2 rounded-xl bg-emergency-500/10 border border-emergency-500/20 text-emergency-400 text-sm">
              <ShieldAlert className="w-5 h-5 flex-shrink-0" />
              <p>Attention : Ce compte aura les mêmes droits absolus que vous sur l&apos;ensemble de la plateforme.</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-300 mb-2">Prénom <span className="text-emergency-500">*</span></label>
              <input required value={form.prenom} onChange={e => setForm(p => ({ ...p, prenom: e.target.value }))} className={cls} placeholder="Mamadou" />
            </div>
            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-300 mb-2">Nom <span className="text-emergency-500">*</span></label>
              <input required value={form.nom} onChange={e => setForm(p => ({ ...p, nom: e.target.value }))} className={cls} placeholder="Diallo" />
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-600 dark:text-slate-300 mb-2">Email <span className="text-emergency-500">*</span></label>
            <input required type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} className={cls} placeholder="exemple@email.com" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {(isAdminUserMode || isMembreMode) && (
              <div>
                <label className="block text-sm text-slate-600 dark:text-slate-300 mb-2">Rôle <span className="text-emergency-500">*</span></label>
                <div className="relative">
                  <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} className={`${cls} appearance-none pr-10 cursor-pointer`}>
                    {isMembreMode 
                      ? allowedMembreRoles.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)
                      : adminUserRoles.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)
                    }
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                </div>
              </div>
            )}

            <div className={isSuperAdminMode ? "col-span-2" : ""}>
              <label className="block text-sm text-slate-600 dark:text-slate-300 mb-2">Téléphone</label>
              <input type="tel" value={form.telephone} onChange={e => setForm(p => ({ ...p, telephone: e.target.value }))} className={cls} placeholder="+224 622..." />
            </div>
          </div>

          {!isMembreMode && (
            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-300 mb-2">Mot de passe temporaire <span className="text-emergency-500">*</span></label>
              <input required type="password" minLength={8} value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} className={cls} placeholder="Min. 8 caractères" />
            </div>
          )}

          {isMembreMode && (
            <div className="flex gap-2 p-3 rounded-xl bg-primary-500/5 border border-primary-500/10 text-xs text-slate-500">
              <Mail className="w-4 h-4 text-primary-400 flex-shrink-0 mt-0.5" />
              <span>Un mot de passe temporaire sera généré et envoyé à <strong className="text-slate-500 dark:text-slate-400">{form.email || "l'adresse indiquée"}</strong>.</span>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-3 rounded-xl text-sm font-medium text-slate-500 dark:text-slate-400 border border-slate-700/50 hover:bg-slate-800/50 transition-all">
              Annuler
            </button>
            <button type="submit" disabled={saving} className={`flex-[2] group relative flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-white overflow-hidden disabled:opacity-60`}>
              <span className={`absolute inset-0 bg-gradient-to-r ${isSuperAdminMode ? 'from-emergency-600 to-rose-500' : 'from-primary-600 to-cyan-500'}`} />
              <span className="relative flex gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {saving ? "Création..." : (isSuperAdminMode ? "Créer Super Admin" : "Créer")}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
