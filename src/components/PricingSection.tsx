"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Sparkles } from "lucide-react";

const plans = [
  {
    name: "Gratuit",
    price: "0",
    period: "pour toujours",
    description: "L'essentiel pour gérer votre santé au quotidien.",
    gradient: "from-slate-600 to-slate-700",
    features: [
      "Carnet de santé numérique",
      "Guides de premiers secours",
      "Bouton SOS d'urgence",
      "Mode hors-ligne basique",
      "Géolocalisation (5 recherches/jour)",
    ],
    cta: "Commencer gratuitement",
    popular: false,
  },
  {
    name: "Premium",
    price: "2 500",
    period: "FCFA / mois",
    description: "Pour une gestion complète et des fonctionnalités avancées.",
    gradient: "from-primary-500 to-cyan-500",
    features: [
      "Tout du plan Gratuit",
      "Diagnostic IA illimité",
      "Géolocalisation illimitée",
      "Stockage illimité de documents",
      "Rappels & alertes personnalisées",
      "Historique complet des diagnostics",
      "Support prioritaire",
    ],
    cta: "Essai gratuit 14 jours",
    popular: true,
  },
  {
    name: "Famille",
    price: "5 000",
    period: "FCFA / mois",
    description: "Protégez toute votre famille avec un seul abonnement.",
    gradient: "from-secondary-500 to-cyan-500",
    features: [
      "Tout du plan Premium",
      "Jusqu'à 6 membres",
      "Tableau de bord familial",
      "Partage sécurisé de dossiers",
      "Notifications pour chaque membre",
      "Suivi pédiatrique",
      "Consultation IA famille",
    ],
    cta: "Essai gratuit 14 jours",
    popular: false,
  },
];

function PricingCard({
  plan,
  index,
  isVisible,
}: {
  plan: (typeof plans)[0];
  index: number;
  isVisible: boolean;
}) {
  return (
    <div
      className={`relative transition-all duration-700 ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      } ${plan.popular ? "lg:-mt-4 lg:mb-4" : ""}`}
      style={{ transitionDelay: `${index * 150}ms` }}
    >
      {/* Popular badge */}
      {plan.popular && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
          <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold text-white bg-gradient-to-r from-primary-500 to-cyan-500 shadow-lg shadow-primary-500/25">
            <Sparkles className="w-3.5 h-3.5" />
            Le plus populaire
          </span>
        </div>
      )}

      <div
        className={`relative h-full p-8 rounded-3xl transition-all duration-500 hover:-translate-y-1 ${
          plan.popular
            ? "bg-gradient-to-b from-primary-500/10 to-transparent border-2 border-primary-500/30 shadow-2xl shadow-primary-500/10"
            : "bg-[var(--surface)] border border-[var(--border)] hover:border-primary-500/20 hover:shadow-xl"
        }`}
      >
        {/* Plan name */}
        <h3
          className="text-xl font-bold text-[var(--foreground)] mb-2"
          style={{ fontFamily: "var(--font-outfit, var(--font-inter))" }}
        >
          {plan.name}
        </h3>
        <p className="text-sm text-[var(--muted)] mb-6">{plan.description}</p>

        {/* Price */}
        <div className="mb-8">
          <span
            className="text-5xl font-extrabold text-[var(--foreground)]"
            style={{ fontFamily: "var(--font-outfit, var(--font-inter))" }}
          >
            {plan.price}
          </span>
          <span className="text-sm text-[var(--muted)] ml-2">{plan.period}</span>
        </div>

        {/* Features */}
        <ul className="space-y-3 mb-8">
          {plan.features.map((feature, i) => (
            <li key={i} className="flex items-start gap-3">
              <div
                className={`flex-shrink-0 w-5 h-5 rounded-full bg-gradient-to-br ${plan.gradient} flex items-center justify-center mt-0.5`}
              >
                <Check className="w-3 h-3 text-white" strokeWidth={3} />
              </div>
              <span className="text-sm text-[var(--foreground)]">{feature}</span>
            </li>
          ))}
        </ul>

        {/* CTA */}
        <a
          href="#cta"
          className={`block w-full py-3.5 rounded-2xl text-center text-sm font-semibold transition-all duration-300 ${
            plan.popular
              ? "bg-gradient-to-r from-primary-600 to-cyan-500 text-white hover:shadow-lg hover:shadow-primary-500/25 hover:-translate-y-0.5"
              : "bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--foreground)] hover:bg-primary-500/10 hover:border-primary-500/30"
          }`}
        >
          {plan.cta}
        </a>
      </div>
    </div>
  );
}

export default function PricingSection() {
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
      { threshold: 0.1 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="pricing"
      className="relative section-padding gradient-mesh"
    >
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div
          className={`text-center max-w-3xl mx-auto mb-16 sm:mb-20 transition-all duration-700 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 mb-6">
            Tarifs
          </span>
          <h2
            className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-6"
            style={{ fontFamily: "var(--font-outfit, var(--font-inter))" }}
          >
            <span className="text-[var(--foreground)]">Un plan pour </span>
            <span className="gradient-text">chaque besoin</span>
          </h2>
          <p className="text-lg text-[var(--muted)] leading-relaxed">
            Commencez gratuitement et évoluez selon vos besoins.
            Aucun engagement, annulable à tout moment.
          </p>
        </div>

        {/* Plans */}
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8 items-start">
          {plans.map((plan, index) => (
            <PricingCard
              key={index}
              plan={plan}
              index={index}
              isVisible={isVisible}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
