/**
 * Base vue vide alors qu'un -wal et appareil.json existent (incident constaté) : un -wal étranger (celui d'une
 * base neuve) posé à côté de la vraie base la fait voir vide, et la fermeture suivante le recopie dans le fichier
 * principal, ce qui détruit les ventes. Dans ce cas on n'ouvre rien en écriture.
 */
export const MESSAGE_BASE_SUSPECTE =
  "Les ventes de ce poste ne sont pas lisibles telles quelles. Aucun fichier n'a été modifié. N'enregistrez rien et appelez l'assistance.";

export interface ObservationBase {
  /** Taille de caisse.sqlite en octets, ou null si le fichier est absent. */
  tailleBase: number | null;
  /** Taille de caisse.sqlite-wal en octets, ou null si le fichier est absent. */
  tailleWal: number | null;
  /** appareil.json existe et porte un identifiant valide. */
  appareilJsonValide: boolean;
  /** Identifiant trouvé en base par une lecture seule, ou null (aucun, table absente comprise). */
  appareilIdEnBase: string | null;
}

/** Vrai si l'ouverture doit être refusée. Fonction pure : aucun accès au disque. */
export function baseVueVideSuspecte(o: ObservationBase): boolean {
  return (
    o.tailleBase !== null &&
    o.tailleBase > 0 &&
    o.tailleWal !== null &&
    o.tailleWal > 0 &&
    o.appareilJsonValide &&
    o.appareilIdEnBase === null
  );
}
