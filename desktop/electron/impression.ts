// Impression directe du ticket (PD05, D746) : fenêtre cachée sur le reçu existant, `webContents.print` silencieux.
// Aucune boîte de dialogue de l'application. Une seule impression à la fois (file simple en mémoire).
import { BrowserWindow, type WebContents, type WebPreferences } from "electron";
import { writeFileSync } from "node:fs";
import {
  CODE_IMPRESSION_ECHOUEE,
  CODE_IMPRIMANTE_NON_CHOISIE,
  MESSAGE_IMPRESSION_ECHOUEE,
  type FormatTicket,
  type ImprimanteSysteme,
  type ReglagesPoste,
  type ReponsePont,
} from "@/lib/caisse/contrat_desktop";
import { attendreImpression, avecDelai, creerDedoublonneur } from "../coeur/impression_file";
import { taillePage } from "../coeur/mesures_ticket";

export const DELAI_PRET_MS = 10_000;
const DELAI_MESURE_MS = 5_000;
const MESSAGE_NON_CHOISIE = "Aucune imprimante n'est choisie pour ce poste. Choisissez-la dans « Ce poste ».";

export interface DepsImpression {
  lireReglages: () => ReglagesPoste;
  /** Origine du serveur local ; vide tant qu'il n'est pas lancé. */
  origine: () => string;
  /** Mêmes préférences de page que la fenêtre principale (préchargement compris). */
  preferences: () => WebPreferences;
  /** Contenu d'une page déjà ouverte, pour lister les imprimantes. */
  contenuPrincipal: () => WebContents | null;
  journal: (message: string) => void;
  /** Délai autour de `print` (60 s par défaut). */
  delaiPrintMs?: number;
}

export interface ServiceImpression {
  listerImprimantes(): Promise<ImprimanteSysteme[]>;
  imprimerVente(venteId: string): Promise<ReponsePont<null>>;
  /** Preuve seulement (sonde) : le même reçu, mêmes mesures, écrit en PDF au lieu d'aller à l'imprimante. */
  exporterPdf(venteId: string, format: FormatTicket, chemin: string): Promise<{ ok: boolean; hauteurPixels: number; octets: number; diagnostic: string }>;
  /** Appelé par la fenêtre d'impression quand le reçu est rendu. */
  signalerPret(contenu: WebContents): void;
  /** Contenus des fenêtres d'impression en cours (autorisés à parler au pont). */
  contenusActifs(): WebContents[];
}

const echec = (code: string, message: string, status: number): ReponsePont<null> => ({ ok: false, status, code, message });

export function creerServiceImpression(deps: DepsImpression): ServiceImpression {
  const enAttente = new Map<number, () => void>();
  const actifs = new Set<WebContents>();
  let file: Promise<unknown> = Promise.resolve();
  const dedoublonneur = creerDedoublonneur();

  /**
   * Ouvre le reçu dans une fenêtre cachée, attend `impression:prete` (10 s au plus), mesure la hauteur,
   * joue `travail`, puis détruit la fenêtre dans tous les cas. `null` : le reçu n'a pas été prêt à temps.
   */
  async function avecRecu<T>(
    venteId: string,
    format: FormatTicket,
    travail: (contenu: WebContents, hauteurPixels: number) => Promise<T>,
  ): Promise<T | null> {
    const origine = deps.origine();
    const fenetre = new BrowserWindow({ show: false, width: 900, height: 1200, webPreferences: { ...deps.preferences(), offscreen: true } });
    const contenu = fenetre.webContents;
    actifs.add(contenu);
    const id = contenu.id;
    let minuterie: NodeJS.Timeout | undefined;
    try {
      // Navigations limitées à notre serveur local, aucune fenêtre fille.
      contenu.on("will-navigate", (e, url) => {
        try {
          if (new URL(url).origin !== origine) e.preventDefault();
        } catch {
          e.preventDefault();
        }
      });
      contenu.setWindowOpenHandler(() => ({ action: "deny" }));

      const pret = new Promise<boolean>((resolve) => {
        enAttente.set(id, () => resolve(true));
        minuterie = setTimeout(() => resolve(false), DELAI_PRET_MS);
      });
      void contenu
        .loadURL(`${origine}/dashboard/ventes/${encodeURIComponent(venteId)}/recu?impression=1&format=${format}`)
        .catch(() => undefined);
      if (!(await pret)) {
        deps.journal("impression : reçu non prêt dans le délai");
        return null;
      }
      // Hauteur du ticket : la feuille du reçu, à défaut le corps de la page.
      const hauteur = await avecDelai<unknown>(
        contenu.executeJavaScript(
          `(() => { const a = document.querySelector("article"); return Math.ceil(a ? a.getBoundingClientRect().height : document.body.scrollHeight); })()`,
          true,
        ),
        DELAI_MESURE_MS,
      );
      if (hauteur === null) {
        deps.journal("impression : le reçu ne répond plus à la mesure");
        return null;
      }
      return await travail(contenu, Number(hauteur));
    } finally {
      if (minuterie) clearTimeout(minuterie);
      enAttente.delete(id);
      actifs.delete(contenu);
      if (!fenetre.isDestroyed()) fenetre.destroy();
    }
  }

  async function imprimer(venteId: string): Promise<ReponsePont<null>> {
    const reglages = deps.lireReglages();
    if (reglages.imprimante === null) return echec(CODE_IMPRIMANTE_NON_CHOISIE, MESSAGE_NON_CHOISIE, 409);
    if (deps.origine() === "") return echec(CODE_IMPRESSION_ECHOUEE, MESSAGE_IMPRESSION_ECHOUEE, 503);
    const format = reglages.formatRecu;
    try {
      // Délai de 60 s autour de `print` : un pilote qui attend ne bloque ni la file ni les boutons ; la fenêtre est détruite ensuite.
      const resultat = await avecRecu(venteId, format, (contenu, hauteurPixels) =>
        attendreImpression((rappel) => {
          contenu.print(
            {
              silent: true,
              printBackground: false,
              deviceName: reglages.imprimante as string,
              margins: { marginType: format === "A4" ? "default" : "none" },
              pageSize: taillePage(format, hauteurPixels),
            },
            rappel,
          );
        }, deps.delaiPrintMs),
      );
      if (resultat === null) return echec(CODE_IMPRESSION_ECHOUEE, MESSAGE_IMPRESSION_ECHOUEE, 504);
      if (!resultat.succes) {
        deps.journal(resultat.delaiDepasse ? "impression : le pilote n'a pas répondu à temps" : `impression refusée par l'imprimante : ${resultat.raison}`);
        return echec(CODE_IMPRESSION_ECHOUEE, MESSAGE_IMPRESSION_ECHOUEE, 502);
      }
      return { ok: true, data: null, message: "Ticket envoyé à l'imprimante." };
    } catch {
      deps.journal("impression : échec inattendu");
      return echec(CODE_IMPRESSION_ECHOUEE, MESSAGE_IMPRESSION_ECHOUEE, 500);
    }
  }

  return {
    async listerImprimantes() {
      const contenu = deps.contenuPrincipal();
      if (contenu === null || contenu.isDestroyed()) return [];
      const liste = await contenu.getPrintersAsync();
      return liste.map((p) => ({ name: p.name, displayName: p.displayName || p.name, isDefault: (p as { isDefault?: boolean }).isDefault === true }));
    },
    imprimerVente(venteId) {
      // Un double clic ou une impression automatique suivie d'un clic ne sort pas deux tickets : même résultat tant que la première court.
      return dedoublonneur.lancer(venteId, () => {
        const suite = file.then(() => imprimer(venteId));
        file = suite.catch(() => undefined);
        return suite;
      });
    },
    exporterPdf(venteId, format, chemin) {
      const suite = file.then(async () => {
        const sortie = await avecRecu(venteId, format, async (contenu, hauteurPixels) => {
          const taille = taillePage(format, hauteurPixels);
          const pdf = await contenu.printToPDF({
            printBackground: false,
            // En pouces ; un ticket sans marge, une feuille A4 avec 15 mm (0,59 pouce) comme sur le web.
            margins: format === "A4" ? { top: 0.59, bottom: 0.59, left: 0.59, right: 0.59 } : { top: 0, bottom: 0, left: 0, right: 0 },
            pageSize: taille === "A4" ? "A4" : { width: taille.width / 25_400, height: taille.height / 25_400 },
          });
          writeFileSync(chemin, pdf);
          // Diagnostic de la preuve : ce que la page contient au moment de l'impression.
          const diagnostic = String(
            await contenu.executeJavaScript(
              `(() => { const a = document.querySelector("article"); const r = a ? a.getBoundingClientRect() : null; return JSON.stringify({ article: !!a, largeur: r ? Math.round(r.width) : 0, hauteur: r ? Math.round(r.height) : 0, texte: (a ? a.innerText : document.body.innerText).slice(0, 80), chemin: location.pathname }); })()`,
              true,
            ),
          );
          return { hauteurPixels, octets: pdf.length, diagnostic };
        });
        return { ok: sortie !== null, hauteurPixels: sortie?.hauteurPixels ?? 0, octets: sortie?.octets ?? 0, diagnostic: sortie?.diagnostic ?? "" };
      });
      file = suite.catch(() => undefined);
      return suite;
    },
    signalerPret(contenu) {
      enAttente.get(contenu.id)?.();
    },
    contenusActifs() {
      return [...actifs];
    },
  };
}
