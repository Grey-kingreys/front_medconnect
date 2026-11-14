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

  return lignes.map(({ document }) => {
    const f = JSON.parse(document) as FicheSynchro;
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
      disponible: stock.quantite > 0,
      reliquat: stock.reliquat,
      quantiteVendable: stock.quantiteVendable,
      lots,
      dateExpiration: stock.dateExpiration ?? undefined,
    };
    return { fiche, source: f, stock };
  });
}
