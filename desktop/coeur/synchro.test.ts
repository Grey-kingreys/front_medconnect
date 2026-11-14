/**
 * Moteur de synchronisation (PD03), joué contre le faux serveur fidèle au contrat réel.
 * Chaque corps envoyé est validé par les listes de clés du back (fixtures/valider_dto.ts).
 */
import { afterEach, describe, expect, it } from "vitest";
import { VENDEUR, MAINTENANT, base, coeurPret, evenements, fermerTout, fiche, outils, uuid } from "./aide_tests";
import { CoeurCaisse } from "./coeur";
import { FauxClient, FauxServeur } from "./fixtures/faux_serveur";
import type { Stockage } from "./stockage";
import { LOT_OCTETS_MAX, MESSAGE_ENVOI_BLOQUE, MoteurSynchro } from "./synchro";
import type { FicheSynchro } from "./types_synchro";

afterEach(fermerTout);

interface Banc {
  s: Stockage;
  c: CoeurCaisse;
  serveur: FauxServeur;
  client: FauxClient;
  moteur: MoteurSynchro;
  horloge: { t: Date };
  journal: string[];
}

const fiche10 = (): FicheSynchro => fiche(1, { quantite: 10, lots: [{ ...fiche(1).lots[0], solde: 10 }] });

/** Poste déjà enregistré (po1) avec une plage p1 de 1 à 500, catalogue chargé. */
function banc(fiches: FicheSynchro[] = [fiche(1)]): Banc {
  const { s, c } = coeurPret(fiches);
  const serveur = new FauxServeur({ id: "po1", code: "D1", appareilId: c.appareilId() });
  serveur.fiches = structuredClone(fiches);
  serveur.ouvrirPlage("p1", 1, 500);
  return avecMoteur(s, c, serveur);
}

function avecMoteur(s: Stockage, c: CoeurCaisse, serveur: FauxServeur): Banc {
  const client = new FauxClient(serveur);
  const horloge = { t: new Date(MAINTENANT) };
  const journal: string[] = [];
  let n = 0;
  const moteur = new MoteurSynchro(c, client, {
    versionApp: "0.1.0",
    libellePoste: "Comptoir",
    horloge: () => new Date(horloge.t),
    genererId: () => uuid(++n, "cccccccc"),
    journal: (m) => journal.push(m),
  });
  return { s, c, serveur, client, moteur, horloge, journal };
}

let compteVente = 0;
function vendre(c: CoeurCaisse, quantite = 1): void {
  c.enregistrerVente({ lignes: [{ stockId: "s1", quantite }] }, uuid(++compteVente, "99999999"), VENDEUR);
}

function statuts(s: Stockage): string[] {
  return evenements(s).map((e) => e.statut);
}

/** Événement de caisse minimal, accepté par les DTO, inséré directement dans le journal local. */
function insererEvenement(s: Stockage, sequence: number, type = "MOUVEMENT_CAISSE", corps?: object): void {
  const defaut = { mouvementId: uuid(sequence, "dddddddd"), sessionId: uuid(1, "eeeeeeee"), type: "APPORT", montant: 1000, motif: "Monnaie du jour" };
  s.executer(
    "INSERT INTO evenements (sequence, evenementId, type, horodatageLocal, utilisateurId, corps, statut) VALUES (?, ?, ?, ?, ?, ?, 'A_ENVOYER')",
    [sequence, uuid(sequence, "ffffffff"), type, MAINTENANT, VENDEUR.id, JSON.stringify(corps ?? defaut)],
  );
}

/** Vente de 50 lignes, environ 25 Ko de JSON. */
function grosseVente(i: number): object {
  return {
    venteId: uuid(i, "11111111"),
    sessionId: uuid(1, "eeeeeeee"),
    numeroSecours: i,
    lignes: Array.from({ length: 50 }, (_, k) => ({
      stockId: `stock-${"x".repeat(50)}${k}`,
      unite: "BOITE",
      nombre: 1,
      prixUnitaire: 100,
      sortieManuelle: { lotId: "l".repeat(60), motif: "m".repeat(290) },
    })),
    paiements: [{ mode: "ESPECES", montant: 5000 }],
    total: 5000,
    ordonnanceVerifiee: false,
  };
}

function routes(client: FauxClient): string[] {
  return client.requetes.map((r) => `${r.methode} ${r.chemin.split("?")[0].replace(/^\/pharmacie\/ph1\//, "")}`);
}

describe("premier démarrage et ordre des étapes", () => {
  it("poste, envoi, plage puis photographie, dans cet ordre", async () => {
    const s = base();
    const c = new CoeurCaisse(s, outils());
    c.rattacher({ structureId: "ph1" });
    const serveur = new FauxServeur();
    const { client, moteur } = avecMoteur(s, c, serveur);

    const bilan = await moteur.cycle("demarrage");

    expect(routes(client)).toEqual(["POST postes", "POST synchro/evenements", "POST postes/po1/plages", "GET synchro/catalogue"]);
    expect(bilan.photographie).toBe("appliquee");
    expect(bilan.plageDemandee).toBe(true);
    expect(moteur.etat().etat).toBe("EN_LIGNE");
    expect(c.aUnCatalogue()).toBe(true);
    expect(c.lireStock()).toHaveLength(1);
    expect(c.etatPourSynchro().posteId).toBe("po1");
    expect(c.etatPourSynchro().plagesLocales).toBe(1);
    // Premier envoi : battement de cœur, file vide déclarée.
    expect(client.vers("POST", "synchro/evenements")[0].gzip).toBe(true);
    expect(JSON.parse(client.vers("POST", "synchro/evenements")[0].corps as string)).toEqual({
      posteId: "po1",
      etat: { fileVide: true, sessionOuverte: false, versionApp: "0.1.0" },
      evenements: [],
    });
    expect(serveur.ecartsValidation).toEqual([]);
  });

  it("trois ventes : séquences consécutives dans l'ordre, tout est ENVOYE", async () => {
    const { s, c, serveur, moteur } = banc();
    vendre(c);
    vendre(c);
    vendre(c);

    const bilan = await moteur.cycle("apres-vente");

    expect(serveur.ordreApplication).toEqual([1, 2, 3, 4]);
    expect(statuts(s)).toEqual(["ENVOYE", "ENVOYE", "ENVOYE", "ENVOYE"]);
    expect(bilan.evenementsAcceptes).toBe(4);
    expect(c.etatLocal().fileEnAttente).toBe(0);
    expect(serveur.ecartsValidation).toEqual([]);
  });
});

describe("doublon, rejet, double décompte", () => {
  it("réponse perdue puis renvoi : DEJA_APPLIQUE, un seul effet au serveur, stock du poste juste", async () => {
    const { s, c, serveur, client, moteur } = banc([fiche10()]);
    vendre(c, 2);
    client.perdre = { motif: "synchro/evenements", restant: 1 };

    const premier = await moteur.cycle("apres-vente");
    expect(premier.etat).toBe("HORS_LIGNE");
    expect(statuts(s)).toEqual(["A_ENVOYER", "A_ENVOYER"]);
    expect([...serveur.effets.values()]).toEqual([1, 1]);
    expect(moteur.etat().echecsConsecutifs).toBe(1);

    const second = await moteur.cycle("minuterie");
    expect(second.etat).toBe("EN_LIGNE");
    expect(statuts(s)).toEqual(["ENVOYE", "ENVOYE"]);
    expect([...serveur.effets.values()]).toEqual([1, 1]);
    expect(serveur.fiches[0].quantite).toBe(8);
    expect(c.lireStock()[0].quantite).toBe(8);
  });

  it("un rejet n'arrête pas la file : message gardé, compteur à 1, les autres passent", async () => {
    const { s, c, serveur, moteur } = banc();
    vendre(c);
    vendre(c);
    vendre(c);
    const deuxiemeVente = evenements(s)[2];
    serveur.rejeter.add(deuxiemeVente.evenementId);

    const bilan = await moteur.cycle("apres-vente");

    expect(statuts(s)).toEqual(["ENVOYE", "ENVOYE", "REJETE", "ENVOYE"]);
    const ligne = s.lireUn<{ code: string; message: string }>("SELECT code, message FROM evenements WHERE statut = 'REJETE'");
    expect(ligne?.code).toBe("STOCK_INTROUVABLE");
    expect(ligne?.message).toContain("n'existe plus");
    expect(bilan.rejets).toBe(1);
    expect(moteur.etat().rejets).toBe(1);
    expect(c.etatLocal().rejetes).toBe(1);
    expect(moteur.etat().echecsConsecutifs).toBe(0);
    // La vente rejetée reste dans le journal local, jamais effacée.
    expect(evenements(s)).toHaveLength(4);
  });

  it("pas de double décompte : l'accusé n'écrit pas sequenceAppliquee, seule la photographie le fait", async () => {
    const { s, c, serveur, client, moteur } = banc([fiche10()]);
    vendre(c, 2);
    expect(c.lireStock()[0].quantite).toBe(8);

    // L'accusé arrive, la photographie échoue : le stock reste 8, pas 6.
    client.forcer = (m, chemin) => (m === "GET" && chemin.includes("synchro/catalogue") ? { status: 500, entetes: {}, corps: "" } : undefined);
    await moteur.cycle("apres-vente");
    expect(statuts(s)).toEqual(["ENVOYE", "ENVOYE"]);
    expect(moteur.etat().sequenceAppliqueeServeur).toBe(2);
    expect(c.etatPourSynchro().sequenceAppliquee).toBe(0);
    expect(c.lireStock()[0].quantite).toBe(8);

    // La photographie arrive : serveur à 8, sequenceAppliquee à jour, le stock reste 8.
    client.forcer = null;
    moteur.forcerPhotographie();
    await moteur.cycle("minuterie");
    expect(serveur.fiches[0].quantite).toBe(8);
    expect(c.etatPourSynchro().sequenceAppliquee).toBe(2);
    expect(c.lireStock()[0].quantite).toBe(8);

    // Une nouvelle vente de 1 avant son accusé : 7.
    vendre(c, 1);
    expect(c.lireStock()[0].quantite).toBe(7);
  });
});

describe("photographie, ETag et heure", () => {
  it("304 : catalogue inchangé, If-None-Match envoyé, date mise à jour", async () => {
    const { s, c, client, moteur } = banc();
    await moteur.cycle("demarrage");
    const etag = c.etatPourSynchro().etag;
    expect(etag).toMatch(/^W\//);
    const avant = JSON.stringify(s.lire("SELECT * FROM fiches"));

    moteur.forcerPhotographie();
    const bilan = await moteur.cycle("minuterie");

    const demandes = client.vers("GET", "synchro/catalogue");
    expect(demandes).toHaveLength(2);
    expect(demandes[1].entetes["If-None-Match"]).toBe(etag);
    expect(demandes[1].entetes["Accept-Encoding"]).toBe("br, gzip");
    expect(bilan.photographie).toBe("inchangee");
    expect(JSON.stringify(s.lire("SELECT * FROM fiches"))).toBe(avant);
    expect(c.etatPourSynchro().etag).toBe(etag);
  });

  it("due toutes les 15 minutes, pas avant", async () => {
    const { client, moteur, horloge } = banc();
    await moteur.cycle("demarrage");
    expect(client.vers("GET", "synchro/catalogue")).toHaveLength(1);

    horloge.t = new Date(Date.parse(MAINTENANT) + 10 * 60_000);
    await moteur.cycle("minuterie");
    expect(client.vers("GET", "synchro/catalogue")).toHaveLength(1);

    horloge.t = new Date(Date.parse(MAINTENANT) + 16 * 60_000);
    await moteur.cycle("minuterie");
    expect(client.vers("GET", "synchro/catalogue")).toHaveLength(2);
  });

  it("heure du serveur trop différente : avertissement, jamais de blocage", async () => {
    const { c, serveur, moteur } = banc();
    serveur.dateServeur = () => new Date(Date.parse(MAINTENANT) + 6 * 60_000);
    vendre(c);

    const bilan = await moteur.cycle("apres-vente");

    expect(moteur.etat().heureFausse).toBe(true);
    expect(moteur.etat().ecartHeureMs).toBe(6 * 60_000);
    expect(bilan.etat).toBe("EN_LIGNE");
    expect(bilan.evenementsAcceptes).toBe(2);
  });

  it("D719 : fiche à 0 et 1 à régulariser, vente provisoire locale : 0 et 2", async () => {
    const { c, serveur, moteur } = banc();
    serveur.fiches = [fiche(1, { quantite: 0, quantiteARegulariser: 1, lots: [] })];
    await moteur.cycle("demarrage");
    expect(c.lireStock()[0].quantite).toBe(0);
    expect(c.lireStock()[0].quantiteARegulariser).toBe(1);

    vendre(c, 1);
    expect(c.lireStock()[0].quantite).toBe(0);
    expect(c.lireStock()[0].quantiteARegulariser).toBe(2);
  });
});

describe("découpage des lots", () => {
  it("450 événements : lots de 200, 200 et 50", async () => {
    const { s, serveur, moteur } = banc();
    for (let i = 1; i <= 450; i++) insererEvenement(s, i);

    await moteur.cycle("demarrage");

    expect(serveur.evenementsParEnvoi).toEqual([200, 200, 50]);
    expect(new Set(statuts(s))).toEqual(new Set(["ENVOYE"]));
    expect(serveur.ordreApplication).toHaveLength(450);
    expect(serveur.ecartsValidation).toEqual([]);
  });

  it("événements volumineux : aucun lot au-dessus de 1,5 Mo", async () => {
    const { s, serveur, moteur } = banc();
    for (let i = 1; i <= 150; i++) insererEvenement(s, i, "VENTE", grosseVente(i));

    await moteur.cycle("demarrage");

    expect(serveur.taillesEnvois.length).toBeGreaterThanOrEqual(3);
    expect(Math.max(...serveur.taillesEnvois)).toBeLessThanOrEqual(LOT_OCTETS_MAX);
    expect(serveur.evenementsParEnvoi.reduce((a, b) => a + b, 0)).toBe(150);
    expect(new Set(statuts(s))).toEqual(new Set(["ENVOYE"]));
    expect(serveur.ecartsValidation).toEqual([]);
  });

  it("413 : lot divisé par deux jusqu'à passer, tout finit envoyé, sans échec compté", async () => {
    const { s, serveur, client, moteur } = banc();
    serveur.limiteOctets = 100_000;
    for (let i = 1; i <= 150; i++) insererEvenement(s, i, "VENTE", grosseVente(i));

    await moteur.cycle("demarrage");

    expect(new Set(statuts(s))).toEqual(new Set(["ENVOYE"]));
    expect(Math.max(...serveur.taillesEnvois)).toBeLessThanOrEqual(100_000);
    expect(client.vers("POST", "synchro/evenements").length).toBeGreaterThan(serveur.taillesEnvois.length);
    expect(moteur.etat().echecsConsecutifs).toBe(0);
  });
});

describe("A_RENVOYER, EN_ATTENTE et differe", () => {
  it("A_RENVOYER : cycle arrêté, rien perdu, tout passe au cycle suivant", async () => {
    const { s, c, serveur, moteur } = banc();
    vendre(c);
    vendre(c);
    vendre(c);
    serveur.renvoyerUneFois.add(evenements(s)[2].evenementId);

    const premier = await moteur.cycle("apres-vente");
    expect(statuts(s)).toEqual(["ENVOYE", "ENVOYE", "A_ENVOYER", "A_ENVOYER"]);
    expect(premier.aRenvoyer).toBe(2);
    expect(moteur.etat().echecsConsecutifs).toBe(1);
    expect(moteur.prochainDelaiMs()).toBe(5_000);

    await moteur.cycle("minuterie");
    expect(statuts(s)).toEqual(["ENVOYE", "ENVOYE", "ENVOYE", "ENVOYE"]);
    expect(serveur.ordreApplication).toEqual([1, 2, 3, 4]);
    expect([...serveur.effets.values()]).toEqual([1, 1, 1, 1]);
    expect(moteur.etat().echecsConsecutifs).toBe(0);
  });

  it("EN_ATTENTE ne se renvoie pas ; un envoi différé met la ligne à jour (ENVOYE ou REJETE)", async () => {
    const { s, serveur, client, moteur } = banc();
    insererEvenement(s, 2);
    insererEvenement(s, 3);
    serveur.rejeter.add(uuid(3, "ffffffff"));

    const premier = await moteur.cycle("demarrage");
    expect(statuts(s)).toEqual(["EN_ATTENTE", "EN_ATTENTE"]);
    expect(premier.enAttente).toBe(2);
    expect(moteur.etat().enAttenteServeur).toBe(2);
    expect(moteur.prochainDelaiMs()).toBe(30_000);

    // Deuxième cycle : rien n'est renvoyé, et le poste ne se dit pas à jour.
    await moteur.cycle("minuterie");
    const dernier = JSON.parse(client.vers("POST", "synchro/evenements").at(-1)?.corps as string) as {
      etat: { fileVide: boolean };
      evenements: unknown[];
    };
    expect(dernier.evenements).toEqual([]);
    expect(dernier.etat.fileVide).toBe(false);
    expect(statuts(s)).toEqual(["EN_ATTENTE", "EN_ATTENTE"]);

    // Le trou est comblé : les deux lignes changent de sort.
    insererEvenement(s, 1);
    await moteur.cycle("minuterie");
    expect(statuts(s)).toEqual(["ENVOYE", "ENVOYE", "REJETE"]);
    expect(moteur.etat().enAttenteServeur).toBe(0);
    expect(s.lireUn<{ code: string }>("SELECT code FROM evenements WHERE sequence = 3")?.code).toBe("STOCK_INTROUVABLE");
  });
});

describe("pannes, 401 et rythme", () => {
  it("401 : connexion à refaire, file intacte, aucun jeton nulle part, reprise avec le nouveau jeton", async () => {
    const { s, c, serveur, client, moteur, journal } = banc();
    vendre(c);
    serveur.jetonValide = false;

    const bilan = await moteur.cycle("apres-vente");
    expect(bilan.etat).toBe("CONNEXION_A_REFAIRE");
    expect(statuts(s)).toEqual(["A_ENVOYER", "A_ENVOYER"]);

    const tables = ["etat_poste", "evenements", "pharmacie", "parametres", "fiches", "plages", "sessions", "ventes", "profil_local"];
    const donnees = JSON.stringify([tables.map((t) => s.lire(`SELECT * FROM ${t}`)), moteur.etat(), journal, client.requetes]);
    expect(donnees).not.toContain(client.jeton);
    expect(donnees).not.toMatch(/Authorization|Bearer/i);

    // Le moteur s'arrête jusqu'au prochain jeton : plus aucune requête.
    const avant = client.requetes.length;
    await moteur.cycle("minuterie");
    expect(client.requetes).toHaveLength(avant);

    serveur.jetonValide = true;
    moteur.reprendreApresConnexion();
    await moteur.cycle("minuterie");
    expect(statuts(s)).toEqual(["ENVOYE", "ENVOYE"]);
    expect(moteur.etat().etat).toBe("EN_LIGNE");
  });

  it("réseau coupé 10 cycles : 5 s, 10 s, 20 s... plafond 5 min, retour à 30 s au succès", async () => {
    const { s, c, client, moteur } = banc();
    vendre(c);
    client.coupure = true;
    const delais: number[] = [];
    for (let i = 0; i < 10; i++) {
      const bilan = await moteur.cycle("minuterie");
      expect(bilan.etat).toBe("HORS_LIGNE");
      delais.push(moteur.prochainDelaiMs());
    }
    expect(delais).toEqual([5_000, 10_000, 20_000, 40_000, 80_000, 160_000, 300_000, 300_000, 300_000, 300_000]);
    expect(statuts(s)).toEqual(["A_ENVOYER", "A_ENVOYER"]);

    // Réseau revenu, un événement attend encore un trou au serveur : file non vide, 30 s.
    client.coupure = false;
    insererEvenement(s, 99);
    await moteur.cycle("minuterie");
    expect(moteur.etat().etat).toBe("EN_LIGNE");
    expect(moteur.etat().echecsConsecutifs).toBe(0);
    expect(statuts(s)).toEqual(["ENVOYE", "ENVOYE", "EN_ATTENTE"]);
    expect(moteur.prochainDelaiMs()).toBe(30_000);
  });

  it("file vide : battement à vide toutes les 5 minutes", async () => {
    const { moteur } = banc();
    await moteur.cycle("demarrage");
    expect(moteur.prochainDelaiMs()).toBe(300_000);
  });

  it("5xx et 429 : hors ligne sans rien perdre ; 403 : message du serveur gardé", async () => {
    const { s, c, client, moteur } = banc();
    vendre(c);
    client.forcer = () => ({ status: 503, entetes: {}, corps: "" });
    expect((await moteur.cycle("apres-vente")).etat).toBe("HORS_LIGNE");
    client.forcer = () => ({ status: 429, entetes: {}, corps: "" });
    expect((await moteur.cycle("minuterie")).etat).toBe("HORS_LIGNE");
    expect(moteur.etat().echecsConsecutifs).toBe(2);
    expect(statuts(s)).toEqual(["A_ENVOYER", "A_ENVOYER"]);

    client.forcer = () => ({
      status: 403,
      entetes: {},
      corps: JSON.stringify({ statusCode: 403, message: "Vous n'avez pas accès à cette pharmacie.", error: "Forbidden", code: "PERMISSION_REFUSEE" }),
    });
    const bilan = await moteur.cycle("minuterie");
    expect(bilan.etat).toBe("EN_LIGNE");
    expect(moteur.etat().erreur).toBe("Vous n'avez pas accès à cette pharmacie.");
    expect(statuts(s)).toEqual(["A_ENVOYER", "A_ENVOYER"]);
  });

  it("poste désactivé (409 POSTE_INCONNU sur le catalogue) : drapeau levé, les envois continuent au cycle suivant", async () => {
    const { s, c, client, moteur } = banc();
    client.forcer = (m, chemin) =>
      m === "GET" && chemin.includes("synchro/catalogue")
        ? { status: 409, entetes: {}, corps: JSON.stringify({ statusCode: 409, message: "Ce poste est inconnu.", error: "Conflict", code: "POSTE_INCONNU" }) }
        : undefined;
    await moteur.cycle("demarrage");
    expect(moteur.etat().posteDesactive).toBe(true);
    expect(moteur.etat().echecsConsecutifs).toBe(0);

    vendre(c);
    const catalogues = client.vers("GET", "synchro/catalogue").length;
    await moteur.cycle("apres-vente");
    expect(statuts(s)).toEqual(["ENVOYE", "ENVOYE"]);
    expect(client.vers("GET", "synchro/catalogue")).toHaveLength(catalogues);
  });
});

describe("envoi bloqué : jamais d'écart automatique, poste toujours utilisable", () => {
  const estEnvoi = (m: string, chemin: string) => m === "POST" && chemin.includes("synchro/evenements");

  /** Vente de 2 sur un stock de 10 bloquée, plage presque épuisée : le cycle doit quand même recharger plage et catalogue. */
  async function cycleBloque(b: Banc): Promise<void> {
    vendre(b.c, 2);
    b.s.executer("UPDATE plages SET dernierUtilise = 490 WHERE id = 'p1'");
    b.moteur.forcerPhotographie();
    const bilan = await b.moteur.cycle("apres-vente");

    expect(b.moteur.etat().erreur).toBe(MESSAGE_ENVOI_BLOQUE);
    expect(b.journal.join("\n")).not.toContain("Mariama");
    expect(statuts(b.s)).toEqual(["A_ENVOYER", "A_ENVOYER"]);
    expect(b.moteur.etat().echecsConsecutifs).toBe(1);
    expect(b.moteur.prochainDelaiMs()).toBe(5_000);
    expect(bilan.plageDemandee).toBe(true);
    expect(bilan.photographie).toBe("appliquee");
    expect(b.c.etatPourSynchro().plagesLocales).toBe(2);
    // Pas de double décompte : la vente bloquée reste décomptée du stock, sequenceAppliquee n'a pas bougé.
    expect(b.c.etatPourSynchro().sequenceAppliquee).toBe(0);
    expect(b.c.lireStock()[0].quantite).toBe(8);
  }

  async function reprise(b: Banc): Promise<void> {
    b.client.forcer = null;
    b.serveur.limiteOctets = 2_000_000;
    await b.moteur.cycle("minuterie");
    expect(b.moteur.etat().erreur).toBeNull();
    expect(b.moteur.etat().echecsConsecutifs).toBe(0);
    expect(statuts(b.s)).toEqual(["ENVOYE", "ENVOYE"]);
  }

  it("400 sur l'enveloppe", async () => {
    const b = banc([fiche10()]);
    b.client.forcer = (m, chemin) => (estEnvoi(m, chemin) ? { status: 400, entetes: {}, corps: JSON.stringify({ statusCode: 400, message: "Corps invalide", code: "VALIDATION" }) } : undefined);
    await cycleBloque(b);
    await reprise(b);
  });

  it("413 sur un événement seul", async () => {
    const b = banc([fiche10()]);
    b.serveur.limiteOctets = 200;
    await cycleBloque(b);
    await reprise(b);
  });

  it("photographie demandée : servie une fois, même si l'envoi reste bloqué", async () => {
    const b = banc([fiche10()]);
    b.client.forcer = (m, chemin) => (estEnvoi(m, chemin) ? { status: 400, entetes: {}, corps: "{}" } : undefined);
    await cycleBloque(b);
    const second = await b.moteur.cycle("minuterie");
    expect(second.photographie).toBe("aucune");
    expect(b.moteur.etat().erreur).toBe(MESSAGE_ENVOI_BLOQUE);
    expect(statuts(b.s)).toEqual(["A_ENVOYER", "A_ENVOYER"]);
  });

  it("400 sur un battement à vide, puis battement accepté : le message disparaît", async () => {
    const b = banc([fiche10()]);
    b.client.forcer = (m, chemin) => (estEnvoi(m, chemin) ? { status: 400, entetes: {}, corps: "{}" } : undefined);
    await b.moteur.cycle("minuterie");
    expect(b.moteur.etat().erreur).toBe(MESSAGE_ENVOI_BLOQUE);
    b.client.forcer = null;
    await b.moteur.cycle("minuterie");
    expect(b.moteur.etat().erreur).toBeNull();
  });

  it("statut de résultat inconnu", async () => {
    const b = banc([fiche10()]);
    b.client.forcer = (m, chemin) => {
      if (!estEnvoi(m, chemin)) return undefined;
      const lot = JSON.parse(b.client.requetes.at(-1)?.corps as string) as { evenements: { evenementId: string; sequence: number }[] };
      const resultats = lot.evenements.map((e) => ({ evenementId: e.evenementId, sequence: e.sequence, statut: "NOUVEAU_STATUT" }));
      return { status: 200, entetes: {}, corps: JSON.stringify({ data: { resultats, sequenceAppliquee: 0, enAttente: 0 }, success: true }) };
    };
    await cycleBloque(b);
    await reprise(b);
  });
});

describe("plages", () => {
  it("sous 20 % de la taille, une plage est demandée ; à 20 % ou plus, aucune", async () => {
    const { s, c, serveur, client, moteur } = banc();
    s.executer("UPDATE plages SET dernierUtilise = 400 WHERE id = 'p1'");
    await moteur.cycle("minuterie");
    expect(client.vers("POST", "plages")).toHaveLength(0);

    s.executer("UPDATE plages SET dernierUtilise = 401 WHERE id = 'p1'");
    const bilan = await moteur.cycle("minuterie");
    expect(bilan.plageDemandee).toBe(true);
    expect(client.vers("POST", "plages")).toHaveLength(1);
    expect(c.etatPourSynchro().plagesLocales).toBe(2);
    expect(c.etatPourSynchro().plageDemandeeId).toBeNull();
    expect(serveur.ecartsValidation).toEqual([]);
  });

  it("409 PLAGES_SUFFISANTES : pas une erreur", async () => {
    const { s, c, serveur, moteur } = banc();
    serveur.ouvrirPlage("p2", 501, 1000);
    s.executer("UPDATE plages SET dernierUtilise = 480 WHERE id = 'p1'");

    const bilan = await moteur.cycle("minuterie");

    expect(bilan.plageDemandee).toBe(true);
    expect(bilan.arret).toBeNull();
    expect(moteur.etat().echecsConsecutifs).toBe(0);
    expect(moteur.etat().erreur).toBeNull();
    expect(c.etatPourSynchro().plageDemandeeId).toBeNull();
  });

  it("réponse perdue : le même identifiant est rejoué, une seule plage réservée", async () => {
    const { s, c, serveur, client, moteur } = banc();
    s.executer("UPDATE plages SET dernierUtilise = 490 WHERE id = 'p1'");
    client.perdre = { motif: "/plages", restant: 1 };

    await moteur.cycle("minuterie");
    const idDemande = c.etatPourSynchro().plageDemandeeId;
    expect(idDemande).not.toBeNull();
    expect(serveur.plages).toHaveLength(2);

    await moteur.cycle("minuterie");
    const envois = client.vers("POST", "/plages").map((r) => r.corps);
    expect(envois).toEqual([JSON.stringify({ id: idDemande }), JSON.stringify({ id: idDemande })]);
    expect(serveur.plages).toHaveLength(2);
    expect(c.etatPourSynchro().plageDemandeeId).toBeNull();
    expect(c.etatPourSynchro().plagesLocales).toBe(2);
  });

  it("poste réinstallé (D752) : séquence reprise à 41, plage neuve seule utilisée, aucun numéro déjà servi", async () => {
    const s = base();
    const c = new CoeurCaisse(s, outils());
    c.rattacher({ structureId: "ph1" });
    const serveur = new FauxServeur({ id: "po1", code: "D1", appareilId: c.appareilId() });
    serveur.simulerHistorique(40);
    serveur.ouvrirPlage("ancienne", 1, 500);
    const { moteur, client } = avecMoteur(s, c, serveur);

    await moteur.cycle("demarrage");

    // Plage demandée, puis photographie à deux plages : seule la plus récente sert.
    expect(routes(client)).toContain("POST postes/po1/plages");
    expect(serveur.plages.map((p) => p.id)).toHaveLength(2);
    c.ouvrirSession({ id: uuid(1, "eeeeeeee") }, VENDEUR);
    vendre(c);
    const journal = evenements(s);
    expect(journal[0].sequence).toBe(41);
    const vente = journal.find((e) => e.type === "VENTE");
    expect(vente?.sequence).toBe(42);
    expect(vente?.corps.numeroTicket).toBe(501);
    expect(s.lireUn<{ dernierUtilise: number }>("SELECT dernierUtilise FROM plages WHERE id = 'ancienne'")?.dernierUtilise).toBe(500);

    await moteur.cycle("apres-vente");
    expect(statuts(s)).toEqual(["ENVOYE", "ENVOYE"]);
    expect(serveur.ecartsValidation).toEqual([]);
  });
});
