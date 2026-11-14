// Processus principal : fenêtre, serveur Next local, garde-fous de navigation.
import { app, BrowserWindow, dialog, Menu, session, shell, type WebPreferences } from "electron";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import os from "node:os";
import { retirerEtControlerCookieRefresh } from "../coeur/cookie_session";
import { Passerelle, construireEtat } from "../coeur/passerelle";
import { ouvrirCaisse, type CaisseOuverte } from "./demarrage";
import { writeFile } from "node:fs/promises";
import { creerServiceImpression } from "./impression";
import { enregistrerIpc } from "./ipc";
import { creerJournalFichier } from "./journal_fichier";
import { demarrerMesureMemoire } from "./memoire";
import { creerServiceMaj, type ServiceMaj } from "./maj";
import { lancerSonde } from "./sonde";
import { arreterServeur, demarrerServeur, erreurFatale, pidServeur } from "./serveur-next";
import { creerServiceSynchro } from "./synchro";

// Adresse de l'API : figée au build par esbuild (`define`), jamais lue d'un fichier.
const URL_API = process.env.NEXT_PUBLIC_API_URL ?? "";
// Adresse des mises à jour : figée au build aussi. Absente : mises à jour manuelles.
const URL_MAJ: string | undefined = process.env.MC_MAJ_URL;

/** Adresse de l'API telle qu'affichée dans « Ce poste » : l'adresse seule, sans chemin. */
function adresseApiAffichee(): string {
  try {
    return new URL(URL_API).origin;
  } catch {
    return "";
  }
}

// Réduction de mémoire (fiche PD01, section 5, étape a).
app.disableHardwareAcceleration();
const sondeActive = process.env.MC_SONDE === "1" && !app.isPackaged;
let fenetre: BrowserWindow | null = null;
let origine = "";

/** Mêmes préférences pour la fenêtre principale et la fenêtre cachée d'impression (préchargement compris). */
function preferencesPage(): WebPreferences {
  return {
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    webSecurity: true,
    devTools: !app.isPackaged,
    backgroundThrottling: false,
    preload: path.join(__dirname, "preload.cjs"),
    additionalArguments: [`--mc-version=${app.getVersion()}`],
  };
}

function creerFenetre(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: !sondeActive,
    backgroundColor: "#f8fafc",
    title: "MedConnecte Caisse",
    webPreferences: preferencesPage(),
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
  let maj: ServiceMaj | null = null;

  // Fermeture : plus de nouveau cycle, on attend la fin de celui qui est en vol (quelques secondes au plus), puis on ferme la base.
  let fermetureFaite = false;
  app.on("will-quit", (evenement) => {
    if (fermetureFaite) return;
    fermetureFaite = true;
    evenement.preventDefault();
    // La règle d'installation se lit avant tout arrêt : caisse fermée et ventes toutes envoyées.
    const installationAutorisee = maj !== null && maj.versionPrete() !== null && maj.installable();
    service?.arreter();
    maj?.arreter();
    arreterServeur();
    const borne = new Promise<void>((ok) => setTimeout(ok, 4000));
    void Promise.race([service?.attendreFinCycle() ?? Promise.resolve(), borne]).finally(() => {
      try {
        caisse?.stockage.fermer();
      } catch {
        // Déjà fermée.
      }
      // La base est fermée : le programme d'installation peut remplacer les fichiers de l'application.
      maj?.installerALaFermeture(installationAutorisee);
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

    // En paquet, la console n'existe pas : le journal va aussi dans journal.log (états et noms de routes, ni jeton ni vente).
    const journalFichier = creerJournalFichier(caisse.dossier);
    const journal = (message: string) => {
      console.log(`[caisse] ${message}`);
      journalFichier(message);
    };
    const envoyer = (canal: string, donnee?: unknown) => {
      const contenu = fenetre?.webContents;
      if (contenu && !contenu.isDestroyed()) contenu.send(canal, donnee);
    };
    let passerelle: Passerelle;
    const etatPoste = () => ({
      ...construireEtat(coeur, service!.etat(), passerelle.utilisateurCourant()),
      majPrete: maj?.versionPrete() ?? null,
      majInstallable: maj?.installable() ?? false,
    });
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
    maj = creerServiceMaj({
      adresse: URL_MAJ,
      coeur,
      enLigne: () => service!.etat().etat === "EN_LIGNE",
      notifier,
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
      enregistrerFichier: async (nomFichier, contenu) => {
        // Boîte « Enregistrer sous » : le nom proposé est celui du serveur, dans les documents de la personne.
        const options = {
          title: "Enregistrer le stock",
          defaultPath: path.join(app.getPath("documents"), nomFichier),
          filters: [{ name: "Classeur Excel", extensions: ["xlsx"] }],
        };
        const choix = fenetre ? await dialog.showSaveDialog(fenetre, options) : await dialog.showSaveDialog(options);
        if (choix.canceled || !choix.filePath) return false;
        await writeFile(choix.filePath, contenu);
        return true;
      },
      journal,
    });
    const impression = creerServiceImpression({
      lireReglages: () => coeur.lireReglages(),
      origine: () => origine,
      preferences: preferencesPage,
      contenuPrincipal: () => fenetre?.webContents ?? null,
      journal,
    });
    enregistrerIpc({
      passerelle,
      origine: () => origine,
      contenuAutorise: () => fenetre?.webContents ?? null,
      impression,
      reglages: {
        lire: () => coeur.lireReglages(),
        enregistrer: (modif) => coeur.enregistrerReglages(modif),
        infosPoste: () => ({ ...coeur.infosPoste(), adresseApi: adresseApiAffichee(), majAutomatique: maj?.automatique ?? false, dossierDonnees: app.getPath("userData") }),
      },
      installerMaj: () => maj?.installerMaintenant() ?? false,
      ouvrirDossierDonnees: () => shell.openPath(app.getPath("userData")),
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
        impression,
      });
    } else {
      await fenetre.loadURL(`${origine}/dashboard`);
    }
  });
}
