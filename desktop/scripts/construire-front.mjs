// Construit le front en sortie autonome et le copie dans desktop/dist-front/serveur.
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { exigerAdresseApi } from "./adresse_api.mjs";

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const racineFront = path.resolve(racine, "..");
const cible = path.join(racine, "dist-front", "serveur");

exigerAdresseApi();

const args = ["next", "build"];
if (process.argv.includes("--webpack")) args.push("--webpack");

const build = spawnSync("npx", args, {
  cwd: racineFront,
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
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

console.log(`Fichiers .env* retirés : ${aSupprimer.length}.`);
console.log(`Taille de la sortie : ${(taille / 1024 / 1024).toFixed(1)} Mo.`);
