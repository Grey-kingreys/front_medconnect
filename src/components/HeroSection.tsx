"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Shield,
  MapPin,
  Smartphone,
  Activity,
  Stethoscope,
  Pill,
  Siren,
  Heart,
  Sparkles,
  LayoutDashboard,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

/* ── Floating medical icons in the hero background ── */
function FloatingElements() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* Gradient blobs */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl animate-blob" />
      <div className="absolute top-1/3 right-0 w-80 h-80 bg-accent-500/8 rounded-full blur-3xl animate-blob animate-delay-300" />
      <div className="absolute bottom-0 left-1/3 w-72 h-72 bg-cyan-500/8 rounded-full blur-3xl animate-blob animate-delay-700" />

      {/* Floating icons */}
      <div className="absolute top-32 left-[10%] animate-float opacity-20">
        <Stethoscope className="w-8 h-8 text-primary-400" />
      </div>
      <div className="absolute top-48 right-[15%] animate-float-delayed opacity-15">
        <Pill className="w-7 h-7 text-cyan-400" />
      </div>
      <div className="absolute top-64 left-[20%] animate-float-slow opacity-10">
        <Heart className="w-6 h-6 text-emergency-500" />
      </div>
      <div className="absolute bottom-48 right-[25%] animate-float opacity-15">
        <Activity className="w-7 h-7 text-secondary-400" />
      </div>
      <div className="absolute bottom-32 left-[8%] animate-float-delayed opacity-10">
        <Shield className="w-8 h-8 text-accent-400" />
      </div>

      {/* Grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: "64px 64px",
        }}
      />
    </div>
  );
}

/* ── Phone mockup with app preview ── */
function PhoneMockup() {
  return (
    <div className="relative w-[280px] sm:w-[320px] mx-auto">
      {/* Glow behind phone */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary-500/30 via-cyan-500/20 to-secondary-500/30 blur-3xl rounded-full scale-110" />

      {/* Phone frame */}
      <div className="relative bg-slate-900 rounded-[3rem] p-3 shadow-2xl shadow-primary-500/10 border border-slate-700/50">
        <div className="bg-slate-950 rounded-[2.3rem] overflow-hidden">
          {/* Status bar */}
          <div className="flex justify-between items-center px-6 py-2 text-[10px] text-slate-400">
            <span>9:41</span>
            <div className="w-20 h-5 bg-slate-800 rounded-full" />
            <div className="flex gap-1">
              <Activity className="w-3 h-3" />
              <span>100%</span>
            </div>
          </div>

          {/* App screen */}
          <div className="px-4 pb-6 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between pt-2">
              <div>
                <p className="text-[10px] text-slate-500">Bonjour 👋</p>
                <p className="text-sm font-semibold text-white">Souleymane</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-cyan-500 flex items-center justify-center">
                <span className="text-xs font-bold text-white">S</span>
              </div>
            </div>

            {/* SOS Button */}
            <button className="w-full py-3 bg-gradient-to-r from-emergency-500 to-emergency-600 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emergency-500/25 animate-pulse-glow">
              <Siren className="w-5 h-5 text-white" />
              <span className="text-sm font-bold text-white tracking-wide">URGENCE SOS</span>
            </button>

            {/* Quick Actions Grid */}
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { icon: Heart, label: "Carnet santé", color: "from-primary-500/20 to-primary-600/20", iconColor: "text-primary-400" },
                { icon: MapPin, label: "Carte médicale", color: "from-secondary-500/20 to-secondary-600/20", iconColor: "text-secondary-400" },
                { icon: Sparkles, label: "Diagnostic IA", color: "from-accent-500/20 to-accent-600/20", iconColor: "text-accent-400" },
                { icon: Pill, label: "Pharmacie", color: "from-cyan-400/20 to-cyan-500/20", iconColor: "text-cyan-400" },
              ].map((item, i) => (
                <div
                  key={i}
                  className={`bg-gradient-to-br ${item.color} backdrop-blur-sm border border-white/5 rounded-2xl p-3 flex flex-col items-center gap-2 hover:scale-105 transition-transform duration-200`}
                >
                  <item.icon className={`w-5 h-5 ${item.iconColor}`} />
                  <span className="text-[11px] font-medium text-slate-300">{item.label}</span>
                </div>
              ))}
            </div>

            {/* Recent card */}
            <div className="bg-white/5 backdrop-blur border border-white/5 rounded-2xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4 text-secondary-400" />
                <span className="text-xs font-medium text-slate-300">Dernière consultation</span>
              </div>
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-xs font-semibold text-white">Dr. Diallo</p>
                  <p className="text-[10px] text-slate-500">Médecine générale</p>
                </div>
                <span className="text-[10px] text-slate-500 bg-slate-800 px-2 py-1 rounded-full">28 Avr</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating badges */}
      <div className="absolute -top-4 -right-4 bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl px-3 py-2 flex items-center gap-2 animate-float shadow-xl">
        <div className="w-7 h-7 rounded-full bg-secondary-500/20 flex items-center justify-center">
          <Shield className="w-4 h-4 text-secondary-400" />
        </div>
        <div>
          <p className="text-[10px] font-semibold text-white">Sécurisé</p>
          <p className="text-[8px] text-slate-400">Chiffrement E2E</p>
        </div>
      </div>

      <div className="absolute -bottom-2 -left-6 bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl px-3 py-2 flex items-center gap-2 animate-float-delayed shadow-xl">
        <div className="w-7 h-7 rounded-full bg-primary-500/20 flex items-center justify-center">
          <Smartphone className="w-4 h-4 text-primary-400" />
        </div>
        <div>
          <p className="text-[10px] font-semibold text-white">Hors-ligne</p>
          <p className="text-[8px] text-slate-400">Accès permanent</p>
        </div>
      </div>
    </div>
  );
}

/* ── Main Hero Section ── */
export default function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const { isAuthenticated } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const el = sectionRef.current;
    if (!el) return;
    el.classList.add("animate-fade-in");
  }, []);

  return (
    <section
      ref={sectionRef}
      id="hero"
      className="relative min-h-screen flex items-center gradient-hero overflow-hidden"
    >
      <FloatingElements />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32 lg:py-20">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-20 items-center">
          {/* Left: Text Content */}
          <div className="text-center lg:text-left space-y-8">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary-500/30 bg-primary-500/10 text-primary-300 text-sm font-medium animate-slide-up">
              <Sparkles className="w-4 h-4" />
              <span>Propulsé par l&apos;Intelligence Artificielle</span>
            </div>

            {/* Heading */}
            <h1
              className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-extrabold leading-[1.1] tracking-tight animate-slide-up animate-delay-100"
              style={{ fontFamily: "var(--font-outfit, var(--font-inter))" }}
            >
              <span className="text-slate-900 dark:text-white">Votre santé,</span>
              <br />
              <span className="gradient-text-hero">connectée</span>
              <br />
              <span className="text-slate-900 dark:text-white">et protégée</span>
            </h1>

            {/* Subtitle */}
            <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-400 max-w-lg mx-auto lg:mx-0 leading-relaxed animate-slide-up animate-delay-200">
              Carnet de santé numérique, géolocalisation médicale, assistance
              d&apos;urgence et diagnostic IA — tout ce dont vous avez besoin, dans
              votre poche.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start animate-slide-up animate-delay-300">
              {mounted && isAuthenticated ? (
                <a
                  href="/dashboard"
                  id="hero-cta-primary"
                  className="group relative inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-semibold text-white rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-2xl hover:shadow-primary-500/25 hover:-translate-y-0.5"
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-primary-600 via-primary-500 to-cyan-500" />
                  <span className="absolute inset-0 bg-gradient-to-r from-primary-500 via-cyan-500 to-secondary-500 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <LayoutDashboard className="relative w-5 h-5" />
                  <span className="relative">Accéder à mon espace</span>
                  <ArrowRight className="relative w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" />
                </a>
              ) : (
                <a
                  href="/auth/register"
                  id="hero-cta-primary"
                  className="group relative inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-semibold text-white rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-2xl hover:shadow-primary-500/25 hover:-translate-y-0.5"
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-primary-600 via-primary-500 to-cyan-500" />
                  <span className="absolute inset-0 bg-gradient-to-r from-primary-500 via-cyan-500 to-secondary-500 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <span className="relative">Commencer gratuitement</span>
                  <ArrowRight className="relative w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" />
                </a>
              )}

              <a
                href="#features"
                id="hero-cta-secondary"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-medium text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-2xl hover:bg-slate-100 dark:hover:bg-white/5 hover:border-slate-400 dark:hover:border-slate-500 hover:text-slate-900 dark:hover:text-white transition-all duration-300"
              >
                Découvrir les fonctionnalités
              </a>
            </div>

            {/* Trust badges */}
            <div className="flex flex-wrap items-center gap-6 justify-center lg:justify-start pt-4 animate-slide-up animate-delay-400">
              {[
                { icon: Shield, text: "Données chiffrées" },
                { icon: Smartphone, text: "PWA installable" },
                { icon: Activity, text: "Mode hors-ligne" },
              ].map((badge, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-sm text-slate-500"
                >
                  <badge.icon className="w-4 h-4 text-primary-500" />
                  <span>{badge.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Phone Mockup */}
          <div className="hidden lg:flex justify-center animate-slide-in-right animate-delay-300">
            <PhoneMockup />
          </div>
        </div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[var(--background)] to-transparent" />
    </section>
  );
}
