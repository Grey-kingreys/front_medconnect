"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, ArrowLeft, Send, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { forgotPassword, ApiError } from "@/lib/api_auth";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await forgotPassword(email);
      setSent(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Impossible d'envoyer l'email. Vérifiez votre connexion.");
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Écran de confirmation après envoi ──
  if (sent) {
    return (
      <div className="text-center space-y-6">
        {/* Success icon */}
        <div className="inline-flex">
          <div className="w-20 h-20 rounded-3xl bg-secondary-500/10 border border-secondary-500/20 flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-secondary-400" />
          </div>
        </div>

        <div>
          <h2
            className="text-2xl font-extrabold text-white mb-2"
            style={{ fontFamily: "var(--font-outfit, var(--font-inter))" }}
          >
            Email envoyé !
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            Si un compte existe avec l&apos;adresse{" "}
            <span className="text-primary-400 font-medium">{email}</span>,
            vous recevrez un lien de réinitialisation dans quelques instants.
          </p>
        </div>

        {/* Tips */}
        <div className="bg-slate-900/40 border border-slate-800/50 rounded-2xl p-4 text-left space-y-2">
          <p className="text-xs font-medium text-slate-300">💡 Conseils :</p>
          <ul className="text-xs text-slate-500 space-y-1.5">
            <li>• Vérifiez votre dossier spam/indésirables</li>
            <li>• Le lien expire dans 1 heure</li>
            <li>• Vous ne pouvez utiliser le lien qu&apos;une seule fois</li>
          </ul>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={() => { setSent(false); setEmail(""); }}
            className="w-full py-3 rounded-xl text-sm font-medium text-slate-300 border border-slate-700/50 hover:bg-white/5 hover:border-slate-500 transition-all duration-200"
          >
            Renvoyer avec une autre adresse
          </button>

          <Link
            href="/auth/login"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-medium text-primary-400 hover:text-primary-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour à la connexion
          </Link>
        </div>
      </div>
    );
  }

  // ── Formulaire de saisie email ──
  return (
    <>
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex mb-4">
          <div className="w-16 h-16 rounded-2xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center">
            <Mail className="w-8 h-8 text-primary-400" />
          </div>
        </div>
        <h2
          className="text-2xl sm:text-3xl font-extrabold text-white mb-2"
          style={{ fontFamily: "var(--font-outfit, var(--font-inter))" }}
        >
          Mot de passe oublié ?
        </h2>
        <p className="text-slate-400 text-sm leading-relaxed">
          Entrez votre adresse email et nous vous enverrons un lien pour
          réinitialiser votre mot de passe.
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
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
            Adresse email
          </label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <input
              id="email"
              name="email"
              type="email"
              required
              value={email}
              onChange={(e) => { setEmail(e.target.value); if (error) setError(""); }}
              placeholder="vous@exemple.com"
              className="w-full pl-12 pr-4 py-3.5 bg-slate-900/60 border border-slate-700/50 rounded-xl text-white placeholder:text-slate-600 focus:outline-none focus:border-primary-500/50 focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 text-sm"
              autoFocus
            />
          </div>
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
              <Send className="w-5 h-5" />
            )}
            {loading ? "Envoi en cours..." : "Envoyer le lien"}
          </span>
        </button>
      </form>

      {/* Footer */}
      <p className="mt-8 text-center">
        <Link
          href="/auth/login"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-300 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour à la connexion
        </Link>
      </p>
    </>
  );
}
