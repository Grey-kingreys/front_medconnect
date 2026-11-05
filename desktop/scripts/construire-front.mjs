// Construit le front en sortie autonome et le copie dans desktop/dist-front/serveur.
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { exigerAdresseApi } from "./adresse_api.mjs";

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const racineFront = path.resolve(racine, "..");
const cible = path.join(racine, "dist-front", "serveur");

exigerAdresseApi();

// Aucun fichier .env* n'est une entrée de ce build : Next les lit à la racine du front et inlinerait leurs
// variables NEXT_PUBLIC_*. Une variable déjà définie dans l'environnement n'est jamais écrasée par un fichier :
// on définit donc (vides) toutes celles que ces fichiers nomment, sans jamais lire ni afficher leurs valeurs.
const environnementBuild = { ...process.env };
let variablesNeutralisees = 0;
for (const nomFichier of readdirSync(racineFront)) {
  if (!nomFichier.startsWith(".env") || !statSync(path.join(racineFront, nomFichier)).isFile()) continue;
  for (const ligne of readFileSync(path.join(racineFront, nomFichier), "utf8").split(/\r?\n/)) {
    const lue = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(ligne);
    if (lue && !["NODE_ENV", "NEXT_OUTPUT"].includes(lue[1]) && environnementBuild[lue[1]] === undefined) {
      environnementBuild[lue[1]] = "";
      variablesNeutralisees += 1;
    }
  }
}
console.log(`Variables des fichiers .env* neutralisées pour ce build : ${variablesNeutralisees}.`);

const args = ["next", "build"];
if (process.argv.includes("--webpack")) args.push("--webpack");

const build = spawnSync("npx", args, {
  cwd: racineFront,
  stdio: "inherit",
  shell: true,
  env: {
    ...environnementBuild,
    NEXT_OUTPUT: "standalone",
    NEXT_PUBLIC_BASE_URL: "http://127.0.0.1:47613",
    NEXT_TELEMETRY_DISABLED: "1",
  },
});
if (build.status !== 0) {
  console.error("La construction du front a échoué.");
  process.exit(1);
}

const standalone = path.join(racineFront, ".next", "standalone");
if (!existsSync(standalone)) {
  console.error("Sortie autonome introuvable : .next/standalone n'existe pas.");
  process.exit(1);
}

rmSync(cible, { recursive: true, force: true });
mkdirSync(cible, { recursive: true });
cpSync(standalone, cible, {
  recursive: true,
  dereference: true,
  // Le cache de build n'a rien à faire dans l'application.
  filter: (source) => path.relative(standalone, source).replaceAll("\\", "/") !== ".next/cache",
});
cpSync(path.join(racineFront, ".next", "static"), path.join(cible, ".next", "static"), {
  recursive: true,
  dereference: true,
});
cpSync(path.join(racineFront, "public"), path.join(cible, "public"), { recursive: true, dereference: true });

/** Parcourt la copie : appelle `visiter` pour chaque entrée, renvoie la taille totale en octets. */
function parcourir(dossier, visiter) {
  let total = 0;
  for (const nom of readdirSync(dossier)) {
    const chemin = path.join(dossier, nom);
    const st = statSync(chemin);
    visiter(chemin, nom, st.isDirectory());
    total += st.isDirectory() ? parcourir(chemin, visiter) : st.size;
  }
  return total;
}

// Aucun fichier .env* ne doit partir dans l'application.
const aSupprimer = [];
parcourir(cible, (chemin, nom, estDossier) => {
  if (!estDossier && nom.startsWith(".env")) aSupprimer.push(chemin);
});
for (const chemin of aSupprimer) rmSync(chemin, { force: true });

// Aucune carte de source (.map) : elles redonneraient le code d'origine (D759).
const cartes = [];
parcourir(cible, (chemin, nom, estDossier) => {
  if (!estDossier && nom.endsWith(".map")) cartes.push(chemin);
});
for (const chemin of cartes) rmSync(chemin, { force: true });

// Chemins du poste de build (D751) : remplacés par `.` dans les deux fichiers qui les portent, sans toucher au reste.
// Le chemin apparaît avec des antislashs doublés (JSON, chaîne JS), simples, ou avec des barres obliques.
const racineAbsolue = racineFront;
const variantes = [racineAbsolue.replaceAll("\\", "\\\\"), racineAbsolue, racineAbsolue.replaceAll("\\", "/")];
let remplacements = 0;
for (const relatif of ["server.js", path.join(".next", "required-server-files.json")]) {
  const fichier = path.join(cible, relatif);
  let texte = readFileSync(fichier, "utf8");
  for (const variante of variantes) {
    const morceaux = texte.split(variante);
    remplacements += morceaux.length - 1;
    texte = morceaux.join(".");
  }
  writeFileSync(fichier, texte);
}

const restants = [];
const taille = parcourir(cible, (chemin, nom, estDossier) => {
  if (!estDossier && nom.startsWith(".env")) restants.push(chemin);
});
if (restants.length > 0) {
  console.error(`Fichiers .env* encore présents dans la copie : ${restants.length}.`);
  process.exit(1);
}

if (!existsSync(path.join(cible, "server.js"))) {
  console.error("server.js n'est pas à la racine de la copie : la racine de traçage est fausse.");
  process.exit(1);
}

console.log(`Fichiers .env* retirés : ${aSupprimer.length}. Cartes de source retirées : ${cartes.length}. Chemins du poste remplacés : ${remplacements}.`);
console.log(`Taille de la sortie : ${(taille / 1024 / 1024).toFixed(1)} Mo.`);
