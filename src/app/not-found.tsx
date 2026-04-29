"use client";

import { useEffect, useState, useRef } from "react";
import { Heart, Home, ArrowLeft, Search, Stethoscope } from "lucide-react";
import Link from "next/link";

/* ── ECG / Heartbeat Monitor Line ── */
function ECGMonitor() {
  const pathRef = useRef<SVGPathElement>(null);
  const [phase, setPhase] = useState<"beating" | "flatline">("beating");

  useEffect(() => {
    const timer = setTimeout(() => setPhase("flatline"), 3000);
    return () => clearTimeout(timer);
  }, []);

  // Heartbeat path: normal ECG waveform repeated
  const beatingPath =
    "M0,50 L30,50 L35,50 L38,20 L42,80 L46,35 L50,50 L80,50 L110,50 L115,50 L118,20 L122,80 L126,35 L130,50 L160,50 L190,50 L195,50 L198,20 L202,80 L206,35 L210,50 L240,50 L270,50 L275,50 L278,20 L282,80 L286,35 L290,50 L320,50 L350,50 L355,50 L358,20 L362,80 L366,35 L370,50 L400,50";

  // Flatline path
  const flatlinePath =
    "M0,50 L30,50 L35,50 L38,20 L42,80 L46,35 L50,50 L80,50 L110,50 L115,50 L118,25 L121,70 L124,40 L127,50 L160,50 L400,50";

  return (
    <div className="relative w-full max-w-2xl mx-auto">
      {/* Monitor screen */}
      <div className="relative bg-slate-950/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 overflow-hidden shadow-2xl shadow-primary-500/5">
        {/* Scanline effect */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03]">
          <div
            className="w-full h-full"
            style={{
              backgroundImage:
                "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.1) 2px, rgba(255,255,255,0.1) 4px)",
            }}
          />
        </div>

        {/* Monitor header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                phase === "beating"
                  ? "bg-secondary-500 animate-pulse"
                  : "bg-emergency-500"
              }`}
            />
            <span className="text-xs font-mono uppercase tracking-widest text-slate-500">
              {phase === "beating" ? "Recherche en cours..." : "Signal perdu"}
            </span>
          </div>
          <span className="text-xs font-mono text-slate-600">
            MedConnect Monitor v4.0.4
          </span>
        </div>

        {/* ECG Line */}
        <div className="relative h-24 sm:h-32">
          <svg
            viewBox="0 0 400 100"
            className="w-full h-full"
            preserveAspectRatio="none"
          >
            {/* Grid lines */}
            <defs>
              <pattern
                id="ecg-grid"
                width="20"
                height="20"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 20 0 L 0 0 0 20"
                  fill="none"
                  stroke="rgba(59,130,246,0.06)"
                  strokeWidth="0.5"
                />
              </pattern>
              {/* Glow filter */}
              <filter id="ecg-glow">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <rect width="400" height="100" fill="url(#ecg-grid)" />

            {/* ECG path */}
            <path
              ref={pathRef}
              d={phase === "beating" ? beatingPath : flatlinePath}
              fill="none"
              stroke={phase === "beating" ? "#10b981" : "#ef4444"}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#ecg-glow)"
              className="transition-all duration-1000"
              style={{
                strokeDasharray: 1200,
                strokeDashoffset: 0,
                animation:
                  phase === "beating"
                    ? "ecg-draw 2s linear infinite"
                    : "ecg-draw-once 1.5s ease-out forwards",
              }}
            />
          </svg>

          {/* Scanning line */}
          <div
            className={`absolute top-0 bottom-0 w-px ${
              phase === "beating" ? "bg-secondary-400/40" : "bg-emergency-500/30"
            }`}
            style={{
              animation: "ecg-scan 2s linear infinite",
            }}
          />
        </div>

        {/* Monitor footer */}
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className="text-[10px] font-mono uppercase text-slate-600">
                BPM
              </p>
              <p
                className={`text-lg font-bold font-mono ${
                  phase === "beating"
                    ? "text-secondary-500"
                    : "text-emergency-500"
                }`}
              >
                {phase === "beating" ? "72" : "—"}
              </p>
            </div>
            <div className="text-center">
              <p className="text-[10px] font-mono uppercase text-slate-600">
                SpO2
              </p>
              <p
                className={`text-lg font-bold font-mono ${
                  phase === "beating"
                    ? "text-primary-400"
                    : "text-emergency-500"
                }`}
              >
                {phase === "beating" ? "98%" : "—"}
              </p>
            </div>
          </div>

          {/* Status */}
          <div
            className={`px-3 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
              phase === "beating"
                ? "bg-secondary-500/10 text-secondary-400 border border-secondary-500/20"
                : "bg-emergency-500/10 text-emergency-500 border border-emergency-500/20 animate-pulse"
            }`}
          >
            {phase === "beating" ? "Connexion..." : "Page introuvable"}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Floating Particles ── */
function FloatingParticles() {
  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none"
      aria-hidden="true"
    >
      {/* Gradient blobs */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-primary-500/5 rounded-full blur-3xl animate-blob" />
      <div className="absolute bottom-1/4 right-0 w-80 h-80 bg-emergency-500/5 rounded-full blur-3xl animate-blob animate-delay-500" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent-500/3 rounded-full blur-3xl" />

      {/* Floating crosses */}
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="absolute animate-float opacity-[0.04]"
          style={{
            top: `${15 + i * 15}%`,
            left: `${10 + ((i * 17) % 80)}%`,
            animationDelay: `${i * 0.8}s`,
            animationDuration: `${5 + i * 1.2}s`,
          }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-primary-400"
          >
            <path d="M12 4v16M4 12h16" />
          </svg>
        </div>
      ))}
    </div>
  );
}

/* ── Main 404 Page ── */
export default function NotFound() {
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    // Show the main content after the ECG flatlines
    const timer = setTimeout(() => setShowContent(true), 3500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center gradient-hero overflow-hidden">
      <FloatingParticles />

      {/* Custom keyframes injected via style tag */}
      <style>{`
        @keyframes ecg-draw {
          0% { stroke-dashoffset: 1200; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes ecg-draw-once {
          0% { stroke-dashoffset: 1200; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes ecg-scan {
          0% { left: 0%; }
          100% { left: 100%; }
        }
        @keyframes glitch-1 {
          0%, 100% { clip-path: inset(20% 0 60% 0); transform: translate(-2px, 0); }
          25% { clip-path: inset(60% 0 10% 0); transform: translate(2px, 0); }
          50% { clip-path: inset(40% 0 30% 0); transform: translate(-1px, 0); }
          75% { clip-path: inset(10% 0 70% 0); transform: translate(1px, 0); }
        }
        @keyframes number-reveal {
          0% { opacity: 0; transform: scale(0.8) translateY(20px); filter: blur(10px); }
          100% { opacity: 1; transform: scale(1) translateY(0); filter: blur(0); }
        }
        @keyframes content-rise {
          0% { opacity: 0; transform: translateY(30px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="relative z-10 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* ECG Monitor */}
        <ECGMonitor />

        {/* 404 Number — appears after flatline */}
        <div
          className={`text-center mt-12 transition-all duration-1000 ${
            showContent ? "opacity-100" : "opacity-0"
          }`}
          style={{
            animation: showContent
              ? "number-reveal 0.8s ease-out forwards"
              : "none",
          }}
        >
          {/* Giant 404 */}
          <div className="relative inline-block">
            <h1
              className="text-[120px] sm:text-[160px] lg:text-[200px] font-black leading-none tracking-tighter select-none"
              style={{
                fontFamily: "var(--font-outfit, var(--font-inter))",
                background:
                  "linear-gradient(135deg, #ef4444 0%, #dc2626 30%, #1e293b 70%, #0f172a 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              404
            </h1>

            {/* Glitch layer */}
            <h1
              className="absolute inset-0 text-[120px] sm:text-[160px] lg:text-[200px] font-black leading-none tracking-tighter select-none opacity-20 pointer-events-none"
              style={{
                fontFamily: "var(--font-outfit, var(--font-inter))",
                color: "#ef4444",
                animation: "glitch-1 3s ease-in-out infinite",
              }}
              aria-hidden="true"
            >
              404
            </h1>

            {/* Stethoscope icon overlay */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
              <Stethoscope className="w-12 h-12 sm:w-16 sm:h-16 text-white/10" />
            </div>
          </div>
        </div>

        {/* Content — rises after 404 */}
        <div
          className={`text-center mt-6 space-y-6 transition-all duration-700 ${
            showContent ? "opacity-100" : "opacity-0"
          }`}
          style={{
            animation: showContent
              ? "content-rise 0.8s ease-out 0.3s forwards"
              : "none",
            opacity: showContent ? undefined : 0,
          }}
        >
          {/* Diagnostic badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-emergency-500/20 bg-emergency-500/5 text-emergency-500 text-sm font-medium">
            <Heart className="w-4 h-4" />
            <span>Diagnostic : Page introuvable</span>
          </div>

          <h2
            className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white"
            style={{ fontFamily: "var(--font-outfit, var(--font-inter))" }}
          >
            Cette page a besoin d&apos;un{" "}
            <span className="gradient-text">médecin</span>
          </h2>

          <p className="text-slate-400 text-base sm:text-lg max-w-md mx-auto leading-relaxed">
            Il semble que la page que vous cherchez n&apos;existe pas, a été
            déplacée ou est en consultation ailleurs.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Link
              href="/"
              className="group relative inline-flex items-center justify-center gap-2.5 px-8 py-4 text-base font-semibold text-white rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-2xl hover:shadow-primary-500/25 hover:-translate-y-0.5"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-primary-600 via-primary-500 to-cyan-500" />
              <span className="absolute inset-0 bg-gradient-to-r from-primary-500 via-cyan-500 to-secondary-500 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <Home className="relative w-5 h-5" />
              <span className="relative">Retour à l&apos;accueil</span>
            </Link>

            <button
              onClick={() => window.history.back()}
              className="inline-flex items-center justify-center gap-2.5 px-8 py-4 text-base font-medium text-slate-300 border border-slate-700 rounded-2xl hover:bg-white/5 hover:border-slate-500 hover:text-white transition-all duration-300"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Page précédente</span>
            </button>
          </div>

          {/* Search suggestion */}
          <div className="pt-6">
            <div className="inline-flex items-center gap-3 px-5 py-3 rounded-2xl bg-white/5 border border-white/5 text-slate-500 text-sm">
              <Search className="w-4 h-4" />
              <span>
                Essayez de vérifier l&apos;URL ou utilisez la navigation
              </span>
            </div>
          </div>
        </div>

        {/* Bottom decoration: MedConnect brand */}
        <div
          className={`text-center mt-16 transition-all duration-700 delay-500 ${
            showContent ? "opacity-100" : "opacity-0"
          }`}
        >
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-400 transition-colors"
          >
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-primary-500 to-cyan-500 flex items-center justify-center">
              <Heart className="w-3 h-3 text-white fill-white" />
            </div>
            <span
              className="text-sm font-semibold"
              style={{ fontFamily: "var(--font-outfit, var(--font-inter))" }}
            >
              MedConnect
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
