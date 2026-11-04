/**
 * Validateur des corps d'envoi, à l'image du ValidationPipe du back (whitelist + forbidNonWhitelisted).
 * Les listes de clés et les bornes viennent de dto_synchro.json (copie de
 * back_medconnect/src/pharmacie/dto/synchro.dto.ts et dto/sessions-caisse.dto.ts).
 * Utilisé par le faux serveur : tout corps envoyé par le moteur est contrôlé.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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

const fixtures = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "dto_synchro.json"), "utf8")) as Fixtures;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function ecartsChamp(chemin: string, valeur: unknown, champ: ChampDto): string[] {
  if (valeur === null || valeur === undefined) return [`${chemin} : null ou indéfini`];
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

/** Écarts d'un événement (enveloppe puis corps selon son type). */
export function ecartsEvenement(evenement: unknown, chemin: string): string[] {
  const ecarts = ecartsObjet(chemin, evenement, fixtures.enveloppe);
  const type = (evenement as { type?: string } | null)?.type;
  const classe = type === undefined ? undefined : fixtures.types[type];
  if (classe === undefined) return [...ecarts, `${chemin} : type inconnu`];
  return [...ecarts, ...ecartsClasse(`${chemin}.corps`, (evenement as { corps?: unknown }).corps, classe)];
}

/** Écarts d'un lot complet : `{ posteId, etat: { fileVide, sessionOuverte, versionApp }, evenements }`, 200 événements au plus. */
export function ecartsLot(lot: unknown): string[] {
  const champs: Record<string, ChampDto> = {
    posteId: { type: "string", longueurMin: 1, longueurMax: 64, obligatoire: true },
    etat: { type: "objet", obligatoire: true },
    evenements: { type: "tableau", max: 200, obligatoire: true },
  };
  const ecarts = ecartsObjet("lot", lot, champs);
  const l = lot as { etat?: unknown; evenements?: unknown };
  ecarts.push(
    ...ecartsObjet(
      "lot.etat",
      l.etat,
      {
        fileVide: { type: "boolean", obligatoire: true },
        sessionOuverte: { type: "boolean", obligatoire: true },
        versionApp: { type: "string", longueurMin: 1, longueurMax: 32, obligatoire: true },
      },
      [],
    ),
  );
  if (Array.isArray(l.evenements)) l.evenements.forEach((e, i) => ecarts.push(...ecartsEvenement(e, `lot.evenements.${i}`)));
  return ecarts;
}
