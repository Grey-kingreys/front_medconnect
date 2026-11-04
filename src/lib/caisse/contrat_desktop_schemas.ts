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
