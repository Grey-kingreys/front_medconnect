"use client";

import { useEffect, useRef, useState } from "react";
import {
  Heart,
  MapPin,
  Siren,
  Sparkles,
  Pill,
  Shield,
  ArrowRight,
} from "lucide-react";

const features = [
  {
    icon: Heart,
    title: "Carnet de Santé Numérique",
    description:
      "Centralisez votre dossier médical : ordonnances, résultats d'analyses, vaccinations et antécédents. Accessible hors-ligne après synchronisation.",
    gradient: "from-primary-500 to-primary-600",
    glowColor: "primary-500",
    badge: "Hors-ligne",
  },
  {
    icon: MapPin,
    title: "Géolocalisation Médicale",
    description:
      "Trouvez hôpitaux, cliniques et pharmacies à proximité sur une carte interactive. Filtrage par distance, type et horaires d'ouverture.",
    gradient: "from-secondary-500 to-secondary-600",
    glowColor: "secondary-500",
    badge: "Temps réel",
  },
  {
    icon: Siren,
    title: "Urgences & Assistance",
    description:
      "Bouton SOS accessible à tout moment, guides de premiers secours pré-téléchargés et chat IA pour orientation en cas d'urgence.",
    gradient: "from-emergency-500 to-emergency-600",
    glowColor: "emergency-500",
    badge: "24/7",
  },
  {
    icon: Sparkles,
    title: "Diagnostic par IA",
    description:
      "Décrivez vos symptômes par texte ou vocal. Notre IA analyse et suggère des pathologies possibles avec des recommandations personnalisées.",
    gradient: "from-accent-500 to-accent-600",
    glowColor: "accent-500",
    badge: "IA avancée",
  },
  {
    icon: Pill,
    title: "Pharmacie en Ligne",
    description:
      "Recherchez des médicaments, vérifiez leur disponibilité dans les pharmacies partenaires et réservez vos préparations en un clic.",
    gradient: "from-cyan-500 to-primary-500",
    glowColor: "cyan-500",
    badge: "Partenaires",
  },
  {
    icon: Shield,
    title: "Sécurité Maximale",
    description:
      "Chiffrement SSL/TLS, authentification JWT, données médicales chiffrées au repos. Conformité RGPD avec droit à l'effacement.",
    gradient: "from-slate-600 to-slate-700",
    glowColor: "primary-500",
    badge: "RGPD",
  },
];

function FeatureCard({
  feature,
  index,
}: {
  feature: (typeof features)[0];
  index: number;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
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
    if (cardRef.current) observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={cardRef}
      className={`group relative transition-all duration-700 ${
        isVisible
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-8"
      }`}
      style={{ transitionDelay: `${index * 100}ms` }}
    >
      <div className="relative h-full p-6 sm:p-8 rounded-3xl bg-[var(--surface)] border border-[var(--border)] hover:border-primary-500/30 transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:shadow-primary-500/5 overflow-hidden">
        {/* Hover glow */}
        <div
          className={`absolute -top-20 -right-20 w-40 h-40 bg-${feature.glowColor}/5 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500`}
        />

        {/* Icon */}
        <div className="relative mb-6">
          <div
            className={`inline-flex w-14 h-14 items-center justify-center rounded-2xl bg-gradient-to-br ${feature.gradient} shadow-lg`}
          >
            <feature.icon className="w-7 h-7 text-white" />
          </div>
          {/* Badge */}
          <span className="absolute -top-1 left-16 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary-400 bg-primary-500/10 border border-primary-500/20 rounded-full">
            {feature.badge}
          </span>
        </div>

        {/* Content */}
        <h3
          className="text-xl font-bold text-[var(--foreground)] mb-3 group-hover:gradient-text transition-all duration-300"
          style={{ fontFamily: "var(--font-outfit, var(--font-inter))" }}
        >
          {feature.title}
        </h3>
        <p className="text-[var(--muted)] leading-relaxed text-sm">
          {feature.description}
        </p>

        {/* Learn more link */}
        <div className="mt-6 flex items-center gap-1.5 text-sm font-medium text-primary-500 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300">
          <span>En savoir plus</span>
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </div>
      </div>
    </div>
  );
}

export default function FeaturesSection() {
  const headingRef = useRef<HTMLDivElement>(null);
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
    if (headingRef.current) observer.observe(headingRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="features"
      className="relative section-padding gradient-mesh"
    >
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div
          ref={headingRef}
          className={`text-center max-w-3xl mx-auto mb-16 sm:mb-20 transition-all duration-700 ${
            isVisible
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-8"
          }`}
        >
          <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest text-primary-400 bg-primary-500/10 border border-primary-500/20 mb-6">
            Fonctionnalités
          </span>
          <h2
            className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-6"
            style={{ fontFamily: "var(--font-outfit, var(--font-inter))" }}
          >
            <span className="text-[var(--foreground)]">Tout pour votre </span>
            <span className="gradient-text-accent">santé</span>
            <span className="text-[var(--foreground)]">, en un seul endroit</span>
          </h2>
          <p className="text-lg text-[var(--muted)] leading-relaxed">
            MedConnect réunit les outils essentiels pour gérer votre santé au
            quotidien, des situations d&apos;urgence aux consultations de routine.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {features.map((feature, index) => (
            <FeatureCard key={index} feature={feature} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
