"use client";

import { useEffect, useRef, useState } from "react";
import { Star, Quote } from "lucide-react";

const testimonials = [
  {
    name: "Aminata Diallo",
    role: "Mère de famille",
    location: "Dakar, Sénégal",
    avatar: "AD",
    rating: 5,
    text: "MedConnect m'a sauvé la vie quand mon fils a fait une crise nocturne. Le bouton SOS et les guides de premiers secours m'ont permis de réagir vite en attendant l'ambulance.",
    gradient: "from-primary-500 to-cyan-500",
  },
  {
    name: "Dr. Ibrahima Koné",
    role: "Médecin généraliste",
    location: "Abidjan, Côte d'Ivoire",
    avatar: "IK",
    rating: 5,
    text: "Le carnet de santé numérique de mes patients me facilite énormément le travail. Je peux consulter l'historique complet en quelques secondes. Un outil révolutionnaire.",
    gradient: "from-secondary-500 to-cyan-500",
  },
  {
    name: "Fatou Sow",
    role: "Étudiante en pharmacie",
    location: "Bamako, Mali",
    avatar: "FS",
    rating: 5,
    text: "La fonctionnalité de recherche en pharmacie est incroyable. Mes clients trouvent facilement leurs médicaments et vérifient la disponibilité avant de se déplacer.",
    gradient: "from-accent-500 to-primary-500",
  },
  {
    name: "Moussa Traoré",
    role: "Entrepreneur",
    location: "Conakry, Guinée",
    avatar: "MT",
    rating: 4,
    text: "Le diagnostic IA m'a orienté vers le bon spécialiste quand j'avais des douleurs persistantes. C'est rassurant d'avoir un premier avis même tard le soir.",
    gradient: "from-cyan-500 to-secondary-500",
  },
  {
    name: "Awa Camara",
    role: "Infirmière",
    location: "Lomé, Togo",
    avatar: "AC",
    rating: 5,
    text: "L'accès hors-ligne au carnet de santé est un game-changer dans les zones rurales. Nos patients gardent leurs données même sans connexion internet.",
    gradient: "from-primary-500 to-accent-500",
  },
  {
    name: "Ousmane Bah",
    role: "Père de famille",
    location: "Ouagadougou, Burkina Faso",
    avatar: "OB",
    rating: 5,
    text: "Grâce à la géolocalisation, j'ai trouvé une pharmacie de garde à 2h du matin pour mon enfant fiévreux. Simple, rapide et efficace.",
    gradient: "from-emergency-500 to-accent-500",
  },
];

function TestimonialCard({
  testimonial,
  index,
  isVisible,
}: {
  testimonial: (typeof testimonials)[0];
  index: number;
  isVisible: boolean;
}) {
  return (
    <div
      className={`group relative transition-all duration-700 ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      }`}
      style={{ transitionDelay: `${index * 100}ms` }}
    >
      <div className="relative h-full p-6 sm:p-8 rounded-3xl bg-[var(--surface)] border border-[var(--border)] hover:border-primary-500/20 transition-all duration-500 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary-500/5">
        {/* Quote icon */}
        <Quote className="w-8 h-8 text-primary-500/20 mb-4" />

        {/* Stars */}
        <div className="flex gap-1 mb-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={`w-4 h-4 ${
                i < testimonial.rating
                  ? "text-amber-400 fill-amber-400"
                  : "text-slate-600"
              }`}
            />
          ))}
        </div>

        {/* Text */}
        <p className="text-[var(--foreground)] leading-relaxed mb-6 text-sm sm:text-base">
          &ldquo;{testimonial.text}&rdquo;
        </p>

        {/* Author */}
        <div className="flex items-center gap-3 pt-4 border-t border-[var(--border)]">
          <div
            className={`w-11 h-11 rounded-full bg-gradient-to-br ${testimonial.gradient} flex items-center justify-center shadow-md`}
          >
            <span className="text-sm font-bold text-white">
              {testimonial.avatar}
            </span>
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--foreground)]">
              {testimonial.name}
            </p>
            <p className="text-xs text-[var(--muted)]">
              {testimonial.role} • {testimonial.location}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TestimonialsSection() {
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
      id="testimonials"
      className="relative section-padding"
    >
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div
          className={`text-center max-w-3xl mx-auto mb-16 sm:mb-20 transition-all duration-700 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest text-accent-400 bg-accent-500/10 border border-accent-500/20 mb-6">
            Témoignages
          </span>
          <h2
            className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-6"
            style={{ fontFamily: "var(--font-outfit, var(--font-inter))" }}
          >
            <span className="text-[var(--foreground)]">Ils nous font </span>
            <span className="gradient-text">confiance</span>
          </h2>
          <p className="text-lg text-[var(--muted)] leading-relaxed">
            Des milliers d&apos;utilisateurs à travers l&apos;Afrique de l&apos;Ouest comptent
            sur MedConnect pour leur santé au quotidien.
          </p>
        </div>

        {/* Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {testimonials.map((testimonial, index) => (
            <TestimonialCard
              key={index}
              testimonial={testimonial}
              index={index}
              isVisible={isVisible}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
