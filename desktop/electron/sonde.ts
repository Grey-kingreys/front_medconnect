// Sonde de vérification automatique, active seulement avec MC_SONDE=1 hors application empaquetée.
// Écrit desktop/sonde-resultat.json (booléens et versions seulement, jamais de valeur sensible) puis quitte.
import { app, session, type BrowserWindow } from "electron";
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { CoeurCaisse } from "../coeur/coeur";
import type { ServiceImpression } from "./impression";
import { jouerScenario } from "./sonde_scenario";

type Resultat = Record<string, unknown>;

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function lancerSonde(opts: {
  fenetre: BrowserWindow;
  origine: string;
  pidServeur?: number;
  coeur: CoeurCaisse;
  dossier: string;
  urlApi: string;
  /** Lance un cycle de synchronisation (scénario PD04c). */
  declencher?: () => void;
  /** Service d'impression du poste (scénario PD05). */
  impression?: ServiceImpression;
}): Promise<void> {
  const { fenetre, origine } = opts;
  // Scénario de preuve PD04c : phase donnée par MC_SCENARIO, sortie dans MC_SONDE_SORTIE.
  if (process.env.MC_SCENARIO) {
    await jouerScenario({
      fenetre,
      origine,
      coeur: opts.coeur,
      dossier: opts.dossier,
      urlApi: opts.urlApi,
      declencher: opts.declencher ?? (() => undefined),
      impression: opts.impression,
      phase: process.env.MC_SCENARIO,
    });
    return;
  }
  const wc = fenetre.webContents;
  const r: Resultat = {};
  const messagesConsole: string[] = [];

  wc.on("console-message", (...args: unknown[]) => {
    const premier = args[0] as { message?: string } | undefined;
    const texte = premier && typeof premier === "object" && "message" in premier ? premier.message : args[2];
    if (typeof texte === "string") messagesConsole.push(texte);
  });

  const js = <T>(code: string) => wc.executeJavaScript(code, true) as Promise<T>;
  const url = () => wc.getURL();
  const attendre = async (condition: () => Promise<boolean> | boolean, delaiMs: number) => {
    const fin = Date.now() + delaiMs;
    while (Date.now() < fin) {
      try {
        if (await condition()) return true;
      } catch {
        // Page en cours de chargement : on réessaie.
      }
      await pause(250);
    }
    return false;
  };
  const aller = async (chemin: string) => {
    try {
      await wc.loadURL(`${origine}${chemin}`);
    } catch {
      // Une redirection peut interrompre le chargement initial.
    }
  };

  /** Pont de caisse : identité tirée du serveur, rattachement, contrôles d'accès. Booléens, comptes et codes seulement. */
  const sondeCaisse = async (): Promise<Resultat> => {
    const c: Resultat = {};
    const pont = "window.medconnecteDesktop";
    const lireJeton = () => js<string | null>(`localStorage.getItem("access_token")`);
    const valide = (t: string | null) => !!t && t !== "invalide";
    let jeton = await lireJeton();
    if (!valide(jeton)) {
      // Le rafraîchissement de l'étape 7 peut être interrompu par la navigation : nouvelle connexion démo.
      await session.defaultSession.clearStorageData();
      await aller("/auth/login");
      await attendre(
        () =>
          js<boolean>(`(() => {
            const b = Array.from(document.querySelectorAll("button")).filter((x) => (x.textContent || "").includes("Pharmacie de Kaloum"));
            const cible = b.find((x) => (x.textContent || "").includes("Administrateur")) || b[0];
            if (!cible) return false;
            cible.click();
            return true;
          })()`),
        20_000,
      );
      await attendre(() => new URL(url()).pathname.startsWith("/dashboard"), 25_000);
      await attendre(async () => valide((jeton = await lireJeton())), 15_000);
      c.nouvelleConnexion = true;
    }
    if (!jeton || !valide(jeton)) return { ...c, erreur: "jeton absent de la page" };
    const octetsJeton = Buffer.from(jeton);

    // Profil du compte connecté, lu par le processus principal (le jeton ne sort pas de la sonde).
    const reponseMe = await fetch(`${opts.urlApi}/auth/me`, { headers: { Authorization: `Bearer ${jeton}` } });
    const me = ((await reponseMe.json()) as { data?: Record<string, unknown> }).data ?? {};
    // Seule la pharmacie sert d'argument aux appels de la page ; l'identité, elle, vient du processus principal.
    const structureId = String((me.structure as { id?: string } | undefined)?.id ?? me.structureId ?? "");

    // Forme du pont : méthodes nommées, aucun accès brut à ipcRenderer, aucune méthode pour déclarer une identité.
    c.formePont = await js<unknown>(`(() => {
      const p = ${pont};
      return { cles: Object.keys(p).sort(), caisse: Object.keys(p.caisse).sort(), ipcRendererExpose: "ipcRenderer" in p || "ipcRenderer" in p.caisse, definirUtilisateurPresent: "definirUtilisateur" in p };
    })()`);

    // Avant tout jeton : aucune identité confirmée, 401. Validation dans le processus principal.
    c.sansIdentite = await js<unknown>(`${pont}.caisse.chargerStock(${JSON.stringify(structureId)}).then((r) => ({ ok: r.ok, status: r.status }))`);
    c.methodeInconnueAbsente = await js<boolean>(`typeof ${pont}.caisse.supprimerTout === "undefined"`);

    // Jeton en mémoire seulement : le processus principal lit /auth/me, rattache le poste, puis synchronise.
    await js(`${pont}.definirJeton(${JSON.stringify(jeton)})`);
    const identite = await attendre(
      async () => (await js<{ ok: boolean }>(`${pont}.caisse.chargerStock(${JSON.stringify(structureId)})`)).ok,
      90_000,
    );
    c.identiteConfirmeeParLeServeur = identite;
    c.posteRattache = opts.coeur.structureRattachee() === structureId;
    const contact = await attendre(async () => (await js<{ dernierContactLe: string | null }>(`${pont}.etat()`)).dernierContactLe !== null, 90_000);
    c.contactServeur = contact;
    c.etat = await js<unknown>(`${pont}.etat()`);
    if (!identite) return c;

    c.argumentInvalide = await js<unknown>(
      `${pont}.caisse.creerVente(${JSON.stringify(structureId)}, { lignes: "x" }, "k").then((r) => ({ ok: r.ok, status: r.status, code: r.code }))`,
    );
    c.autrePharmacie = await js<unknown>(
      `${pont}.caisse.chargerStock("00000000-0000-4000-8000-000000000000").then((r) => ({ ok: r.ok, status: r.status }))`,
    );
    // Aucune nouvelle vente : la base du poste de la première passe (vente déjà envoyée) est relue.
    const stock = await js<{ ok: boolean; data?: unknown[] }>(`${pont}.caisse.chargerStock(${JSON.stringify(structureId)})`);
    c.fichesLues = stock.data?.length ?? 0;
    c.etatCaisse = await js<unknown>(
      `${pont}.caisse.etatCaisse(${JSON.stringify(structureId)}, ${JSON.stringify(String(me.id))}).then((r) => ({ ok: r.ok, poste: r.ok ? r.data.poste.type : null, sessionOuverte: r.ok ? r.data.session !== null : null }))`,
    );
    const e = opts.coeur.etatLocal();
    const s = opts.coeur.etatPourSynchro();
    c.fileEtSequence = { fileEnAttente: e.fileEnAttente, rejetes: e.rejetes, sequenceAppliquee: s.sequenceAppliquee };

    // Le jeton n'est écrit dans aucun fichier du dossier de données du poste.
    // (Le stockage local du navigateur garde le sien, comme sur le web : il n'entre pas dans ce contrôle.)
    const fichiers = readdirSync(opts.dossier).filter((f) => /^(caisse\.sqlite|appareil\.json)/.test(f));
    const dansFichier = fichiers.filter((f) => {
      try {
        return readFileSync(path.join(opts.dossier, f)).includes(octetsJeton);
      } catch {
        return false;
      }
    });
    c.fichiersControles = fichiers.length;
    c.jetonSurDisque = dansFichier.length > 0;
    c.jetonDansLaBase = existsSync(path.join(opts.dossier, "caisse.sqlite"))
      ? readFileSync(path.join(opts.dossier, "caisse.sqlite")).includes(octetsJeton)
      : null;
    return c;
  };

  /**
   * Connexion hors ligne (PD04b). À lancer avec une adresse d'API injoignable, après une passe en ligne qui a laissé la session ouverte.
   * Phase 1 : redémarrage de la page sans réseau (session et menu gardés), déconnexion confirmée, page de connexion.
   * Phase 2 : relance de l'application sans réseau (connexion demandée, aucune vente). Booléens et statuts seulement, jamais de jeton.
   */
  const sondeHorsLigne = async (phase: string): Promise<Resultat> => {
    const h: Resultat = { phase };
    const pont = "window.medconnecteDesktop";
    const texte = () => js<string>(`document.body.innerText`);
    const cliquer = (libelle: string, dansDialogue: boolean) =>
      js<boolean>(`(() => {
        const racine = ${dansDialogue ? `document.querySelector('[role="dialog"]')` : "document"};
        if (!racine) return false;
        const b = Array.from(racine.querySelectorAll("button")).find((x) => (x.textContent || "").trim() === ${JSON.stringify(libelle)});
        if (!b) return false;
        b.click();
        return true;
      })()`);
    const ventesBloquees = async () => {
      const stock = await js<{ ok: boolean; status?: number }>(`${pont}.caisse.chargerStock("00000000-0000-4000-8000-000000000001")`);
      const vente = await js<{ ok: boolean; status?: number }>(
        `${pont}.caisse.creerVente("00000000-0000-4000-8000-000000000001", { lignes: [{ stockId: "x", quantite: 1 }] }, "00000000-0000-4000-8000-0000000000aa")`,
      );
      return { stock: { ok: stock.ok, status: stock.status }, vente: { ok: vente.ok, status: vente.status } };
    };

    await aller("/dashboard/vente");
    if (phase === "1") {
      await attendre(async () => !(await js<boolean>(`!!localStorage.getItem("access_token")`)) || new URL(url()).pathname.startsWith("/dashboard"), 20_000);
      await pause(4000);
      h.resteConnecte = new URL(url()).pathname.startsWith("/dashboard");
      h.stockageIntact = await js<boolean>(`!!localStorage.getItem("access_token") && !!localStorage.getItem("user")`);
      h.horsLigneConstate = await attendre(async () => !(await js<{ enLigne: boolean }>(`${pont}.etat()`)).enLigne, 90_000);
      const profil = await js<{ id?: string; structureType?: string; permissions?: string[]; structure?: { id?: string } } | null>(
        `${pont}.profil.lire()`,
      );
      h.profilPont = {
        present: profil !== null,
        pharmacie: profil?.structureType === "PHARMACIE",
        droitCaisse: profil?.permissions?.includes("caisse:utiliser") === true,
        jetonAbsent: profil !== null && !/token|jeton/i.test(JSON.stringify(profil)),
      };
      const structureId = String(profil?.structure?.id ?? "");
      const stock = await js<{ ok: boolean; data?: unknown[] }>(`${pont}.caisse.chargerStock(${JSON.stringify(structureId)})`);
      h.stockLuHorsLigne = { ok: stock.ok, fiches: stock.data?.length ?? 0 };
      h.menuVisible = (await texte()).includes("Se déconnecter");

      // Déconnexion volontaire sans réseau : confirmation, « Rester connecté » ne change rien
      h.clicSeDeconnecter = await cliquer("Se déconnecter", false);
      await attendre(async () => (await texte()).includes("ne pourrez pas vous reconnecter"), 10_000);
      h.dialogue = (await texte()).includes("Les ventes de ce poste restent enregistrées");
      await cliquer("Rester connecté", true);
      await pause(800);
      h.resteApresAnnuler = new URL(url()).pathname.startsWith("/dashboard") && (await js<boolean>(`!!localStorage.getItem("user")`));
      const file = opts.coeur.etatLocal().fileEnAttente;
      await cliquer("Se déconnecter", false);
      await attendre(async () => (await texte()).includes("ne pourrez pas vous reconnecter"), 10_000);
      await cliquer("Se déconnecter", true);
      h.versConnexion = await attendre(() => new URL(url()).pathname.startsWith("/auth/login"), 30_000);
      await attendre(async () => (await texte()).includes("Pas de connexion internet"), 15_000);
      h.messageHorsLigne = (await texte()).includes("Pas de connexion internet");
      h.stockageVide = await js<boolean>(`!localStorage.getItem("access_token") && !localStorage.getItem("user")`);
      h.apresDeconnexion = await ventesBloquees();
      h.fileInchangee = opts.coeur.etatLocal().fileEnAttente === file;
    } else {
      await attendre(() => new URL(url()).pathname.startsWith("/auth/login"), 20_000);
      await pause(2000);
      h.versConnexion = new URL(url()).pathname.startsWith("/auth/login");
      h.messageHorsLigne = await attendre(async () => (await texte()).includes("Pas de connexion internet"), 20_000);
      h.profilLocalAbsent = (await js<unknown>(`${pont}.profil.lire()`)) === null;
      h.apresRelance = await ventesBloquees();
      h.venteEnFile = opts.coeur.etatLocal().fileEnAttente;
    }
    return h;
  };

  const modeHorsLigne = process.env.MC_SONDE_HORS_LIGNE;
  if (modeHorsLigne === "1" || modeHorsLigne === "2") {
    let h: Resultat;
    try {
      h = await sondeHorsLigne(modeHorsLigne);
    } catch (e) {
      h = { erreurSonde: e instanceof Error ? e.message.split("\n")[0] : "erreur" };
    }
    writeFileSync(path.join(app.getAppPath(), `sonde-hors-ligne-${modeHorsLigne}.json`), JSON.stringify(h, null, 2) + "\n");
    app.quit();
    return;
  }

  try {
    // 1. versions
    r.versions = {
      electron: process.versions.electron,
      node: process.versions.node,
      chrome: process.versions.chrome,
      modules: process.versions.modules,
    };

    // 2. better-sqlite3 sous Electron
    try {
      const exiger = createRequire(path.join(app.getAppPath(), "package.json"));
      const Database = exiger("better-sqlite3");
      const base = new Database(":memory:");
      const ligne = base.prepare("select 1 as un").get() as { un: number };
      base.close();
      r.betterSqlite3 = ligne.un === 1;
    } catch (e) {
      r.betterSqlite3 = false;
      r.betterSqlite3Erreur = e instanceof Error ? e.message.split("\n")[0] : "erreur";
    }

    // 3. plateforme et processus
    const metriques = app.getAppMetrics();
    r.plateforme = process.platform;
    r.architecture = process.arch;
    r.pidServeurNext = opts.pidServeur ?? null;
    r.typeProcessusServeur = metriques.find((p) => p.pid === opts.pidServeur)?.type ?? null;

    // Départ à froid : aucune session gardée d'un lancement précédent.
    await session.defaultSession.clearStorageData();

    // 4. connexion par le compte de démonstration de la Pharmacie de Kaloum
    await aller("/dashboard");
    await attendre(() => url().includes("/auth/login"), 15_000);
    const clic = `(() => {
      const boutons = Array.from(document.querySelectorAll("button")).filter((b) => (b.textContent || "").includes("Pharmacie de Kaloum"));
      const b = boutons.find((x) => (x.textContent || "").includes("Administrateur")) || boutons[0];
      if (!b) return false;
      b.click();
      return true;
    })()`;
    let clique = false;
    await attendre(async () => (clique = await js<boolean>(clic)), 20_000);
    if (!clique) {
      r.connexion = "indisponible";
      r.diagnostic = {
        chemin: new URL(url()).pathname,
        boutons: await js<number>(`document.querySelectorAll("button").length`).catch(() => -1),
      };
    } else {
      const ok = await attendre(() => new URL(url()).pathname.startsWith("/dashboard"), 25_000);
      r.connexion = ok;
      r.urlFinaleConnexion = new URL(url()).pathname;
    }

    if (r.connexion === true) {
      // 5. cookie de refresh
      const cookies = await session.defaultSession.cookies.get({ name: "refresh_token" });
      r.cookieRefresh = { present: cookies.length > 0, httpOnly: cookies.length > 0 && cookies.every((c) => c.httpOnly) };

      // 6. navigation
      const navigation: Record<string, boolean> = {};
      for (const chemin of ["/dashboard/vente", "/dashboard/caisse", "/dashboard/ventes"]) {
        await aller(chemin);
        await pause(2500);
        navigation[chemin] = new URL(url()).pathname.startsWith(chemin) && !url().includes("/auth/login");
      }
      r.navigation = navigation;

      // 7. refresh par cookie
      await aller("/dashboard/vente");
      await attendre(() => js<boolean>(`!!localStorage.getItem("access_token")`), 10_000);
      await js(`localStorage.setItem("access_token", "invalide")`);
      await aller("/dashboard/vente");
      const change = await attendre(
        () => js<boolean>(`(() => { const t = localStorage.getItem("access_token"); return !!t && t !== "invalide"; })()`),
        25_000,
      );
      await pause(1500);
      r.refresh = { jetonChange: change, resteConnecte: change && !url().includes("/auth/login") };

      // 9. pont (lu sur une page connectée)
      r.pont = await js<unknown>(`({
        version: window.medconnecteDesktop ? window.medconnecteDesktop.version : null,
        requireAbsent: typeof window.require === "undefined",
        processAbsent: typeof window.process === "undefined",
      })`);

      // 10. Pont de caisse (PD04a) : écrit UNE vente sur la base de dev (compte démo de la Pharmacie de Kaloum).
      r.caisse = await sondeCaisse();

      // Attente de mesure mémoire sur la vente
      const attenteMs = Number(process.env.MC_SONDE_ATTENTE_MS ?? 0);
      await aller("/dashboard/vente");
      if (attenteMs > 0) await pause(attenteMs);
    }

    // 8. CORS et CSP
    r.consoleCorsCsp = messagesConsole.filter((m) => /CORS|Content Security Policy/i.test(m)).length;
  } catch (e) {
    r.erreurSonde = e instanceof Error ? e.message.split("\n")[0] : "erreur";
  }

  writeFileSync(path.join(app.getAppPath(), "sonde-resultat.json"), JSON.stringify(r, null, 2) + "\n");
  app.quit();
}
