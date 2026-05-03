"use client";

import { useState, useEffect } from "react";
import { Download, Check } from "lucide-react";

export function PWAInstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showButton, setShowButton] = useState(false);

  useEffect(() => {
    // Check if app is already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }

    const handler = (e: any) => {
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
      className="flex items-center gap-2 w-full px-3 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-primary-600 to-cyan-500 hover:from-primary-500 hover:to-cyan-400 rounded-xl shadow-lg shadow-primary-500/20 transition-all active:scale-95"
    >
      <Download size={14} />
      Installer l&apos;application
    </button>
  );
}
