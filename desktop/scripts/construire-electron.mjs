// Construit le processus principal et le préchargement d'Electron dans dist/.
// Par défaut le processus principal et le cœur sont compilés en bytecode V8 (D759) ; `--sans-bytecode` garde un
// fichier lisible, pour le développement et la sonde.
import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { exigerAdresseApi } from "./adresse_api.mjs";

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(racine, "dist");
const avecBytecode = !process.argv.includes("--sans-bytecode");

// L'adresse de l'API est figée dans le processus principal au build, comme pour le front (jamais lue d'un fichier).
const adresseApi = exigerAdresseApi();
mkdirSync(dist, { recursive: true });
for (const reste of ["main.cjs", "principal.js", "principal.jsc"]) rmSync(path.join(dist, reste), { force: true });

await build({
  entryPoints: [path.join(racine, "electron/main.ts")],
  outfile: path.join(dist, avecBytecode ? "principal.js" : "main.cjs"),
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node24",
  external: ["electron", "better-sqlite3"],
  // Code resserré (noms courts, espaces retirés) quand il part chez une officine.
  minify: avecBytecode,
  legalComments: "none",
  // Adresses figées au build : API, et mises à jour (absente : mises à jour manuelles).
  define: {
    "process.env.NEXT_PUBLIC_API_URL": JSON.stringify(adresseApi),
    "process.env.MC_MAJ_URL": process.env.MC_MAJ_URL ? JSON.stringify(process.env.MC_MAJ_URL) : "undefined",
  },
  logLevel: "warning",
});

if (avecBytecode) {
  // Le bytecode n'est valable que pour la version exacte de V8 qui le produit : on compile avec Electron lui-même.
  const exeElectron = createRequire(import.meta.url)("electron");
  const compilation = spawnSync(
    exeElectron,
    [path.join(racine, "scripts", "compiler-bytecode.cjs"), path.join(dist, "principal.js"), path.join(dist, "principal.jsc")],
    { cwd: racine, stdio: "inherit", env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" }, timeout: 120_000 },
  );
  if (compilation.status !== 0) {
    console.error("La compilation en bytecode a échoué.");
    process.exit(1);
  }
  rmSync(path.join(dist, "principal.js"), { force: true });
  // Petit chargeur lisible (et le chargeur de bytenode), seul point d'entrée.
  await build({
    entryPoints: [path.join(racine, "scripts/chargeur.cjs")],
    outfile: path.join(dist, "main.cjs"),
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node24",
    external: ["electron", "./principal.jsc"],
    legalComments: "none",
    logLevel: "warning",
  });
}

// Préchargement en bac à sable : un seul fichier CommonJS (le bac à sable ne charge pas de bytecode).
await build({
  entryPoints: [path.join(racine, "electron/preload.ts")],
  outfile: path.join(dist, "preload.cjs"),
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node24",
  external: ["electron"],
  minify: avecBytecode,
  legalComments: "none",
  logLevel: "warning",
});

cpSync(path.join(racine, "electron/attente.html"), path.join(dist, "attente.html"));
cpSync(path.join(racine, "..", "public/icons/icon-192x192.png"), path.join(dist, "icon-192x192.png"));
console.log(`Application construite dans desktop/dist${avecBytecode ? " (bytecode V8)" : " (lisible)"}.`);
