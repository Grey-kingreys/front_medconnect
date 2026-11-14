/**
 * Lecture d'une date de péremption saisie au comptoir (D684).
 * Calcul en UTC, sans comparaison avec aujourd'hui : le serveur refuse une date passée (DATE_PEREMPTION_PASSEE).
 */

export type LectureDate = { ok: true; jour: string } | { ok: false; message: string };

const MESSAGE_ILLISIBLE = "Date de péremption illisible : écrivez par exemple 06/28 ou 30/06/2028.";

const SEPARATEUR = "[/\\-.]";
const MOIS_ANNEE = new RegExp(`^(\\d{1,2})${SEPARATEUR}(\\d{2}|\\d{4})$`);
const JOUR_MOIS_ANNEE = new RegExp(`^(\\d{1,2})${SEPARATEUR}(\\d{1,2})${SEPARATEUR}(\\d{2}|\\d{4})$`);
const JOUR_ISO = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;

const deux = (n: number) => String(n).padStart(2, "0");

/** Année lue : deux chiffres donnent 2000 + AA. */
const anneeComplete = (texte: string) => (texte.length === 2 ? 2000 + Number(texte) : Number(texte));

/** Nombre de jours du mois (mois de 1 à 12), bissextile compris. */
const joursDuMois = (annee: number, mois: number) => new Date(Date.UTC(annee, mois, 0)).getUTCDate();

function jourValide(annee: number, mois: number, jour: number): LectureDate {
  // Une année de 4 chiffres inférieure à 1000 n'est pas une date de péremption (et Date.UTC lit 0 à 99 comme 19xx).
  if (annee < 1000 || mois < 1 || mois > 12 || jour < 1 || jour > joursDuMois(annee, mois)) {
    return { ok: false, message: MESSAGE_ILLISIBLE };
  }
  return { ok: true, jour: `${String(annee).padStart(4, "0")}-${deux(mois)}-${deux(jour)}` };
}

/** Lit une date de péremption saisie au comptoir ; renvoie le jour AAAA-MM-JJ. */
export function lireDatePeremption(saisie: string): LectureDate {
  const texte = saisie.trim();

  const iso = JOUR_ISO.exec(texte);
  if (iso) return jourValide(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const complete = JOUR_MOIS_ANNEE.exec(texte);
  if (complete) return jourValide(anneeComplete(complete[3]), Number(complete[2]), Number(complete[1]));

  const moisAnnee = MOIS_ANNEE.exec(texte);
  if (moisAnnee) {
    const mois = Number(moisAnnee[1]);
    const annee = anneeComplete(moisAnnee[2]);
    if (mois < 1 || mois > 12) return { ok: false, message: MESSAGE_ILLISIBLE };
    return jourValide(annee, mois, joursDuMois(annee, mois));
  }

  return { ok: false, message: MESSAGE_ILLISIBLE };
}

/** Jour AAAA-MM-JJ affiché « 30/06/2028 ». */
export function afficherDatePeremption(jour: string): string {
  const [annee, mois, jourDuMois] = jour.slice(0, 10).split("-");
  return `${jourDuMois}/${mois}/${annee}`;
}
