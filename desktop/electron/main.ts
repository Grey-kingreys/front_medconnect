// Processus principal : fenêtre, serveur Next local, garde-fous de navigation.
import { app, BrowserWindow, Menu, session, shell } from "electron";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import os from "node:os";
import { retirerEtControlerCookieRefresh } from "../coeur/cookie_session";
import { Passerelle, construireEtat } from "../coeur/passerelle";
import { ouvrirCaisse, type CaisseOuverte } from "./demarrage";
import { enregistrerIpc } from "./ipc";
import { demarrerMesureMemoire } from "./memoire";
import { lancerSonde } from "./sonde";
import { arreterServeur, demarrerServeur, erreurFatale, pidServeur } from "./serveur-next";
import { creerServiceSynchro } from "./synchro";

// Adresse de l'API : figée au build par esbuild (`define`), jamais lue d'un fichier.
const URL_API = process.env.NEXT_PUBLIC_API_URL ?? "";

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

  let caisse: CaisseOuverte | null = null;
  let service: ReturnType<typeof creerServiceSynchro> | null = null;

  // Fermeture : plus de nouveau cycle, on attend la fin de celui qui est en vol (quelques secondes au plus), puis on ferme la base.
  let fermetureFaite = false;
  app.on("will-quit", (evenement) => {
    if (fermetureFaite) return;
    fermetureFaite = true;
    evenement.preventDefault();
    service?.arreter();
    arreterServeur();
    const borne = new Promise<void>((ok) => setTimeout(ok, 4000));
    void Promise.race([service?.attendreFinCycle() ?? Promise.resolve(), borne]).finally(() => {
      try {
        caisse?.stockage.fermer();
      } catch {
        // Déjà fermée.
      }
      // Tout est fermé : sortie directe (un second app.quit() dans will-quit ne ramenait pas toujours l'arrêt).
      app.exit(0);
    });
  });
  app.on("window-all-closed", () => app.quit());

  void app.whenReady().then(async () => {
    Menu.setApplicationMenu(null);
    session.defaultSession.setPermissionRequestHandler((_wc, _permission, rappel) => rappel(false));
    session.defaultSession.setPermissionCheckHandler(() => false);

    // La caisse locale d'abord : une base illisible demande une décision avant tout le reste.
    caisse = await ouvrirCaisse({ sansInterface: sondeActive });
    if (caisse === null) return;
    const { coeur } = caisse;

    demarrerMesureMemoire();
    fenetre = creerFenetre();

    const journal = (message: string) => console.log(`[caisse] ${message}`);
    const envoyer = (canal: string, donnee?: unknown) => {
      const contenu = fenetre?.webContents;
      if (contenu && !contenu.isDestroyed()) contenu.send(canal, donnee);
    };
    let passerelle: Passerelle;
    const etatPoste = () => construireEtat(coeur, service!.etat(), passerelle.utilisateurCourant());
    const notifier = () => envoyer("etat", etatPoste());
    service = creerServiceSynchro({
      coeur,
      urlApi: URL_API,
      versionApp: app.getVersion(),
      libellePoste: os.hostname().slice(0, 40),
      genererId: () => randomUUID(),
      notifier,
      demanderJeton: () => envoyer("demande-jeton"),
      identite: {
        confirmer: (donnees) => void passerelle.confirmerIdentite(donnees),
        effacer: () => passerelle.effacerIdentite(),
        idCourant: () => passerelle.utilisateurCourant()?.id ?? null,
      },
      journal,
    });
    passerelle = new Passerelle({
      coeur,
      apresVente: () => service!.declencher("apres-vente"),
      apresAnnulation: () => {
        service!.moteur.forcerPhotographie();
        service!.declencher("apres-vente");
      },
      apresRattachement: () => service!.declencher("demarrage"),
      etatChange: notifier,
      journal,
    });
    enregistrerIpc({
      passerelle,
      origine: () => origine,
      contenuAutorise: () => fenetre?.webContents ?? null,
      definirJeton: (jeton) => service!.definirJeton(jeton),
      deconnecter: () => {
        service!.deconnecter();
        // Le vendeur suivant ne doit pas hériter du refresh de la session, en ligne comme hors ligne
        void retirerEtControlerCookieRefresh(session.defaultSession.cookies, journal);
      },
      etat: etatPoste,
    });

    // La fenêtre ne charge jamais une adresse tant que notre propre serveur n'a pas été confirmé vivant.
    const port = await demarrerServeur();
    if (port === null) {
      erreurFatale("MedConnecte Caisse ne peut pas démarrer : les ports nécessaires sont occupés. Redémarrez l'ordinateur.");
    }
    origine = `http://127.0.0.1:${port}`;
    if (sondeActive) {
      await lancerSonde({
        fenetre,
        origine,
        pidServeur: pidServeur(),
        coeur,
        dossier: caisse.dossier,
        urlApi: URL_API,
        declencher: () => service!.declencher("minuterie"),
      });
    } else {
      await fenetre.loadURL(`${origine}/dashboard`);
    }
  });
}
