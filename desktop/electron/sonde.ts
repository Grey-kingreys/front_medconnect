// Sonde de vérification automatique, active seulement avec MC_SONDE=1 hors application empaquetée.
// Écrit desktop/sonde-resultat.json (booléens et versions seulement, jamais de valeur sensible) puis quitte.
import { app, session, type BrowserWindow } from "electron";
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import path from "node:path";

type Resultat = Record<string, unknown>;

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function lancerSonde(opts: { fenetre: BrowserWindow; origine: string; pidServeur?: number }): Promise<void> {
  const { fenetre, origine } = opts;
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
