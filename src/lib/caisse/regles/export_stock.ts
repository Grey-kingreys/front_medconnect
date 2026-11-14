/**
 * Export du stock au format du modèle d'import « livraison » : mêmes colonnes et mêmes règles que
 * back_medconnect (src/pharmacie/pharmacie.service.ts, `exporterStock` et `COLONNES_MODELE_LIVRAISON`).
 * Une ligne par lot en stock, une ligne sans péremption pour une fiche sans lot ; quantités en boîtes ENTIÈRES
 * (le reste d'une boîte entamée et un stock négatif vont dans les notes). Pure : aucun import de React, de Next,
 * d'Electron ni d'accès réseau. Hors ligne, aucun prix d'achat n'est sur le poste : la colonne de coût reste vide.
 */
import type { UniteMinimale } from "../../api_pharmacie";
import { LIBELLES_UNITE_MINIMALE, umVersBoites } from "./quantites";

/** Titres, clés et largeurs des colonnes : à garder identiques à `COLONNES_MODELE_LIVRAISON` du back. */
export const COLONNES_EXPORT_STOCK = [
  { header: "Médicament", key: "nom", width: 40 },
  { header: "Quantité (boîtes)", key: "quantite", width: 16 },
  { header: "Prix de la boîte (GNF)", key: "prix", width: 22 },
  { header: "Date d'expiration (AAAA-MM-JJ)", key: "date", width: 32 },
  { header: "Lot", key: "lot", width: 16 },
  { header: "Coût d'achat de la boîte (GNF)", key: "cout", width: 30 },
  { header: "Notes", key: "notes", width: 40 },
] as const;

export type FiltreExportStock = "tous" | "alertes" | "rupture" | "qualifier";

export type CelluleExport = string | number | null;

/** Une ligne du classeur, dans l'ordre de `COLONNES_EXPORT_STOCK`. */
export type LigneExport = [nom: string, quantite: number, prix: number | null, date: string | null, lot: string | null, cout: CelluleExport, notes: string | null];

/** Ce que l'export lit d'une fiche (stock local ou stock du serveur). */
export interface FicheExport {
  nom: string;
  nomGenerique: string | null;
  prixUnitaire: number | null;
  coefficientBoite: number;
  uniteMinimale: UniteMinimale;
  notes: string | null;
  /** Faux : la fiche reste à qualifier. */
  qualifie: boolean | undefined;
  /** Unités minimales, jamais négative (le négatif est dans `quantiteARegulariser`). */
  quantite: number;
  quantiteARegulariser: number;
  lots: { quantite: number; dateExpiration: string | null; numeroLot: string | null }[];
}

export interface OptionsExportStock {
  filtre?: FiltreExportStock;
  q?: string;
  /** Seuil de stock bas, en boîtes (paramètres de la pharmacie). */
  seuilBoites: number;
}

/** Nom de pharmacie pour un nom de fichier : minuscules, sans accents, tirets. */
export function normaliserPourFichier(texte: string): string {
  const base = texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "pharmacie";
}

/** `stock-<pharmacie>-<AAAA-MM-JJ>.xlsx`, comme le serveur. */
export function nomFichierExportStock(nomPharmacie: string, jour: string): string {
  return `stock-${normaliserPourFichier(nomPharmacie)}-${jour}.xlsx`;
}

type EtatStock = "RUPTURE" | "BAS" | "NORMAL";

/** Rupture si quantité <= 0 ; bas si 0 < quantité < seuil x coefficient ; sinon normal (comme `etatStock` du back). */
function etat(quantiteUm: number, coefficient: number, seuilBoites: number): EtatStock {
  if (quantiteUm <= 0) return "RUPTURE";
  return quantiteUm < seuilBoites * coefficient ? "BAS" : "NORMAL";
}

function quantiteEtNotes(f: FicheExport, unites: number): { quantite: number; notes: string | null } {
  const coefficient = Math.max(1, f.coefficientBoite);
  const { boites, unites: reste } = umVersBoites(Math.max(0, unites), coefficient);
  const libelle = LIBELLES_UNITE_MINIMALE[f.uniteMinimale] ?? LIBELLES_UNITE_MINIMALE.UNITE;
  const entamee = reste > 0 ? `Boîte entamée : ${reste} ${reste > 1 ? libelle.pluriel : libelle.singulier} en plus` : null;
  const negatif = unites < 0 ? `Stock négatif dans MedConnecte : ${unites} ${unites < -1 ? libelle.pluriel : libelle.singulier}` : null;
  return { quantite: boites, notes: [f.notes, entamee, negatif].filter(Boolean).join(" ; ") || null };
}

/** Lignes du classeur pour les fiches retenues par le filtre et la recherche. Le coût est toujours vide. */
export function lignesExportStock(fiches: readonly FicheExport[], options: OptionsExportStock): LigneExport[] {
  const filtre = options.filtre ?? "tous";
  const recherche = (options.q ?? "").trim().toLowerCase();
  const retenues = fiches.filter((f) => {
    if (recherche && !f.nom.toLowerCase().includes(recherche) && !f.nomGenerique?.toLowerCase().includes(recherche)) return false;
    const e = etat(f.quantite, Math.max(1, f.coefficientBoite), options.seuilBoites);
    if (filtre === "alertes") return e === "BAS";
    if (filtre === "rupture") return e === "RUPTURE";
    if (filtre === "qualifier") return f.qualifie === false;
    return true;
  });

  const lignes: LigneExport[] = [];
  for (const f of retenues) {
    const prix = f.prixUnitaire ?? null;
    if (f.lots.length === 0) {
      const { quantite, notes } = quantiteEtNotes(f, f.quantite > 0 ? f.quantite : -(f.quantiteARegulariser ?? 0));
      lignes.push([f.nom, quantite, prix, null, null, null, notes]);
      continue;
    }
    for (const lot of f.lots) {
      const { quantite, notes } = quantiteEtNotes(f, lot.quantite);
      lignes.push([f.nom, quantite, prix, lot.dateExpiration, lot.numeroLot ?? null, null, notes]);
    }
  }
  return lignes;
}
