/**
 * Écriture d'un classeur .xlsx à une feuille, sans dépendance : un classeur est une archive ZIP de fichiers XML,
 * écrite ici avec `node:zlib` seulement (rien de plus à empaqueter dans l'installateur). Pur : aucun accès disque,
 * aucun import d'Electron. Cellules : texte (chaîne en ligne), nombre, date (chaîne AAAA-MM-JJ d'une colonne de
 * date, écrite en vraie date Excel) ou vide. Tout texte est écrit en chaîne en ligne (`inlineStr`) : Excel ne
 * l'évalue jamais comme une formule, même s'il commence par `=`, `+`, `-` ou `@` (pas d'injection de formule).
 */
import { crc32, deflateRawSync } from "node:zlib";

export interface ColonneXlsx {
  header: string;
  width: number;
}

export type CelluleXlsx = string | number | null;

export interface EntreeClasseur {
  /** Nom de la feuille (31 caractères au plus, sans les caractères interdits par Excel). */
  feuille: string;
  colonnes: readonly ColonneXlsx[];
  lignes: readonly (readonly CelluleXlsx[])[];
  /** Indices (à partir de 0) des colonnes dont les chaînes AAAA-MM-JJ deviennent des dates. */
  colonnesDate?: readonly number[];
}

const ENTETE_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

/** Échappe le texte d'un nœud XML et retire les caractères interdits en XML 1.0. */
function echapper(texte: string): string {
  return texte
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Lettres de colonne : 0 donne A, 25 donne Z, 26 donne AA. */
export function lettreColonne(indice: number): string {
  let n = indice;
  let lettres = "";
  do {
    lettres = String.fromCharCode(65 + (n % 26)) + lettres;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return lettres;
}

/** Numéro de série Excel (jours depuis le 30/12/1899) d'une date AAAA-MM-JJ, ou null si elle est illisible. */
export function serieExcel(jour: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(jour);
  if (m === null) return null;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(t);
  if (d.getUTCFullYear() !== Number(m[1]) || d.getUTCMonth() !== Number(m[2]) - 1 || d.getUTCDate() !== Number(m[3])) return null;
  return Math.round((t - Date.UTC(1899, 11, 30)) / 86_400_000);
}

const STYLE_TITRE = 1;
const STYLE_DATE = 2;

function feuilleXml(e: EntreeClasseur): string {
  const dates = new Set(e.colonnesDate ?? []);
  const colonnes = e.colonnes.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width}" customWidth="1"/>`).join("");
  const rangees: string[] = [];
  rangees.push(
    `<row r="1">${e.colonnes
      .map((c, i) => `<c r="${lettreColonne(i)}1" s="${STYLE_TITRE}" t="inlineStr"><is><t xml:space="preserve">${echapper(c.header)}</t></is></c>`)
      .join("")}</row>`,
  );
  e.lignes.forEach((ligne, r) => {
    const numero = r + 2;
    const cellules: string[] = [];
    ligne.forEach((valeur, i) => {
      const ref = `${lettreColonne(i)}${numero}`;
      if (valeur === null || valeur === "") return;
      if (typeof valeur === "number") {
        if (Number.isFinite(valeur)) cellules.push(`<c r="${ref}"><v>${valeur}</v></c>`);
        return;
      }
      const serie = dates.has(i) ? serieExcel(valeur) : null;
      if (serie !== null) cellules.push(`<c r="${ref}" s="${STYLE_DATE}"><v>${serie}</v></c>`);
      else cellules.push(`<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${echapper(valeur)}</t></is></c>`);
    });
    rangees.push(`<row r="${numero}">${cellules.join("")}</row>`);
  });
  return (
    ENTETE_XML +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${colonnes}</cols><sheetData>${rangees.join("")}</sheetData></worksheet>`
  );
}

const STYLES_XML =
  ENTETE_XML +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<numFmts count="1"><numFmt numFmtId="164" formatCode="yyyy\\-mm\\-dd"/></numFmts>' +
  '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
  '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>' +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

const TYPES_XML =
  ENTETE_XML +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
  '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
  '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>';

const RELS_XML =
  ENTETE_XML +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';

const RELS_CLASSEUR_XML =
  ENTETE_XML +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
  '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';

function classeurXml(feuille: string): string {
  return (
    ENTETE_XML +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    `<sheets><sheet name="${echapper(feuille).replace(/"/g, "&quot;")}" sheetId="1" r:id="rId1"/></sheets></workbook>`
  );
}

/** Archive ZIP (méthode « deflate ») de fichiers texte UTF-8. */
function zip(fichiers: readonly { nom: string; contenu: string }[]): Buffer {
  const locaux: Buffer[] = [];
  const centraux: Buffer[] = [];
  let decalage = 0;
  for (const f of fichiers) {
    const nom = Buffer.from(f.nom, "utf8");
    const brut = Buffer.from(f.contenu, "utf8");
    const compresse = deflateRawSync(brut);
    const crc = crc32(brut) >>> 0;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version nécessaire
    local.writeUInt16LE(0x0800, 6); // noms en UTF-8
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(0, 10); // heure
    local.writeUInt16LE(0x21, 12); // date : 01/01/1980
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compresse.length, 18);
    local.writeUInt32LE(brut.length, 22);
    local.writeUInt16LE(nom.length, 26);
    local.writeUInt16LE(0, 28);
    locaux.push(local, nom, compresse);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0x21, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compresse.length, 20);
    central.writeUInt32LE(brut.length, 24);
    central.writeUInt16LE(nom.length, 28);
    central.writeUInt32LE(decalage, 42);
    centraux.push(central, nom);

    decalage += local.length + nom.length + compresse.length;
  }
  const tailleCentral = centraux.reduce((s, b) => s + b.length, 0);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(fichiers.length, 8);
  fin.writeUInt16LE(fichiers.length, 10);
  fin.writeUInt32LE(tailleCentral, 12);
  fin.writeUInt32LE(decalage, 16);
  return Buffer.concat([...locaux, ...centraux, fin]);
}

/** Classeur .xlsx d'une feuille : titres en gras sur la ligne 1 (figée), puis une ligne par entrée. */
export function genererXlsx(e: EntreeClasseur): Buffer {
  return zip([
    { nom: "[Content_Types].xml", contenu: TYPES_XML },
    { nom: "_rels/.rels", contenu: RELS_XML },
    { nom: "xl/workbook.xml", contenu: classeurXml(e.feuille) },
    { nom: "xl/_rels/workbook.xml.rels", contenu: RELS_CLASSEUR_XML },
    { nom: "xl/styles.xml", contenu: STYLES_XML },
    { nom: "xl/worksheets/sheet1.xml", contenu: feuilleXml(e) },
  ]);
}
