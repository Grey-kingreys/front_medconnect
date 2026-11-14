/**
 * Surcouche locale du stock : mouvements signés et lots créés sur le poste, pas encore appliqués par le serveur.
 * Une ligne ne compte que si sa séquence dépasse `sequenceAppliquee` : dès que le serveur a appliqué ou rejeté
 * l'événement, la photographie suivante avance `sequenceAppliquee` et la ligne disparaît de la lecture, remplacée
 * par la vérité du serveur (les lignes restent en base, sans effet).
 */
import type { LotPhoto, MouvementLocal } from "@/lib/caisse/regles/stock_local";
import type { Stockage } from "./stockage";

export type TypeMouvementLocal = "VENTE" | "SORTIE" | "CORRECTION" | "RECEPTION" | "INVENTAIRE";

export interface NouveauMouvementLocal {
  sequence: number;
  stockId: string;
  lotId: string | null;
  /** Signée : négative pour une sortie. */
  quantiteUm: number;
  type: TypeMouvementLocal;
  /** Pièce d'origine (identifiant de la vente, de la réception...). */
  reference?: string | null;
}

export interface NouveauLotLocal {
  lotId: string;
  stockId: string;
  sequence: number;
  numeroLot: string | null;
  dateExpiration: string | null;
  dateReception: string;
  coefficientReception: number;
  lotTechnique?: boolean;
}

export function ajouterMouvementLocal(s: Stockage, m: NouveauMouvementLocal): void {
  s.executer("INSERT INTO mouvements_locaux (sequence, stockId, lotId, quantiteUm, type, reference) VALUES (?, ?, ?, ?, ?, ?)", [
    m.sequence,
    m.stockId,
    m.lotId,
    m.quantiteUm,
    m.type,
    m.reference ?? null,
  ]);
}

/** Crée un lot local ; un lot du même identifiant déjà là est laissé tel quel (rejeu sans doublon). */
export function ajouterLotLocal(s: Stockage, l: NouveauLotLocal): void {
  s.executer(
    "INSERT OR IGNORE INTO lots_locaux (lotId, stockId, sequence, numeroLot, dateExpiration, dateReception, coefficientReception, lotTechnique) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [l.lotId, l.stockId, l.sequence, l.numeroLot, l.dateExpiration, l.dateReception, l.coefficientReception, l.lotTechnique ? 1 : 0],
  );
}

export interface Surcouche {
  mouvements: Map<string, MouvementLocal[]>;
  lotsLocaux: Map<string, LotPhoto[]>;
}

/** Mouvements et lots locaux de séquence supérieure à `sequenceAppliquee`, par fiche (une seule fiche si `stockId` est donné). */
export function lireSurcouche(s: Stockage, sequenceAppliquee: number, stockId?: string): Surcouche {
  const filtre = stockId === undefined ? "" : " AND stockId = ?";
  const params = stockId === undefined ? [sequenceAppliquee] : [sequenceAppliquee, stockId];

  const mouvements = new Map<string, MouvementLocal[]>();
  for (const m of s.lire<{ stockId: string; lotId: string | null; quantiteUm: number }>(
    `SELECT stockId, lotId, quantiteUm FROM mouvements_locaux WHERE sequence > ?${filtre} ORDER BY id`,
    params,
  )) {
    const liste = mouvements.get(m.stockId) ?? [];
    liste.push({ lotId: m.lotId, quantiteUm: m.quantiteUm });
    mouvements.set(m.stockId, liste);
  }

  const lotsLocaux = new Map<string, LotPhoto[]>();
  for (const l of s.lire<{
    lotId: string;
    stockId: string;
    numeroLot: string | null;
    dateExpiration: string | null;
    dateReception: string;
    coefficientReception: number;
    lotTechnique: number;
  }>(
    `SELECT lotId, stockId, numeroLot, dateExpiration, dateReception, coefficientReception, lotTechnique FROM lots_locaux WHERE sequence > ?${filtre} ORDER BY sequence, lotId`,
    params,
  )) {
    const liste = lotsLocaux.get(l.stockId) ?? [];
    liste.push({
      id: l.lotId,
      numeroLot: l.numeroLot,
      dateExpiration: l.dateExpiration,
      dateReception: l.dateReception,
      coefficientReception: l.coefficientReception,
      solde: 0,
      lotTechnique: l.lotTechnique === 1,
    });
    lotsLocaux.set(l.stockId, liste);
  }
  return { mouvements, lotsLocaux };
}
