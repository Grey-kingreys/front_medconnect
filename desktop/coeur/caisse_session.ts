/**
 * Caisse du poste : sessions, comptages, mouvements, bilan, fermeture. Chaque opération
 * s'écrit avec son événement dans une seule transaction. Règles du back reprises :
 * src/pharmacie/caisse/sessions-caisse.service.ts et bilan-caisse.ts.
 */
import type {
  BilanCaisse,
  ComptageCaisse,
  LigneComptage,
  MouvementCaisse,
  SessionCaisse,
  SessionCaisseOuverte,
  TypeMouvementCaisse,
} from "@/lib/api_caisse";
import { CODE_ESPECES, calculerTheorique, ecartCaisse, totalComptage } from "@/lib/caisse/regles/caisse";
import type { Contexte } from "./contexte";
import {
  MESSAGES_MOUVEMENT,
  MESSAGE_COMPTAGE_FERMETURE_REQUIS,
  MESSAGE_COUPURES_EN_DOUBLE,
  MESSAGE_IDENTIFIANT_DEJA_UTILISE,
  MESSAGE_MOTIF_MOUVEMENT_REQUIS,
  MESSAGE_RELEVE_EN_DOUBLE,
  MESSAGE_RELEVE_ESPECES,
  MESSAGE_RELEVE_FERMETURE_SEULEMENT,
  MESSAGE_SESSION_AUTRE_VENDEUR,
  MESSAGE_SESSION_FERMEE,
  MESSAGE_SESSION_INTROUVABLE,
  messageCommentaireRequis,
  messageComptageDejaSaisi,
  messageCoupureInconnue,
  messageModeInconnu,
  messageSessionAutreUtilisateur,
} from "./messages";
import { RefusCaisse, exigerUuid, refusValidation } from "./refus";
import type { ComptageEntree, FermetureEntree, MouvementEntree, ReleveEntree, Utilisateur } from "./types_caisse";

export interface LigneSession {
  id: string;
  utilisateurId: string;
  utilisateurNom: string | null;
  statut: string;
  jourMetier: string;
  ouverteLe: string;
  fermeeLe: string | null;
  commentaireEcart: string | null;
  adoptee: number;
  ouverteAutomatiquement: number;
  bilanFige: string | null;
}

interface LigneMouvement {
  id: string;
  type: TypeMouvementCaisse;
  mode: string;
  montant: number;
  motif: string | null;
  auteurId: string;
  horodatage: string;
}

const entier = (v: unknown, min: number, max: number): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;

// ----------------------------------------------------------------------------- lecture

export function lireSession(c: Contexte, id: string): LigneSession | undefined {
  return c.stockage.lireUn<LigneSession>("SELECT * FROM sessions WHERE id = ?", [id]);
}

export function sessionOuverteLigne(c: Contexte): LigneSession | undefined {
  return c.stockage.lireUn<LigneSession>("SELECT * FROM sessions WHERE statut = 'OUVERTE' ORDER BY rowid LIMIT 1");
}

function lireComptages(c: Contexte, sessionId: string): ComptageCaisse[] {
  return c.stockage
    .lire<{ document: string }>("SELECT document FROM comptages WHERE sessionId = ? ORDER BY rowid", [sessionId])
    .map((l) => JSON.parse(l.document) as ComptageCaisse);
}

export function versSession(c: Contexte, s: LigneSession): SessionCaisse {
  const etat = c.etat();
  const comptages = lireComptages(c, s.id);
  const ouverture = comptages.find((x) => x.moment === "OUVERTURE") ?? null;
  return {
    id: s.id,
    poste: { id: etat.posteId ?? "", code: etat.posteCode ?? "", libelle: etat.posteLibelle ?? "", type: "DESKTOP" },
    utilisateurId: s.utilisateurId,
    utilisateurNom: s.utilisateurNom ?? "",
    statut: s.statut as SessionCaisse["statut"],
    jourMetier: s.jourMetier,
    ouverteLe: s.ouverteLe,
    fermeeLe: s.fermeeLe,
    commentaireEcart: s.commentaireEcart,
    fondCaisse: ouverture?.totalEspeces ?? 0,
    fondCompte: ouverture !== null,
    comptageOuverture: ouverture,
    comptageFermeture: comptages.find((x) => x.moment === "FERMETURE") ?? null,
  };
}

/** Une session connue de ce poste, à laquelle l'utilisateur a droit (le sien, ou superviseur). */
function sessionAccessible(c: Contexte, sessionId: string, u: Utilisateur): LigneSession {
  const s = lireSession(c, sessionId);
  if (!s) throw new RefusCaisse(404, "SESSION_INTROUVABLE", MESSAGE_SESSION_INTROUVABLE);
  if (s.utilisateurId !== u.id && !u.superviseur) {
    throw new RefusCaisse(403, "PERMISSION_REFUSEE", MESSAGE_SESSION_AUTRE_VENDEUR);
  }
  return s;
}

function exigerOuverte(s: LigneSession): void {
  if (s.statut !== "OUVERTE") throw new RefusCaisse(409, "SESSION_FERMEE", MESSAGE_SESSION_FERMEE);
}

// ----------------------------------------------------------------------------- ouverture

/** Ouvre une caisse (avec son événement). Le titulaire de la caisse déjà ouverte doit être `u`. */
export function creerSession(c: Contexte, id: string, u: Utilisateur, automatique: boolean): LigneSession {
  c.stockage.executer(
    "INSERT INTO sessions (id, utilisateurId, utilisateurNom, statut, jourMetier, ouverteLe, adoptee, ouverteAutomatiquement) VALUES (?, ?, ?, 'OUVERTE', ?, ?, 0, ?)",
    [id, u.id, u.nom, c.jour(), c.maintenant(), automatique ? 1 : 0],
  );
  c.ajouterEvenement("SESSION_OUVERTE", u.id, { sessionId: id });
  return lireSession(c, id) as LigneSession;
}

export function ouvrirSession(
  c: Contexte,
  entree: { id: string; comptage?: { coupures: LigneComptage[] } },
  u: Utilisateur,
): SessionCaisseOuverte {
  return c.stockage.transaction(() => {
    exigerUuid(entree.id, "de la caisse");
    c.referentielsRequis();
    let s: LigneSession | undefined;
    const connue = lireSession(c, entree.id);
    if (connue) {
      if (connue.utilisateurId !== u.id) {
        throw new RefusCaisse(409, "IDENTIFIANT_DEJA_UTILISE", MESSAGE_IDENTIFIANT_DEJA_UTILISE);
      }
      exigerOuverte(connue);
      s = connue;
    } else {
      const ouverte = sessionOuverteLigne(c);
      if (ouverte && ouverte.utilisateurId !== u.id) {
        throw new RefusCaisse(
          409,
          "SESSION_AUTRE_UTILISATEUR",
          messageSessionAutreUtilisateur(ouverte.utilisateurNom ?? "un autre vendeur"),
        );
      }
      s = ouverte;
    }
    const creee = s === undefined;
    if (s === undefined) s = creerSession(c, entree.id, u, false);
    if (entree.comptage && !lireComptages(c, s.id).some((x) => x.moment === "OUVERTURE")) {
      ecrireComptage(c, s, "OUVERTURE", { id: c.outils.genererId(), coupures: entree.comptage.coupures }, u, true);
    }
    return { ...versSession(c, s), cree: creee, ouverteMaintenant: creee };
  });
}

// ----------------------------------------------------------------------------- comptage

function validerCoupures(c: Contexte, coupures: LigneComptage[]): void {
  if (!Array.isArray(coupures) || coupures.length > 20) {
    throw refusValidation("Le comptage ne peut pas contenir plus de 20 coupures.");
  }
  for (const l of coupures) {
    if (!entier(l?.valeurFaciale, 1, 1_000_000)) throw refusValidation("La valeur d'un billet est invalide.");
    if (!entier(l.nombre, 0, 10_000)) {
      throw refusValidation("Le nombre de billets doit être compris entre 0 et 10 000.");
    }
  }
  if (new Set(coupures.map((l) => l.valeurFaciale)).size !== coupures.length) {
    throw refusValidation(MESSAGE_COUPURES_EN_DOUBLE);
  }
  const connues = new Set(
    c.referentielsRequis().coupures.filter((x) => x.devise === "GNF").map((x) => x.valeurFaciale),
  );
  for (const l of coupures) {
    if (!connues.has(l.valeurFaciale)) throw refusValidation(messageCoupureInconnue(l.valeurFaciale));
  }
}

function validerReleves(
  c: Contexte,
  moment: "OUVERTURE" | "FERMETURE",
  releves: ReleveEntree[],
): { mode: string; libelle: string; montant: number }[] {
  if (releves.length > 20) throw refusValidation("Un comptage ne peut pas contenir plus de 20 relevés.");
  if (moment === "OUVERTURE" && releves.length > 0) throw refusValidation(MESSAGE_RELEVE_FERMETURE_SEULEMENT);
  for (const r of releves) {
    if (!entier(r?.montant, 0, 1_000_000_000)) throw refusValidation("Le montant d'un relevé est invalide.");
  }
  if (new Set(releves.map((r) => r.mode)).size !== releves.length) throw refusValidation(MESSAGE_RELEVE_EN_DOUBLE);
  const modes = new Map(c.referentielsRequis().modesPaiement.map((m) => [m.code, m]));
  for (const r of releves) {
    if (!modes.has(r.mode)) throw new RefusCaisse(400, "MODE_PAIEMENT_INCONNU", messageModeInconnu(r.mode));
  }
  for (const r of releves) {
    if (modes.get(r.mode)?.comptagePhysique) throw refusValidation(MESSAGE_RELEVE_ESPECES);
  }
  return releves.map((r) => ({ mode: r.mode, libelle: modes.get(r.mode)?.libelle ?? r.mode, montant: r.montant }));
}

/** Écrit un comptage ; `emettre` ajoute l'événement COMPTAGE_SAISI (faux pour celui de la fermeture, porté par SESSION_FERMEE). */
function ecrireComptage(
  c: Contexte,
  s: LigneSession,
  moment: "OUVERTURE" | "FERMETURE",
  entree: Pick<ComptageEntree, "id" | "coupures" | "releves">,
  u: Utilisateur,
  emettre: boolean,
): { comptage: ComptageCaisse; cree: boolean } {
  const existant = lireComptages(c, s.id).find((x) => x.moment === moment);
  if (existant) {
    if (entree.id === existant.id) return { comptage: existant, cree: false };
    throw new RefusCaisse(409, "COMPTAGE_DEJA_SAISI", messageComptageDejaSaisi(moment));
  }
  if (c.stockage.lireUn("SELECT id FROM comptages WHERE id = ?", [entree.id])) {
    throw new RefusCaisse(409, "IDENTIFIANT_DEJA_UTILISE", MESSAGE_IDENTIFIANT_DEJA_UTILISE);
  }
  validerCoupures(c, entree.coupures);
  const releves = validerReleves(c, moment, entree.releves ?? []);
  const coupures = entree.coupures.map((l) => ({ valeurFaciale: l.valeurFaciale, nombre: l.nombre }));
  const comptage: ComptageCaisse = {
    id: entree.id,
    moment,
    totalEspeces: totalComptage(coupures),
    coupures,
    releves,
    auteurId: u.id,
    createdAt: c.maintenant(),
  };
  c.stockage.executer(
    "INSERT INTO comptages (id, sessionId, moment, document, totalEspeces, auteurId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [comptage.id, s.id, moment, JSON.stringify(comptage), comptage.totalEspeces, u.id, comptage.createdAt],
  );
  if (emettre) {
    c.ajouterEvenement("COMPTAGE_SAISI", u.id, {
      comptageId: comptage.id,
      sessionId: s.id,
      moment,
      coupures,
      ...(releves.length > 0 ? { releves: releves.map((r) => ({ mode: r.mode, montant: r.montant })) } : {}),
    });
  }
  return { comptage, cree: true };
}

export function saisirComptage(c: Contexte, sessionId: string, entree: ComptageEntree, u: Utilisateur): ComptageCaisse {
  return c.stockage.transaction(() => {
    exigerUuid(entree.id, "du comptage");
    const s = sessionAccessible(c, sessionId, u);
    exigerOuverte(s);
    return ecrireComptage(c, s, entree.moment, entree, u, true).comptage;
  });
}

// ----------------------------------------------------------------------------- mouvements

function versMouvement(m: LigneMouvement): MouvementCaisse {
  return {
    id: m.id,
    type: m.type,
    mode: m.mode,
    montant: m.montant,
    motif: m.motif ?? "",
    auteurId: m.auteurId,
    horodatageServeur: m.horodatage,
  };
}

const TYPES_MOUVEMENT: readonly string[] = ["PRELEVEMENT", "APPORT", "REMBOURSEMENT"];

export function enregistrerMouvement(
  c: Contexte,
  sessionId: string,
  entree: MouvementEntree,
  u: Utilisateur,
): MouvementCaisse {
  return c.stockage.transaction(() => {
    exigerUuid(entree.id, "du mouvement");
    const motif = (entree.motif ?? "").trim();
    if (motif.length < 3) throw new RefusCaisse(400, "MOTIF_REQUIS", MESSAGE_MOTIF_MOUVEMENT_REQUIS);
    if (motif.length > 300) throw refusValidation("Le motif ne doit pas dépasser 300 caractères.");
    if (!TYPES_MOUVEMENT.includes(entree.type)) throw refusValidation("Le type de mouvement est invalide.");
    if (!entier(entree.montant, 1, 100_000_000)) {
      throw refusValidation("Le montant doit être compris entre 1 et 100 000 000 GNF.");
    }
    const s = sessionAccessible(c, sessionId, u);
    exigerOuverte(s);
    const existant = c.stockage.lireUn<LigneMouvement & { sessionId: string }>(
      "SELECT * FROM mouvements_caisse WHERE id = ?",
      [entree.id],
    );
    if (existant) {
      if (existant.sessionId === sessionId) return versMouvement(existant);
      throw new RefusCaisse(409, "IDENTIFIANT_DEJA_UTILISE", MESSAGE_IDENTIFIANT_DEJA_UTILISE);
    }
    const mode = entree.mode ?? CODE_ESPECES;
    if (!c.referentielsRequis().modesPaiement.some((m) => m.code === mode)) {
      throw new RefusCaisse(400, "MODE_PAIEMENT_INCONNU", messageModeInconnu(mode));
    }
    const ligne: LigneMouvement = {
      id: entree.id,
      type: entree.type,
      mode,
      montant: entree.montant,
      motif,
      auteurId: u.id,
      horodatage: c.maintenant(),
    };
    c.stockage.executer(
      "INSERT INTO mouvements_caisse (id, sessionId, type, mode, montant, motif, auteurId, horodatage) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [ligne.id, sessionId, ligne.type, ligne.mode, ligne.montant, ligne.motif, ligne.auteurId, ligne.horodatage],
    );
    c.ajouterEvenement("MOUVEMENT_CAISSE", u.id, {
      mouvementId: ligne.id,
      sessionId,
      type: ligne.type,
      montant: ligne.montant,
      motif,
      ...(entree.mode !== undefined ? { mode: entree.mode } : {}),
    });
    return versMouvement(ligne);
  });
}

/** Message de succès d'un mouvement, comme le serveur (pour l'écran). */
export function messageMouvement(type: TypeMouvementCaisse): string {
  return MESSAGES_MOUVEMENT[type];
}

// ----------------------------------------------------------------------------- bilan

export function calculerBilan(c: Contexte, s: LigneSession, fige: boolean): BilanCaisse {
  const ref = c.referentielsRequis();
  const modesRef = [...ref.modesPaiement].sort((a, b) => a.ordre - b.ordre || a.code.localeCompare(b.code));
  const paiements = c.stockage.lire<{ mode: string; montant: number }>(
    "SELECT mode, montant FROM paiements_locaux WHERE sessionId = ?",
    [s.id],
  );
  const mouvements = c.stockage.lire<LigneMouvement>(
    "SELECT * FROM mouvements_caisse WHERE sessionId = ? ORDER BY horodatage, rowid",
    [s.id],
  );
  const libelles = new Map(modesRef.map((m) => [m.code, m.libelle]));
  const codes = modesRef.map((m) => m.code);
  // Un mode retiré du référentiel depuis garde son argent : il reste compté.
  for (const code of [...paiements.map((p) => p.mode), ...mouvements.map((m) => m.mode)]) {
    if (!libelles.has(code)) {
      libelles.set(code, code);
      codes.push(code);
    }
  }
  const comptages = lireComptages(c, s.id);
  const ouverture = comptages.find((x) => x.moment === "OUVERTURE");
  const fermeture = comptages.find((x) => x.moment === "FERMETURE");
  const fond = ouverture?.totalEspeces ?? 0;
  const theoriques = calculerTheorique({
    modes: codes,
    fondEspeces: fond,
    paiements,
    mouvements: mouvements.map((m) => ({ type: m.type, mode: m.mode, montant: m.montant })),
  });
  const resultats = theoriques.map(({ mode, theorique }) => {
    const compte =
      mode === CODE_ESPECES
        ? (fermeture?.totalEspeces ?? null)
        : (fermeture?.releves.find((r) => r.mode === mode)?.montant ?? null);
    return { mode, libelle: libelles.get(mode) ?? mode, theorique, compte, ecart: ecartCaisse(compte, theorique) };
  });
  const ecartEspeces = resultats.find((r) => r.mode === CODE_ESPECES)?.ecart ?? null;
  const seuil = ref.parametres.seuilEcartCaisse;
  const nombre = (sql: string) => c.stockage.lireUn<{ n: number }>(sql, [s.id])?.n ?? 0;
  return {
    activite: {
      nombreVentes: nombre("SELECT COUNT(*) AS n FROM ventes WHERE sessionId = ? AND typePiece = 'VENTE'"),
      nombreAnnulations: nombre("SELECT COUNT(*) AS n FROM ventes WHERE sessionId = ? AND typePiece = 'ANNULATION'"),
      montantEncaisse: paiements.reduce((somme, p) => somme + p.montant, 0),
      parMode: codes
        .map((code) => {
          const siens = paiements.filter((p) => p.mode === code);
          return {
            mode: code,
            libelle: libelles.get(code) ?? code,
            montant: siens.reduce((somme, p) => somme + p.montant, 0),
            nombrePaiements: siens.length,
          };
        })
        .filter((m) => m.nombrePaiements > 0),
    },
    session: versSession(c, s),
    fond: { montant: fond, compte: ouverture !== undefined },
    mouvements: mouvements.map(versMouvement),
    theorique: resultats.map((r) => ({ mode: r.mode, libelle: r.libelle, montant: r.theorique })),
    compte: resultats.map((r) => ({ mode: r.mode, libelle: r.libelle, montant: r.compte })),
    ecarts: resultats.map((r) => ({ mode: r.mode, libelle: r.libelle, ecart: r.ecart })),
    ecartEspeces,
    seuilEcartCaisse: seuil,
    commentaireRequis: ecartEspeces !== null && Math.abs(ecartEspeces) > seuil,
    fige,
  };
}

export function bilan(c: Contexte, sessionId: string, u: Utilisateur): BilanCaisse {
  const s = sessionAccessible(c, sessionId, u);
  if (s.statut !== "OUVERTE" && s.bilanFige !== null) return JSON.parse(s.bilanFige) as BilanCaisse;
  return calculerBilan(c, s, s.statut !== "OUVERTE");
}

// ----------------------------------------------------------------------------- fermeture

export function fermerSession(c: Contexte, sessionId: string, entree: FermetureEntree, u: Utilisateur): BilanCaisse {
  return c.stockage.transaction(() => {
    const s = sessionAccessible(c, sessionId, u);
    if (s.statut !== "OUVERTE") {
      // Déjà fermée : on rejoue le bilan figé, sans nouvel événement.
      return s.bilanFige !== null ? (JSON.parse(s.bilanFige) as BilanCaisse) : calculerBilan(c, s, true);
    }
    const commentaire = (entree.commentaire ?? "").trim();
    if (commentaire.length > 500) throw refusValidation("Le commentaire ne doit pas dépasser 500 caractères.");

    let integre: ComptageCaisse | null = null;
    const donne = entree.comptageFermeture;
    if (donne) {
      exigerUuid(donne.id, "du comptage");
      const resultat = ecrireComptage(c, s, "FERMETURE", donne, u, false);
      // Un comptage déjà envoyé seul (COMPTAGE_SAISI) n'est pas répété dans l'événement de fermeture.
      if (resultat.cree) integre = resultat.comptage;
    }
    if (!lireComptages(c, s.id).some((x) => x.moment === "FERMETURE")) {
      throw new RefusCaisse(400, "COMPTAGE_FERMETURE_REQUIS", MESSAGE_COMPTAGE_FERMETURE_REQUIS);
    }
    const avant = calculerBilan(c, s, false);
    if (avant.commentaireRequis && commentaire.length < 3) {
      throw new RefusCaisse(
        400,
        "COMMENTAIRE_ECART_REQUIS",
        messageCommentaireRequis(avant.ecartEspeces as number, avant.seuilEcartCaisse),
      );
    }
    const avecCommentaire = commentaire.length >= 3;
    c.stockage.executer("UPDATE sessions SET statut = 'FERMEE', fermeeLe = ?, commentaireEcart = ? WHERE id = ?", [
      c.maintenant(),
      avecCommentaire ? commentaire : null,
      s.id,
    ]);
    const figee = calculerBilan(c, lireSession(c, s.id) as LigneSession, true);
    c.stockage.executer("UPDATE sessions SET bilanFige = ? WHERE id = ?", [JSON.stringify(figee), s.id]);
    c.ajouterEvenement("SESSION_FERMEE", u.id, {
      sessionId: s.id,
      ...(integre
        ? {
            comptageFermeture: {
              comptageId: integre.id,
              coupures: integre.coupures,
              ...(integre.releves.length > 0
                ? { releves: integre.releves.map((r) => ({ mode: r.mode, montant: r.montant })) }
                : {}),
            },
          }
        : {}),
      ...(avecCommentaire ? { commentaire } : {}),
    });
    return figee;
  });
}
