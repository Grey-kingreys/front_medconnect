/**
 * Aides pures de l'impression (PD05), sans Electron : délai autour de `print`, déduplication par vente,
 * liste blanche des messages que la fenêtre cachée d'impression peut envoyer au pont.
 */

/** Un pilote qui attend (boîte de nom de fichier, imprimante hors ligne) ne doit pas bloquer la file. */
export const DELAI_PRINT_MS = 60_000;

export interface ResultatPrint {
  succes: boolean;
  raison: string;
  delaiDepasse: boolean;
}

/** Lance l'impression et rend la main au plus tard après `delaiMs`, que le rappel soit venu ou non. */
export function attendreImpression(
  lancer: (rappel: (succes: boolean, raison: string) => void) => void,
  delaiMs: number = DELAI_PRINT_MS,
): Promise<ResultatPrint> {
  return new Promise((resolve) => {
    const minuterie = setTimeout(() => resolve({ succes: false, raison: "délai dépassé", delaiDepasse: true }), delaiMs);
    const terminer = (succes: boolean, raison: string) => {
      clearTimeout(minuterie);
      resolve({ succes, raison, delaiDepasse: false });
    };
    try {
      lancer(terminer);
    } catch (e) {
      terminer(false, e instanceof Error ? e.message : "échec");
    }
  });
}

/** Rend la promesse, ou `null` après `delaiMs` : une page plantée ne répond jamais, et la file attendrait sans fin. */
export function avecDelai<T>(promesse: Promise<T>, delaiMs: number): Promise<T | null> {
  return new Promise((resolve, reject) => {
    const minuterie = setTimeout(() => resolve(null), delaiMs);
    promesse.then(
      (valeur) => {
        clearTimeout(minuterie);
        resolve(valeur);
      },
      (erreur: unknown) => {
        clearTimeout(minuterie);
        reject(erreur instanceof Error ? erreur : new Error("échec"));
      },
    );
  });
}

/** Tant qu'un travail de même clé est en cours, un second appel reçoit le même résultat au lieu de relancer. */
export function creerDedoublonneur() {
  const enCours = new Map<string, Promise<unknown>>();
  return {
    lancer<T>(cle: string, travail: () => Promise<T>): Promise<T> {
      const existant = enCours.get(cle);
      if (existant !== undefined) return existant as Promise<T>;
      const promesse = travail().finally(() => enCours.delete(cle));
      enCours.set(cle, promesse);
      return promesse;
    },
    estEnCours(cle: string): boolean {
      return enCours.has(cle);
    },
  };
}

/**
 * Lectures que la fenêtre d'impression peut faire : le reçu lit la vente, l'état du poste et le profil local.
 * Tout le reste (ventes, caisse, jeton, déconnexion, réglages) lui est refusé.
 */
const LECTURES_FENETRE_IMPRESSION: ReadonlySet<string> = new Set(["caisse:getVente", "etat", "profil:lire", "impression:signalerPret"]);

export function lectureAutoriseeDepuisImpression(canal: string): boolean {
  return LECTURES_FENETRE_IMPRESSION.has(canal);
}
