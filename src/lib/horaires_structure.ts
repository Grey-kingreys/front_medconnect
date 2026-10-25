/** Horaires d'ouverture d'une structure : lecture et écriture du texte enregistré par jour. */

export const JOURS_SEMAINE = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"] as const;
export type JourSemaine = (typeof JOURS_SEMAINE)[number];
export type Horaires = Record<JourSemaine, string>;

export const HORAIRES_PAR_DEFAUT: Horaires = {
  Lundi: "08:00-18:00",
  Mardi: "08:00-18:00",
  Mercredi: "08:00-18:00",
  Jeudi: "08:00-18:00",
  Vendredi: "08:00-18:00",
  Samedi: "08:00-12:00",
  Dimanche: "Fermé",
};

export const VALEUR_FERME = "Fermé";

export interface PlageHoraire {
  ferme: boolean;
  ouverture: string;
  fermeture: string;
}

/** Lecture du texte des horaires ; les jours absents prennent la valeur par défaut. */
export function lireHoraires(json: string | null | undefined): Horaires {
  try {
    const lu: unknown = JSON.parse(json || "{}");
    if (lu === null || typeof lu !== "object" || Array.isArray(lu)) return { ...HORAIRES_PAR_DEFAUT };
    const objet = lu as Record<string, unknown>;
    const resultat = { ...HORAIRES_PAR_DEFAUT };
    for (const jour of JOURS_SEMAINE) {
      const valeur = objet[jour];
      resultat[jour] = valeur ? String(valeur) : HORAIRES_PAR_DEFAUT[jour];
    }
    return resultat;
  } catch {
    return { ...HORAIRES_PAR_DEFAUT };
  }
}

const FORMAT_PLAGE = /^(\d{2}:\d{2})-(\d{2}:\d{2})$/;

/** "08:00-21:00" devient une plage ouverte ; "Fermé" une plage fermée ; tout autre texte une plage à compléter. */
export function lirePlage(valeur: string): PlageHoraire {
  const texte = valeur.trim();
  if (texte === VALEUR_FERME) return { ferme: true, ouverture: "", fermeture: "" };
  const trouve = FORMAT_PLAGE.exec(texte);
  if (trouve) return { ferme: false, ouverture: trouve[1], fermeture: trouve[2] };
  return { ferme: false, ouverture: "", fermeture: "" };
}

/** Inverse de `lirePlage`. */
export function ecrirePlage(plage: PlageHoraire): string {
  return plage.ferme ? VALEUR_FERME : `${plage.ouverture}-${plage.fermeture}`;
}
