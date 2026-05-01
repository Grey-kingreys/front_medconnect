"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Lock,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ShieldAlert,
  Check,
  ArrowLeft,
} from "lucide-react";
import { verifyResetToken, resetPassword, ApiError } from "@/lib/api_auth";

const passwordRules = [
  { label: "Au moins 8 caractères", test: (p: string) => p.length >= 8 },
  { label: "Une lettre majuscule", test: (p: string) => /[A-Z]/.test(p) },
  { label: "Une lettre minuscule", test: (p: string) => /[a-z]/.test(p) },
  { label: "Un chiffre", test: (p: string) => /\d/.test(p) },
];

type PageState = "verifying" | "form" | "success" | "invalid";

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="text-center space-y-6 py-8">
          <Loader2 className="w-12 h-12 text-primary-500 animate-spin mx-auto" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Chargement...</p>
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [state, setState] = useState<PageState>("verifying");
  const [email, setEmail] = useState("");
  const [form, setForm] = useState({ password: "", confirmPassword: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Vérification du token au montage
  const verify = useCallback(async () => {
    if (!token) {
      setState("invalid");
      return;
    }
    try {
      const res = await verifyResetToken(token);
      setEmail(res.data.email);
      setState("form");
    } catch {
      setState("invalid");
    }
  }, [token]);

  useEffect(() => {
    verify();
  }, [verify]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (error) setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

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
      await resetPassword(token, form.password);
      setState("success");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setState("invalid");
        } else {
          setError(err.message);
        }
      } else {
        setError("Une erreur est survenue. Veuillez réessayer.");
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Vérification en cours ──
  if (state === "verifying") {
    return (
      <div className="text-center space-y-6 py-8">
        <Loader2 className="w-12 h-12 text-primary-500 animate-spin mx-auto" />
        <div>
          <h2
            className="text-xl font-bold text-slate-900 dark:text-white mb-2"
            style={{ fontFamily: "var(--font-outfit, var(--font-inter))" }}
          >
            Vérification du lien...
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Nous vérifions la validité de votre lien de réinitialisation.
          </p>
        </div>
      </div>
    );
  }

  // ── Token invalide ou expiré ──
  if (state === "invalid") {
    return (
      <div className="text-center space-y-6">
        <div className="inline-flex">
          <div className="w-20 h-20 rounded-3xl bg-emergency-500/10 border border-emergency-500/20 flex items-center justify-center">
            <ShieldAlert className="w-10 h-10 text-emergency-500" />
          </div>
        </div>

        <div>
          <h2
            className="text-2xl font-extrabold text-slate-900 dark:text-white mb-2"
            style={{ fontFamily: "var(--font-outfit, var(--font-inter))" }}
          >
            Lien invalide ou expiré
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
            Ce lien de réinitialisation n&apos;est plus valide. Il a peut-être
            expiré ou a déjà été utilisé.
          </p>
        </div>

        <div className="space-y-3">
          <Link
            href="/auth/forgot-password"
            className="group relative flex items-center justify-center gap-2 w-full py-3.5 rounded-xl text-sm font-semibold text-white overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-primary-500/25"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-primary-600 to-cyan-500" />
            <span className="relative">Demander un nouveau lien</span>
          </Link>

          <Link
            href="/auth/login"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-medium text-slate-500 hover:text-slate-600 dark:text-slate-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour à la connexion
          </Link>
        </div>
      </div>
    );
  }

  // ── Succès ──
  if (state === "success") {
    return (
      <div className="text-center space-y-6">
        <div className="inline-flex">
          <div className="w-20 h-20 rounded-3xl bg-secondary-500/10 border border-secondary-500/20 flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-secondary-400" />
          </div>
        </div>

        <div>
          <h2
            className="text-2xl font-extrabold text-slate-900 dark:text-white mb-2"
            style={{ fontFamily: "var(--font-outfit, var(--font-inter))" }}
          >
            Mot de passe réinitialisé !
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
            Votre mot de passe a été changé avec succès. Vous pouvez maintenant
            vous connecter avec votre nouveau mot de passe.
          </p>
        </div>

        <Link
          href="/auth/login"
          className="group relative flex items-center justify-center gap-2 w-full py-3.5 rounded-xl text-sm font-semibold text-white overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-primary-500/25"
        >
          <span className="absolute inset-0 bg-gradient-to-r from-primary-600 to-cyan-500" />
          <span className="absolute inset-0 bg-gradient-to-r from-primary-500 to-secondary-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <span className="relative">Se connecter</span>
        </Link>
      </div>
    );
  }

  // ── Formulaire de réinitialisation ──
  return (
    <>
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex mb-4">
          <div className="w-16 h-16 rounded-2xl bg-accent-500/10 border border-accent-500/20 flex items-center justify-center">
            <KeyRound className="w-8 h-8 text-accent-400" />
          </div>
        </div>
        <h2
          className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mb-2"
          style={{ fontFamily: "var(--font-outfit, var(--font-inter))" }}
        >
          Nouveau mot de passe
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm">
          Choisissez un nouveau mot de passe pour{" "}
          <span className="text-primary-400 font-medium">{email}</span>
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
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* New password */}
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
            Nouveau mot de passe
          </label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              value={form.password}
              onChange={handleChange}
              placeholder="••••••••"
              className="w-full pl-12 pr-12 py-3.5 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/50 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-500 focus:outline-none focus:border-primary-500/50 focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 text-sm"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-600 dark:text-slate-300 transition-colors"
              aria-label={showPassword ? "Masquer" : "Afficher"}
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

          {/* Password rules */}
          {form.password.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-1.5">
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

        {/* Confirm password */}
        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
            Confirmer le mot de passe
          </label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <input
              id="confirmPassword"
              name="confirmPassword"
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              value={form.confirmPassword}
              onChange={handleChange}
              placeholder="••••••••"
              className={`w-full pl-12 pr-4 py-3.5 bg-white dark:bg-slate-900/60 border rounded-xl text-slate-900 dark:text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 transition-all duration-200 text-sm ${
                form.confirmPassword.length > 0 && form.password !== form.confirmPassword
                  ? "border-emergency-500/50 focus:border-emergency-500/50 focus:ring-emergency-500/20"
                  : form.confirmPassword.length > 0 && form.password === form.confirmPassword
                    ? "border-secondary-500/50 focus:border-secondary-500/50 focus:ring-secondary-500/20"
                    : "border-slate-200 dark:border-slate-700/50 focus:border-primary-500/50 focus:ring-primary-500/20"
              }`}
            />
          </div>
          {form.confirmPassword.length > 0 && form.password !== form.confirmPassword && (
            <p className="mt-1.5 text-xs text-emergency-500">Les mots de passe ne correspondent pas</p>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="group relative w-full py-3.5 rounded-xl text-sm font-semibold text-white overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-primary-500/25 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <span className="absolute inset-0 bg-gradient-to-r from-primary-600 to-cyan-500" />
          <span className="absolute inset-0 bg-gradient-to-r from-primary-500 to-secondary-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <span className="relative flex items-center justify-center gap-2">
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <KeyRound className="w-5 h-5" />
            )}
            {loading ? "Réinitialisation..." : "Réinitialiser le mot de passe"}
          </span>
        </button>
      </form>
    </>
  );
}
