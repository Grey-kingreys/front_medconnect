// Lance electron-builder sur l'application construite. Variables facultatives :
// - MC_MAJ_URL : adresse des mises à jour (https, ou http sur 127.0.0.1) ; absente : mises à jour manuelles, aucun latest.yml ;
// - MC_VERSION_PAQUET : remplace la version du paquet (preuve de mise à jour 0.1.0 vers 0.1.1), package.json reste intact.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(racine, "node_modules", "electron-builder", "cli.js");

const args = [cli, "--win", "--x64", "--config", "electron-builder.yml", "--publish", "never"];

const adresseMaj = process.env.MC_MAJ_URL ?? "";
if (adresseMaj !== "") {
  let sure = false;
  try {
    const url = new URL(adresseMaj);
    sure = url.protocol === "https:" || (url.protocol === "http:" && url.hostname === "127.0.0.1");
  } catch {
    sure = false;
  }
  if (!sure) {
    console.error("MC_MAJ_URL doit être en https:// (ou http://127.0.0.1 pour une preuve sur ce poste).");
    process.exit(1);
  }
  args.push("-c.publish.provider=generic", `-c.publish.url=${adresseMaj}`);
}

const version = process.env.MC_VERSION_PAQUET ?? "";
if (version !== "") {
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    console.error("MC_VERSION_PAQUET doit avoir la forme 1.2.3.");
    process.exit(1);
  }
  args.push(`-c.extraMetadata.version=${version}`);
}

// Options en plus (par exemple --dir : dossier seul, sans installateur).
args.push(...process.argv.slice(2));

const resultat = spawnSync(process.execPath, args, {
  cwd: racine,
  stdio: "inherit",
  env: { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: "false" },
});
process.exit(resultat.status ?? 1);
