// Processus principal : fenêtre, serveur Next local, garde-fous de navigation.
import { app, BrowserWindow, Menu, session, shell } from "electron";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { demarrerMesureMemoire } from "./memoire";
import { lancerSonde } from "./sonde";
import { arreterServeur, demarrerServeur, erreurFatale, pidServeur } from "./serveur-next";

// Réduction de mémoire (fiche PD01, section 5, étape a).
app.disableHardwareAcceleration();
const sondeActive = process.env.MC_SONDE === "1" && !app.isPackaged;
let fenetre: BrowserWindow | null = null;
let origine = "";

function creerFenetre(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: !sondeActive,
    backgroundColor: "#f8fafc",
    title: "MedConnecte Caisse",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      devTools: !app.isPackaged,
      backgroundThrottling: false,
      preload: path.join(__dirname, "preload.cjs"),
      additionalArguments: [`--mc-version=${app.getVersion()}`],
    },
  });

  const urlAttente = pathToFileURL(path.join(__dirname, "attente.html")).href;
  /** Même origine que le serveur local, ou l'écran d'attente exact. */
  const verifier = (url: string): boolean => {
    try {
      return url === urlAttente || (origine !== "" && new URL(url).origin === origine);
    } catch {
      return false;
    }
  };
  const traiterLienExterne = (url: string) => {
    try {
      if (new URL(url).protocol === "https:") void shell.openExternal(url);
    } catch {
      // Adresse illisible : refusée.
    }
  };

  win.webContents.on("will-navigate", (evenement, url) => {
    if (verifier(url)) return;
    evenement.preventDefault();
    traiterLienExterne(url);
  });
  win.webContents.on("will-redirect", (evenement, url) => {
    if (verifier(url)) return;
    evenement.preventDefault();
    traiterLienExterne(url);
  });
  // Aucune nouvelle fenêtre : seuls les liens https s'ouvrent, dans le navigateur du système.
  win.webContents.setWindowOpenHandler(({ url }) => {
    traiterLienExterne(url);
    return { action: "deny" };
  });

  void win.loadFile(path.join(__dirname, "attente.html"));
  return win;
}

const premiereInstance = app.requestSingleInstanceLock();
if (!premiereInstance) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!fenetre) return;
    if (fenetre.isMinimized()) fenetre.restore();
    fenetre.focus();
  });

  app.on("will-quit", arreterServeur);
  app.on("window-all-closed", () => app.quit());

  void app.whenReady().then(async () => {
    Menu.setApplicationMenu(null);
    session.defaultSession.setPermissionRequestHandler((_wc, _permission, rappel) => rappel(false));
    session.defaultSession.setPermissionCheckHandler(() => false);
    demarrerMesureMemoire();
    fenetre = creerFenetre();

    // La fenêtre ne charge jamais une adresse tant que notre propre serveur n'a pas été confirmé vivant.
    const port = await demarrerServeur();
    if (port === null) {
      erreurFatale("MedConnecte Caisse ne peut pas démarrer : les ports nécessaires sont occupés. Redémarrez l'ordinateur.");
    }
    origine = `http://127.0.0.1:${port}`;
    if (sondeActive) {
      await lancerSonde({ fenetre, origine, pidServeur: pidServeur() });
    } else {
      await fenetre.loadURL(`${origine}/dashboard`);
    }
  });
}
