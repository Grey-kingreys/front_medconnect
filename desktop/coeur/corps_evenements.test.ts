/**
 * Contrat des événements : chaque corps produit par le cœur doit être accepté tel quel par le
 * serveur. Les clés permises et les bornes de chaque classe de DTO du back sont copiées dans
 * fixtures/dto_synchro.json (back_medconnect/src/pharmacie/dto/synchro.dto.ts).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { VENDEUR, coeurPret, evenements, fermerTout, fiche, uuid, type EvenementLu } from "./aide_tests";

afterEach(fermerTout);

interface ChampDto {
  type: "uuid" | "int" | "string" | "boolean" | "enum" | "tableau" | "objet" | "date";
  obligatoire?: boolean;
  min?: number;
  max?: number;
  longueurMin?: number;
  longueurMax?: number;
  motif?: string;
  valeurs?: string[];
  classe?: string;
}
interface Fixtures {
  types: Record<string, string>;
  enveloppe: Record<string, ChampDto>;
  classes: Record<string, Record<string, ChampDto>>;
  exclusifs: Record<string, string[][]>;
}

const fixtures = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "fixtures", "dto_synchro.json"), "utf8")) as Fixtures;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Liste des écarts d'une valeur avec la description d'un champ de DTO. */
function ecartsChamp(chemin: string, valeur: unknown, champ: ChampDto): string[] {
  const nul = valeur === null || valeur === undefined;
  if (nul) return [`${chemin} : null ou indéfini`];
  switch (champ.type) {
    case "uuid":
      return typeof valeur === "string" && UUID.test(valeur) ? [] : [`${chemin} : UUID attendu`];
    case "int":
      if (typeof valeur !== "number" || !Number.isInteger(valeur)) return [`${chemin} : entier attendu`];
      return valeur < (champ.min ?? -Infinity) || valeur > (champ.max ?? Infinity) ? [`${chemin} : hors bornes (${valeur})`] : [];
    case "string": {
      if (typeof valeur !== "string") return [`${chemin} : texte attendu`];
      const ecarts: string[] = [];
      if (valeur.length < (champ.longueurMin ?? 0) || valeur.length > (champ.longueurMax ?? Infinity)) ecarts.push(`${chemin} : longueur hors bornes`);
      if (champ.motif && !new RegExp(champ.motif).test(valeur)) ecarts.push(`${chemin} : format invalide`);
      if (valeur !== valeur.trim()) ecarts.push(`${chemin} : espaces en bordure`);
      return ecarts;
    }
    case "boolean":
      return typeof valeur === "boolean" ? [] : [`${chemin} : booléen attendu`];
    case "enum":
      return champ.valeurs?.includes(valeur as string) ? [] : [`${chemin} : valeur hors liste`];
    case "date":
      return typeof valeur === "string" && !Number.isNaN(Date.parse(valeur)) ? [] : [`${chemin} : date ISO attendue`];
    case "tableau": {
      if (!Array.isArray(valeur)) return [`${chemin} : tableau attendu`];
      if (valeur.length < (champ.min ?? 0) || valeur.length > (champ.max ?? Infinity)) return [`${chemin} : taille hors bornes (${valeur.length})`];
      return valeur.flatMap((v, i) => (champ.classe ? ecartsClasse(`${chemin}.${i}`, v, champ.classe) : []));
    }
    case "objet":
      if (typeof valeur !== "object" || Array.isArray(valeur)) return [`${chemin} : objet attendu`];
      return champ.classe ? ecartsClasse(chemin, valeur, champ.classe) : [];
  }
}

function ecartsObjet(chemin: string, valeur: unknown, champs: Record<string, ChampDto>, exclusifs: string[][] = []): string[] {
  if (valeur === null || typeof valeur !== "object" || Array.isArray(valeur)) return [`${chemin} : objet attendu`];
  const objet = valeur as Record<string, unknown>;
  const ecarts: string[] = [];
  for (const cle of Object.keys(objet)) {
    if (!(cle in champs)) ecarts.push(`${chemin}.${cle} : clé inconnue du DTO`);
  }
  for (const [cle, champ] of Object.entries(champs)) {
    if (!(cle in objet)) {
      if (champ.obligatoire) ecarts.push(`${chemin}.${cle} : clé obligatoire absente`);
      continue;
    }
    ecarts.push(...ecartsChamp(`${chemin}.${cle}`, objet[cle], champ));
  }
  for (const groupe of exclusifs) {
    if (groupe.filter((cle) => cle in objet).length !== 1) ecarts.push(`${chemin} : une seule clé parmi ${groupe.join(", ")}`);
  }
  return ecarts;
}

function ecartsClasse(chemin: string, valeur: unknown, classe: string): string[] {
  return ecartsObjet(chemin, valeur, fixtures.classes[classe], fixtures.exclusifs[classe]);
}

function ecartsEvenement(e: EvenementLu): string[] {
  const enveloppe = { evenementId: e.evenementId, sequence: e.sequence, type: e.type, horodatageLocal: "2026-11-04T10:00:00.000Z", utilisateurId: e.utilisateurId, corps: e.corps };
  const ecarts = ecartsObjet(`#${e.sequence}`, enveloppe, fixtures.enveloppe);
  const classe = fixtures.types[e.type];
  return classe ? [...ecarts, ...ecartsClasse(`#${e.sequence}.corps`, e.corps, classe)] : [...ecarts, `type inconnu : ${e.type}`];
}

describe("validateur du contrat (garde-fou du test)", () => {
  it("refuse une clé inconnue, une clé obligatoire absente, un null et une borne dépassée", () => {
    expect(ecartsClasse("c", { sessionId: uuid(1), en_trop: 1 }, "CorpsSessionOuverteDto")).toEqual(["c.en_trop : clé inconnue du DTO"]);
    expect(ecartsClasse("c", {}, "CorpsSessionOuverteDto")).toEqual(["c.sessionId : clé obligatoire absente"]);
    expect(ecartsClasse("c", { sessionId: null }, "CorpsSessionOuverteDto")).toHaveLength(1);
    expect(ecartsClasse("c", { mouvementId: uuid(1), sessionId: uuid(2), type: "APPORT", montant: 100_000_001, motif: "ab" }, "CorpsMouvementCaisseDto")).toHaveLength(2);
    const vente = { venteId: uuid(1), sessionId: uuid(2), numeroTicket: 1, numeroSecours: 2, lignes: [], paiements: [], total: 0, ordonnanceVerifiee: false };
    expect(ecartsClasse("c", vente, "CorpsVenteDto").length).toBeGreaterThanOrEqual(3);
  });
});

describe("corps des événements acceptés tels quels par le serveur", () => {
  it("tous les événements d'un scénario complet respectent les DTO du back", () => {
    const plaquette = fiche(2, {
      uniteMinimale: "PLAQUETTE",
      coefficientBoite: 10,
      deconditionnable: true,
      prixUnitaire: 6000,
      prixUnite: 700,
      quantite: 100,
      lots: [{ ...fiche(2).lots[0], solde: 100, coefficientReception: 10 }],
    });
    const perime = fiche(4, { quantite: 10, lots: [{ ...fiche(4).lots[0], dateExpiration: "2026-10-01", solde: 10 }] });
    const { s, c } = coeurPret([fiche(1), plaquette, fiche(3, { quantite: 0, lots: [] }), perime], { plages: [{ id: "p1", debut: 1, fin: 3 }] });
    const a = { stockId: "s1", quantite: 1 };

    // Caisse A : ouverture comptée, ventes variées, mouvements, fermeture avec comptage et commentaire.
    c.ouvrirSession({ id: uuid(1), comptage: { coupures: [{ valeurFaciale: 20000, nombre: 10 }, { valeurFaciale: 500, nombre: 0 }] } }, VENDEUR);
    c.enregistrerVente({ lignes: [a] }, uuid(10), VENDEUR);
    c.enregistrerVente(
      {
        lignes: [{ stockId: "s2", quantite: 2 }, { stockId: "s2", quantite: 3, unite: "UNITE" }, { stockId: "s3", quantite: 1 }],
        // Total : 2 boîtes à 6 000, 3 plaquettes à 700, 1 boîte à 5 000 = 19 100.
        paiements: [
          { mode: "ESPECES", montant: 10000, montantRecu: 20000 },
          { mode: "ORANGE_MONEY", montant: 9100, reference: "OM-1" },
        ],
        clientNom: "Aminata Diallo",
        clientTelephone: "+224 620 00 00 00",
        ordonnanceVerifiee: true,
      },
      uuid(11),
      VENDEUR,
    );
    c.enregistrerVente({ lignes: [{ stockId: "s4", quantite: 2, sortieManuelle: { lotId: "l4", motif: "Accord du titulaire" } }] }, uuid(12), VENDEUR);
    // La plage compte 3 numéros (ventes 10, 11, 12) : la suivante prend un numéro de secours.
    c.enregistrerVente({ lignes: [a] }, uuid(13), VENDEUR);
    c.enregistrerVente({ lignes: [a] }, uuid(14), VENDEUR);
    c.enregistrerMouvement(uuid(1), { id: uuid(2), type: "PRELEVEMENT", montant: 10000, motif: "Dépôt à la banque" }, VENDEUR);
    c.enregistrerMouvement(uuid(1), { id: uuid(3), type: "APPORT", montant: 5000, motif: "Monnaie", mode: "ORANGE_MONEY" }, VENDEUR);
    c.fermerSession(
      uuid(1),
      { comptageFermeture: { id: uuid(4), coupures: [{ valeurFaciale: 20000, nombre: 12 }], releves: [{ mode: "ORANGE_MONEY", montant: 1000 }] }, commentaire: "Écart constaté et expliqué" },
      VENDEUR,
    );

    // Caisse B : comptage de fermeture envoyé seul, puis fermeture qui ne le répète pas.
    c.enregistrerVente({ lignes: [a] }, uuid(15), VENDEUR);
    const sessionB = c.sessionOuverte()?.id as string;
    c.saisirComptage(sessionB, { id: uuid(5), moment: "FERMETURE", coupures: [{ valeurFaciale: 1000, nombre: 1 }], releves: [{ mode: "MTN_MOMO", montant: 0 }] }, VENDEUR);
    c.fermerSession(sessionB, { comptageFermeture: { id: uuid(5), coupures: [{ valeurFaciale: 1000, nombre: 1 }] }, commentaire: "Écart léger" }, VENDEUR);

    const tous = evenements(s);
    const types = new Set(tous.map((e) => e.type));
    expect([...types].sort()).toEqual(["COMPTAGE_SAISI", "MOUVEMENT_CAISSE", "SESSION_FERMEE", "SESSION_OUVERTE", "VENTE"]);
    expect(tous.length).toBe(14);
    expect(tous.flatMap(ecartsEvenement)).toEqual([]);

    // Cohérence interne que le serveur vérifie aussi : total, paiements, un seul numéro.
    for (const e of tous.filter((x) => x.type === "VENTE")) {
      const lignes = e.corps.lignes as { nombre: number; prixUnitaire: number }[];
      const paiements = e.corps.paiements as { montant: number }[];
      expect(lignes.reduce((somme, l) => somme + l.nombre * l.prixUnitaire, 0)).toBe(e.corps.total);
      expect(paiements.reduce((somme, p) => somme + p.montant, 0)).toBe(e.corps.total);
    }
    expect(tous.filter((e) => e.type === "VENTE").map((e) => ("numeroTicket" in e.corps ? "ticket" : "secours"))).toContain("secours");

    // Aucune clé à null, aucun coût, aucune séquence en double.
    const json = tous.map((e) => JSON.stringify(e.corps)).join("\n");
    expect(json).not.toContain("null");
    expect(json).not.toMatch(/cout|marge/i);
    expect(new Set(tous.map((e) => e.sequence)).size).toBe(tous.length);
    expect(tous.map((e) => e.sequence)).toEqual(tous.map((_, i) => i + 1));

    // Le comptage de fermeture de la caisse B n'est pas répété dans SESSION_FERMEE.
    const fermeeB = tous.filter((e) => e.type === "SESSION_FERMEE").at(-1);
    expect(fermeeB?.corps).toEqual({ sessionId: sessionB, commentaire: "Écart léger" });
  });
});
