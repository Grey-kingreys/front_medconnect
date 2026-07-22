"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import InstallAppButton from "./InstallAppButton";

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
        <div className="inline-flex mb-8">
          <div className="relative">
            <div className="w-20 h-20 rounded-3xl bg-white flex items-center justify-center shadow-2xl shadow-primary-500/30 overflow-hidden">
              <Image
                src="/images/logo.png"
                alt="MedConnecte Logo"
                width={64}
                height={64}
                className="animate-pulse-glow"
              />
            </div>
            <div className="absolute inset-0 w-20 h-20 rounded-3xl bg-gradient-to-br from-primary-500 to-cyan-500 animate-pulse-ring opacity-30 -z-10" />
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
          Rejoignez des milliers d&apos;utilisateurs qui font confiance à MedConnecte
          pour leur santé. Gratuit, sécurisé et disponible hors-ligne.
        </p>

        {/* CTA Buttons.
            « Voir la démo » est retiré tant qu'aucune démo n'existe : le bouton
            pointait sur `#` et ne faisait rien. */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
          <InstallAppButton />
        </div>

        {/* Trust line */}
        <p className="text-sm text-slate-500">
          ✓ Gratuit · ✓ Aucune carte requise · ✓ Installation en 10 secondes
        </p>
      </div>
    </section>
  );
}
