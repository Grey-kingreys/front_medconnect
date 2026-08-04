"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  Headset, KeyRound, MessageSquare, Loader2, CheckCircle2, AlertCircle, ShieldCheck, ArrowRight, RotateCcw, ScanLine,
} from "lucide-react";
import {
  redeemConsentCode, requestConsentOtp, verifyConsentOtp,
  ConsentResult, OtpRequested,
} from "@/lib/api_consent";
import { ApiError } from "@/lib/api_auth";
import { QrScanner } from "@/components/QrScanner";

type Mode = "code" | "sms";

export default function AccueilPage() {
  const { user, profile } = useAuth();
  const structureId = profile?.structureId ?? user?.structureId ?? "";

  const [mode, setMode] = useState<Mode>("code");

  // Flux code
  const [code, setCode] = useState("");

  // Flux SMS
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState<OtpRequested | null>(null);
  const [otpCode, setOtpCode] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ConsentResult | null>(null);
  const [scanning, setScanning] = useState(false);

  const errMsg = (e: unknown) =>
    e instanceof ApiError ? e.message : "Une erreur est survenue. Réessayez.";

  const resetAll = () => {
    setCode(""); setPhone(""); setOtp(null); setOtpCode("");
    setError(""); setResult(null);
  };

  const doRedeem = async (value: string) => {
    setLoading(true); setError(""); setResult(null);
    try {
      setResult(await redeemConsentCode(value.trim()));
      setCode("");
    } catch (e) { setError(errMsg(e)); }
    finally { setLoading(false); }
  };

  const submitCode = (e: React.FormEvent) => {
    e.preventDefault();
    doRedeem(code);
  };

  const handleScanned = (scanned: string) => {
    setScanning(false);
    setCode(scanned);
    doRedeem(scanned);
  };

  const sendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(""); setResult(null);
    try {
      setOtp(await requestConsentOtp(phone.trim()));
    } catch (e) { setError(errMsg(e)); }
    finally { setLoading(false); }
  };

  const submitOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp) return;
    setLoading(true); setError("");
    try {
      setResult(await verifyConsentOtp(otp.patientId, otpCode.trim()));
      setOtp(null); setOtpCode(""); setPhone("");
    } catch (e) { setError(errMsg(e)); }
    finally { setLoading(false); }
  };

  const cls =
    "w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/50 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500/50 text-sm transition-all";

  if (!structureId) {
    return (
      <div className="max-w-xl mx-auto mt-10 flex items-center gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 text-sm">
        <AlertCircle className="w-5 h-5 flex-shrink-0" />
        Cette page est réservée au personnel rattaché à une structure.
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-6 animate-fade-in">
      {/* En-tête */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center text-white shadow-lg shadow-violet-500/25">
          <Headset className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white" style={{ fontFamily: "var(--font-outfit, var(--font-inter))" }}>Accueil patient</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Enregistrer le partage du dossier d&apos;un patient avec votre structure</p>
        </div>
      </div>

      {/* Résultat de succès */}
      {result && (
        <div className="p-5 rounded-2xl bg-secondary-500/10 border border-secondary-500/30 space-y-3">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-secondary-400 flex-shrink-0" />
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">
                {result.patient.prenom} {result.patient.nom}
              </p>
              <p className="text-sm text-secondary-400">{result.message}</p>
            </div>
          </div>
          <button onClick={resetAll} className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">
            <RotateCcw className="w-4 h-4" /> Enregistrer un autre patient
          </button>
        </div>
      )}

      {!result && (
        <div className="bg-white dark:bg-[#0f172a]/60 border border-slate-200 dark:border-slate-800/50 rounded-2xl overflow-hidden">
          {/* Onglets */}
          <div className="flex border-b border-slate-100 dark:border-slate-800/50">
            {([
              { m: "code" as Mode, label: "Code du patient", icon: <KeyRound className="w-4 h-4" /> },
              { m: "sms" as Mode, label: "Envoyer par SMS", icon: <MessageSquare className="w-4 h-4" /> },
            ]).map(t => (
              <button
                key={t.m}
                onClick={() => { setMode(t.m); setError(""); }}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-medium transition-colors ${mode === t.m ? "text-violet-500 border-b-2 border-violet-500 bg-violet-500/5" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"}`}
              >
                {t.icon}{t.label}
              </button>
            ))}
          </div>

          <div className="p-6">
            {error && (
              <div className="flex gap-2 p-3 mb-4 rounded-xl bg-emergency-500/10 border border-emergency-500/20 text-emergency-400 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
              </div>
            )}

            {/* Flux 1 : code présenté par le patient */}
            {mode === "code" && (
              <form onSubmit={submitCode} className="space-y-4">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Demandez au patient d&apos;ouvrir <span className="font-medium text-slate-700 dark:text-slate-200">« Partager mon dossier »</span> dans son application, puis scannez son QR (ou saisissez le code).
                </p>
                <button
                  type="button"
                  onClick={() => { setError(""); setScanning(true); }}
                  className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-violet-600 dark:text-violet-300 border border-violet-500/30 bg-violet-500/5 hover:bg-violet-500/10 transition-all"
                >
                  <ScanLine className="w-4 h-4" /> Scanner le QR
                </button>
                <div className="flex items-center gap-3 text-[11px] uppercase tracking-wider text-slate-400">
                  <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                  ou saisir le code
                  <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                </div>
                <input
                  value={code}
                  onChange={e => setCode(e.target.value.toUpperCase())}
                  className={`${cls} text-center text-2xl font-bold tracking-[0.3em] uppercase`}
                  placeholder="A7K3QM"
                  maxLength={12}
                />
                <button type="submit" disabled={loading || code.trim().length < 4}
                  className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-purple-500 hover:shadow-lg hover:shadow-violet-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  Valider l&apos;accès
                </button>
              </form>
            )}

            {/* Flux 2 : OTP par SMS */}
            {mode === "sms" && !otp && (
              <form onSubmit={sendOtp} className="space-y-4">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Pour un patient sans smartphone : saisissez son numéro, il recevra un code par SMS à vous dicter.
                </p>
                <input
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className={cls}
                  placeholder="+224 622 00 00 00"
                  type="tel"
                />
                <button type="submit" disabled={loading || phone.trim().length < 6}
                  className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-purple-500 hover:shadow-lg hover:shadow-violet-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                  Envoyer le code
                </button>
              </form>
            )}

            {mode === "sms" && otp && (
              <form onSubmit={submitOtp} className="space-y-4">
                <div className="flex gap-2 p-3 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-500 dark:text-violet-300 text-sm">
                  <MessageSquare className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{otp.message}</span>
                </div>
                <input
                  autoFocus
                  value={otpCode}
                  onChange={e => setOtpCode(e.target.value.replace(/\D/g, ""))}
                  className={`${cls} text-center text-2xl font-bold tracking-[0.4em]`}
                  placeholder="123456"
                  inputMode="numeric"
                  maxLength={6}
                />
                <div className="flex gap-2">
                  <button type="button" onClick={() => { setOtp(null); setOtpCode(""); }}
                    className="px-4 py-3 rounded-xl text-sm font-medium text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-800/50">
                    Retour
                  </button>
                  <button type="submit" disabled={loading || otpCode.length < 4}
                    className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-purple-500 hover:shadow-lg hover:shadow-violet-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                    Valider l&apos;accès
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
        Le patient reste seul maître de ses données : ce partage n&apos;est enregistré qu&apos;avec son consentement (code ou SMS).
      </p>

      {scanning && <QrScanner onDetected={handleScanned} onClose={() => setScanning(false)} />}
    </div>
  );
}
