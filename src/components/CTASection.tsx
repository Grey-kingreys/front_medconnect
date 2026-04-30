"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Download, Smartphone, Heart } from "lucide-react";

export default function CTASection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} id="cta" className="relative py-24 sm:py-32 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 gradient-hero" />
      <div className="absolute inset-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl animate-blob" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl animate-blob animate-delay-500" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent-500/5 rounded-full blur-3xl" />
      </div>

      <div
        className={`relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
      >
        {/* Icon */}
        <div className="inline-flex mb-8">
          <div className="relative">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary-500 to-cyan-500 flex items-center justify-center shadow-2xl shadow-primary-500/30">
              <Heart className="w-10 h-10 text-white fill-white animate-heartbeat" />
            </div>
            <div className="absolute inset-0 w-20 h-20 rounded-3xl bg-gradient-to-br from-primary-500 to-cyan-500 animate-pulse-ring opacity-30" />
          </div>
        </div>

        {/* Heading */}
        <h2
          className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-extrabold text-white leading-tight tracking-tight mb-6"
          style={{ fontFamily: "var(--font-outfit, var(--font-inter))" }}
        >
          Prenez soin de votre santé
          <br />
          <span className="gradient-text-hero">dès aujourd&apos;hui</span>
        </h2>

        <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed mb-10">
          Rejoignez des milliers d&apos;utilisateurs qui font confiance à MedConnect
          pour leur santé. Gratuit, sécurisé et disponible hors-ligne.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
          <a
            href="#"
            id="cta-download"
            className="group relative inline-flex items-center justify-center gap-3 px-10 py-5 text-lg font-semibold text-white rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-2xl hover:shadow-primary-500/30 hover:-translate-y-1"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-primary-600 via-primary-500 to-cyan-500 animate-gradient" />
            <span className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-primary-500 to-secondary-500 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <Download className="relative w-5 h-5" />
            <span className="relative">Installer MedConnect</span>
            <ArrowRight className="relative w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" />
          </a>

          <a
            href="#"
            id="cta-demo"
            className="inline-flex items-center justify-center gap-3 px-10 py-5 text-lg font-medium text-slate-300 border border-slate-600 rounded-2xl hover:bg-white/5 hover:border-slate-400 hover:text-white transition-all duration-300"
          >
            <Smartphone className="w-5 h-5" />
            <span>Voir la démo</span>
          </a>
        </div>

        {/* Trust line */}
        <p className="text-sm text-slate-500">
          ✓ Gratuit · ✓ Aucune carte requise · ✓ Installation en 10 secondes
        </p>
      </div>
    </section>
  );
}
