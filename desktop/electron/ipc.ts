// Gestionnaires IPC du pont. Chaque message est contrôlé ici, dans le processus principal :
// 1. l'expéditeur est le cadre principal de la page de NOTRE serveur local, sinon refus sans détail ;
// 2. les arguments sont validés (Zod), l'utilisateur, la pharmacie et le droit contrôlés par la passerelle.
import { ipcMain, type IpcMainInvokeEvent, type WebContents } from "electron";
import { schemaJeton, schemasPont } from "@/lib/caisse/contrat_desktop_schemas";
import type { EtatPosteDesktop } from "@/lib/caisse/contrat_desktop";
import { origineAutorisee, type Passerelle } from "../coeur/passerelle";

export interface DepsIpc {
  passerelle: Passerelle;
  /** Origine du serveur local ; vide tant qu'il n'est pas lancé. */
  origine: () => string;
  /** Fenêtre de l'application : seul son contenu principal peut parler au pont. */
  contenuAutorise: () => WebContents | null;
  definirJeton: (jeton: string | null) => void;
  deconnecter: () => void;
  etat: () => EtatPosteDesktop;
}

const REFUS = { ok: false, status: 403, message: "Accès refusé." } as const;

export function enregistrerIpc(deps: DepsIpc): void {
  const expediteurAutorise = (evenement: IpcMainInvokeEvent): boolean => {
    const cadre = evenement.senderFrame;
    const contenu = deps.contenuAutorise();
    return (
      cadre !== null &&
      contenu !== null &&
      evenement.sender === contenu &&
      cadre === contenu.mainFrame &&
      origineAutorisee(cadre.url, deps.origine())
    );
  };

  for (const nom of Object.keys(schemasPont)) {
    ipcMain.handle(`caisse:${nom}`, async (evenement, ...args: unknown[]) => {
      if (!expediteurAutorise(evenement)) return REFUS;
      return deps.passerelle.appeler(nom, args);
    });
  }

  ipcMain.handle("etat", (evenement) => {
    if (!expediteurAutorise(evenement)) throw new Error("Accès refusé.");
    return deps.etat();
  });

  // Lecture seule du profil confirmé par le serveur (sans jeton) ; le rendu ne peut rien y écrire.
  ipcMain.handle("profil:lire", (evenement) => {
    if (!expediteurAutorise(evenement)) return null;
    return deps.passerelle.profilLocal();
  });

  ipcMain.handle("jeton", (evenement, ...args: unknown[]) => {
    if (!expediteurAutorise(evenement)) return;
    const lu = schemaJeton.safeParse(args);
    if (lu.success) deps.definirJeton(lu.data[0]);
  });

  // Retire seulement : au pire, un rendu compromis déconnecte le poste, il ne peut installer personne.
  ipcMain.handle("deconnexion", (evenement) => {
    if (!expediteurAutorise(evenement)) return;
    deps.deconnecter();
  });

  // Aucun canal « utilisateur » : l'identité vient du serveur (`/auth/me`), jamais du rendu. Le rendu ne pousse que le jeton.
}
