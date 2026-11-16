/**
 * Fiches de stock modifiées ou ajoutées sur le poste, sans réseau. Une seule transaction par opération : surcouche
 * locale (la fiche change aussitôt à l'écran) et événement du journal. Le serveur applique ensuite l'événement :
 * un champ changé ailleurs entre-temps n'est pas écrasé (anomalie pour le responsable).
 *
 * Seuls les champs « sûrs » se changent ici : prix de la boîte, prix à l'unité, tolérance d'inventaire, notes. Le
 * coefficient, l'unité, la vente à l'unité, la qualification, l'archivage et la création d'un médicament du
 * catalogue demandent une connexion (conversion du stock et catalogue commun à toutes les pharmacies).
 *
 * Aucun prix d'achat sur le poste (Q8) : le catalogue allégé n'a ni prix ni coût.
 */
import type { Medicament, StockMedicament } from "@/lib/api_pharmacie";
import type { Contexte } from "./contexte";
import { CHAMPS_FICHE_LOCAUX, fichesLocales, type ChampFicheLocal } from "./fiche_locale";
import { MESSAGE_STOCK_INTROUVABLE } from "./messages_stock";
import { exigerUuid, RefusCaisse, refusValidation } from "./refus";
import type { Utilisateur } from "./types_caisse";
import type { FicheSynchro, MedicamentAllegeSynchro } from "./types_synchro";

/** Plus grand entier enregistrable côté serveur. */
const ENTIER_MAX = 2_147_483_647;
const TOLERANCE_MAX = 1_000_000;
const NOTES_MAX = 2000;
export const RESULTATS_CATALOGUE_MAX = 50;

// Messages repris à la lettre de back_medconnect : src/pharmacie/fiche-produit.service.ts et pharmacie.service.ts.
export const MESSAGE_PRIX_BOITE_INVALIDE = "Le prix de la boîte doit être un nombre entier de francs guinéens, sans décimales.";
export const MESSAGE_PRIX_UNITE_INVALIDE = "Le prix à l'unité doit être un nombre entier de francs guinéens, sans décimales.";
export const MESSAGE_TOLERANCE_INVALIDE = "L'écart d'inventaire toléré doit être un nombre entier d'unités, de 0 à 1 000 000.";
export const MESSAGE_NOTES_TROP_LONGUES = "Les notes sont trop longues (2 000 caractères au plus).";
export const MESSAGE_PRIX_UNITE_SANS_DECONDITIONNEMENT =
  "Un prix à l'unité n'est possible que si ce médicament se vend aussi à l'unité. Activez la vente à l'unité ou retirez le prix à l'unité.";
export const MESSAGE_MEDICAMENT_INCONNU = "Médicament non trouvé dans le catalogue";
export const MESSAGE_FICHE_ENREGISTREE_HORS_LIGNE = "Fiche produit enregistrée sur ce poste.";
export const MESSAGE_AUCUNE_MODIFICATION = "Aucune modification de la fiche produit.";
export const MESSAGE_FICHE_AJOUTEE_HORS_LIGNE = "Médicament ajouté au stock de ce poste. Enregistrez ensuite une réception pour y ajouter des boîtes.";
export const MESSAGE_FICHE_DEJA_PRESENTE = "Ce médicament est déjà dans votre stock. Rien n'a été modifié.";

export interface ChampsFicheModifiables {
  prixUnitaire?: number | null;
  prixUnite?: number | null;
  toleranceInventaire?: number | null;
  notes?: string | null;
}

type Valeur = number | string | null;

function entier(v: unknown, min: number, max: number): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
}

/** Notes vides valent null, comme côté serveur. */
function notesNettoyees(v: string | null | undefined): string | null {
  const t = typeof v === "string" ? v.trim() : "";
  return t === "" ? null : t;
}

/** Valeur de la fiche telle que la photographie (et les modifications locales) la donne : une fiche sans prix y vaut null, pas 0. */
function valeurActuelle(f: FicheSynchro, champ: ChampFicheLocal): Valeur {
  switch (champ) {
    case "prixUnitaire":
      return f.prixUnitaire ?? null;
    case "prixUnite":
      return f.prixUnite ?? null;
    case "toleranceInventaire":
      return f.toleranceInventaire ?? null;
    case "notes":
      return notesNettoyees(f.notes);
  }
}

export interface ResultatModification {
  fiche: StockMedicament;
  /** Faux : aucun champ ne change, rien n'est écrit. */
  modifiee: boolean;
}

/** Modifie les champs sûrs d'une fiche : surcouche locale et événement `FICHE_MODIFIEE` en une transaction. */
export function modifierFicheLocale(c: Contexte, stockId: string, champs: ChampsFicheModifiables, u: Utilisateur): ResultatModification {
  return c.stockage.transaction(() => {
    const existante = fichesLocales(c, stockId)[0];
    if (existante === undefined) throw new RefusCaisse(404, "STOCK_INTROUVABLE", MESSAGE_STOCK_INTROUVABLE);

    const voulues: Partial<Record<ChampFicheLocal, Valeur>> = {};
    if (champs.prixUnitaire !== undefined) {
      if (champs.prixUnitaire !== null && !entier(champs.prixUnitaire, 0, ENTIER_MAX)) throw refusValidation(MESSAGE_PRIX_BOITE_INVALIDE);
      voulues.prixUnitaire = champs.prixUnitaire;
    }
    if (champs.prixUnite !== undefined) {
      if (champs.prixUnite !== null && !entier(champs.prixUnite, 1, ENTIER_MAX)) throw refusValidation(MESSAGE_PRIX_UNITE_INVALIDE);
      voulues.prixUnite = champs.prixUnite;
    }
    if (champs.toleranceInventaire !== undefined) {
      if (champs.toleranceInventaire !== null && !entier(champs.toleranceInventaire, 0, TOLERANCE_MAX)) throw refusValidation(MESSAGE_TOLERANCE_INVALIDE);
      voulues.toleranceInventaire = champs.toleranceInventaire;
    }
    if (champs.notes !== undefined) {
      const n = notesNettoyees(champs.notes);
      if (n !== null && n.length > NOTES_MAX) throw refusValidation(MESSAGE_NOTES_TROP_LONGUES);
      voulues.notes = n;
    }

    const avant: Record<string, Valeur> = {};
    const apres: Record<string, Valeur> = {};
    for (const champ of CHAMPS_FICHE_LOCAUX) {
      if (!(champ in voulues)) continue;
      const actuelle = valeurActuelle(existante.source, champ);
      const voulue = voulues[champ] as Valeur;
      if (voulue === actuelle) continue;
      avant[champ] = actuelle;
      apres[champ] = voulue;
    }
    if (Object.keys(apres).length === 0) return { fiche: existante.fiche, modifiee: false };

    // Un prix à l'unité n'est permis que sur une fiche qui se vend à l'unité (la vente à l'unité reste à régler en ligne).
    if (apres.prixUnite !== undefined && apres.prixUnite !== null && existante.fiche.deconditionnable !== true) {
      throw new RefusCaisse(400, "PRIX_UNITE_SANS_DECONDITIONNEMENT", MESSAGE_PRIX_UNITE_SANS_DECONDITIONNEMENT);
    }

    const sequence = c.etat().prochaineSequence;
    for (const champ of Object.keys(apres)) {
      c.stockage.executer("INSERT INTO fiches_modifiees_locales (sequence, stockId, champ, valeur) VALUES (?, ?, ?, ?)", [sequence, stockId, champ, JSON.stringify(apres[champ])]);
    }
    c.ajouterEvenement("FICHE_MODIFIEE", u.id, { stockId, avant, apres });
    return { fiche: fichesLocales(c, stockId)[0].fiche, modifiee: true };
  });
}

export interface CorpsFicheCreee {
  /** Identifiant de la fiche choisi par le poste (UUID) : rejouer le même ne la crée qu'une fois. */
  id: string;
  medicamentId: string;
  prixUnitaire?: number | null;
  notes?: string | null;
}

export interface ResultatCreation {
  fiche: StockMedicament;
  /** Faux : la fiche était déjà dans le stock de ce poste (ou la demande est rejouée), rien n'est écrit. */
  cree: boolean;
}

function medicamentDuCatalogue(c: Contexte, medicamentId: string): MedicamentAllegeSynchro | null {
  const ligne = c.stockage.lireUn<{ document: string }>("SELECT document FROM medicaments_catalogue WHERE id = ?", [medicamentId]);
  return ligne === undefined || ligne === null ? null : (JSON.parse(ligne.document) as MedicamentAllegeSynchro);
}

/** Ajoute un médicament du catalogue au stock, sans quantité : fiche locale et événement `FICHE_CREEE` en une transaction. */
export function creerFicheLocale(c: Contexte, corps: CorpsFicheCreee, u: Utilisateur): ResultatCreation {
  return c.stockage.transaction(() => {
    exigerUuid(corps.id, "de la fiche");
    // Demande rejouée : la fiche faite par la première est rendue telle quelle.
    const rejouee = fichesLocales(c, corps.id)[0];
    if (rejouee !== undefined) return { fiche: rejouee.fiche, cree: false };

    const medicament = medicamentDuCatalogue(c, corps.medicamentId);
    if (medicament === null) throw new RefusCaisse(404, "MEDICAMENT_INTROUVABLE", MESSAGE_MEDICAMENT_INCONNU);

    const dejaLa = fichesLocales(c).find((f) => f.fiche.medicamentId === corps.medicamentId);
    if (dejaLa !== undefined) return { fiche: dejaLa.fiche, cree: false };

    const prix = corps.prixUnitaire ?? null;
    if (prix !== null && !entier(prix, 0, ENTIER_MAX)) throw refusValidation(MESSAGE_PRIX_BOITE_INVALIDE);
    const notes = notesNettoyees(corps.notes);
    if (notes !== null && notes.length > NOTES_MAX) throw refusValidation(MESSAGE_NOTES_TROP_LONGUES);

    // Valeurs par défaut du serveur pour une fiche neuve : une unité par boîte, vente à la boîte, à qualifier.
    const fiche: FicheSynchro = {
      stockId: corps.id,
      medicamentId: medicament.id,
      nom: medicament.nom,
      nomGenerique: medicament.nomGenerique,
      categorie: medicament.categorie,
      formes: medicament.formes,
      ordonnanceRequise: medicament.ordonnanceRequise,
      prixUnitaire: prix,
      prixUnite: null,
      coefficientBoite: 1,
      uniteMinimale: "UNITE",
      deconditionnable: false,
      toleranceInventaire: null,
      qualifie: false,
      notes,
      quantite: 0,
      quantiteARegulariser: 0,
      lots: [],
    };
    const sequence = c.etat().prochaineSequence;
    c.stockage.executer("INSERT INTO fiches_creees_locales (stockId, sequence, medicamentId, document) VALUES (?, ?, ?, ?)", [corps.id, sequence, medicament.id, JSON.stringify(fiche)]);
    c.ajouterEvenement("FICHE_CREEE", u.id, {
      id: corps.id,
      medicamentId: medicament.id,
      ...(prix !== null ? { prixUnitaire: prix } : {}),
      ...(notes !== null ? { notes } : {}),
    });
    return { fiche: fichesLocales(c, corps.id)[0].fiche, cree: true };
  });
}

function sansAccents(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** Médicaments du catalogue allégé dont le nom ou le nom générique contient la recherche (accents et casse ignorés). */
export function rechercherCatalogueLocal(c: Contexte, recherche: string): Medicament[] {
  const q = sansAccents(recherche.trim());
  if (q.length < 2) return [];
  const sortie: Medicament[] = [];
  for (const ligne of c.stockage.lire<{ document: string }>("SELECT document FROM medicaments_catalogue ORDER BY rang")) {
    const m = JSON.parse(ligne.document) as MedicamentAllegeSynchro;
    if (!sansAccents(m.nom).includes(q) && !(m.nomGenerique !== null && sansAccents(m.nomGenerique).includes(q))) continue;
    sortie.push({
      id: m.id,
      nom: m.nom,
      nomGenerique: m.nomGenerique ?? undefined,
      categorie: m.categorie,
      ordonnanceRequise: m.ordonnanceRequise,
      formes: m.formes,
    });
  }
  sortie.sort((a, b) => a.nom.localeCompare(b.nom, "fr") || (a.id < b.id ? -1 : 1));
  return sortie.slice(0, RESULTATS_CATALOGUE_MAX);
}
