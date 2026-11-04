/** Outils partagés par les tests du cœur (base en mémoire, horloge et identifiants fixes). */
import { CoeurCaisse, type Outils } from "./coeur";
import { migrer } from "./schema";
import type { Stockage } from "./stockage";
import { ouvrirStockage } from "./stockage_sqlite";
import type { Utilisateur } from "./types_caisse";
import type { FicheSynchro, Photographie } from "./types_synchro";

export const OUVERTS: Stockage[] = [];

export function fermerTout(): void {
  for (const s of OUVERTS.splice(0)) {
    try {
      s.fermer();
    } catch {
      // déjà fermée
    }
  }
}

export function base(): Stockage {
  const s = ouvrirStockage(":memory:");
  OUVERTS.push(s);
  migrer(s);
  return s;
}

/** UUID de test reconnaissable : `uuid(7)` donne toujours le même identifiant valide. */
export function uuid(n: number, prefixe = "00000000"): string {
  return `${prefixe}-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

export const MAINTENANT = "2026-11-04T10:00:00.000Z";

export function outils(maintenant = MAINTENANT): Outils {
  let n = 0;
  return { horloge: () => new Date(maintenant), genererId: () => uuid(++n, "aaaaaaaa") };
}

export const VENDEUR: Utilisateur = { id: uuid(1, "bbbbbbbb"), nom: "Mariama Diallo", superviseur: false };
export const AUTRE_VENDEUR: Utilisateur = { id: uuid(2, "bbbbbbbb"), nom: "Ibrahima Camara", superviseur: false };
export const SUPERVISEUR: Utilisateur = { id: uuid(3, "bbbbbbbb"), nom: "Fatoumata Bah", superviseur: true };

export function fiche(i: number, champs: Partial<FicheSynchro> = {}): FicheSynchro {
  return {
    stockId: `s${i}`,
    medicamentId: `m${i}`,
    nom: `Produit ${String(i).padStart(5, "0")}`,
    nomGenerique: null,
    categorie: "ANTALGIQUE",
    formes: ["COMPRIME"],
    ordonnanceRequise: false,
    prixUnitaire: 5000,
    prixUnite: null,
    coefficientBoite: 1,
    uniteMinimale: "UNITE",
    deconditionnable: false,
    quantite: 40,
    quantiteARegulariser: 0,
    lots: [
      {
        id: `l${i}`,
        numeroLot: `N${i}`,
        dateExpiration: "2027-06-30",
        dateReception: "2026-10-01T08:00:00.000Z",
        coefficientReception: 1,
        solde: 40,
        lotTechnique: false,
      },
    ],
    ...champs,
  };
}

export function photo(fiches: FicheSynchro[], champs: Partial<Photographie["poste"]> = {}): Photographie {
  return {
    pharmacie: { id: "ph1", nom: "Pharmacie de Kaloum", adresse: null, ville: "Conakry", telephone: null, logoUrl: null },
    pointDeVente: { id: "pv1", ordre: 1 },
    poste: { id: "po1", code: "D1", libelle: "Comptoir", sequenceAppliquee: 0, sequenceMaxRecue: 0, plages: [], ...champs },
    parametres: {
      horizonsPeremptionJours: [90, 30, 7],
      seuilEcartCaisse: 5000,
      seuilAvertissementPrixPct: 20,
      seuilStockBas: 5,
      taillePlageTickets: 500,
      seuilRechargementPlagePct: 20,
      debutCaisse: "2026-10-01T00:00:00.000Z",
    },
    modesPaiement: [
      { code: "ESPECES", libelle: "Espèces", comptagePhysique: true, referenceAutorisee: false, ordre: 1 },
      { code: "ORANGE_MONEY", libelle: "Orange Money", comptagePhysique: false, referenceAutorisee: true, ordre: 2 },
      { code: "MTN_MOMO", libelle: "MTN MoMo", comptagePhysique: false, referenceAutorisee: true, ordre: 3 },
    ],
    coupures: [20000, 10000, 5000, 2000, 1000, 500].map((valeurFaciale, i) => ({
      devise: "GNF",
      valeurFaciale,
      type: "BILLET",
      ordre: i + 1,
    })),
    fiches,
  };
}

/** Cœur rattaché à la pharmacie ph1, catalogue chargé. */
export function coeurPret(
  fiches: FicheSynchro[] = [fiche(1)],
  champs: Partial<Photographie["poste"]> = { plages: [{ id: "p1", debut: 1, fin: 500 }] },
  s: Stockage = base(),
): { s: Stockage; c: CoeurCaisse } {
  const c = new CoeurCaisse(s, outils());
  c.rattacher({ structureId: "ph1" });
  c.appliquerPhotographie(photo(fiches, champs), null, null);
  return { s, c };
}

export interface EvenementLu {
  sequence: number;
  evenementId: string;
  type: string;
  utilisateurId: string;
  corps: Record<string, unknown>;
  statut: string;
}

export function evenements(s: Stockage): EvenementLu[] {
  return s
    .lire<Omit<EvenementLu, "corps"> & { corps: string }>("SELECT * FROM evenements ORDER BY sequence")
    .map((e) => ({ ...e, corps: JSON.parse(e.corps) as Record<string, unknown> }));
}

/** Vrai si une valeur négative figure n'importe où dans la structure. */
export function contientNegatif(valeur: unknown): boolean {
  if (typeof valeur === "number") return valeur < 0;
  if (Array.isArray(valeur)) return valeur.some(contientNegatif);
  if (valeur !== null && typeof valeur === "object") return Object.values(valeur).some(contientNegatif);
  return false;
}
