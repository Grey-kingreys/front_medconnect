/**
 * Anomalies lues et traitées sur le poste, sans réseau. La lecture montre les anomalies OUVERTES de la dernière
 * photographie (détails lisibles, aucun coût) moins celles que ce poste a déjà marquées « traitées ». Le traitement
 * écrit en une transaction une marque locale et l'événement `ANOMALIE_TRAITEE`. Comme pour les mouvements de stock,
 * la marque masque l'anomalie tant que la photographie des anomalies est antérieure à la marque : dès qu'une
 * photographie postérieure arrive, elle donne la vérité (anomalie traitée et absente, ou de nouveau ouverte).
 * Seules les anomalies ouvertes descendent sur le poste : l'onglet « Traitées » n'y montre que ce qui a été traité ici.
 */
import type { Anomalie, PageAnomalies } from "@/lib/api_pilotage";
import type { Contexte } from "./contexte";
import { RefusCaisse, refusValidation } from "./refus";
import type { Utilisateur } from "./types_caisse";
import type { AnomalieSynchro } from "./types_synchro";

export const PAR_PAGE_ANOMALIES = 20;
export const MESSAGE_ANOMALIE_TRAITEE = "Anomalie traitée sur ce poste.";
export const MESSAGE_ANOMALIE_INTROUVABLE = "Cette anomalie est introuvable.";
export const MESSAGE_ANOMALIE_DEJA_TRAITEE = "Cette anomalie a déjà été traitée.";
export const MESSAGE_COMMENTAIRE_TRAITEMENT_REQUIS = "Indiquez ce qui a été vérifié ou fait (3 caractères au moins).";

export interface OptionsListeAnomaliesLocale {
  statut?: "OUVERTE" | "TRAITEE";
  type?: string;
  page?: number;
}

interface MarqueTraitee {
  anomalieId: string;
  sequence: number;
  commentaire: string;
  traiteeLe: string;
  traiteeParId: string;
  traiteeParNom: string;
}

function ouvertesPhotographie(c: Contexte): AnomalieSynchro[] {
  return c.stockage.lire<{ document: string }>("SELECT document FROM anomalies_locales ORDER BY rang").map((l) => JSON.parse(l.document) as AnomalieSynchro);
}

/** Clé de `reglages` : date de la dernière photographie qui portait les anomalies (un 304 ne la change pas). */
export const CLE_ANOMALIES_PHOTOGRAPHIE_LE = "anomalies_photographie_le";

/**
 * Marques locales encore actives, par identifiant d'anomalie. Une marque masque l'anomalie tant que la photographie
 * des anomalies est ANTÉRIEURE ou égale à la marque : dès qu'une photographie postérieure arrive, elle fait foi
 * (traitée par le serveur et absente, ou encore ouverte après un rejet : l'anomalie réapparaît).
 */
function marquesActives(c: Contexte): Map<string, MarqueTraitee> {
  const photo = c.stockage.lireUn<{ valeur: string }>("SELECT valeur FROM reglages WHERE cle = ?", [CLE_ANOMALIES_PHOTOGRAPHIE_LE])?.valeur ?? "";
  const lignes = c.stockage.lire<MarqueTraitee>(
    "SELECT anomalieId, sequence, commentaire, traiteeLe, traiteeParId, traiteeParNom FROM anomalies_traitees_locales WHERE traiteeLe >= ? ORDER BY sequence",
    [photo],
  );
  return new Map(lignes.map((m) => [m.anomalieId, m]));
}

function versAnomalie(a: AnomalieSynchro): Anomalie {
  return { ...a, details: a.details ?? {} } as Anomalie;
}

/** Page d'anomalies au format de la route du serveur : à traiter (photographie moins les marques) ou traitées sur ce poste. */
export function listerAnomaliesLocales(c: Contexte, options: OptionsListeAnomaliesLocale = {}): PageAnomalies {
  const marques = marquesActives(c);
  const ouvertes = ouvertesPhotographie(c).filter((a) => !marques.has(a.id));
  const statut = options.statut ?? "OUVERTE";
  const page = options.page ?? 1;

  let retenues: Anomalie[];
  if (statut === "OUVERTE") {
    retenues = ouvertes.map(versAnomalie);
  } else {
    // Traitées sur ce poste et pas encore confirmées par le serveur : on les relit dans la photographie.
    const parId = new Map(ouvertesPhotographie(c).map((a) => [a.id, a]));
    retenues = [...marques.values()]
      .reverse()
      .flatMap((m) => {
        const a = parId.get(m.anomalieId);
        if (a === undefined) return [];
        return [
          versAnomalie({
            ...a,
            statut: "TRAITEE",
            traiteeLe: m.traiteeLe,
            traiteePar: { id: m.traiteeParId, nom: m.traiteeParNom },
            commentaireTraitement: m.commentaire,
          }),
        ];
      });
  }
  if (options.type !== undefined && options.type !== "") retenues = retenues.filter((a) => a.type === options.type);

  const debut = (Math.max(1, page) - 1) * PAR_PAGE_ANOMALIES;
  return {
    anomalies: retenues.slice(debut, debut + PAR_PAGE_ANOMALIES),
    page,
    parPage: PAR_PAGE_ANOMALIES,
    total: retenues.length,
    ouvertes: ouvertes.length,
  };
}

/** Marque une anomalie « traitée » sur le poste : marque locale et événement `ANOMALIE_TRAITEE`, en une transaction. */
export function traiterAnomalieLocale(c: Contexte, anomalieId: string, commentaire: string, u: Utilisateur): Anomalie {
  return c.stockage.transaction(() => {
    const texte = typeof commentaire === "string" ? commentaire.trim() : "";
    if (texte.length < 3) throw new RefusCaisse(400, "MOTIF_REQUIS", MESSAGE_COMMENTAIRE_TRAITEMENT_REQUIS);
    if (texte.length > 500) throw refusValidation("Le commentaire est trop long (500 caractères au plus).");
    const a = ouvertesPhotographie(c).find((x) => x.id === anomalieId);
    if (a === undefined) throw new RefusCaisse(404, "ANOMALIE_INTROUVABLE", MESSAGE_ANOMALIE_INTROUVABLE);
    if (marquesActives(c).has(anomalieId)) throw new RefusCaisse(409, "ANOMALIE_DEJA_TRAITEE", MESSAGE_ANOMALIE_DEJA_TRAITEE);

    const maintenant = c.maintenant();
    const sequence = c.etat().prochaineSequence;
    c.stockage.executer(
      "INSERT OR REPLACE INTO anomalies_traitees_locales (anomalieId, sequence, commentaire, traiteeLe, traiteeParId, traiteeParNom) VALUES (?, ?, ?, ?, ?, ?)",
      [anomalieId, sequence, texte, maintenant, u.id, u.nom],
    );
    c.ajouterEvenement("ANOMALIE_TRAITEE", u.id, { anomalieId, commentaire: texte });
    return versAnomalie({
      ...a,
      statut: "TRAITEE",
      traiteeLe: maintenant,
      traiteePar: { id: u.id, nom: u.nom },
      commentaireTraitement: texte,
    });
  });
}
