"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { X, Loader2, RefreshCw, ShieldCheck, AlertCircle } from "lucide-react";
import { generateShareCode, ShareCode } from "@/lib/api_consent";
import { ApiError } from "@/lib/api_auth";

/**
 * Modal patient « Partager mon dossier ».
 * Génère un code éphémère (+ QR) à présenter à l'accueil d'une structure.
 * Le code expire (compte à rebours) et est à usage unique côté serveur.
 */
export function ShareDossierModal({ onClose }: { onClose: () => void }) {
  const [share, setShare] = useState<ShareCode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [remaining, setRemaining] = useState(0);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const s = await generateShareCode();
      setShare(s);
      setRemaining(s.expiresInSec);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Impossible de générer le code.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Compte à rebours
  useEffect(() => {
    if (remaining <= 0) return;
    const id = setInterval(() => setRemaining(r => Math.max(0, r - 1)), 1000);
    return () => clearInterval(id);
  }, [remaining]);

  const expired = !!share && remaining <= 0;
  const mmss = `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-slide-up">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800/50">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary-500" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Partager mon dossier</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 flex flex-col items-center text-center gap-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Montrez ce code (ou le QR) à l&apos;accueil pour autoriser la structure à consulter votre dossier.
          </p>

          {loading && <Loader2 className="w-8 h-8 animate-spin text-primary-500 my-6" />}

          {error && !loading && (
            <div className="flex gap-2 p-3 rounded-xl bg-emergency-500/10 border border-emergency-500/20 text-emergency-400 text-sm w-full">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
            </div>
          )}

          {share && !loading && (
            <>
              <div className={`relative rounded-2xl bg-white p-3 border border-slate-200 ${expired ? "opacity-30" : ""}`}>
                {/* QR fourni par le backend en data URL */}
                <Image src={share.qrDataUrl} alt="QR de partage" width={200} height={200} unoptimized className="w-48 h-48" />
              </div>

              <div className="w-full">
                <p className="text-[11px] uppercase tracking-wider text-slate-400 mb-1">Code</p>
                <p className={`text-3xl font-extrabold tracking-[0.3em] text-slate-900 dark:text-white ${expired ? "opacity-30" : ""}`}>
                  {share.code}
                </p>
              </div>

              {expired ? (
                <button onClick={load} className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-primary-600 to-cyan-500 hover:shadow-lg hover:shadow-primary-500/25">
                  <RefreshCw className="w-4 h-4" /> Régénérer un code
                </button>
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Expire dans <span className="font-semibold text-slate-900 dark:text-white tabular-nums">{mmss}</span>
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
