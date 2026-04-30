"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Building2, Mail, Lock, User, Phone, MapPin, Loader2, ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { verifyInviteToken, setupStructure, MyStructure } from "@/lib/api_structure";
import { useAuth } from "@/hooks/useAuth";

export default function SetupStructurePage() {
  const router = useRouter();
  const params = useParams();
  const token = params.token as string;
  const { loginUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [structure, setStructure] = useState<MyStructure | null>(null);

  const [step, setStep] = useState(1); // 1: Info perso, 2: Info structure
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    prenom: "",
    nom: "",
    telephone: "",
    password: "",
    passwordConfirm: "",
    structureNom: "",
    adresse: "",
    ville: "",
    structureTelephone: "",
    description: "",
  });

  useEffect(() => {
    async function verify() {
      try {
        const res = await verifyInviteToken(token);
        setStructure(res.data);
        setForm((prev) => ({ ...prev, structureNom: res.data.nom }));
      } catch (err: any) {
        setError(err.message || "Lien invalide ou expiré.");
      } finally {
        setLoading(false);
      }
    }
    verify();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1) {
      if (form.password !== form.passwordConfirm) {
        setError("Les mots de passe ne correspondent pas.");
        return;
      }
      if (form.password.length < 8) {
        setError("Le mot de passe doit contenir au moins 8 caractères.");
        return;
      }
      setError("");
      setStep(2);
      return;
    }

    setSaving(true);
    setError("");
    try {
      const res = await setupStructure(token, {
        nom: form.nom,
        prenom: form.prenom,
        telephone: form.telephone,
        password: form.password,
        structureNom: form.structureNom,
        adresse: form.adresse,
        ville: form.ville,
        structureTelephone: form.structureTelephone || undefined,
        description: form.description || undefined,
      });
      // Login with the returned token
      loginUser({
        access_token: res.data.access_token,
        refreshToken: res.data.refresh_token,
        user: res.data.user,
      });
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Une erreur est survenue lors de la configuration.");
      setStep(1); // Go back if error to allow correcting
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    "w-full py-3 pr-4 bg-slate-900/60 border border-slate-700/50 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-600 focus:outline-none focus:border-primary-500/50 focus:ring-2 focus:ring-primary-500/20 transition-all text-sm";

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary-400 animate-spin mb-4" />
        <p className="text-slate-500 dark:text-slate-400 animate-pulse">Vérification de l&apos;invitation...</p>
      </div>
    );
  }

  if (error && !structure) {
    return (
      <div className="w-full max-w-md mx-auto relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-emergency-500 to-rose-500 rounded-2xl blur opacity-20" />
        <div className="relative bg-[#0f172a]/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800/50 rounded-2xl p-8 text-center shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-emergency-500/10 flex items-center justify-center mx-auto mb-6">
            <ShieldCheck className="w-8 h-8 text-emergency-500" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2" style={{ fontFamily: "var(--font-outfit)" }}>
            Lien Invalide
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mb-8 text-sm">{error}</p>
          <Link
            href="/auth/login"
            className="inline-flex items-center justify-center w-full px-4 py-3 rounded-xl text-sm font-semibold text-slate-900 dark:text-white bg-slate-800 hover:bg-slate-700 transition-all"
          >
            Retour à la connexion
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg mx-auto relative group animate-fade-in">
      <div className="absolute -inset-1 bg-gradient-to-r from-primary-500 to-cyan-500 rounded-2xl blur opacity-20 group-hover:opacity-30 transition duration-1000" />
      <div className="relative bg-[#0f172a]/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800/50 rounded-2xl p-8 shadow-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-primary-500/10 to-cyan-500/10 mb-4 border border-primary-500/20">
            <Building2 className="w-8 h-8 text-primary-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2" style={{ fontFamily: "var(--font-outfit)" }}>
            Configuration
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Bienvenue ! Configurez votre compte administrateur pour <strong className="text-slate-900 dark:text-white">{structure?.nom}</strong>.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="p-3 rounded-xl bg-emergency-500/10 border border-emergency-500/20 text-emergency-400 text-sm">
              {error}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4 animate-slide-up">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary-500/20 text-primary-400 text-xs font-bold border border-primary-500/30">1</div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Vos informations</h3>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Prénom <span className="text-emergency-500">*</span></label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input type="text" required placeholder="Mamadou" className={`${inputCls} pl-12`} value={form.prenom} onChange={e => setForm({ ...form, prenom: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Nom <span className="text-emergency-500">*</span></label>
                  <input type="text" required placeholder="Diallo" className={`${inputCls} pl-4`} value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Téléphone (Admin) <span className="text-emergency-500">*</span></label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input type="tel" required placeholder="+224 622..." className={`${inputCls} pl-12`} value={form.telephone} onChange={e => setForm({ ...form, telephone: e.target.value })} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input type="email" disabled value={structure?.email || ""} className={`${inputCls} pl-12 opacity-60 cursor-not-allowed`} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Mot de passe <span className="text-emergency-500">*</span></label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input type="password" required minLength={8} placeholder="Min. 8 caractères" className={`${inputCls} pl-12`} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Confirmer mot de passe <span className="text-emergency-500">*</span></label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input type="password" required minLength={8} placeholder="Confirmez" className={`${inputCls} pl-12`} value={form.passwordConfirm} onChange={e => setForm({ ...form, passwordConfirm: e.target.value })} />
                </div>
              </div>

              <button type="submit" className="w-full group relative flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-white mt-6 overflow-hidden">
                <span className="absolute inset-0 bg-gradient-to-r from-primary-600 to-cyan-500" />
                <span className="absolute inset-0 bg-gradient-to-r from-primary-500 to-secondary-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className="relative flex items-center gap-2">Suivant <ArrowRight className="w-4 h-4" /></span>
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 animate-slide-up">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary-500/20 text-primary-400 text-xs font-bold border border-primary-500/30">2</div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Infos de la structure</h3>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Nom de la structure <span className="text-emergency-500">*</span></label>
                <div className="relative">
                  <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input type="text" required className={`${inputCls} pl-12`} value={form.structureNom} onChange={e => setForm({ ...form, structureNom: e.target.value })} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Téléphone (Structure)</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input type="tel" placeholder="+224 622..." className={`${inputCls} pl-12`} value={form.structureTelephone} onChange={e => setForm({ ...form, structureTelephone: e.target.value })} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Ville <span className="text-emergency-500">*</span></label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input type="text" required placeholder="Conakry" className={`${inputCls} pl-12`} value={form.ville} onChange={e => setForm({ ...form, ville: e.target.value })} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Adresse détaillée <span className="text-emergency-500">*</span></label>
                <input type="text" required placeholder="Quartier, commune..." className={`${inputCls} pl-4`} value={form.adresse} onChange={e => setForm({ ...form, adresse: e.target.value })} />
              </div>

              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setStep(1)} className="flex-1 px-4 py-3 rounded-xl text-sm font-medium text-slate-500 dark:text-slate-400 border border-slate-700/50 hover:bg-slate-800/50 transition-all">
                  Retour
                </button>
                <button type="submit" disabled={saving} className="flex-[2] group relative flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-white overflow-hidden disabled:opacity-60">
                  <span className="absolute inset-0 bg-gradient-to-r from-primary-600 to-cyan-500" />
                  <span className="absolute inset-0 bg-gradient-to-r from-primary-500 to-secondary-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <span className="relative flex items-center gap-2">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    {saving ? "Configuration..." : "Terminer"}
                  </span>
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
