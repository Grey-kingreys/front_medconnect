"use client";

import { useEffect, useState } from "react";

interface ImageWithFallbackProps {
  /** URL de l'image (ex. avatar/logo servi par R2). Null/undefined → fallback direct. */
  src: string | null | undefined;
  alt: string;
  className?: string;
  /** Rendu de repli : si `src` est absent OU si l'image échoue à charger (hors-ligne,
   *  connexion instable — contexte Guinée). Évite l'icône « image cassée ». */
  fallback: React.ReactNode;
}

/**
 * Affiche une image distante avec repli gracieux. Sur `onError` (réseau coupé, R2
 * injoignable…), bascule sur `fallback` (initiales, icône) plutôt qu'une image cassée.
 * Réessaie automatiquement quand `src` change (nouvel upload).
 */
export default function ImageWithFallback({
  src,
  alt,
  className,
  fallback,
}: ImageWithFallbackProps) {
  const [failed, setFailed] = useState(false);

  // Réinitialise l'état d'erreur si la source change (ex. l'utilisateur change sa photo).
  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) return <>{fallback}</>;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} onError={() => setFailed(true)} />
  );
}
