"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Sparkles, User, Store, Building2 } from "lucide-react";

const allPlans = {
  patients: [
    {
      name: "Gratuit",
      price: "0",
      period: "pour toujours",
      description: "L'essentiel pour gérer votre santé au quotidien.",
      gradient: "from-slate-600 to-slate-700",
      features: [
        "Bouton SOS Urgence (Gratuit)",
        "Localisation structures & pharmacies",
        "Pharmacies & hôpitaux de garde",
        "Assistant IA (3 consultations/mois)",
        "Stock pharmacies (3 plus proches)",
        "Dossier médical (Lecture seule)",
      ],
      cta: "Commencer gratuitement",
      popular: false,
    },
    {
      name: "Premium",
      price: "50 000",
      period: "GNF / mois",
      description: "Pour une gestion complète et des fonctionnalités avancées.",
      gradient: "from-primary-500 to-cyan-500",
      features: [
        "Tout du plan Gratuit",
        "Assistant IA illimité",
        "Stock de toutes les pharmacies",
        "Réservation / Précommande",
        "Dossier médical complet + partage",
        "Comparaison de prix en temps réel",
        "Historique complet des diagnostics",
      ],
      cta: "Passer au Premium",
      popular: true,
    },
  ],
  pharmacies: [
    {
      name: "Free",
      price: "0",
      period: "pour toujours",
      description: "Visibilité de base pour votre officine.",
      gradient: "from-slate-600 to-slate-700",
      features: [
        "Profil basique sur la plateforme",
        "Visible dans la localisation",
        "Réception des demandes clients",
        "Affichage du stock (10 produits max)",
        "Mise à jour stock (1 fois/jour)",
      ],
      cta: "Inscrire ma pharmacie",
      popular: false,
    },
    {
      name: "Premium",
      price: "100 000",
      period: "GNF / mois",
      description: "Maximisez vos ventes et votre visibilité locale.",
      gradient: "from-emerald-500 to-teal-500",
      features: [
        "Tout du plan Free + Badge vérifié",
        "Mise en avant sur la carte",
        "Affichage stock illimité",
        "Mise à jour en temps réel",
        "Réservation / Précommande activée",
        "Alertes rupture de stock",
        "Statistiques et rapports de vente",
      ],
      cta: "Devenir Premium",
      popular: true,
    },
  ],
  hopitaux: [
    {
      name: "Free",
      price: "0",
      period: "pour toujours",
      description: "Découvrez la puissance de MedConnect.",
      gradient: "from-slate-600 to-slate-700",
      features: [
        "Jusqu'à 2 comptes médecins",
        "Toutes les fonctionnalités incluses",
        "Dossiers médicaux numériques",
        "Gestion des gardes en temps réel",
        "Réception des SOS localisés",
        "Tableau de bord & statistiques",
      ],
      cta: "Essayer gratuitement",
      popular: false,
    },
    {
      name: "Pro",
      price: "100 000",
      period: "GNF / mois",
      description: "Idéal pour les cliniques et cabinets privés.",
      gradient: "from-blue-500 to-indigo-500",
      features: [
        "Jusqu'à 10 comptes médecins",
        "Toutes les fonctionnalités incluses",
        "Dossiers médicaux numériques",
        "Gestion des gardes en temps réel",
        "Réception des SOS localisés",
        "Coordination inter-services",
      ],
      cta: "Choisir Pro",
      popular: true,
    },
    {
      name: "Platinium",
      price: "800 000",
      period: "GNF / mois",
      description: "Pour les structures hospitalières moyennes.",
      gradient: "from-purple-500 to-pink-500",
      features: [
        "Jusqu'à 100 comptes médecins",
        "Toutes les fonctionnalités incluses",
        "Support prioritaire 24/7",
        "Formation du personnel incluse",
        "Gestion multi-services avancée",
        "Export de données illimité",
      ],
      cta: "Choisir Platinium",
      popular: false,
    },
    {
      name: "Diamant",
      price: "1 500 000",
      period: "GNF / mois",
      description: "Pour les grands centres hospitaliers (CHU).",
      gradient: "from-amber-500 to-orange-500",
      features: [
        "Médecins illimités",
        "Toutes les fonctionnalités incluses",
        "Intégration SIH sur mesure",
        "Chargé de compte dédié",
        "Serveur haute disponibilité",
        "Statistiques avancées régionales",
      ],
      cta: "Contactez-nous",
      popular: false,
    },
  ],
};

type Plan = typeof allPlans.patients[0];

function PricingCard({
  plan,
  index,
  isVisible,
}: {
  plan: Plan;
  index: number;
  isVisible: boolean;
}) {
  return (
    <div
      className={`relative h-full transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        } ${plan.popular ? "lg:scale-105 z-10" : "z-0"}`}
      style={{ transitionDelay: `${index * 100}ms` }}
    >
      {/* Popular badge */}
      {plan.popular && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-20">
          <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold text-white bg-gradient-to-r from-primary-500 to-cyan-500 shadow-lg shadow-primary-500/25">
            <Sparkles className="w-3.5 h-3.5" />
            Le plus recommandé
          </span>
        </div>
      )}

      <div
        className={`relative h-full flex flex-col p-8 rounded-3xl transition-all duration-500 hover:-translate-y-1 ${plan.popular
            ? "bg-gradient-to-b from-primary-500/10 to-transparent border-2 border-primary-500/30 shadow-2xl shadow-primary-500/10"
            : "bg-[var(--surface)] border border-[var(--border)] hover:border-primary-500/20 hover:shadow-xl"
          }`}
      >
        {/* Plan name */}
        <div className="mb-6">
          <h3
            className="text-xl font-bold text-[var(--foreground)] mb-2"
            style={{ fontFamily: "var(--font-outfit, var(--font-inter))" }}
          >
            {plan.name}
          </h3>
          <p className="text-sm text-[var(--muted)] line-clamp-2">{plan.description}</p>
        </div>

        {/* Price */}
        <div className="mb-8">
          <div className="flex items-baseline gap-1">
            <span
              className="text-4xl font-extrabold text-[var(--foreground)]"
              style={{ fontFamily: "var(--font-outfit, var(--font-inter))" }}
            >
              {plan.price}
            </span>
            <span className="text-sm font-medium text-[var(--muted)]">GNF</span>
          </div>
          <p className="text-xs text-[var(--muted)] mt-1">{plan.period}</p>
        </div>

        {/* Features */}
        <ul className="space-y-3 mb-8 flex-grow">
          {plan.features.map((feature, i) => (
            <li key={i} className="flex items-start gap-3">
              <div
                className={`flex-shrink-0 w-5 h-5 rounded-full bg-gradient-to-br ${plan.gradient} flex items-center justify-center mt-0.5 shadow-sm`}
              >
                <Check className="w-3 h-3 text-white" strokeWidth={3} />
              </div>
              <span className="text-sm text-[var(--foreground)] leading-tight">{feature}</span>
            </li>
          ))}
        </ul>

        {/* CTA */}
        <a
          href="#cta"
          className={`block w-full py-4 rounded-2xl text-center text-sm font-bold transition-all duration-300 ${plan.popular
              ? "bg-gradient-to-r from-primary-600 to-cyan-500 text-white hover:shadow-lg hover:shadow-primary-500/25 hover:-translate-y-0.5 active:scale-95"
              : "bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--foreground)] hover:bg-primary-500/10 hover:border-primary-500/30 active:scale-95"
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
  const [activeTab, setActiveTab] = useState<keyof typeof allPlans>("patients");

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

  const tabs = [
    { id: "patients", label: "Patients", icon: User },
    { id: "pharmacies", label: "Pharmacies", icon: Store },
    { id: "hopitaux", label: "Hôpitaux", icon: Building2 },
  ] as const;

  return (
    <section
      ref={sectionRef}
      id="pricing"
      className="relative section-padding overflow-hidden"
    >
      {/* Background Decorations */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary-500/5 rounded-full blur-[100px] -z-10" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-[100px] -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div
          className={`text-center max-w-3xl mx-auto mb-12 transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
        >
          <span className="inline-block px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 mb-6">
            Tarifs Transparent
          </span>
          <h2
            className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-6"
            style={{ fontFamily: "var(--font-outfit, var(--font-inter))" }}
          >
            <span className="text-[var(--foreground)]">Un plan pour </span>
            <span className="gradient-text">chaque acteur</span>
          </h2>
          <p className="text-lg text-[var(--muted)]">
            Accédez aux meilleurs outils de santé en Guinée. Commencez gratuitement,
            évoluez sans limites.
          </p>
        </div>

        {/* Tab Switcher */}
        <div
          className={`flex justify-center mb-16 transition-all duration-700 delay-200 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
        >
          <div className="inline-flex p-1.5 bg-[var(--surface-elevated)] rounded-2xl border border-[var(--border)] shadow-xl">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${activeTab === tab.id
                    ? "bg-gradient-to-r from-primary-600 to-cyan-500 text-white shadow-lg shadow-primary-500/20"
                    : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-white/5"
                  }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Plans Grid */}
        <div
          className={`grid gap-8 items-stretch ${activeTab === "hopitaux"
              ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
              : "grid-cols-1 sm:grid-cols-2 max-w-4xl mx-auto"
            }`}
        >
          {allPlans[activeTab].map((plan, index) => (
            <PricingCard
              key={`${activeTab}-${index}`}
              plan={plan}
              index={index}
              isVisible={isVisible}
            />
          ))}
        </div>

        {/* Footer info */}
        <p className={`text-center mt-12 text-sm text-[var(--muted)] transition-all duration-700 delay-500 ${isVisible ? "opacity-100" : "opacity-0"
          }`}>
          * Tous les prix sont hors taxes. Le bouton SOS reste gratuit pour tous les patients.
        </p>
      </div>
    </section>
  );
}
