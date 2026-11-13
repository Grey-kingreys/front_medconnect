"use client";

import { useState, useEffect, useSyncExternalStore } from "react";
import { Download, Check } from "lucide-react";
import { ui } from "@/theme/ui";

// Événement « beforeinstallprompt » (non typé par TypeScript)
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const REQUETE_AUTONOME = "(display-mode: standalone)";

function abonnerAffichage(rappel: () => void) {
  const requete = window.matchMedia(REQUETE_AUTONOME);
  requete.addEventListener("change", rappel);
  return () => requete.removeEventListener("change", rappel);
}

export function PWAInstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  // Application ouverte en mode installé (faux côté serveur)
  const modeAutonome = useSyncExternalStore(
    abonnerAffichage,
    () => window.matchMedia(REQUETE_AUTONOME).matches,
    () => false,
  );
  const [installee, setIsInstalled] = useState(false);
  const isInstalled = modeAutonome || installee;
  const [showButton, setShowButton] = useState(false);

  useEffect(() => {
    if (window.matchMedia(REQUETE_AUTONOME).matches) return;

    const handler = (evenement: Event) => {
      const e = evenement as BeforeInstallPromptEvent;
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      setShowButton(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    window.addEventListener("appinstalled", () => {
      setIsInstalled(true);
      setShowButton(false);
      setDeferredPrompt(null);
    });

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === "accepted") {
      console.log("User accepted the install prompt");
    } else {
      console.log("User dismissed the install prompt");
    }

    // We've used the prompt, and can't use it again, throw it away
    setDeferredPrompt(null);
    setShowButton(false);
  };

  if (isInstalled) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-secondary-500 bg-secondary-500/10 rounded-xl border border-secondary-500/20">
        <Check size={14} />
        Application installée
      </div>
    );
  }

  if (!showButton) return null;

  return (
    <button
      onClick={handleInstallClick}
      className={ui.menu.lien}
    >
      <Download size={16} aria-hidden="true" />
      Installer l&apos;application
    </button>
  );
}
