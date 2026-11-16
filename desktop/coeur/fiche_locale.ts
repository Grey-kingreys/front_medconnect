/**
 * Fiches de stock telles que le poste les voit : photographie du serveur plus les mouvements et lots locaux
 * pas encore appliqués par le serveur (surcouche). Lecture seule, sans Electron ni Next.
 */
import type { LotFiche, StockMedicament, UniteMinimale } from "@/lib/api_pharmacie";
import { calculerStockLocal, type StockLocal } from "@/lib/caisse/regles/stock_local";
import type { Contexte } from "./contexte";
import { lireSurcouche } from "./stock_surcouche";
import type { FicheSynchro } from "./types_synchro";

const UNITES: readonly UniteMinimale[] = ["COMPRIME", "GELULE", "ML", "SACHET", "GRAMME", "AMPOULE", "PLAQUETTE", "UNITE"];

function uniteConnue(valeur: string): UniteMinimale {
  return (UNITES as readonly string[]).includes(valeur) ? (valeur as UniteMinimale) : "UNITE";
}

/** Champs d'une fiche modifiables hors ligne : les seuls qu'une modification locale peut changer. */
export const CHAMPS_FICHE_LOCAUX = ["prixUnitaire", "prixUnite", "toleranceInventaire", "notes"] as const;
export type ChampFicheLocal = (typeof CHAMPS_FICHE_LOCAUX)[number];

/** Modifications de champs faites sur le poste, pas encore appliquées par le serveur, dans l'ordre où elles ont été faites. */
function modificationsLocales(c: Contexte, sequenceAppliquee: number, stockId?: string): Map<string, { champ: ChampFicheLocal; valeur: number | string | null }[]> {
  const filtre = stockId === undefined ? "" : " AND stockId = ?";
  const params = stockId === undefined ? [sequenceAppliquee] : [sequenceAppliquee, stockId];
  const sortie = new Map<string, { champ: ChampFicheLocal; valeur: number | string | null }[]>();
  for (const m of c.stockage.lire<{ stockId: string; champ: ChampFicheLocal; valeur: string }>(
    `SELECT stockId, champ, valeur FROM fiches_modifiees_locales WHERE sequence > ?${filtre} ORDER BY id`,
    params,
  )) {
    const liste = sortie.get(m.stockId) ?? [];
    liste.push({ champ: m.champ, valeur: JSON.parse(m.valeur) as number | string | null });
    sortie.set(m.stockId, liste);
  }
  return sortie;
}

/**
 * Fiches de la photographie, plus celles créées sur le poste pas encore appliquées par le serveur (sauf si la photographie
 * a déjà une fiche pour le même médicament : celle du serveur gagne), avec les modifications locales par-dessus.
 */
function fichesSources(c: Contexte, sequenceAppliquee: number, stockId: string | undefined, documents: string[]): FicheSynchro[] {
  const sources = documents.map((document) => JSON.parse(document) as FicheSynchro);
  const filtre = stockId === undefined ? "" : " AND stockId = ?";
  const creees = c.stockage.lire<{ stockId: string; medicamentId: string; document: string }>(
    `SELECT stockId, medicamentId, document FROM fiches_creees_locales WHERE sequence > ?${filtre} ORDER BY sequence`,
    stockId === undefined ? [sequenceAppliquee] : [sequenceAppliquee, stockId],
  );
  for (const l of creees) {
    const doublon = c.stockage.lireUn<{ stockId: string }>("SELECT stockId FROM fiches WHERE stockId = ? OR json_extract(document, '$.medicamentId') = ?", [l.stockId, l.medicamentId]);
    if (doublon === undefined || doublon === null) sources.push(JSON.parse(l.document) as FicheSynchro);
  }
  const modifications = modificationsLocales(c, sequenceAppliquee, stockId);
  return sources.map((f) => {
    const liste = modifications.get(f.stockId);
    if (liste === undefined) return f;
    const copie: FicheSynchro = { ...f };
    for (const m of liste) (copie as unknown as Record<string, unknown>)[m.champ] = m.valeur;
    return copie;
  });
}

export interface FicheEtStock {
  /** Fiche au format que les écrans lisent déjà. */
  fiche: StockMedicament;
  /** Photographie de la fiche, telle que le serveur l'a donnée. */
  source: FicheSynchro;
  stock: StockLocal;
}

/** Toutes les fiches, ou la seule fiche `stockId`. */
export function fichesLocales(c: Contexte, stockId?: string): FicheEtStock[] {
  const etat = c.etat();
  const structureId = etat.structureId ?? "";
  const jour = c.jour();
  const surcouche = lireSurcouche(c.stockage, etat.sequenceAppliquee, stockId);
  const lignes =
    stockId === undefined
      ? c.stockage.lire<{ document: string }>("SELECT document FROM fiches ORDER BY rowid")
      : c.stockage.lire<{ document: string }>("SELECT document FROM fiches WHERE stockId = ?", [stockId]);

  return fichesSources(
    c,
    etat.sequenceAppliquee,
    stockId,
    lignes.map((l) => l.document),
  ).map((f) => {
    const stock = calculerStockLocal(f, surcouche.mouvements.get(f.stockId) ?? [], jour, surcouche.lotsLocaux.get(f.stockId) ?? []);
    const lots: LotFiche[] = stock.lots.map((l) => ({
      id: l.id,
      numeroLot: l.numeroLot,
      dateExpiration: l.dateExpiration,
      quantite: l.solde,
      lotTechnique: l.lotTechnique,
      coefficientReception: l.coefficientReception,
    }));
    const fiche: StockMedicament = {
      id: f.stockId,
      medicamentId: f.medicamentId,
      medicament: {
        id: f.medicamentId,
        nom: f.nom,
        nomGenerique: f.nomGenerique ?? undefined,
        categorie: f.categorie,
        formes: f.formes,
        ordonnanceRequise: f.ordonnanceRequise,
      },
      structureId,
      quantite: stock.quantite,
      quantiteARegulariser: stock.quantiteARegulariser,
      prixUnitaire: f.prixUnitaire ?? 0,
      prixUnite: f.prixUnite,
      coefficientBoite: f.coefficientBoite,
      uniteMinimale: uniteConnue(f.uniteMinimale),
      deconditionnable: f.deconditionnable,
      toleranceInventaire: f.toleranceInventaire ?? null,
      notes: f.notes ?? undefined,
      disponible: stock.quantite > 0,
      reliquat: stock.reliquat,
      quantiteVendable: stock.quantiteVendable,
      lots,
      dateExpiration: stock.dateExpiration ?? undefined,
    };
    return { fiche, source: f, stock };
  });
}
