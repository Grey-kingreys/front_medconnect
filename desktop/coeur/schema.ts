import type { Stockage } from "./stockage";

/**
 * Migrations du schéma local, ordonnées. La version est `PRAGMA user_version` :
 * une étape par version, chacune dans sa transaction (D740). Ne jamais modifier une
 * étape déjà livrée : ajouter la suivante.
 */
const ETAPES: string[] = [
  // Version 1.
  `
  CREATE TABLE etat_poste (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    appareilId TEXT,
    structureId TEXT,
    posteId TEXT,
    posteCode TEXT,
    posteLibelle TEXT,
    ordrePointDeVente INTEGER,
    pointDeVenteId TEXT,
    sequenceAppliquee INTEGER NOT NULL DEFAULT 0,
    prochaineSequence INTEGER NOT NULL DEFAULT 1,
    etag TEXT,
    photographieLe TEXT,
    heureServeurEcartMs INTEGER,
    prochainSecours INTEGER NOT NULL DEFAULT 1
  );
  INSERT INTO etat_poste (id) VALUES (1);

  CREATE TABLE pharmacie (id INTEGER PRIMARY KEY CHECK (id = 1), document TEXT NOT NULL);
  CREATE TABLE parametres (id INTEGER PRIMARY KEY CHECK (id = 1), document TEXT NOT NULL);
  CREATE TABLE modes_paiement (id INTEGER PRIMARY KEY CHECK (id = 1), document TEXT NOT NULL);
  CREATE TABLE coupures (id INTEGER PRIMARY KEY CHECK (id = 1), document TEXT NOT NULL);

  CREATE TABLE fiches (
    stockId TEXT PRIMARY KEY,
    document TEXT NOT NULL,
    nom TEXT NOT NULL
  );

  CREATE TABLE plages (
    id TEXT PRIMARY KEY,
    debut INTEGER NOT NULL,
    fin INTEGER NOT NULL,
    dernierUtilise INTEGER
  );

  CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    utilisateurId TEXT NOT NULL,
    utilisateurNom TEXT,
    statut TEXT NOT NULL,
    jourMetier TEXT NOT NULL,
    ouverteLe TEXT NOT NULL,
    fermeeLe TEXT,
    commentaireEcart TEXT,
    adoptee INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE comptages (
    id TEXT PRIMARY KEY,
    sessionId TEXT NOT NULL,
    moment TEXT NOT NULL,
    document TEXT NOT NULL,
    totalEspeces INTEGER NOT NULL,
    auteurId TEXT NOT NULL,
    createdAt TEXT NOT NULL
  );

  CREATE TABLE mouvements_caisse (
    id TEXT PRIMARY KEY,
    sessionId TEXT NOT NULL,
    type TEXT NOT NULL,
    mode TEXT NOT NULL,
    montant INTEGER NOT NULL,
    motif TEXT,
    auteurId TEXT NOT NULL,
    horodatage TEXT NOT NULL
  );

  CREATE TABLE ventes (
    id TEXT PRIMARY KEY,
    sequence INTEGER NOT NULL,
    sessionId TEXT NOT NULL,
    jourMetier TEXT NOT NULL,
    numero TEXT NOT NULL,
    total INTEGER NOT NULL,
    document TEXT NOT NULL,
    createdAt TEXT NOT NULL
  );

  CREATE TABLE sorties_stock (
    venteId TEXT NOT NULL,
    sequence INTEGER NOT NULL,
    stockId TEXT NOT NULL,
    lotId TEXT,
    quantiteUm INTEGER NOT NULL
  );
  CREATE INDEX sorties_stock_fiche ON sorties_stock (stockId, sequence);

  CREATE TABLE paiements_locaux (
    venteId TEXT NOT NULL,
    sessionId TEXT NOT NULL,
    mode TEXT NOT NULL,
    montant INTEGER NOT NULL
  );

  CREATE TABLE evenements (
    sequence INTEGER PRIMARY KEY,
    evenementId TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL,
    horodatageLocal TEXT NOT NULL,
    utilisateurId TEXT NOT NULL,
    corps TEXT NOT NULL,
    statut TEXT NOT NULL CHECK (statut IN ('A_ENVOYER', 'ENVOYE', 'EN_ATTENTE', 'REJETE')),
    code TEXT,
    message TEXT
  );

  CREATE TABLE profil_local (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    document TEXT NOT NULL,
    utilisateurId TEXT NOT NULL,
    enregistreLe TEXT NOT NULL
  );
  `,
  // Version 2 (PD02b) : caisse ouverte par une vente, bilan figé à la fermeture.
  `
  ALTER TABLE sessions ADD COLUMN ouverteAutomatiquement INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE sessions ADD COLUMN bilanFige TEXT;
  ALTER TABLE ventes ADD COLUMN typePiece TEXT NOT NULL DEFAULT 'VENTE';
  `,
  // Version 3 (PD03) : identifiant de la demande de plage en cours, rejoué tel quel si la réponse s'est perdue (D632).
  `
  ALTER TABLE etat_poste ADD COLUMN plageDemandeeId TEXT;
  `,
  // Version 4 (PD05) : réglages du poste (imprimante, format du ticket, impression automatique), clé et valeur en texte.
  `
  CREATE TABLE reglages (
    cle TEXT PRIMARY KEY,
    valeur TEXT NOT NULL
  );
  `,
];

export const VERSION_SCHEMA = ETAPES.length;

/**
 * Amène la base à la dernière version. Une base plus récente que l'application
 * (mise à jour annulée, application plus ancienne) est refusée sans rien écrire (D740).
 */
export function migrer(stockage: Stockage, versionCible: number = VERSION_SCHEMA): void {
  const actuelle = stockage.lireUn<{ user_version: number }>("PRAGMA user_version")?.user_version ?? 0;
  if (actuelle > VERSION_SCHEMA) {
    throw new Error(
      `La base locale est de version ${actuelle}, plus récente que cette application (version ${VERSION_SCHEMA}). Mettez l'application à jour.`,
    );
  }
  for (let version = actuelle + 1; version <= Math.min(versionCible, VERSION_SCHEMA); version++) {
    stockage.transaction(() => {
      stockage.executer(ETAPES[version - 1]);
      stockage.executer(`PRAGMA user_version = ${version}`);
    });
  }
}
