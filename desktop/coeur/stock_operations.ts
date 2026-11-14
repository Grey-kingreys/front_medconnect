/**
 * Sortie de stock et correction de quantité faites sur le poste, sans réseau. Une seule transaction par
 * opération : mouvement local signé (la surcouche fait baisser ou monter le stock affiché aussitôt) et
 * événement du journal. Le serveur applique ensuite l'événement ; il l'accepte toujours (décision Q2), la part
 * qu'un lot ne couvre plus devient une sortie provisoire sans lot avec une anomalie pour le responsable.
 * Après l'application, la photographie suivante avance `sequenceAppliquee` et la ligne locale disparaît.
 */
import type { SortieStockEnregistree, StockMedicament } from "@/lib/api_pharmacie";
import { motifSortie, typeMouvementSortie, type RaisonSortieCode } from "@/lib/caisse/regles/sortie_stock";
import type { Contexte } from "./contexte";
import { fichesLocales, type FicheEtStock } from "./fiche_locale";
import { MESSAGE_LOT_INTROUVABLE } from "./messages";
import {
  MESSAGE_COMMENTAIRE_SORTIE_REQUIS,
  MESSAGE_LOT_REQUIS_AUCUN,
  MESSAGE_LOT_REQUIS_CHOIX,
  MESSAGE_MOTIF_CORRECTION_REQUIS,
  MESSAGE_RAISON_SORTIE_REQUISE,
  MESSAGE_SORTIE_QUANTITE_INVALIDE,
  MESSAGE_SORTIE_QUANTITE_TROP_GRANDE,
  MESSAGE_STOCK_INTROUVABLE,
  MESSAGE_VARIATION_INVALIDE,
  messageSortieLotInsuffisante,
  messageStockLotNegatif,
} from "./messages_stock";
import { exigerUuid, RefusCaisse, refusValidation } from "./refus";
import { ajouterMouvementLocal } from "./stock_surcouche";
import type { Utilisateur } from "./types_caisse";

export const QUANTITE_MAX = 1_000_000_000;

export interface CorpsSortieLocale {
  id: string;
  stockId: string;
  lotId: string;
  unite: "BOITE" | "UNITE";
  quantite: number;
  raison?: RaisonSortieCode;
  commentaire?: string;
}

export interface CorpsCorrectionLocale {
  id: string;
  lotId?: string;
  variation: number;
  motif: string;
  notes?: string;
}

function entier(v: unknown, min: number, max: number): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
}

function ficheOuRefus(c: Contexte, stockId: string): FicheEtStock {
  const f = fichesLocales(c, stockId)[0];
  if (f === undefined) throw new RefusCaisse(404, "STOCK_INTROUVABLE", MESSAGE_STOCK_INTROUVABLE);
  return f;
}

/** Lot visé par une opération : dans la photographie ou créé sur le poste, même si son solde local est à 0. */
function lotConnu(f: FicheEtStock, lotId: string): boolean {
  return f.source.lots.some((l) => l.id === lotId) || f.stock.lots.some((l) => l.id === lotId);
}

function soldeLocalLot(f: FicheEtStock, lotId: string): number {
  return f.stock.lots.find((l) => l.id === lotId)?.solde ?? 0;
}

function coefficientLot(f: FicheEtStock, lotId: string): number {
  const lot = f.stock.lots.find((l) => l.id === lotId) ?? f.source.lots.find((l) => l.id === lotId);
  return lot?.coefficientReception ?? f.source.coefficientBoite;
}

/** Somme signée des mouvements locaux déjà écrits pour cette pièce, ou null si elle est inconnue du poste. */
function dejaEnregistree(c: Contexte, id: string, type: "SORTIE" | "CORRECTION"): number | null {
  const lignes = c.stockage.lire<{ quantiteUm: number }>("SELECT quantiteUm FROM mouvements_locaux WHERE reference = ? AND type = ?", [id, type]);
  return lignes.length === 0 ? null : lignes.reduce((s, l) => s + l.quantiteUm, 0);
}

export function sortirStock(c: Contexte, corps: CorpsSortieLocale, u: Utilisateur): SortieStockEnregistree {
  return c.stockage.transaction(() => {
    exigerUuid(corps.id, "de la sortie");
    const f = ficheOuRefus(c, corps.stockId);
    const lotVise = corps.lotId;

    // Rejeu du même identifiant : rien de plus n'est sorti.
    const dejaUm = dejaEnregistree(c, corps.id, "SORTIE");
    if (dejaUm !== null) return resultatSortie(c, f, corps, -dejaUm, u, false);

    const m = motifSortie(corps.raison ?? null, corps.commentaire ?? null);
    if (!m.ok) {
      const message = m.code === "RAISON_REQUISE" ? MESSAGE_RAISON_SORTIE_REQUISE : MESSAGE_COMMENTAIRE_SORTIE_REQUIS;
      throw new RefusCaisse(400, "MOTIF_REQUIS", message);
    }
    if (corps.unite !== "BOITE" && corps.unite !== "UNITE") throw refusValidation(MESSAGE_SORTIE_QUANTITE_INVALIDE);
    if (!entier(corps.quantite, 1, QUANTITE_MAX)) throw refusValidation(MESSAGE_SORTIE_QUANTITE_INVALIDE);
    if (!lotConnu(f, lotVise)) throw new RefusCaisse(404, "LOT_INTROUVABLE", MESSAGE_LOT_INTROUVABLE);

    const quantiteUm = corps.unite === "BOITE" ? corps.quantite * coefficientLot(f, lotVise) : corps.quantite;
    if (quantiteUm > QUANTITE_MAX) throw refusValidation(MESSAGE_SORTIE_QUANTITE_TROP_GRANDE);
    const solde = soldeLocalLot(f, lotVise);
    if (quantiteUm > solde) throw new RefusCaisse(409, "STOCK_LOT_NEGATIF", messageSortieLotInsuffisante(solde));

    const sequence = c.etat().prochaineSequence;
    ajouterMouvementLocal(c.stockage, { sequence, stockId: corps.stockId, lotId: lotVise, quantiteUm: -quantiteUm, type: "SORTIE", reference: corps.id });
    c.ajouterEvenement("SORTIE_STOCK", u.id, {
      id: corps.id,
      stockId: corps.stockId,
      lotId: lotVise,
      unite: corps.unite,
      quantite: corps.quantite,
      raison: corps.raison,
      commentaire: (corps.commentaire ?? "").trim(),
    });
    return resultatSortie(c, f, corps, quantiteUm, u, true);
  });
}

function resultatSortie(c: Contexte, avant: FicheEtStock, corps: CorpsSortieLocale, quantiteUm: number, u: Utilisateur, cree: boolean): SortieStockEnregistree {
  const apres = ficheOuRefus(c, corps.stockId);
  const lot = apres.stock.lots.find((l) => l.id === corps.lotId) ?? avant.source.lots.find((l) => l.id === corps.lotId);
  const raison = (corps.raison ?? "AUTRE") as RaisonSortieCode;
  const m = motifSortie(raison, corps.commentaire ?? null);
  return {
    id: corps.id,
    mouvementId: corps.id,
    stockId: corps.stockId,
    nom: avant.source.nom,
    lotId: corps.lotId,
    numeroLot: lot?.numeroLot ?? null,
    dateExpiration: lot?.dateExpiration ?? null,
    perime: lot?.dateExpiration != null && lot.dateExpiration < c.jour(),
    type: typeMouvementSortie(raison),
    motif: m.ok ? m.motif : "",
    quantite: quantiteUm,
    soldeLot: soldeLocalLot(apres, corps.lotId),
    soldeProduit: apres.stock.quantite,
    quantiteARegulariser: apres.stock.quantiteARegulariser,
    auteurId: u.id,
    createdAt: c.maintenant(),
    cree,
  };
}

export function corrigerQuantite(c: Contexte, stockId: string, corps: CorpsCorrectionLocale, u: Utilisateur): { fiche: StockMedicament; variation: number } {
  return c.stockage.transaction(() => {
    exigerUuid(corps.id, "de la correction");
    const f = ficheOuRefus(c, stockId);

    const dejaUm = dejaEnregistree(c, corps.id, "CORRECTION");
    if (dejaUm !== null) return { fiche: f.fiche, variation: dejaUm };

    const motif = (corps.motif ?? "").trim();
    if (motif.length < 3) throw new RefusCaisse(400, "MOTIF_REQUIS", MESSAGE_MOTIF_CORRECTION_REQUIS);
    if (!entier(corps.variation, -QUANTITE_MAX, QUANTITE_MAX) || corps.variation === 0) throw refusValidation(MESSAGE_VARIATION_INVALIDE);

    let lotId = corps.lotId;
    if (lotId === undefined) {
      if (f.stock.lots.length === 1) lotId = f.stock.lots[0].id;
      else if (f.stock.lots.length === 0) throw new RefusCaisse(409, "LOT_REQUIS", MESSAGE_LOT_REQUIS_AUCUN);
      else throw new RefusCaisse(409, "LOT_REQUIS", MESSAGE_LOT_REQUIS_CHOIX);
    } else if (!lotConnu(f, lotId)) {
      throw new RefusCaisse(404, "LOT_INTROUVABLE", MESSAGE_LOT_INTROUVABLE);
    }
    const solde = soldeLocalLot(f, lotId);
    if (solde + corps.variation < 0) throw new RefusCaisse(409, "STOCK_LOT_NEGATIF", messageStockLotNegatif(solde));

    const sequence = c.etat().prochaineSequence;
    ajouterMouvementLocal(c.stockage, { sequence, stockId, lotId, quantiteUm: corps.variation, type: "CORRECTION", reference: corps.id });
    c.ajouterEvenement("CORRECTION_QUANTITE", u.id, {
      id: corps.id,
      stockId,
      lotId,
      variation: corps.variation,
      motif,
      notes: (corps.notes ?? "").trim(),
    });
    return { fiche: ficheOuRefus(c, stockId).fiche, variation: corps.variation };
  });
}
