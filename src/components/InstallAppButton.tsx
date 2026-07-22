"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Download, Share, Plus, X, Check } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * CTA d'installation de la PWA.
 *
 * Deux parcours, car iOS/Safari n'implémente pas `beforeinstallprompt` et
 * n'autorise aucune invite programmatique : on y explique le geste manuel
 * (Partager → Sur l'écran d'accueil) dans une modale.
 *
 * ⚠️ `beforeinstallprompt` n'est émis par Chrome/Edge que si un service worker
 * avec gestionnaire `fetch` est actif — cf. `public/sw.js`.
 */
export default function InstallAppButton() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [estInstallee, setEstInstallee] = useState(false);
  const [estIOS, setEstIOS] = useState(false);
  const [modaleIOS, setModaleIOS] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setEstInstallee(true);
      return;
    }

    // iPad récent : le user agent annonce « Macintosh », d'où le test tactile.
    const ua = window.navigator.userAgent;
    setEstIOS(
      /iPad|iPhone|iPod/.test(ua) ||
        (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1),
    );

    const surPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };
    const surInstallation = () => {
      setEstInstallee(true);
      setPromptEvent(null);
    };

    window.addEventListener("beforeinstallprompt", surPrompt);
    window.addEventListener("appinstalled", surInstallation);
    return () => {
      window.removeEventListener("beforeinstallprompt", surPrompt);
      window.removeEventListener("appinstalled", surInstallation);
    };
  }, []);

  async function installer() {
    if (estIOS || !promptEvent) {
      setModaleIOS(true);
      return;
    }
    await promptEvent.prompt();
    await promptEvent.userChoice;
    setPromptEvent(null);
  }

  if (estInstallee) {
    return (
      <div className="inline-flex items-center justify-center gap-3 px-10 py-5 text-lg font-semibold text-white bg-white/10 border border-white/20 rounded-2xl">
        <Check className="w-5 h-5" aria-hidden="true" />
        <span>Application déjà installée</span>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={installer}
        id="cta-download"
        className="group relative inline-flex items-center justify-center gap-3 px-10 py-5 text-lg font-semibold text-white rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-2xl hover:shadow-primary-500/30 hover:-translate-y-1"
      >
        <span className="absolute inset-0 bg-gradient-to-r from-primary-600 via-primary-500 to-cyan-500 animate-gradient" />
        <span className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-primary-500 to-secondary-500 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <Download className="relative w-5 h-5" aria-hidden="true" />
        <span className="relative">Installer MedConnecte</span>
        <ArrowRight className="relative w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" aria-hidden="true" />
      </button>

      {modaleIOS && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="titre-install-ios"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
          onClick={() => setModaleIOS(false)}
        >
          <div
            className="relative w-full max-w-md p-6 rounded-3xl bg-[var(--surface)] border border-[var(--border)] shadow-2xl text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setModaleIOS(false)}
              aria-label="Fermer"
              className="absolute top-4 right-4 p-1 rounded-lg text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-white/5 transition-colors"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>

            <h2
              id="titre-install-ios"
              className="text-xl font-bold text-[var(--foreground)] mb-2 pr-8"
              style={{ fontFamily: "var(--font-outfit, var(--font-inter))" }}
            >
              Installer MedConnecte
            </h2>
            <p className="text-sm text-[var(--muted)] mb-6">
              {estIOS
                ? "Sur iPhone et iPad, l'installation se fait depuis le menu de partage de Safari :"
                : "Votre navigateur ne propose pas l'installation automatique. Depuis son menu, choisissez « Installer l'application » ou « Ajouter à l'écran d'accueil »."}
            </p>

            {estIOS && (
              <ol className="space-y-4 mb-2">
                <li className="flex items-start gap-3">
                  <Share className="w-5 h-5 mt-0.5 flex-shrink-0 text-primary-500" aria-hidden="true" />
                  <span className="text-sm text-[var(--foreground)]">
                    Appuyez sur <strong>Partager</strong> dans la barre de Safari.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <Plus className="w-5 h-5 mt-0.5 flex-shrink-0 text-primary-500" aria-hidden="true" />
                  <span className="text-sm text-[var(--foreground)]">
                    Choisissez <strong>Sur l&apos;écran d&apos;accueil</strong>.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 mt-0.5 flex-shrink-0 text-primary-500" aria-hidden="true" />
                  <span className="text-sm text-[var(--foreground)]">
                    Confirmez avec <strong>Ajouter</strong>.
                  </span>
                </li>
              </ol>
            )}
          </div>
        </div>
      )}
    </>
  );
}
