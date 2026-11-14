import { z } from "zod";

/**
 * Schémas des messages du pont, utilisés par le processus principal d'Electron (jamais par les écrans).
 * Chaque méthode de `PontDesktop` a un schéma de la liste de ses arguments.
 */

const identifiant = z.string().min(1).max(100);
const montant = z.number().int().min(0).max(2_147_483_647);
const coupure = z.object({ valeurFaciale: z.number().int().positive().max(1_000_000), nombre: z.number().int().min(0).max(100_000) }).strict();
const releve = z.object({ mode: identifiant, montant }).strict();

const corpsOuverture = z
  .object({ id: identifiant, posteId: identifiant.optional(), comptage: z.object({ coupures: z.array(coupure).max(50) }).strict().optional() })
  .strict();

const corpsComptage = z
  .object({
    id: identifiant,
    moment: z.enum(["OUVERTURE", "FERMETURE"]),
    coupures: z.array(coupure).max(50),
    releves: z.array(releve).max(20).optional(),
  })
  .strict();

const corpsMouvement = z
  .object({
    id: identifiant,
    type: z.enum(["PRELEVEMENT", "APPORT", "REMBOURSEMENT"]),
    montant: montant.refine((m) => m > 0),
    motif: z.string().max(300),
    mode: identifiant.optional(),
  })
  .strict();

const corpsFermeture = z
  .object({
    comptageFermeture: z
      .object({ id: identifiant, coupures: z.array(coupure).max(50), releves: z.array(releve).max(20).optional() })
      .strict()
      .optional(),
    commentaire: z.string().max(500).optional(),
  })
  .strict();

const ligneVente = z
  .object({
    stockId: identifiant,
    quantite: z.number().int().min(1).max(1_000_000),
    unite: z.enum(["BOITE", "UNITE"]).optional(),
    sortieManuelle: z.object({ lotId: identifiant, motif: z.string().max(300) }).strict().optional(),
  })
  .strict();

const paiement = z
  .object({ mode: identifiant, montant, reference: z.string().max(100).optional(), montantRecu: montant.optional() })
  .strict();

const corpsVente = z
  .object({
    lignes: z.array(ligneVente).min(1).max(50),
    paiements: z.array(paiement).max(5).optional(),
    clientNom: z.string().max(100).optional(),
    clientTelephone: z.string().max(30).optional(),
    ordonnanceVerifiee: z.boolean().optional(),
    telephonePrescripteur: z.string().max(30).optional(),
  })
  .strict();

const optionsListe = z
  .object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), page: z.number().int().min(1).max(100_000).optional() })
  .strict();

/** Réponse d'annulation du serveur : seuls les champs que le cœur lit sont contrôlés. */
const reponseAnnulation = z
  .object({
    id: identifiant,
    annulation: z
      .object({ id: identifiant, posteId: identifiant, sessionCaisseId: identifiant, jourMetier: z.string().max(20) })
      .passthrough(),
  })
  .passthrough();

export const schemasPont = {
  chargerStock: z.tuple([identifiant]),
  chargerReferentiels: z.tuple([identifiant]),
  etatCaisse: z.tuple([identifiant, identifiant]),
  creerVente: z.tuple([identifiant, corpsVente, identifiant]),
  ouvrirSession: z.tuple([identifiant, corpsOuverture]),
  saisirComptage: z.tuple([identifiant, identifiant, corpsComptage]),
  enregistrerMouvement: z.tuple([identifiant, identifiant, corpsMouvement]),
  getBilan: z.tuple([identifiant, identifiant]),
  fermerSession: z.tuple([identifiant, identifiant, corpsFermeture]),
  listerVentes: z.tuple([identifiant, optionsListe]),
  getVente: z.tuple([identifiant, identifiant]),
  enregistrerAnnulationServeur: z.tuple([reponseAnnulation]),
} as const;

export type NomMethodeCaisse = keyof typeof schemasPont;

/**
 * Domaines du pont. Chaque domaine a sa liste de messages (nom, schéma des arguments) et ses permissions
 * (`permissions_pont.ts`). Les domaines pharmacie à venir sont déclarés vides : ils sont prêts à recevoir leurs
 * fonctions, une par une, sans changer ni `ipc.ts`, ni `preload.ts`, ni la passerelle.
 */
type SchemasDomaine = Record<string, { safeParse(v: unknown): { success: boolean; data?: unknown } }>;

const uuid = z.string().uuid();

const corpsSortieStock = z
  .object({
    id: uuid,
    stockId: identifiant,
    lotId: identifiant,
    unite: z.enum(["BOITE", "UNITE"]),
    quantite: z.number().int().min(1).max(1_000_000_000),
    raison: z.enum(["PERIME", "CASSE", "PERDU", "RETOUR_FOURNISSEUR", "AUTRE"]).optional(),
    commentaire: z.string().max(300).optional(),
  })
  .strict();

const corpsCorrectionQuantite = z
  .object({
    id: uuid,
    lotId: identifiant.optional(),
    variation: z.number().int().min(-1_000_000_000).max(1_000_000_000).refine((v) => v !== 0),
    motif: z.string().max(300),
    notes: z.string().max(500).optional(),
  })
  .strict();

/** Fonctions du domaine `stock` : sortie de stock et correction de quantité (permission `stock:write`). */
export const schemasStock = {
  sortir: z.tuple([identifiant, corpsSortieStock]),
  corriger: z.tuple([identifiant, identifiant, corpsCorrectionQuantite]),
} as const;

export type NomMethodeStock = keyof typeof schemasStock;

export const DOMAINES_PONT = ["caisse", "stock", "reception", "inventaire", "credit", "anomalie"] as const;
export type DomainePont = (typeof DOMAINES_PONT)[number];

export const schemasParDomaine: Record<DomainePont, SchemasDomaine> = {
  caisse: schemasPont as unknown as SchemasDomaine,
  stock: schemasStock as unknown as SchemasDomaine,
  reception: {},
  inventaire: {},
  credit: {},
  anomalie: {},
};

export function estDomainePont(nom: string): nom is DomainePont {
  return (DOMAINES_PONT as readonly string[]).includes(nom);
}

/** Messages d'impression : identifiant de vente en UUID, réglages partiels et stricts. */
export const schemasImpression = {
  listerImprimantes: z.tuple([]),
  lireReglages: z.tuple([]),
  enregistrerReglages: z.tuple([
    z
      .object({
        imprimante: z.string().min(1).max(300).nullable().optional(),
        formatRecu: z.enum(["58", "80", "A4"]).optional(),
        impressionAutomatique: z.boolean().optional(),
      })
      .strict(),
  ]),
  lireInfosPoste: z.tuple([]),
  ouvrirDossierDonnees: z.tuple([]),
  imprimerVente: z.tuple([z.string().uuid()]),
} as const;

export type NomMethodeImpression = keyof typeof schemasImpression;

export const schemaJeton = z.tuple([z.string().min(1).max(8192).nullable()]);

export const schemaUtilisateur = z.tuple([
  z
    .object({
      id: identifiant,
      nom: z.string().max(200),
      structureId: identifiant,
      permissions: z.array(z.string().max(100)).max(300),
    })
    .strict()
    .nullable(),
]);
