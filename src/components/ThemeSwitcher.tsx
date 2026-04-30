"use client";

import { useState, useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor, ChevronDown } from "lucide-react";

export function ThemeSwitcher({ up = false }: { up?: boolean }) {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Éviter les erreurs d'hydratation
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!mounted) return <div className="w-9 h-9" />; // Placeholder

  const themes = [
    { name: "Clair", value: "light", icon: Sun },
    { name: "Sombre", value: "dark", icon: Moon },
    { name: "Système", value: "system", icon: Monitor },
  ];

  const CurrentIcon =
    theme === "system"
      ? Monitor
      : theme === "light" || resolvedTheme === "light"
      ? Sun
      : Moon;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center w-9 h-9 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        aria-label="Changer le thème"
      >
        <CurrentIcon className="w-4 h-4" />
      </button>

      {isOpen && (
        <div 
          className={`absolute right-0 w-36 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800/50 rounded-xl shadow-lg overflow-hidden z-50 animate-slide-up ${
            up ? "bottom-full mb-2" : "top-full mt-2"
          }`}
        >
          <div className="py-1">
            {themes.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.value}
                  onClick={() => {
                    setTheme(t.value);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors ${
                    theme === t.value
                      ? "text-primary-500 bg-primary-50 dark:bg-primary-500/10"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {t.name}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
