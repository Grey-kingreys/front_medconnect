"use client";

import { useEffect, useId, useRef } from "react";

interface UseDialogA11yOptions {
  isOpen: boolean;
  onClose: () => void;
  // Mettre à false pendant une action en cours (ex. suppression) pour bloquer Échap.
  closeOnEscape?: boolean;
}

const SELECTEUR_FOCALISABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

/**
 * Accessibilité d'une modale : rôle, focus initial, piège du focus (Tab / Maj+Tab),
 * fermeture par Échap et restitution du focus à la fermeture.
 * Appeler le hook avant tout `return null` conditionnel.
 */
export function useDialogA11y({
  isOpen,
  onClose,
  closeOnEscape = true,
}: UseDialogA11yOptions) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // Les dernières valeurs sont lues via des refs pour ne pas relancer l'effet
  // (et donc ne pas déplacer le focus) à chaque rendu du parent.
  const onCloseRef = useRef(onClose);
  const closeOnEscapeRef = useRef(closeOnEscape);
  useEffect(() => {
    onCloseRef.current = onClose;
    closeOnEscapeRef.current = closeOnEscape;
  });

  useEffect(() => {
    if (!isOpen) return;

    const elementPrecedent = document.activeElement as HTMLElement | null;
    const dialogue = ref.current;

    const listeFocalisables = () =>
      dialogue
        ? Array.from(
            dialogue.querySelectorAll<HTMLElement>(SELECTEUR_FOCALISABLE),
          )
        : [];

    // Focus initial : premier élément focalisable, sinon le dialogue lui-même.
    (listeFocalisables()[0] ?? dialogue)?.focus();

    const surToucheEnfoncee = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (closeOnEscapeRef.current) {
          e.stopPropagation();
          onCloseRef.current();
        }
        return;
      }
      if (e.key !== "Tab" || !dialogue) return;

      const elements = listeFocalisables();
      if (elements.length === 0) {
        e.preventDefault();
        dialogue.focus();
        return;
      }
      const premier = elements[0];
      const dernier = elements[elements.length - 1];
      const actif = document.activeElement;

      if (e.shiftKey && (actif === premier || actif === dialogue)) {
        e.preventDefault();
        dernier.focus();
      } else if (!e.shiftKey && actif === dernier) {
        e.preventDefault();
        premier.focus();
      } else if (actif && !dialogue.contains(actif)) {
        e.preventDefault();
        premier.focus();
      }
    };

    document.addEventListener("keydown", surToucheEnfoncee);
    return () => {
      document.removeEventListener("keydown", surToucheEnfoncee);
      // Rendre le focus à l'élément qui l'avait avant l'ouverture.
      if (elementPrecedent && document.contains(elementPrecedent)) {
        elementPrecedent.focus();
      }
    };
  }, [isOpen]);

  return {
    dialogProps: {
      ref,
      role: "dialog" as const,
      "aria-modal": true as const,
      "aria-labelledby": titleId,
      tabIndex: -1,
    },
    titleId,
  };
}
