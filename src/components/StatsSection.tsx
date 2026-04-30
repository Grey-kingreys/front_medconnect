"use client";

import { useEffect, useRef, useState } from "react";
import { Users, Building2, MapPin, HeartPulse } from "lucide-react";

const stats = [
  {
    icon: Users,
    value: 50000,
    suffix: "+",
    label: "Utilisateurs actifs",
    gradient: "from-primary-500 to-cyan-500",
  },
  {
    icon: Building2,
    value: 1200,
    suffix: "+",
    label: "Établissements référencés",
    gradient: "from-secondary-500 to-cyan-500",
  },
  {
    icon: MapPin,
    value: 45,
    suffix: "",
    label: "Villes couvertes",
    gradient: "from-accent-500 to-primary-500",
  },
  {
    icon: HeartPulse,
    value: 98,
    suffix: "%",
    label: "Satisfaction utilisateur",
    gradient: "from-emergency-500 to-accent-500",
  },
];

function AnimatedCounter({
  target,
  suffix,
  isVisible,
}: {
  target: number;
  suffix: string;
  isVisible: boolean;
}) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isVisible) return;

    const duration = 2000;
    const steps = 60;
    const increment = target / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [isVisible, target]);

  const formatNumber = (num: number) => {
    if (num >= 1000) {
      return num.toLocaleString("fr-FR");
    }
    return num.toString();
  };

  return (
    <span className="tabular-nums">
      {formatNumber(count)}
      {suffix}
    </span>
  );
}

export default function StatsSection() {
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
      { threshold: 0.3 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="stats"
      className="relative py-20 sm:py-28 overflow-hidden"
    >
      {/* Background */}
      <div className="absolute inset-0 gradient-hero" />
      <div className="absolute inset-0 gradient-mesh" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {stats.map((stat, index) => (
            <div
              key={index}
              className={`text-center transition-all duration-700 ${
                isVisible
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-8"
              }`}
              style={{ transitionDelay: `${index * 150}ms` }}
            >
              {/* Icon */}
              <div className="inline-flex mb-4">
                <div
                  className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center shadow-lg opacity-80`}
                >
                  <stat.icon className="w-7 h-7 text-white" />
                </div>
              </div>

              {/* Number */}
              <div
                className="text-4xl sm:text-5xl font-extrabold text-white mb-2"
                style={{ fontFamily: "var(--font-outfit, var(--font-inter))" }}
              >
                <AnimatedCounter
                  target={stat.value}
                  suffix={stat.suffix}
                  isVisible={isVisible}
                />
              </div>

              {/* Label */}
              <p className="text-sm sm:text-base text-slate-400 font-medium">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
