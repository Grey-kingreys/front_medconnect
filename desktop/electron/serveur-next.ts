// Démarrage et surveillance du serveur Next embarqué (processus utilitaire Electron).
import { app, dialog, utilityProcess, type UtilityProcess } from "electron";
import http from "node:http";
import net from "node:net";
import path from "node:path";

export const PORTS_POSSIBLES = [47613, 47614, 47615];
const ADRESSE = "127.0.0.1";
const DELAI_MAX_MS = 45_000;
const VERIFICATION_TARDIVE_MS = 1500;

let serveur: UtilityProcess | null = null;
let serveurVivant = false;
let arretVoulu = false;
let relancesFaites = 0;
let demarrageEnCours = true;

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

function portLibre(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const test = net.createServer();
    test.once("error", () => resolve(false));
    test.once("listening", () => test.close(() => resolve(true)));
    test.listen(port, ADRESSE);
  });
}

export function erreurFatale(message: string): never {
  dialog.showErrorBox("MedConnecte Caisse", message);
  app.exit(1);
  throw new Error(message);
}

function cheminServeur(): string {
  const base = app.isPackaged ? process.resourcesPath : path.resolve(app.getAppPath());
  return path.join(base, "dist-front", "serveur", "server.js");
}

export function pidServeur(): number | undefined {
  return serveur?.pid;
}

function lancerServeur(port: number): void {
  const chemin = cheminServeur();
  const enfant = utilityProcess.fork(chemin, [], {
    cwd: path.dirname(chemin),
    serviceName: "serveur-next",
    stdio: "pipe",
    env: {
      ...process.env,
      PORT: String(port),
      HOSTNAME: ADRESSE,
      NODE_ENV: "production",
      NEXT_TELEMETRY_DISABLED: "1",
    } as Record<string, string>,
  });
  // La sortie est lue pour ne pas bloquer le processus, jamais journalisée.
  enfant.stdout?.on("data", () => {});
  enfant.stderr?.on("data", () => {});
  serveur = enfant;
  serveurVivant = true;
  enfant.on("exit", () => {
    if (serveur !== enfant) return;
    serveurVivant = false;
    // Pendant le démarrage, l'échec est géré par demarrerServeur (port suivant).
    if (arretVoulu || demarrageEnCours) return;
    if (relancesFaites < 1) {
      relancesFaites += 1;
      lancerServeur(port);
      return;
    }
    erreurFatale("MedConnecte Caisse s'est arrêtée de façon inattendue. Relancez l'application.");
  });
}

export function arreterServeur(): void {
  arretVoulu = true;
  const enfant = serveur;
  serveur = null;
  enfant?.kill();
}

function repondEn200(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const requete = http.get({ host: ADRESSE, port, path: "/auth/login", timeout: 2000 }, (reponse) => {
      reponse.resume();
      resolve(reponse.statusCode === 200);
    });
    requete.on("error", () => resolve(false));
    requete.on("timeout", () => {
      requete.destroy();
      resolve(false);
    });
  });
}

/** Attend que le serveur réponde 200 sur /auth/login (200 ms d'intervalle, 45 s au plus) tant que notre enfant vit. */
async function attendreServeur(port: number): Promise<boolean> {
  const fin = Date.now() + DELAI_MAX_MS;
  while (Date.now() < fin && serveurVivant) {
    if (await repondEn200(port)) return true;
    await pause(200);
  }
  return false;
}

/**
 * Lance le serveur sur le premier port libre et renvoie ce port, ou null si aucun ne convient.
 * Un 200 ne suffit pas : un autre programme a pu prendre le port entre le test et le lancement.
 * On exige donc que NOTRE processus soit encore vivant après la réponse, et encore un peu plus tard.
 */
export async function demarrerServeur(): Promise<number | null> {
  demarrageEnCours = true;
  try {
    for (const port of PORTS_POSSIBLES) {
      if (!(await portLibre(port))) continue;
      lancerServeur(port);
      const repond = await attendreServeur(port);
      if (repond && serveurVivant) {
        await pause(VERIFICATION_TARDIVE_MS);
        if (serveurVivant && (await repondEn200(port))) return port;
      }
      arreterServeurDuDemarrage();
    }
    return null;
  } finally {
    demarrageEnCours = false;
  }
}

function arreterServeurDuDemarrage(): void {
  const enfant = serveur;
  serveur = null;
  serveurVivant = false;
  enfant?.kill();
}
