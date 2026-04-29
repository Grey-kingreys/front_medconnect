"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  User,
  Phone,
  UserPlus,
  Loader2,
  AlertCircle,
  Check,
} from "lucide-react";
import { register, ApiError } from "@/lib/api_auth";
import { useAuth } from "@/hooks/useAuth";

const passwordRules = [
  { label: "Au moins 8 caractères", test: (p: string) => p.length >= 8 },
  { label: "Une lettre majuscule", test: (p: string) => /[A-Z]/.test(p) },
  { label: "Une lettre minuscule", test: (p: string) => /[a-z]/.test(p) },
  { label: "Un chiffre", test: (p: string) => /\d/.test(p) },
];

export default function RegisterPage() {
  const router = useRouter();
  const { loginUser } = useAuth();
  const [form, setForm] = useState({
    nom: "",
    prenom: "",
    email: "",
    telephone: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (error) setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validation côté client
    if (form.password !== form.confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    const failedRules = passwordRules.filter((r) => !r.test(form.password));
    if (failedRules.length > 0) {
      setError(`Le mot de passe doit contenir : ${failedRules.map((r) => r.label.toLowerCase()).join(", ")}`);
      return;
    }

    setLoading(true);

    try {
      const res = await register({
        nom: form.nom,
        prenom: form.prenom,
        email: form.email,
        password: form.password,
        telephone: form.telephone || undefined,
      });

      // Mettre à jour le contexte Auth (stocke les tokens + set le user)
      loginUser(res.data);
      // Rediriger vers le dashboard
      router.push("/dashboard");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Impossible de créer le compte. Vérifiez votre connexion.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Header */}
      <div className="text-center mb-8">
        <h2
          className="text-2xl sm:text-3xl font-extrabold text-white mb-2"
          style={{ fontFamily: "var(--font-outfit, var(--font-inter))" }}
        >
          Créer un compte
        </h2>
        <p className="text-slate-400 text-sm">
          Rejoignez MedConnect gratuitement
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 flex items-start gap-3 p-4 rounded-2xl bg-emergency-500/10 border border-emergency-500/20 text-emergency-500 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Nom + Prénom */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="nom" className="block text-sm font-medium text-slate-300 mb-1.5">
              Nom
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                id="nom"
                name="nom"
                type="text"
                required
                minLength={2}
                value={form.nom}
                onChange={handleChange}
                placeholder="Diallo"
                className="w-full pl-10 pr-3 py-3 bg-slate-900/60 border border-slate-700/50 rounded-xl text-white placeholder:text-slate-600 focus:outline-none focus:border-primary-500/50 focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 text-sm"
              />
            </div>
          </div>
          <div>
            <label htmlFor="prenom" className="block text-sm font-medium text-slate-300 mb-1.5">
              Prénom
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                id="prenom"
                name="prenom"
                type="text"
                required
                minLength={2}
                value={form.prenom}
                onChange={handleChange}
                placeholder="Mamadou"
                className="w-full pl-10 pr-3 py-3 bg-slate-900/60 border border-slate-700/50 rounded-xl text-white placeholder:text-slate-600 focus:outline-none focus:border-primary-500/50 focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Email */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1.5">
            Adresse email
          </label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              id="email"
              name="email"
              type="email"
              required
              value={form.email}
              onChange={handleChange}
              placeholder="vous@exemple.com"
              className="w-full pl-10 pr-3 py-3 bg-slate-900/60 border border-slate-700/50 rounded-xl text-white placeholder:text-slate-600 focus:outline-none focus:border-primary-500/50 focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 text-sm"
            />
          </div>
        </div>

        {/* Téléphone (optionnel) */}
        <div>
          <label htmlFor="telephone" className="block text-sm font-medium text-slate-300 mb-1.5">
            Téléphone <span className="text-slate-600">(optionnel)</span>
          </label>
          <div className="relative">
            <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              id="telephone"
              name="telephone"
              type="tel"
              value={form.telephone}
              onChange={handleChange}
              placeholder="+224 622 123 456"
              className="w-full pl-10 pr-3 py-3 bg-slate-900/60 border border-slate-700/50 rounded-xl text-white placeholder:text-slate-600 focus:outline-none focus:border-primary-500/50 focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 text-sm"
            />
          </div>
        </div>

        {/* Mot de passe */}
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-1.5">
            Mot de passe
          </label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              value={form.password}
              onChange={handleChange}
              placeholder="••••••••"
              className="w-full pl-10 pr-11 py-3 bg-slate-900/60 border border-slate-700/50 rounded-xl text-white placeholder:text-slate-600 focus:outline-none focus:border-primary-500/50 focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 text-sm"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
              aria-label={showPassword ? "Masquer" : "Afficher"}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {/* Password strength indicators */}
          {form.password.length > 0 && (
            <div className="mt-2.5 grid grid-cols-2 gap-1.5">
              {passwordRules.map((rule, i) => {
                const passed = rule.test(form.password);
                return (
                  <div
                    key={i}
                    className={`flex items-center gap-1.5 text-[11px] transition-colors duration-200 ${
                      passed ? "text-secondary-400" : "text-slate-600"
                    }`}
                  >
                    <Check className={`w-3 h-3 ${passed ? "opacity-100" : "opacity-30"}`} />
                    {rule.label}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Confirmer mot de passe */}
        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-300 mb-1.5">
            Confirmer le mot de passe
          </label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              id="confirmPassword"
              name="confirmPassword"
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              value={form.confirmPassword}
              onChange={handleChange}
              placeholder="••••••••"
              className={`w-full pl-10 pr-3 py-3 bg-slate-900/60 border rounded-xl text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 transition-all duration-200 text-sm ${
                form.confirmPassword.length > 0 && form.password !== form.confirmPassword
                  ? "border-emergency-500/50 focus:border-emergency-500/50 focus:ring-emergency-500/20"
                  : form.confirmPassword.length > 0 && form.password === form.confirmPassword
                    ? "border-secondary-500/50 focus:border-secondary-500/50 focus:ring-secondary-500/20"
                    : "border-slate-700/50 focus:border-primary-500/50 focus:ring-primary-500/20"
              }`}
            />
          </div>
          {form.confirmPassword.length > 0 && form.password !== form.confirmPassword && (
            <p className="mt-1.5 text-[11px] text-emergency-500">Les mots de passe ne correspondent pas</p>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="group relative w-full py-3.5 rounded-xl text-sm font-semibold text-white overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-primary-500/25 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
        >
          <span className="absolute inset-0 bg-gradient-to-r from-primary-600 to-cyan-500" />
          <span className="absolute inset-0 bg-gradient-to-r from-primary-500 to-secondary-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <span className="relative flex items-center justify-center gap-2">
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <UserPlus className="w-5 h-5" />
            )}
            {loading ? "Création en cours..." : "Créer mon compte"}
          </span>
        </button>
      </form>

      {/* Footer */}
      <p className="mt-6 text-center text-sm text-slate-500">
        Déjà un compte ?{" "}
        <Link
          href="/auth/login"
          className="font-medium text-primary-400 hover:text-primary-300 transition-colors"
        >
          Se connecter
        </Link>
      </p>
    </>
  );
}
