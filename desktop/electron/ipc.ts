// Gestionnaires IPC du pont. Chaque message est contrôlé ici, dans le processus principal :
// 1. l'expéditeur est le cadre principal de la page de NOTRE serveur local, sinon refus sans détail ;
// 2. les arguments sont validés (Zod), l'utilisateur, la pharmacie et le droit contrôlés par la passerelle.
// La fenêtre cachée d'impression (PD05) lit le reçu par le même pont, mais ne peut ni poser un jeton ni déconnecter.
import { ipcMain, type IpcMainInvokeEvent, type WebContents } from "electron";
import { DOMAINES_PONT, schemaJeton, schemasImpression, schemasParDomaine, type NomMethodeImpression } from "@/lib/caisse/contrat_desktop_schemas";
import type { EtatPosteDesktop, InfosPoste, ReglagesPoste, ReponsePont } from "@/lib/caisse/contrat_desktop";
import { lectureAutoriseeDepuisImpression } from "../coeur/impression_file";
import { MESSAGE_MAJ_INTERDITE } from "../coeur/maj_regle";
import { origineAutorisee, type Passerelle } from "../coeur/passerelle";
import type { ServiceImpression } from "./impression";

export interface DepsIpc {
  passerelle: Passerelle;
  /** Origine du serveur local ; vide tant qu'il n'est pas lancé. */
  origine: () => string;
  /** Fenêtre de l'application : seul son contenu principal peut parler au pont (jeton, déconnexion comprises). */
  contenuAutorise: () => WebContents | null;
  definirJeton: (jeton: string | null) => void;
  deconnecter: () => void;
  etat: () => EtatPosteDesktop;
  /** Installe la mise à jour prête si la règle le permet ; faux sinon. */
  installerMaj: () => boolean;
  /** Ouvre le dossier des données du poste dans l'explorateur ; texte vide si réussi, sinon le message d'erreur du système. */
  ouvrirDossierDonnees: () => Promise<string>;
  impression: ServiceImpression;
  reglages: {
    lire: () => ReglagesPoste;
    enregistrer: (modif: Partial<ReglagesPoste>) => ReglagesPoste;
    infosPoste: () => InfosPoste;
  };
}

const REFUS = { ok: false, status: 403, message: "Accès refusé." } as const;
const MESSAGE_VALIDATION = "Cette demande n'est pas valide.";
const MESSAGE_NON_CONNECTE = "Vous n'êtes pas authentifié.";

export function enregistrerIpc(deps: DepsIpc): void {
  const cadreAutorise = (evenement: IpcMainInvokeEvent, contenu: WebContents | null): boolean => {
    const cadre = evenement.senderFrame;
    return (
      cadre !== null &&
      contenu !== null &&
      !contenu.isDestroyed() &&
      evenement.sender === contenu &&
      cadre === contenu.mainFrame &&
      origineAutorisee(cadre.url, deps.origine())
    );
  };
  /** Fenêtre principale seulement. */
  const expediteurAutorise = (evenement: IpcMainInvokeEvent): boolean => cadreAutorise(evenement, deps.contenuAutorise());
  /** Fenêtre principale, ou fenêtre cachée d'impression en cours pour les seules lectures de la liste blanche. */
  const expediteurLecture = (evenement: IpcMainInvokeEvent, canal: string): boolean =>
    expediteurAutorise(evenement) ||
    (lectureAutoriseeDepuisImpression(canal) && deps.impression.contenusActifs().some((c) => cadreAutorise(evenement, c)));

  // Un canal par fonction de chaque domaine : `<domaine>:<fonction>`. Les domaines pharmacie à venir y entrent sans autre changement.
  for (const domaine of DOMAINES_PONT) {
    for (const nom of Object.keys(schemasParDomaine[domaine])) {
      ipcMain.handle(`${domaine}:${nom}`, async (evenement, ...args: unknown[]) => {
        if (!expediteurLecture(evenement, `${domaine}:${nom}`)) return REFUS;
        return deps.passerelle.appeler(nom, args, domaine);
      });
    }
  }

  ipcMain.handle("etat", (evenement) => {
    if (!expediteurLecture(evenement, "etat")) throw new Error("Accès refusé.");
    return deps.etat();
  });

  // Lecture seule du profil confirmé par le serveur (sans jeton) ; le rendu ne peut rien y écrire.
  ipcMain.handle("profil:lire", (evenement) => {
    if (!expediteurLecture(evenement, "profil:lire")) return null;
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

  // Impression (PD05) : réglages, liste des imprimantes et ticket. Tout utilisateur connecté à ce poste.
  const ok = <T>(data: T, message: string): ReponsePont<T> => ({ ok: true, data, message });
  const invalide = (): ReponsePont<never> => ({ ok: false, status: 400, code: "VALIDATION", message: MESSAGE_VALIDATION });
  const nonConnecte = (): ReponsePont<never> => ({ ok: false, status: 401, code: "NON_AUTHENTIFIE", message: MESSAGE_NON_CONNECTE });

  for (const nom of Object.keys(schemasImpression) as NomMethodeImpression[]) {
    ipcMain.handle(`impression:${nom}`, async (evenement, ...args: unknown[]): Promise<ReponsePont<unknown>> => {
      if (!expediteurAutorise(evenement)) return REFUS;
      const lu = (schemasImpression[nom] as { safeParse(v: unknown): { success: boolean; data?: unknown } }).safeParse(args);
      if (!lu.success) return invalide();
      if (deps.passerelle.utilisateurCourant() === null) return nonConnecte();
      const valeurs = lu.data as unknown[];
      switch (nom) {
        case "listerImprimantes":
          return ok(await deps.impression.listerImprimantes(), "Imprimantes de ce poste.");
        case "lireReglages":
          return ok(deps.reglages.lire(), "Réglages de ce poste.");
        case "enregistrerReglages":
          return ok(deps.reglages.enregistrer(valeurs[0] as Partial<ReglagesPoste>), "Réglages enregistrés.");
        case "lireInfosPoste":
          return ok(deps.reglages.infosPoste(), "Informations de ce poste.");
        case "ouvrirDossierDonnees": {
          const erreur = await deps.ouvrirDossierDonnees();
          return erreur === ""
            ? ok(null, "Dossier ouvert.")
            : { ok: false, status: 500, code: "DOSSIER_NON_OUVERT", message: "Le dossier des données n'a pas pu être ouvert." };
        }
        case "imprimerVente":
          return deps.impression.imprimerVente(valeurs[0] as string);
      }
    });
  }

  // Mise à jour sur demande : fenêtre principale seulement, la règle est contrôlée par le service.
  ipcMain.handle("maj:installer", (evenement): ReponsePont<null> => {
    if (!expediteurAutorise(evenement)) return REFUS;
    if (deps.installerMaj()) return ok(null, "La mise à jour va s'installer.");
    return { ok: false, status: 409, code: "MAJ_INTERDITE", message: MESSAGE_MAJ_INTERDITE };
  });

  // Signal de la fenêtre d'impression : seule une fenêtre d'impression en cours peut le donner.
  ipcMain.handle("impression:signalerPret", (evenement) => {
    const contenu = deps.impression.contenusActifs().find((c) => cadreAutorise(evenement, c));
    if (contenu) deps.impression.signalerPret(contenu);
  });

  // Aucun canal « utilisateur » : l'identité vient du serveur (`/auth/me`), jamais du rendu. Le rendu ne pousse que le jeton.
}
