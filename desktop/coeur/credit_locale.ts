/**
 * Cahier de crédit utilisable sans réseau. La lecture part de la dernière photographie (clients, prises, remboursements,
 * dates limites, sans aucun coût) puis y ajoute ce qui a été fait sur ce poste et que le serveur n'a pas encore appliqué
 * (séquence plus grande que la séquence appliquée de la photographie, même règle que les mouvements de stock). Le reste
 * à payer et le statut se calculent ici, avec les mêmes règles que le serveur (`regles/credit.ts`) et l'horloge du poste
 * pour le retard. Chaque écriture est une transaction : ligne locale et événement du journal ensemble.
 *
 * Un remboursement qui dépasserait le reste est refusé sur le poste (comme sur le web). Seul le rejeu sur le serveur
 * peut le voir dépasser (deux postes ont encaissé) : il l'accepte alors et signale un trop-perçu.
 */
import type {
  ClientCreditResume,
  CorpsClientCredit,
  CorpsModifClientCredit,
  FicheClientCredit,
  FiltreStatutCredit,
  ListeCredits,
  PriseCredit,
  RemboursementCredit,
  ResultatRemboursement,
  StatutCredit,
} from "@/lib/api_credit";
import type { Vente } from "@/lib/api_ventes";
import { calculerEtatCredit, chiffres, normaliser, resumerMedicaments, type EtatCredit, type PriseCalcul } from "@/lib/caisse/regles/credit";
import { sessionOuverteLigne } from "./caisse_session";
import type { Contexte } from "./contexte";
import { exigerUuid, RefusCaisse, refusValidation } from "./refus";
import type { Utilisateur } from "./types_caisse";
import type { ClientCreditSynchro, PriseCreditSynchro, RemboursementCreditSynchro } from "./types_synchro";

export const PAR_PAGE_CREDITS = 50;
const ENTIER_MAX = 2_147_483_647;

// Messages repris à la lettre de back_medconnect : src/pharmacie/credit/credit.service.ts.
export const MESSAGE_CLIENT_CREDIT_INTROUVABLE = "Ce client de crédit est introuvable.";
export const MESSAGE_PRISE_INTROUVABLE = "Cette prise à crédit est introuvable.";
export const MESSAGE_CREDIT_DEJA_SOLDE = "Ce client ne doit plus rien.";
export const MESSAGE_CAISSE_NON_OUVERTE =
  "Aucune caisse ouverte à votre nom : ouvrez votre caisse pour y verser cet argent, ou décochez « Mettre cet argent dans ma caisse ».";
export const MESSAGE_PRISE_ANNULEE = "Cette prise a été annulée : elle ne compte plus dans ce que le client doit.";
export const MESSAGE_PRISE_SOLDEE = "Cette prise est déjà soldée : sa date limite ne se modifie plus.";
export const MESSAGE_DATE_LIMITE_PASSEE = "La date limite ne peut pas être antérieure à aujourd'hui.";
export const MESSAGE_DATE_LIMITE_INVALIDE = "La date limite doit être une date valide (AAAA-MM-JJ).";
export const MESSAGE_NOM_CLIENT_CREDIT = "Le nom complet du client est obligatoire (2 à 100 caractères).";
export const MESSAGE_TELEPHONE_CLIENT_CREDIT =
  "Le téléphone du client ne doit contenir que des chiffres, espaces, + et tirets (6 à 20 chiffres).";
export const MESSAGE_CLIENT_CREDIT_ENREGISTRE = "Client de crédit enregistré sur ce poste.";
export const MESSAGE_CLIENT_CREDIT_MODIFIE = "Client de crédit mis à jour sur ce poste.";
export const MESSAGE_DATE_LIMITE_ENREGISTREE = "Date limite enregistrée sur ce poste.";
export const MESSAGE_DATE_LIMITE_RETIREE = "Date limite retirée sur ce poste.";

export function messageMontantSuperieurAuReste(reste: number): string {
  return `Le montant dépasse ce que le client doit : il reste ${formaterGnf(reste)} GNF à payer.`;
}

export function messageRemboursementEnregistre(reste: number): string {
  return reste === 0 ? "Remboursement enregistré sur ce poste : le crédit est soldé." : `Remboursement enregistré sur ce poste : il reste ${formaterGnf(reste)} GNF à payer.`;
}

function formaterGnf(montant: number): string {
  return String(montant).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

const ORDRE_STATUT: Record<StatutCredit, number> = { EN_RETARD: 0, EN_COURS: 1, SOLDE: 2 };

// ------------------------------------------------------------------------------------------ lecture

interface PriseInterne {
  venteId: string;
  numero: string;
  createdAt: string;
  jourMetier: string;
  vendeurNom: string;
  total: number;
  annulee: boolean;
  motifAnnulation: string | null;
  dateLimite: string | null;
  lignes: PriseCredit["lignes"];
}

interface RemboursementInterne {
  id: string;
  montant: number;
  note: string | null;
  verseEnCaisse: boolean;
  auteurNom: string;
  createdAt: string;
  mouvementCaisseId: string | null;
}

interface ClientInterne {
  /** Historique retiré de la photographie : compté dans le reste, mais sans détail. */
  anterieurPris: number;
  anterieurRembourse: number;
  id: string;
  nomComplet: string;
  telephone: string | null;
  note: string | null;
  createdAt: string;
  prises: PriseInterne[];
  remboursements: RemboursementInterne[];
}

interface ClientCalcule {
  client: ClientInterne;
  etat: EtatCredit;
}

function depuisPrisePhoto(p: PriseCreditSynchro): PriseInterne {
  return {
    venteId: p.venteId,
    numero: p.numero,
    createdAt: p.createdAt,
    jourMetier: p.jourMetier,
    vendeurNom: p.vendeurNom,
    total: p.total,
    annulee: p.annulee,
    motifAnnulation: p.motifAnnulation,
    dateLimite: p.dateLimite,
    // La photographie ne donne que le nombre affiché : c'est aussi ce que la fiche montre.
    lignes: p.lignes.map((l) => ({ nomMedicament: l.nomMedicament, quantite: l.nombreAffiche, nombreAffiche: l.nombreAffiche, uniteAffichee: l.uniteAffichee, sousTotal: l.sousTotal })),
  };
}

function depuisRemboursementPhoto(r: RemboursementCreditSynchro): RemboursementInterne {
  return { id: r.id, montant: r.montant, note: r.note, verseEnCaisse: r.verseEnCaisse, auteurNom: r.auteurNom ?? "", createdAt: r.createdAt, mouvementCaisseId: null };
}

/** Clients de la photographie plus ce qui a été fait ici et pas encore appliqué par le serveur. */
function construireClients(c: Contexte): ClientInterne[] {
  const appliquee = c.etat().sequenceAppliquee;
  const clients = new Map<string, ClientInterne>();
  for (const l of c.stockage.lire<{ document: string }>("SELECT document FROM clients_credit_photo ORDER BY rang")) {
    const p = JSON.parse(l.document) as ClientCreditSynchro;
    clients.set(p.id, {
      id: p.id,
      nomComplet: p.nomComplet,
      telephone: p.telephone,
      note: p.note,
      createdAt: p.createdAt,
      anterieurPris: p.anterieur?.totalPris ?? 0,
      anterieurRembourse: p.anterieur?.totalRembourse ?? 0,
      prises: p.prises.map(depuisPrisePhoto),
      remboursements: p.remboursements.map(depuisRemboursementPhoto),
    });
  }
  for (const l of c.stockage.lire<{ id: string; nomComplet: string; telephone: string | null; note: string | null; creeLe: string }>(
    "SELECT id, nomComplet, telephone, note, creeLe FROM clients_credit_locaux WHERE sequence > ? ORDER BY sequence",
    [appliquee],
  )) {
    if (clients.has(l.id)) continue;
    clients.set(l.id, { id: l.id, nomComplet: l.nomComplet, telephone: l.telephone, note: l.note, createdAt: l.creeLe, anterieurPris: 0, anterieurRembourse: 0, prises: [], remboursements: [] });
  }
  for (const m of c.stockage.lire<{ clientId: string; champ: string; valeur: string }>(
    "SELECT clientId, champ, valeur FROM clients_credit_modifies_locaux WHERE sequence > ? ORDER BY id",
    [appliquee],
  )) {
    const client = clients.get(m.clientId);
    if (client === undefined) continue;
    const valeur = JSON.parse(m.valeur) as string | null;
    if (m.champ === "nomComplet" && valeur !== null) client.nomComplet = valeur;
    else if (m.champ === "telephone") client.telephone = valeur;
    else if (m.champ === "note") client.note = valeur;
  }

  const prisesPhoto = new Set([...clients.values()].flatMap((cl) => cl.prises.map((p) => p.venteId)));
  for (const l of c.stockage.lire<{ venteId: string; clientId: string; dateLimite: string | null; document: string | null }>(
    "SELECT p.venteId, p.clientId, p.dateLimite, v.document FROM prises_credit_locales p LEFT JOIN ventes v ON v.id = p.venteId WHERE p.sequence > ? ORDER BY p.sequence",
    [appliquee],
  )) {
    const client = clients.get(l.clientId);
    if (client === undefined || l.document === null || prisesPhoto.has(l.venteId)) continue;
    const v = JSON.parse(l.document) as Vente;
    client.prises.push({
      venteId: v.id,
      numero: v.numero,
      createdAt: v.createdAt,
      jourMetier: v.jourMetier,
      vendeurNom: v.vendeur.nom,
      total: v.total,
      annulee: v.statut === "ANNULEE",
      motifAnnulation: v.statut === "ANNULEE" ? v.motifAnnulation : null,
      dateLimite: l.dateLimite,
      lignes: v.lignes.map((x) => ({ nomMedicament: x.nomMedicament, quantite: x.quantite, nombreAffiche: x.nombreAffiche, uniteAffichee: x.uniteAffichee, sousTotal: x.sousTotal })),
    });
  }

  const rembPhoto = new Set([...clients.values()].flatMap((cl) => cl.remboursements.map((r) => r.id)));
  for (const l of c.stockage.lire<{ id: string; clientId: string; montant: number; note: string | null; verseEnCaisse: number; auteurNom: string; creeLe: string }>(
    "SELECT id, clientId, montant, note, verseEnCaisse, auteurNom, creeLe FROM remboursements_credit_locaux WHERE sequence > ? ORDER BY sequence",
    [appliquee],
  )) {
    const client = clients.get(l.clientId);
    if (client === undefined || rembPhoto.has(l.id)) continue;
    client.remboursements.push({
      id: l.id,
      montant: l.montant,
      note: l.note,
      verseEnCaisse: l.verseEnCaisse === 1,
      auteurNom: l.auteurNom,
      createdAt: l.creeLe,
      mouvementCaisseId: l.verseEnCaisse === 1 ? l.id : null,
    });
  }

  // Dates limites modifiées ici : la dernière gagne.
  for (const d of c.stockage.lire<{ venteId: string; dateLimite: string | null }>(
    "SELECT venteId, dateLimite FROM dates_limites_locales WHERE sequence > ? ORDER BY id",
    [appliquee],
  )) {
    for (const client of clients.values()) {
      const prise = client.prises.find((p) => p.venteId === d.venteId);
      if (prise) prise.dateLimite = d.dateLimite;
    }
  }
  return [...clients.values()];
}

const ANTERIEUR = "__anterieur__";

function calculer(c: Contexte, client: ClientInterne): ClientCalcule {
  const prises: PriseCalcul[] = client.prises.map((p) => ({ venteId: p.venteId, total: p.total, annulee: p.annulee, dateLimite: p.dateLimite, createdAt: p.createdAt }));
  // L'historique retiré de la photographie pèse comme une prise la plus ancienne : le reste reste exact.
  if (client.anterieurPris > 0) prises.push({ venteId: ANTERIEUR, total: client.anterieurPris, annulee: false, dateLimite: null, createdAt: "" });
  const rembourse = client.anterieurRembourse + client.remboursements.reduce((s, r) => s + r.montant, 0);
  const etat = calculerEtatCredit(prises, rembourse, c.jour());
  return { client, etat: { ...etat, prises: etat.prises.filter((p) => p.venteId !== ANTERIEUR) } };
}

function clientsCalcules(c: Contexte): ClientCalcule[] {
  return construireClients(c).map((cl) => calculer(c, cl));
}

function trouver(c: Contexte, clientId: string): ClientCalcule {
  const trouve = clientsCalcules(c).find((x) => x.client.id === clientId);
  if (!trouve) throw new RefusCaisse(404, "CLIENT_CREDIT_INTROUVABLE", MESSAGE_CLIENT_CREDIT_INTROUVABLE);
  return trouve;
}

export interface OptionsListeCredits {
  q?: string;
  statut?: FiltreStatutCredit;
  page?: number;
  parPage?: number;
}

/** Liste au format de la route du serveur : filtre, tri (retard, en cours, soldé), pagination. */
export function listerCreditsLocaux(c: Contexte, options: OptionsListeCredits = {}): ListeCredits {
  const q = normaliser(options.q ?? "");
  const chiffresQ = chiffres(options.q ?? "");
  const lignes: ClientCreditResume[] = [];
  for (const { client, etat } of clientsCalcules(c)) {
    if (q !== "") {
      const dansNom = normaliser(client.nomComplet).includes(q);
      const dansTel = chiffresQ.length >= 2 && chiffres(client.telephone ?? "").includes(chiffresQ);
      if (!dansNom && !dansTel) continue;
    }
    if (options.statut !== undefined && options.statut !== "TOUS" && etat.statut !== options.statut) continue;
    const parId = new Map(client.prises.map((p) => [p.venteId, p]));
    const noms = etat.prises.filter((p) => p.nonSoldee).flatMap((p) => (parId.get(p.venteId)?.lignes ?? []).map((l) => l.nomMedicament));
    const derniere = etat.prises.filter((p) => !p.annulee).reduce<string | null>((max, p) => (max === null || p.createdAt > max ? p.createdAt : max), null);
    lignes.push({
      id: client.id,
      nomComplet: client.nomComplet,
      telephone: client.telephone,
      resteAPayer: etat.resteAPayer,
      statut: etat.statut,
      dernierePrise: derniere,
      resume: resumerMedicaments(noms),
      dateLimite: etat.dateLimiteProche,
      nombrePrises: etat.prises.filter((p) => !p.annulee).length,
    });
  }
  lignes.sort(
    (a, b) =>
      ORDRE_STATUT[a.statut] - ORDRE_STATUT[b.statut] ||
      (b.dernierePrise ?? "").localeCompare(a.dernierePrise ?? "") ||
      a.nomComplet.localeCompare(b.nomComplet, "fr"),
  );
  const parPage = options.parPage ?? PAR_PAGE_CREDITS;
  const page = options.page ?? 1;
  return {
    clients: lignes.slice((page - 1) * parPage, page * parPage),
    total: lignes.length,
    page,
    parPage,
    totalPages: Math.max(1, Math.ceil(lignes.length / parPage)),
    resteTotal: lignes.reduce((s, l) => s + l.resteAPayer, 0),
  };
}

function versFiche({ client, etat }: ClientCalcule): FicheClientCredit {
  const parId = new Map(client.prises.map((p) => [p.venteId, p]));
  const prises: PriseCredit[] = etat.prises
    .map((p): PriseCredit => {
      const v = parId.get(p.venteId) as PriseInterne;
      return {
        venteId: v.venteId,
        numero: v.numero,
        createdAt: v.createdAt,
        jourMetier: v.jourMetier,
        vendeurNom: v.vendeurNom,
        total: v.total,
        resteSurPrise: p.reste,
        soldee: !p.annulee && !p.nonSoldee,
        annulee: p.annulee,
        motifAnnulation: p.annulee ? v.motifAnnulation : null,
        dateLimite: v.dateLimite,
        lignes: v.lignes,
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const remboursements: RemboursementCredit[] = [...client.remboursements]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || (a.id < b.id ? 1 : -1))
    .map((r) => ({ id: r.id, montant: r.montant, note: r.note, verseEnCaisse: r.verseEnCaisse, auteurNom: r.auteurNom, createdAt: r.createdAt }));
  return {
    id: client.id,
    nomComplet: client.nomComplet,
    telephone: client.telephone,
    note: client.note,
    createdAt: client.createdAt,
    resteAPayer: etat.resteAPayer,
    totalPris: etat.totalPris,
    totalRembourse: etat.totalRembourse,
    statut: etat.statut,
    dateLimite: etat.dateLimiteProche,
    prises,
    remboursements,
  };
}

/** Fiche d'un client : prises, remboursements, reste et statut calculés ici. */
export function lireFicheCreditLocale(c: Contexte, clientId: string): FicheClientCredit {
  return versFiche(trouver(c, clientId));
}

// ------------------------------------------------------------------------------------------ validations

function telephoneValide(t: string): boolean {
  if (t.length > 30 || !/^\+?[\d\s-]+$/.test(t)) return false;
  const n = t.replace(/\D/g, "").length;
  return n >= 6 && n <= 20;
}

function nomValide(nom: string): boolean {
  return nom.length >= 2 && nom.length <= 100;
}

function texteOuNull(v: string | null | undefined): string | null {
  const t = typeof v === "string" ? v.trim() : "";
  return t === "" ? null : t;
}

/** Date limite : réelle et au plus tôt aujourd'hui (jour du poste), comme sur le web. */
export function exigerDateLimiteValide(c: Contexte, dateLimite: string): void {
  const valide = /^\d{4}-\d{2}-\d{2}$/.test(dateLimite) && new Date(`${dateLimite}T00:00:00.000Z`).toISOString().slice(0, 10) === dateLimite;
  if (!valide) throw refusValidation(MESSAGE_DATE_LIMITE_INVALIDE);
  if (dateLimite < c.jour()) throw new RefusCaisse(400, "DATE_LIMITE_PASSEE", MESSAGE_DATE_LIMITE_PASSEE);
}

// ------------------------------------------------------------------------------------------ écritures

/** Insère le client et son événement ; à appeler dans la transaction de l'opération. */
function inserer(c: Contexte, id: string, nomComplet: string, telephone: string | null, note: string | null, u: Utilisateur): void {
  const sequence = c.etat().prochaineSequence;
  c.stockage.executer("INSERT INTO clients_credit_locaux (id, sequence, nomComplet, telephone, note, creeLe) VALUES (?, ?, ?, ?, ?, ?)", [id, sequence, nomComplet, telephone, note, c.maintenant()]);
  c.ajouterEvenement("CLIENT_CREDIT_CREE", u.id, { id, nomComplet, ...(telephone !== null ? { telephone } : {}), ...(note !== null ? { note } : {}) });
}

/** Nouveau client du cahier. Rejouable avec le même `id` : la fiche existante est rendue sans nouvel événement. */
export function creerClientCreditLocal(c: Contexte, corps: CorpsClientCredit & { id: string }, u: Utilisateur): FicheClientCredit {
  return c.stockage.transaction(() => {
    exigerUuid(corps.id, "du client de crédit");
    const existant = clientsCalcules(c).find((x) => x.client.id === corps.id);
    if (existant) return versFiche(existant);
    const nom = typeof corps.nomComplet === "string" ? corps.nomComplet.trim() : "";
    if (!nomValide(nom)) throw refusValidation(MESSAGE_NOM_CLIENT_CREDIT);
    const telephone = texteOuNull(corps.telephone);
    if (telephone !== null && !telephoneValide(telephone)) throw refusValidation(MESSAGE_TELEPHONE_CLIENT_CREDIT);
    const note = texteOuNull(corps.note);
    if (note !== null && note.length > 500) throw refusValidation("La note ne doit pas dépasser 500 caractères.");
    inserer(c, corps.id, nom, telephone, note, u);
    return lireFicheCreditLocale(c, corps.id);
  });
}

/** Modifie nom, téléphone ou note : seuls les champs qui changent partent dans l'événement. */
export function modifierClientCreditLocal(c: Contexte, clientId: string, corps: CorpsModifClientCredit, u: Utilisateur): FicheClientCredit {
  return c.stockage.transaction(() => {
    const avant = trouver(c, clientId).client;
    const champs: Record<string, string | null> = {};
    if (corps.nomComplet !== undefined) {
      const nom = corps.nomComplet.trim();
      if (!nomValide(nom)) throw refusValidation(MESSAGE_NOM_CLIENT_CREDIT);
      if (nom !== avant.nomComplet) champs.nomComplet = nom;
    }
    if (corps.telephone !== undefined) {
      const t = texteOuNull(corps.telephone);
      if (t !== null && !telephoneValide(t)) throw refusValidation(MESSAGE_TELEPHONE_CLIENT_CREDIT);
      if (t !== avant.telephone) champs.telephone = t;
    }
    if (corps.note !== undefined) {
      const n = texteOuNull(corps.note);
      if (n !== null && n.length > 500) throw refusValidation("La note ne doit pas dépasser 500 caractères.");
      if (n !== avant.note) champs.note = n;
    }
    if (Object.keys(champs).length === 0) return lireFicheCreditLocale(c, clientId);
    const sequence = c.etat().prochaineSequence;
    for (const [champ, valeur] of Object.entries(champs)) {
      c.stockage.executer("INSERT INTO clients_credit_modifies_locaux (sequence, clientId, champ, valeur) VALUES (?, ?, ?, ?)", [sequence, clientId, champ, JSON.stringify(valeur)]);
    }
    c.ajouterEvenement("CLIENT_CREDIT_MODIFIE", u.id, { id: clientId, champs });
    return lireFicheCreditLocale(c, clientId);
  });
}

/** Pose ou retire (null) la date limite d'une prise non soldée et non annulée. */
export function modifierDateLimiteLocale(c: Contexte, venteId: string, dateLimite: string | null, u: Utilisateur): FicheClientCredit {
  return c.stockage.transaction(() => {
    if (dateLimite !== null) exigerDateLimiteValide(c, dateLimite);
    const proprietaire = clientsCalcules(c).find((x) => x.client.prises.some((p) => p.venteId === venteId));
    const prise = proprietaire?.etat.prises.find((p) => p.venteId === venteId);
    if (!proprietaire || !prise) throw new RefusCaisse(404, "PRISE_INTROUVABLE", MESSAGE_PRISE_INTROUVABLE);
    if (prise.annulee) throw new RefusCaisse(409, "PRISE_ANNULEE", MESSAGE_PRISE_ANNULEE);
    if (!prise.nonSoldee) throw new RefusCaisse(409, "PRISE_SOLDEE", MESSAGE_PRISE_SOLDEE);
    if (prise.dateLimite !== dateLimite) {
      const sequence = c.etat().prochaineSequence;
      c.stockage.executer("INSERT INTO dates_limites_locales (sequence, venteId, dateLimite) VALUES (?, ?, ?)", [sequence, venteId, dateLimite]);
      c.ajouterEvenement("DATE_LIMITE_MODIFIEE", u.id, { venteId, dateLimite });
    }
    return lireFicheCreditLocale(c, proprietaire.client.id);
  });
}

export interface CorpsRemboursementLocal {
  id: string;
  montant: number;
  note?: string;
  verseEnCaisse?: boolean;
}

/**
 * Remboursement encaissé sur le poste. « Versé en caisse » crée l'entrée de caisse locale (APPORT) dans la caisse
 * ouverte du poste, à ce nom ; le serveur la recrée au rejeu depuis l'événement (même identifiant), il n'y a donc pas
 * d'événement `MOUVEMENT_CAISSE` en plus. Rejouable avec le même `id`.
 */
export function enregistrerRemboursementLocal(c: Contexte, clientId: string, corps: CorpsRemboursementLocal, u: Utilisateur): ResultatRemboursement {
  return c.stockage.transaction(() => {
    exigerUuid(corps.id, "du remboursement");
    const avant = trouver(c, clientId);
    const deja = avant.client.remboursements.find((r) => r.id === corps.id);
    if (deja) {
      return { remboursement: { ...deja }, resteAPayer: avant.etat.resteAPayer, statut: avant.etat.statut };
    }
    if (!Number.isInteger(corps.montant) || corps.montant < 1 || corps.montant > ENTIER_MAX) {
      throw refusValidation("Le montant doit être un nombre entier de GNF supérieur à zéro.");
    }
    const note = texteOuNull(corps.note);
    if (note !== null && note.length > 500) throw refusValidation("La note ne doit pas dépasser 500 caractères.");
    const reste = avant.etat.resteAPayer;
    if (reste <= 0) throw new RefusCaisse(409, "CREDIT_DEJA_SOLDE", MESSAGE_CREDIT_DEJA_SOLDE);
    if (corps.montant > reste) {
      throw new RefusCaisse(400, "MONTANT_SUPERIEUR_AU_RESTE", messageMontantSuperieurAuReste(reste), { resteAPayer: reste });
    }

    const verse = corps.verseEnCaisse === true;
    let sessionId: string | null = null;
    if (verse) {
      const ouverte = sessionOuverteLigne(c);
      if (!ouverte || ouverte.utilisateurId !== u.id) throw new RefusCaisse(409, "CAISSE_NON_OUVERTE", MESSAGE_CAISSE_NON_OUVERTE);
      sessionId = ouverte.id;
      c.stockage.executer(
        "INSERT INTO mouvements_caisse (id, sessionId, type, mode, montant, motif, auteurId, horodatage) VALUES (?, ?, 'APPORT', 'ESPECES', ?, ?, ?, ?)",
        [corps.id, sessionId, corps.montant, `Remboursement de crédit : ${avant.client.nomComplet}`.slice(0, 200), u.id, c.maintenant()],
      );
    }
    const sequence = c.etat().prochaineSequence;
    const creeLe = c.maintenant();
    c.stockage.executer(
      "INSERT INTO remboursements_credit_locaux (id, sequence, clientId, montant, note, verseEnCaisse, auteurNom, creeLe) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [corps.id, sequence, clientId, corps.montant, note, verse ? 1 : 0, u.nom, creeLe],
    );
    c.ajouterEvenement("REMBOURSEMENT_CREDIT", u.id, {
      id: corps.id,
      clientId,
      montant: corps.montant,
      ...(note !== null ? { note } : {}),
      verseEnCaisse: verse,
      ...(sessionId !== null ? { sessionId } : {}),
    });
    const apres = trouver(c, clientId);
    return {
      remboursement: { id: corps.id, montant: corps.montant, note, verseEnCaisse: verse, auteurNom: u.nom, createdAt: creeLe, mouvementCaisseId: verse ? corps.id : null },
      resteAPayer: apres.etat.resteAPayer,
      statut: apres.etat.statut,
    };
  });
}

// ------------------------------------------------------------------------------------------ vente à crédit

export interface CreditDeVente {
  /** Client existant, ou null quand un nouveau client est à créer avec la vente. */
  client: { id: string; nomComplet: string; telephone: string | null } | null;
  nouveau: { nomComplet: string; telephone: string | null } | null;
  dateLimite: string | null;
}

/**
 * Contrôle le corps d'une vente à crédit, avant toute écriture : un seul client (existant ou nouveau), date limite
 * valide, un seul paiement CREDIT s'il est donné. Null pour une vente ordinaire.
 */
export function verifierCreditDeVente(
  c: Contexte,
  corps: { clientCreditId?: string; nouveauClientCredit?: { nomComplet: string; telephone?: string }; dateLimiteCredit?: string; paiements?: { mode: string }[] },
): CreditDeVente | null {
  const estCredit = Boolean(corps.clientCreditId) || corps.nouveauClientCredit !== undefined || (corps.paiements?.some((p) => p.mode === "CREDIT") ?? false);
  if (!estCredit) {
    if (corps.dateLimiteCredit !== undefined) {
      throw new RefusCaisse(400, "CREDIT_PAIEMENTS_INCOHERENTS", "Une date limite ne s'applique qu'à une vente à crédit : choisissez un client de crédit.");
    }
    return null;
  }
  if (corps.clientCreditId && corps.nouveauClientCredit) {
    throw refusValidation("Choisissez un client existant ou créez-en un nouveau, pas les deux.");
  }
  if (!corps.clientCreditId && !corps.nouveauClientCredit) {
    throw new RefusCaisse(400, "CREDIT_CLIENT_REQUIS", "Choisissez le client à qui accorder ce crédit.");
  }
  if (corps.paiements && !(corps.paiements.length === 1 && corps.paiements[0].mode === "CREDIT")) {
    throw new RefusCaisse(400, "CREDIT_PAIEMENTS_INCOHERENTS", "Une vente à crédit se règle entièrement à crédit : retirez les autres paiements.");
  }
  if (corps.dateLimiteCredit !== undefined) exigerDateLimiteValide(c, corps.dateLimiteCredit);
  const dateLimite = corps.dateLimiteCredit ?? null;
  if (corps.clientCreditId) {
    const x = clientsCalcules(c).find((k) => k.client.id === corps.clientCreditId);
    if (!x) throw new RefusCaisse(404, "CLIENT_CREDIT_INTROUVABLE", MESSAGE_CLIENT_CREDIT_INTROUVABLE);
    return { client: { id: x.client.id, nomComplet: x.client.nomComplet, telephone: x.client.telephone }, nouveau: null, dateLimite };
  }
  const nouveau = corps.nouveauClientCredit as { nomComplet: string; telephone?: string };
  const nom = (nouveau.nomComplet ?? "").trim();
  if (!nomValide(nom)) throw refusValidation(MESSAGE_NOM_CLIENT_CREDIT);
  const telephone = texteOuNull(nouveau.telephone);
  if (telephone !== null && !telephoneValide(telephone)) throw refusValidation(MESSAGE_TELEPHONE_CLIENT_CREDIT);
  return { client: null, nouveau: { nomComplet: nom, telephone }, dateLimite };
}

/**
 * Crée le client d'une vente à crédit sous l'identifiant donné (événement `CLIENT_CREDIT_CREE`, avant celui de la vente).
 * À appeler dans la transaction de la vente, avant de lire la séquence réservée à la vente.
 */
export function creerClientDeVente(c: Contexte, id: string, nouveau: { nomComplet: string; telephone: string | null }, u: Utilisateur): void {
  exigerUuid(id, "du client de crédit");
  inserer(c, id, nouveau.nomComplet, nouveau.telephone, null, u);
}

/** Garde la prise à crédit : la vente est dans `ventes`, ici le client et la date limite. */
export function enregistrerPriseLocale(c: Contexte, venteId: string, sequence: number, clientId: string, dateLimite: string | null): void {
  c.stockage.executer("INSERT INTO prises_credit_locales (venteId, sequence, clientId, dateLimite) VALUES (?, ?, ?, ?)", [venteId, sequence, clientId, dateLimite]);
}
