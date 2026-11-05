// Après l'empaquetage (`afterPack`) : copie du serveur Next dans resources/, puis fusibles d'Electron.
// La copie est faite ici et non par `extraResources` : les filtres d'electron-builder écartent `node_modules`
// et les dossiers à point (`.next`), sans prévenir.
// Le serveur reste en dossier : essayé dans une archive `serveur.asar`, Electron refuse de l'ouvrir
// ("Failed to find file integrity info") tant que le fusible d'intégrité est actif (D759, mesure 5, abandonnée).
const { cpSync, existsSync } = require("node:fs");
const path = require("node:path");
const fusibles = require("./fusibles.cjs").default;

exports.default = async function apresEmpaquetage(contexte) {
  const source = path.resolve(__dirname, "..", "dist-front", "serveur");
  if (!existsSync(path.join(source, "server.js"))) {
    throw new Error("dist-front/serveur est absent : lancez d'abord `npm run construire:front`.");
  }
  cpSync(source, path.join(contexte.appOutDir, "resources", "dist-front", "serveur"), { recursive: true, dereference: true });
  await fusibles(contexte);
};
