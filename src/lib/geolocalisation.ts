/**
 * Géolocalisation partagée : haute précision demandée, meilleure mesure gardée,
 * durée bornée. Ne lève jamais d'exception.
 */

/**
 * Le navigateur ne dit pas si la position vient du GPS, du wifi ou de l'adresse IP :
 * « inconnue », valeur de l'énumération SourcePositionUrgence du back (gps, reseau, inconnue).
 */
export type SourcePosition = "inconnue";

export interface PositionMesuree {
  latitude: number;
  longitude: number;
  /** Rayon d'incertitude en mètres (coords.accuracy). */
  precision: number;
  /** Instant de la mesure (pos.timestamp), au format ISO 8601. */
  horodatagePosition: string;
  source: SourcePosition;
}

export type CauseEchecPosition = "refusee" | "indisponible" | "non_prise_en_charge";

export type ResultatPosition =
  | { ok: true; position: PositionMesuree }
  | { ok: false; cause: CauseEchecPosition };

export interface ReglagesLocalisation {
  /** Arrêt dès qu'une mesure atteint cette précision (mètres). */
  precisionVisee: number;
  /** Durée maximale de la recherche (ms) : le résultat arrive toujours avant. */
  dureeMaxMs: number;
}

/** SOS : arrêt dès 50 m, jamais plus de 10 s. */
export const REGLAGES_SOS: ReglagesLocalisation = { precisionVisee: 50, dureeMaxMs: 10_000 };

/** Hors SOS : première mesure reçue, au plus 10 s si rien n'arrive. */
export const REGLAGES_RAPIDES: ReglagesLocalisation = { precisionVisee: Number.POSITIVE_INFINITY, dureeMaxMs: 10_000 };

/** « Me localiser » et partage de position : arrêt dès 30 m, jamais plus de 10 s. */
export const REGLAGES_PRECIS: ReglagesLocalisation = { precisionVisee: 30, dureeMaxMs: 10_000 };

/** Au delà, la position est dite approximative au patient. */
export const PRECISION_MAX_FIABLE_M = 500;

// GeolocationPositionError.PERMISSION_DENIED (constante absente de jsdom)
const ERREUR_PERMISSION_REFUSEE = 1;

const versPositionMesuree = (pos: GeolocationPosition): PositionMesuree => ({
  latitude: pos.coords.latitude,
  longitude: pos.coords.longitude,
  precision: pos.coords.accuracy,
  horodatagePosition: new Date(pos.timestamp).toISOString(),
  source: "inconnue",
});

export function localiserPrecisement(
  reglages: ReglagesLocalisation,
  onAmelioration?: (position: PositionMesuree) => void
): Promise<ResultatPosition> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.resolve({ ok: false, cause: "non_prise_en_charge" });
  }
  const geo = navigator.geolocation;
  return new Promise((resolve) => {
    let meilleure: PositionMesuree | null = null;
    let termine = false;
    let idSuivi: number | null = null;

    const terminer = (resultat: ResultatPosition) => {
      if (termine) return;
      termine = true;
      clearTimeout(minuteur);
      if (idSuivi !== null) geo.clearWatch(idSuivi);
      resolve(resultat);
    };

    const minuteur = setTimeout(
      () => terminer(meilleure ? { ok: true, position: meilleure } : { ok: false, cause: "indisponible" }),
      reglages.dureeMaxMs
    );

    idSuivi = geo.watchPosition(
      (pos) => {
        if (termine) return;
        const mesure = versPositionMesuree(pos);
        if (!meilleure || mesure.precision < meilleure.precision) {
          meilleure = mesure;
          onAmelioration?.(mesure);
        }
        if (meilleure.precision <= reglages.precisionVisee) terminer({ ok: true, position: meilleure });
      },
      (erreur) => {
        // Refus : inutile d'attendre. Autres erreurs (indisponible, délai) : on attend la fin de la durée.
        if (erreur.code === ERREUR_PERMISSION_REFUSEE) terminer({ ok: false, cause: "refusee" });
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: reglages.dureeMaxMs }
    );
    // Rappel synchrone éventuel : le suivi n'était pas encore enregistré dans terminer
    if (termine) geo.clearWatch(idSuivi);
  });
}

/** Précision lisible : « environ 30 m », « environ 2,5 km ». */
export function libelleDistancePrecision(metres: number): string {
  if (metres < 1000) return `environ ${Math.max(10, Math.round(metres / 10) * 10)} m`;
  const km = Math.round(metres / 100) / 10;
  return `environ ${km.toLocaleString("fr-FR")} km`;
}

/** Phrase montrée au patient sur la précision de la position envoyée avec le SOS. */
export function libellePrecisionSos(position: PositionMesuree | null, numeroUrgence: string): string {
  if (!position) return `Position non trouvée : si possible, appelez aussi le ${numeroUrgence}`;
  if (position.precision > PRECISION_MAX_FIABLE_M) {
    return `Position approximative : si possible, appelez aussi le ${numeroUrgence}`;
  }
  const metres = Math.max(10, Math.round(position.precision / 10) * 10);
  return `Position précise à environ ${metres} m`;
}
