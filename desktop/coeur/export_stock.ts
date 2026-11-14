/**
 * Export du stock sur le poste : lignes du classeur calculées à partir du stock local (photographie plus mouvements
 * locaux), sans aucun coût (aucun prix d'achat n'est sur le poste). La génération du fichier est dans `xlsx.ts`,
 * son enregistrement dans le processus principal d'Electron.
 */
import { COLONNES_EXPORT_STOCK, lignesExportStock, nomFichierExportStock, type FicheExport, type FiltreExportStock } from "@/lib/caisse/regles/export_stock";
import type { UniteMinimale } from "@/lib/api_pharmacie";
import type { Contexte } from "./contexte";
import { fichesLocales } from "./fiche_locale";
import { genererXlsx } from "./xlsx";

/** Indice de la colonne « Date d'expiration » : écrite en vraie date Excel. */
const COLONNE_DATE = COLONNES_EXPORT_STOCK.findIndex((c) => c.key === "date");

export interface ExportStockPret {
  nomFichier: string;
  contenu: Buffer;
}

export function preparerExportStock(c: Contexte, options: { filtre?: FiltreExportStock; q?: string }): ExportStockPret {
  const ref = c.referentielsRequis();
  const fiches: FicheExport[] = fichesLocales(c).map(({ source, stock }) => ({
    nom: source.nom,
    nomGenerique: source.nomGenerique,
    prixUnitaire: source.prixUnitaire,
    coefficientBoite: source.coefficientBoite,
    uniteMinimale: source.uniteMinimale as UniteMinimale,
    notes: source.notes ?? null,
    qualifie: source.qualifie,
    quantite: stock.quantite,
    quantiteARegulariser: stock.quantiteARegulariser,
    lots: stock.lots.map((l) => ({ quantite: l.solde, dateExpiration: l.dateExpiration, numeroLot: l.numeroLot })),
  }));
  const lignes = lignesExportStock(fiches, { ...options, seuilBoites: ref.parametres.seuilStockBas });
  return {
    nomFichier: nomFichierExportStock(ref.pharmacie.nom, c.jour()),
    contenu: genererXlsx({ feuille: "Stock", colonnes: COLONNES_EXPORT_STOCK, lignes, colonnesDate: [COLONNE_DATE] }),
  };
}
