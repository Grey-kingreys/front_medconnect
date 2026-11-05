// Mises à jour de l'application (PD06, D747). Paquet uniquement, et seulement si une adresse sûre a été figée
// au build (`MC_MAJ_URL`) : sinon les mises à jour sont manuelles, sans aucune erreur à l'écran.
// Règle : on n'installe qu'à la fermeture ou sur demande, jamais avec une caisse ouverte ni une file non vide.
import { app } from "electron";
import { autoUpdater } from "electron-updater";
import { adresseMajValide, peutInstaller } from "../coeur/maj_regle";
import type { CoeurCaisse } from "../coeur/coeur";

const PREMIERE_VERIFICATION_MS = 60_000;
const INTERVALLE_MS = 6 * 60 * 60 * 1000;

export interface ServiceMaj {
  /** Vrai si les mises à jour se font toutes seules (adresse sûre figée au build, application installée). */
  automatique: boolean;
  /** Version téléchargée, prête à s'installer, ou null. */
  versionPrete(): string | null;
  /** Vrai si la règle autorise l'installation maintenant. */
  installable(): boolean;
  /** Installation sur demande : relance l'application. Faux si rien n'est prêt ou si la règle l'interdit. */
  installerMaintenant(): boolean;
  /** À la fermeture : installe si une mise à jour est prête et si la règle était respectée au début de la fermeture. */
  installerALaFermeture(autorise: boolean): void;
  arreter(): void;
}

export function creerServiceMaj(deps: {
  adresse: string | undefined;
  coeur: CoeurCaisse;
  enLigne: () => boolean;
  notifier: () => void;
  journal: (message: string) => void;
}): ServiceMaj {
  const automatique = app.isPackaged && adresseMajValide(deps.adresse);
  let prete: string | null = null;
  let minuterie: NodeJS.Timeout | null = null;

  const installable = () => peutInstaller(deps.coeur.etatLocal());

  const verifier = () => {
    if (!deps.enLigne()) return;
    autoUpdater.checkForUpdates().catch((erreur: unknown) => {
      // Silencieux pour le vendeur : une ligne au journal local, rien à l'écran.
      deps.journal(`maj: vérification impossible (${erreur instanceof Error ? erreur.name : "erreur"})`);
    });
  };

  if (automatique && deps.adresse) {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.allowDowngrade = false;
    autoUpdater.setFeedURL({ provider: "generic", url: deps.adresse });
    autoUpdater.on("update-downloaded", (info) => {
      prete = info.version;
      deps.journal(`maj: version ${info.version} téléchargée`);
      deps.notifier();
    });
    autoUpdater.on("error", (erreur: Error) => {
      deps.journal(`maj: échec (${erreur.name})`);
    });
    // Première vérification après 60 s, puis toutes les 6 heures. Hors ligne au moment prévu : on réessaie dans 60 s.
    const planifier = (delai: number) => {
      minuterie = setTimeout(() => {
        if (!deps.enLigne()) {
          planifier(PREMIERE_VERIFICATION_MS);
          return;
        }
        verifier();
        planifier(INTERVALLE_MS);
      }, delai);
      minuterie.unref();
    };
    planifier(PREMIERE_VERIFICATION_MS);
  }

  return {
    automatique,
    versionPrete: () => prete,
    installable,
    installerMaintenant: () => {
      if (prete === null || !installable()) return false;
      demandeRelance = true;
      app.quit();
      return true;
    },
    installerALaFermeture: (autorise) => {
      if (prete === null || !(autorise || demandeRelance)) return;
      try {
        autoUpdater.quitAndInstall(true, demandeRelance);
      } catch (erreur) {
        deps.journal(`maj: installation impossible (${erreur instanceof Error ? erreur.name : "erreur"})`);
      }
    },
    arreter: () => {
      if (minuterie) clearTimeout(minuterie);
    },
  };
}

/** Posé par « Installer maintenant » : la fermeture qui suit installe et relance. */
let demandeRelance = false;
