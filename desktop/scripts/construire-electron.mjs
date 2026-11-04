// Construit le processus principal et le préchargement d'Electron dans dist/.
import { build } from "esbuild";
import { cpSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { exigerAdresseApi } from "./adresse_api.mjs";

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(racine, "dist");

// L'adresse de l'API est figée dans le processus principal au build, comme pour le front (jamais lue d'un fichier).
const adresseApi = exigerAdresseApi();
mkdirSync(dist, { recursive: true });

await build({
  entryPoints: [path.join(racine, "electron/main.ts")],
  outfile: path.join(dist, "main.cjs"),
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node24",
  external: ["electron", "better-sqlite3"],
  define: { "process.env.NEXT_PUBLIC_API_URL": JSON.stringify(adresseApi) },
  logLevel: "warning",
});

// Préchargement en bac à sable : un seul fichier CommonJS.
await build({
  entryPoints: [path.join(racine, "electron/preload.ts")],
  outfile: path.join(dist, "preload.cjs"),
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node24",
  external: ["electron"],
  logLevel: "warning",
});

cpSync(path.join(racine, "electron/attente.html"), path.join(dist, "attente.html"));
cpSync(path.join(racine, "..", "public/icons/icon-192x192.png"), path.join(dist, "icon-192x192.png"));
console.log("Application construite dans desktop/dist.");
