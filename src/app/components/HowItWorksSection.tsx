"use client";

import { useEffect, useRef, useState } from "react";
import {
  UserPlus,
  ScanSearch,
  MapPinCheck,
  Sparkles,
  ArrowDown,
} from "lucide-react";

const steps = [
  {
    icon: UserPlus,
    step: "01",
    title: "Créez votre profil",
    description:
      "Inscrivez-vous en quelques secondes et renseignez votre profil médical : groupe sanguin, allergies, pathologies connues.",
    color: "from-primary-500 to-primary-600",
  },
  {
    icon: ScanSearch,
    step: "02",
    title: "Explorez les services",
    description:
      "Accédez à votre carnet de santé, trouvez des établissements à proximité, ou lancez un diagnostic IA selon vos besoins.",
    color: "from-cyan-500 to-primary-500",
  },
  {
    icon: MapPinCheck,
    step: "03",
    title: "Localisez & Agissez",
    description:
      "Trouvez la pharmacie ou l'hôpital le plus proche, réservez un médicament, ou suivez l'itinéraire en temps réel.",
    color: "from-secondary-500 to-cyan-500",
  },
  {
    icon: Sparkles,
    step: "04",
    title: "Restez protégé",
    description:
      "Recevez des rappels de vaccination, consultez votre historique et gardez vos données synchronisées en toute sécurité.",
    color: "from-accent-500 to-primary-500",
  },
];

function StepCard({
  step,
  index,
  isVisible,
}: {
  step: (typeof steps)[0];
  index: number;
  isVisible: boolean;
}) {
  return (
    <div
      className={`relative transition-all duration-700 ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      }`}
      style={{ transitionDelay: `${index * 150}ms` }}
    >
      {/* Connector line (not on last item) */}
      {index < steps.length - 1 && (
        <div className="hidden lg:block absolute top-10 left-[calc(100%_-_8px)] w-full h-[2px]">
          <div
            className={`h-full bg-gradient-to-r ${step.color} transition-all duration-1000 ${
              isVisible ? "w-full opacity-30" : "w-0 opacity-0"
            }`}
            style={{ transitionDelay: `${(index + 1) * 200}ms` }}
          />
        </div>
      )}

      {/* Mobile connector */}
      {index < steps.length - 1 && (
        <div className="lg:hidden flex justify-center py-4">
          <ArrowDown className="w-5 h-5 text-primary-500/30" />
        </div>
      )}

      <div className="group relative text-center lg:text-left">
        {/* Step number + icon */}
        <div className="relative inline-flex mb-6">
          <div
            className={`w-20 h-20 rounded-3xl bg-gradient-to-br ${step.color} flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform duration-300`}
          >
            <step.icon className="w-9 h-9 text-white" />
          </div>
          <span className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-[var(--surface-elevated)] border-2 border-[var(--border)] flex items-center justify-center text-xs font-bold text-primary-500">
            {step.step}
          </span>
        </div>

        {/* Content */}
        <h3
          className="text-xl font-bold text-[var(--foreground)] mb-3"
          style={{ fontFamily: "var(--font-outfit, var(--font-inter))" }}
        >
          {step.title}
        </h3>
        <p className="text-[var(--muted)] leading-relaxed text-sm max-w-xs mx-auto lg:mx-0">
          {step.description}
        </p>
      </div>
    </div>
  );
}

export default function HowItWorksSection() {
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
      { threshold: 0.15 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="how-it-works"
      className="relative section-padding overflow-hidden"
    >
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary-500/3 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Header */}
        <div
          className={`text-center max-w-3xl mx-auto mb-16 sm:mb-20 transition-all duration-700 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest text-secondary-400 bg-secondary-500/10 border border-secondary-500/20 mb-6">
            Comment ça marche
          </span>
          <h2
            className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-6"
            style={{ fontFamily: "var(--font-outfit, var(--font-inter))" }}
          >
            <span className="text-[var(--foreground)]">Simple comme </span>
            <span className="gradient-text">1, 2, 3, 4</span>
          </h2>
          <p className="text-lg text-[var(--muted)] leading-relaxed">
            Prenez le contrôle de votre santé en quelques étapes simples.
            Aucune connaissance technique requise.
          </p>
        </div>

        {/* Steps */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6">
          {steps.map((step, index) => (
            <StepCard
              key={index}
              step={step}
              index={index}
              isVisible={isVisible}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
