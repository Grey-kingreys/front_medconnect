"use client";

import { useEffect, useState } from "react";
import { pontDesktop, type EtatPosteDesktop, type PontDesktop } from "./contrat_desktop";

export interface PosteDesktopSuivi {
  /** Null sur le web. Lu dès le premier rendu : les pages du tableau de bord ne se montent qu'après le premier rendu côté navigateur. */
  pont: PontDesktop | null;
  /** Null tant que le poste n'a pas répondu, et sur le web. */
  etat: EtatPosteDesktop | null;
}

/** État du poste desktop, tenu à jour par le pont. Sur le web : `{ pont: null, etat: null }` et rien ne change. */
export function useEtatPoste(): PosteDesktopSuivi {
  const [suivi, setSuivi] = useState<PosteDesktopSuivi>(() => ({ pont: pontDesktop(), etat: null }));

  useEffect(() => {
    const pont = pontDesktop();
    if (pont === null) return;
    let actif = true;
    pont
      .etat()
      .then((etat) => {
        if (actif) setSuivi({ pont, etat });
      })
      .catch(() => undefined);
    const arreter = pont.surEtat((etat) => {
      if (actif) setSuivi({ pont, etat });
    });
    return () => {
      actif = false;
      arreter();
    };
  }, []);

  return suivi;
}

/**
 * Hors ligne sur un poste desktop : le plafond de stock ne s'applique plus (D737). Faux sur le web, et faux tant que
 * le poste n'a pas échoué à joindre le serveur : le démarrage, la connexion à refaire et le poste non enregistré
 * ne sont pas une coupure.
 */
export function horsLigneSurPoste(suivi: PosteDesktopSuivi): boolean {
  return suivi.pont !== null && suivi.etat !== null && suivi.etat.horsLigne;
}

/** Vrai sur le poste desktop tant que son état n'est pas connu : les écrans attendent plutôt que de deviner. */
export function etatPosteAttendu(suivi: PosteDesktopSuivi): boolean {
  return suivi.pont !== null && suivi.etat === null;
}
