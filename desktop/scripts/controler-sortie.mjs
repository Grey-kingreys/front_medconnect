// Contrôle de l'application empaquetée (PD06, D759). Code 1 au moindre manque ou à la moindre fuite.
// Vérifie : fichiers attendus, aucun fichier .env*, aucune carte de source (.map), aucun chemin du poste de build,
// aucun secret (motifs connus, et valeurs des fichiers .env* du dépôt : seules les NOMS des variables fautives sont affichés).
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import asar from "@electron/asar";

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const racineFront = path.resolve(racine, "..");
const sortie = path.join(racine, "sortie");
const paquet = path.join(sortie, "win-unpacked");
const ressources = path.join(paquet, "resources");
const serveur = path.join(ressources, "dist-front", "serveur");
const fichierAsar = path.join(ressources, "app.asar");

const erreurs = [];
const manque = (message) => erreurs.push(message);

/** Liste récursive des fichiers d'un dossier. */
function fichiers(dossier) {
  const liste = [];
  for (const nom of readdirSync(dossier)) {
    const chemin = path.join(dossier, nom);
    if (statSync(chemin).isDirectory()) liste.push(...fichiers(chemin));
    else liste.push(chemin);
  }
  return liste;
}

// 1. Fichiers attendus.
const attendus = [
  [path.join(serveur, "server.js"), "serveur Next : server.js"],
  [path.join(serveur, ".next", "static"), "serveur Next : .next/static"],
  [path.join(serveur, "node_modules"), "serveur Next : node_modules"],
  [fichierAsar, "app.asar"],
  [path.join(ressources, "app.asar.unpacked", "node_modules", "better-sqlite3", "prebuilds", "win32-x64.node"), "better-sqlite3 : win32-x64.node hors de l'asar"],
];
for (const [chemin, libelle] of attendus) if (!existsSync(chemin)) manque(`Manque : ${libelle}.`);
if (!existsSync(paquet)) {
  console.error("Contrôle impossible : sortie/win-unpacked n'existe pas. Lancez d'abord l'empaquetage.");
  process.exit(1);
}
const installateurs = existsSync(sortie) ? readdirSync(sortie).filter((n) => /^MedConnecte Caisse Setup .+\.exe$/.test(n)) : [];
if (installateurs.length === 0) manque("Manque : l'installateur « MedConnecte Caisse Setup <version>.exe » dans sortie/.");

// 2. Contenu de l'asar, extrait dans un dossier temporaire.
const temp = mkdtempSync(path.join(os.tmpdir(), "mc-controle-"));
const dansAsar = path.join(temp, "app");
mkdirSync(dansAsar, { recursive: true });
try {
  if (existsSync(fichierAsar)) asar.extractAll(fichierAsar, dansAsar);

  // L'archive seule est écartée (lue par son extraction) : `app.asar.unpacked` reste contrôlé.
  const tous = fichiers(ressources).filter((f) => f !== fichierAsar);
  const dansAsarFichiers = fichiers(dansAsar);
  const tousLesFichiers = [...tous, ...dansAsarFichiers];

  // 3. Aucun .env*, aucun .map (nom exact du fichier, node_modules compris).
  for (const f of tousLesFichiers) {
    const nom = path.basename(f);
    if (nom.startsWith(".env")) manque(`Fichier d'environnement dans le paquet : ${path.relative(ressources, f).replaceAll("\\", "/")}`);
    if (nom.endsWith(".map")) manque(`Carte de source dans le paquet : ${path.relative(ressources, f).replaceAll("\\", "/")}`);
  }

  // 3 bis. Cœur en bytecode seulement : principal.jsc présent dans l'asar, aucune source du cœur lisible.
  const relatifAsar = (f) => path.relative(dansAsar, f).replaceAll("\\", "/");
  const dansAsarRel = dansAsarFichiers.map(relatifAsar).filter((r) => !r.startsWith("node_modules/"));
  if (!dansAsarRel.includes("dist/principal.jsc")) manque("Manque : dist/principal.jsc (bytecode du processus principal) dans l'asar.");
  if (dansAsarRel.includes("dist/principal.js")) manque("Source lisible dans l'asar : dist/principal.js.");
  for (const r of dansAsarRel) {
    if (/\.tsx?$/.test(r) || r.startsWith("coeur/") || r.startsWith("electron/")) manque(`Source du cœur dans l'asar : ${r}`);
    if (r.startsWith("dist/") && /\.(js|cjs|mjs)$/.test(r) && !["dist/main.cjs", "dist/preload.cjs"].includes(r)) manque(`Source JavaScript inattendue dans l'asar : ${r}`);
  }

  // 3 ter. L'adresse d'API attendue (NEXT_PUBLIC_API_URL) est dans le bytecode et dans le code du site ; aucune autre valeur n'est affichée.
  const attendue = process.env.NEXT_PUBLIC_API_URL ?? "";
  if (attendue === "") {
    manque("NEXT_PUBLIC_API_URL n'est pas définie : impossible de vérifier l'adresse d'API du paquet.");
  } else {
    const dansBytecode = existsSync(path.join(dansAsar, "dist", "principal.jsc")) && readFileSync(path.join(dansAsar, "dist", "principal.jsc")).includes(attendue);
    if (!dansBytecode) manque("L'adresse d'API attendue est absente du processus principal (principal.jsc).");
    const statique = path.join(serveur, ".next", "static");
    const dansSite = existsSync(statique) && fichiers(statique).some((f) => f.endsWith(".js") && readFileSync(f).includes(attendue));
    if (!dansSite) manque("L'adresse d'API attendue est absente du code du site (.next/static).");
    if (dansBytecode && dansSite) console.log(`Adresse d'API attendue : présente dans le processus principal et dans le site (${attendue}).`);
  }

  // 4. Chemin du poste de build : .js et .json hors node_modules.
  const racineBuild = racineFront;
  const formes = [racineBuild, racineBuild.replaceAll("\\", "\\\\"), racineBuild.replaceAll("\\", "/")].map((s) => s.toLowerCase());
  const horsModules = (f) => !f.split(path.sep).includes("node_modules");
  for (const f of tousLesFichiers.filter((x) => /\.(js|cjs|mjs|json|jsc)$/.test(x) && horsModules(x))) {
    const texte = readFileSync(f, "latin1").toLowerCase();
    if (formes.some((forme) => texte.includes(forme))) {
      manque(`Chemin du poste de build trouvé dans : ${path.relative(ressources, f).replaceAll("\\", "/")}`);
    }
  }

  // 5. Secrets : motifs connus, hors node_modules, dans le texte du paquet.
  const motifs = [
    [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "clé privée"],
    [/\bAKIA[0-9A-Z]{16}\b/, "clé d'accès AWS"],
    [/\bsk_(live|test)_[0-9A-Za-z]{16,}/, "clé secrète de paiement"],
    [/\bre_[A-Za-z0-9]{20,}/, "clé Resend"],
    [/\bJWT_SECRET\b/, "nom JWT_SECRET"],
    [/\bENCRYPTION_KEY\b/, "nom ENCRYPTION_KEY"],
    [/\bR2_SECRET_ACCESS_KEY\b/, "nom R2_SECRET_ACCESS_KEY"],
    [/\bRESEND_API_KEY\b/, "nom RESEND_API_KEY"],
    [/\bNIMBA_[A-Z_]*(KEY|SECRET)\b/, "clé Nimba"],
    [/\bAI_SHARED_SECRET\b/, "nom AI_SHARED_SECRET"],
  ];
  for (const f of tousLesFichiers.filter((x) => /\.(js|cjs|mjs|jsc|json|html|css|txt)$/.test(x) && horsModules(x))) {
    const texte = readFileSync(f, "latin1");
    for (const [motif, libelle] of motifs) {
      if (motif.test(texte)) manque(`Secret possible (${libelle}) dans : ${path.relative(ressources, f).replaceAll("\\", "/")}`);
    }
  }

  // 6. Valeurs des fichiers .env* du dépôt : jamais affichées, seul le NOM de la variable est cité.
  const valeurs = new Map();
  const dossiersEnv = [racineFront, path.resolve(racineFront, "..")];
  for (const dossier of dossiersEnv) {
    if (!existsSync(dossier)) continue;
    for (const nom of readdirSync(dossier)) {
      if (!nom.startsWith(".env") || !statSync(path.join(dossier, nom)).isFile()) continue;
      for (const ligne of readFileSync(path.join(dossier, nom), "utf8").split(/\r?\n/)) {
        const lue = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(ligne);
        if (!lue) continue;
        // NEXT_PUBLIC_* : publiques par conception, inlinées dans le paquet (vérifiées à l'étape 3 ter).
        if (lue[1].startsWith("NEXT_PUBLIC_")) continue;
        const valeur = lue[2].trim().replace(/^["']|["']$/g, "");
        // Les valeurs courtes ou banales (ports, booléens, noms) feraient de fausses alertes.
        if (valeur.length >= 16 && !/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(valeur)) valeurs.set(lue[1], valeur);
      }
    }
  }
  const fautives = new Set();
  const binaire = /\.(node|exe|dll|png|jpg|jpeg|ico|woff2?|ttf|pak|bin|dat|br|gz|zip|icns|webp|avif)$/i;
  for (const f of tousLesFichiers.filter((x) => !binaire.test(x))) {
    if (statSync(f).size > 20 * 1024 * 1024) continue;
    const contenu = readFileSync(f);
    for (const [nom, valeur] of valeurs) if (contenu.includes(valeur)) fautives.add(nom);
  }
  for (const nom of fautives) manque(`La valeur de la variable ${nom} (fichiers .env*) se retrouve dans le paquet.`);

  // Comptes rendus.
  console.log(`Fichiers contrôlés : ${tousLesFichiers.length} (asar compris).`);
  console.log(`Valeurs de .env* recherchées : ${valeurs.size} (aucune n'est affichée).`);
} finally {
  rmSync(temp, { recursive: true, force: true });
}

if (erreurs.length > 0) {
  console.error(`Contrôle de la sortie : ${erreurs.length} problème(s).`);
  for (const e of erreurs) console.error(` - ${e}`);
  process.exit(1);
}
if (installateurs.length > 0) {
  for (const nom of installateurs) {
    console.log(`Installateur : sortie/${nom} (${(statSync(path.join(sortie, nom)).size / 1024 / 1024).toFixed(1)} Mo).`);
  }
}
console.log("Contrôle de la sortie : aucun .env*, aucune carte de source, aucun chemin du poste, aucun secret.");
