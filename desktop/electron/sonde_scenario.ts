// Scénario de preuve de la fiche PD04c, joué dans l'application réelle (DOM réel), actif seulement avec
// MC_SONDE=1 et MC_SCENARIO=<phase> hors application empaquetée. Le relais local (127.0.0.1:3299) coupe l'API :
// ni Docker ni le réseau de la machine ne sont touchés. Écrit un JSON de booléens, de comptes et de textes d'écran
// (jamais de jeton, de cookie ni de mot de passe) dans MC_SONDE_SORTIE, puis quitte.
import { app, BrowserWindow, session } from "electron";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { CoeurCaisse } from "../coeur/coeur";
import type { ServiceImpression } from "./impression";

type Json = Record<string, unknown>;

export interface OptionsScenario {
  fenetre: BrowserWindow;
  origine: string;
  coeur: CoeurCaisse;
  dossier: string;
  urlApi: string;
  declencher: () => void;
  phase: string;
  impression?: ServiceImpression;
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
const UNITES = /(boîtes?|plaquettes?|comprimés?|gélules?|unités?|sachets?|ampoules?|ml|grammes?)/;

export async function jouerScenario(opts: OptionsScenario): Promise<void> {
  const wc = opts.fenetre.webContents;
  const sortie = process.env.MC_SONDE_SORTIE ?? app.getAppPath();
  const fichierEtat = path.join(sortie, "etat_scenario.json");
  const r: Json = { phase: opts.phase, debut: new Date().toISOString() };
  const etapes: Json[] = [];
  const noter = (nom: string, ok: boolean | null, detail: unknown = null) => {
    etapes.push({ etape: nom, ok, detail });
  };

  const js = <T>(code: string) => wc.executeJavaScript(code, true) as Promise<T>;
  const chemin = () => new URL(wc.getURL()).pathname;
  const texte = () => js<string>("document.body.innerText");
  const pont = "window.medconnecteDesktop";
  const attendre = async (condition: () => Promise<boolean> | boolean, delaiMs: number) => {
    const fin = Date.now() + delaiMs;
    while (Date.now() < fin) {
      try {
        if (await condition()) return true;
      } catch {
        // Page en cours de chargement.
      }
      await pause(250);
    }
    return false;
  };
  const aller = async (c: string) => {
    try {
      await wc.loadURL(`${opts.origine}${c}`);
    } catch {
      // Une redirection peut interrompre le chargement.
    }
  };
  const etatPoste = () =>
    js<{
      enLigne: boolean;
      horsLigne: boolean;
      fileEnAttente: number;
      dernierContactLe: string | null;
      rejetes: number;
      messageEnvoi: string | null;
      connexionARefaire: boolean;
    }>(`${pont}.etat()`);
  const relais = async (etat: "on" | "off") => {
    await fetch(`http://127.0.0.1:3299/${etat}`);
  };
  const aLaLigne = async (ligne: string) => (await texte()).split("\n").some((l) => l.trim() === ligne);
  const contient = async (fragment: string) => (await texte()).includes(fragment);

  /** Défauts d'affichage de l'écran courant : « undefined », « NaN », signe moins devant une quantité de stock. */
  const defauts = async (ecran: string) => {
    const t = await texte();
    const motif = new RegExp(`(^|[\\s(:,])-\\s?\\d[\\d\\s]*\\s${UNITES.source}`, "i");
    const moinsStock = t.split("\n").filter((l) => motif.test(l));
    const d = { ecran, undefined: /undefined/.test(t), nan: /NaN/.test(t), moinsStock: moinsStock.length };
    noter(`DOM ${ecran}`, !d.undefined && !d.nan && d.moinsStock === 0, d);
    return d;
  };

  const cliquerBouton = (libelle: string, racine = "document", exact = true) =>
    js<boolean>(`(() => {
      const racine = ${racine};
      if (!racine) return false;
      const b = Array.from(racine.querySelectorAll("button, a, [role='radio']")).find((x) => {
        const t = (x.textContent || "").trim();
        const l = x.getAttribute("aria-label") || "";
        return ${exact} ? (t === ${JSON.stringify(libelle)} || l === ${JSON.stringify(libelle)}) : (t.includes(${JSON.stringify(libelle)}) || l.includes(${JSON.stringify(libelle)}));
      });
      if (!b || b.disabled) return false;
      b.click();
      return true;
    })()`);
  const remplir = (selecteur: string, valeur: string) =>
    js<boolean>(`(() => {
      const el = document.querySelector(${JSON.stringify(selecteur)});
      if (!el) return false;
      const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value").set.call(el, ${JSON.stringify(valeur)});
      el.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    })()`);
  const lireJeton = () => js<string | null>(`localStorage.getItem("access_token")`);
  const jetonValide = async () => {
    const j = await lireJeton();
    return !!j && j !== "invalide";
  };

  const connexionDemo = async (role = "Administrateur") => {
    await aller("/auth/login");
    await attendre(
      () =>
        js<boolean>(`(() => {
          const b = Array.from(document.querySelectorAll("button")).filter((x) => (x.textContent || "").includes("Pharmacie de Kaloum"));
          const cible = b.find((x) => (x.textContent || "").includes(${JSON.stringify(role)})) || b[0];
          if (!cible) return false;
          cible.click();
          return true;
        })()`),
      30_000,
    );
    const ok = await attendre(() => chemin().startsWith("/dashboard"), 30_000);
    await attendre(jetonValide, 20_000);
    return ok;
  };

  const api = async (c: string) => {
    const jeton = await lireJeton();
    const rep = await fetch(`${opts.urlApi}${c}`, { headers: { Authorization: `Bearer ${jeton ?? ""}` } });
    return { status: rep.status, corps: (await rep.json().catch(() => ({}))) as Json };
  };
  const identite = async () => {
    const me = (await api("/auth/me")).corps.data as Json | undefined;
    const structure = me?.structure as { id?: string } | undefined;
    return { structureId: String(structure?.id ?? me?.structureId ?? ""), userId: String(me?.id ?? "") };
  };

  const lireEtat = (): Json => (existsSync(fichierEtat) ? (JSON.parse(readFileSync(fichierEtat, "utf8")) as Json) : {});
  const ecrireEtat = (e: Json) => writeFileSync(fichierEtat, JSON.stringify(e, null, 2) + "\n");
  const sqlite = () => {
    const exiger = createRequire(path.join(app.getAppPath(), "package.json"));
    const Database = exiger("better-sqlite3");
    return new Database(path.join(opts.dossier, "caisse.sqlite"));
  };

  interface Fiche {
    id: string;
    medicament: { nom: string; ordonnanceRequise?: boolean };
    quantite: number;
    quantiteVendable?: number;
    quantiteARegulariser?: number;
    coefficientBoite?: number;
    uniteMinimale?: string;
    deconditionnable?: boolean;
    prixUnitaire?: number | null;
    prixUnite?: number | null;
  }
  const resume = (f: Fiche | undefined) =>
    f
      ? {
          id: f.id,
          nom: f.medicament.nom,
          quantite: f.quantite,
          aRegulariser: f.quantiteARegulariser ?? 0,
          coef: f.coefficientBoite ?? 1,
          unite: f.uniteMinimale ?? "UNITE",
        }
      : null;

  /** Une vente par l'écran : recherche, ajout, quantité, validation, mode de paiement, confirmation. */
  const vendre = async (nom: string, options: { plus?: number; mode?: string; enUnites?: boolean }) => {
    await aller("/dashboard/vente");
    if (!(await attendre(() => js<boolean>(`!!document.querySelector("#recherche-vente")`), 30_000))) {
      return { ok: false, raison: "écran de vente absent" };
    }
    await remplir("#recherche-vente", nom);
    const ajoute = await attendre(() => cliquerBouton(`Ajouter ${nom} au panier`), 15_000);
    if (!ajoute) return { ok: false, raison: "bouton Ajouter absent ou désactivé" };
    await pause(300);
    if (options.enUnites) {
      // Vente à l'unité minimale (plaquette, comprimé) : le bouton de l'unité qui n'est pas la boîte.
      await js<boolean>(`(() => {
        const g = Array.from(document.querySelectorAll('[role="group"]')).find((x) => x.getAttribute("aria-label") === ${JSON.stringify(`Unité de vente de ${nom}`)});
        const b = g && Array.from(g.querySelectorAll("button")).find((x) => !/oîte/.test(x.textContent || ""));
        if (!b) return false;
        if (b.getAttribute("aria-pressed") !== "true") b.click();
        return true;
      })()`);
      await pause(300);
    }
    for (let i = 0; i < (options.plus ?? 0); i += 1) {
      await cliquerBouton(`Augmenter la quantité de ${nom}`);
      await pause(200);
    }
    const avant = await texte();
    const avertissement = avant.split("\n").find((l) => l.includes("à régulariser") || l.includes("Stock connu")) ?? null;
    // Médicament sur ordonnance : la case « J'ai vu l'ordonnance » doit être cochée
    const ordonnance = await js<boolean>(`(() => {
      const label = Array.from(document.querySelectorAll("label")).find((l) => (l.textContent || "").includes("J'ai vu l'ordonnance"));
      const caseOrdonnance = label && (label.querySelector("input") || document.getElementById(label.getAttribute("for") || ""));
      if (!caseOrdonnance) return false;
      if (!caseOrdonnance.checked) caseOrdonnance.click();
      return true;
    })()`);
    await cliquerBouton("Valider la vente");
    if (!(await attendre(() => contient("Valider la vente ?"), 10_000))) return { ok: false, raison: "confirmation absente", ordonnance };
    if (options.mode) await cliquerBouton(options.mode, `document.querySelector('[role="dialog"]')`);
    await pause(200);
    await cliquerBouton("Confirmer la vente", `document.querySelector('[role="dialog"]')`);
    const fait = await attendre(() => aLaLigne("Vente enregistrée"), 30_000);
    const t = await texte();
    const numero = /Numéro : (\S+)/.exec(t)?.[1] ?? null;
    const venteId = await js<string | null>(
      `(() => { const a = document.querySelector('a[href*="/recu"]'); return a ? decodeURIComponent(a.getAttribute("href").split("/")[3]) : null; })()`,
    );
    const defaut = await defauts(`succès de vente ${nom}`);
    return {
      ok: fait,
      numero,
      venteId,
      avertissement,
      messageARegulariser: t.includes("Une partie est à régulariser par le titulaire."),
      defaut,
    };
  };

  // ─── Aides de la fiche PD05 (impression, annulation en ligne, plaquette) ───
  const apiEcrire = async (methode: string, c: string, corps: Json | null, entetes: Record<string, string> = {}) => {
    const jeton = await lireJeton();
    const rep = await fetch(`${opts.urlApi}${c}`, {
      method: methode,
      headers: { Authorization: `Bearer ${jeton ?? ""}`, "Content-Type": "application/json", ...entetes },
      body: corps === null ? undefined : JSON.stringify(corps),
    });
    return { status: rep.status, corps: (await rep.json().catch(() => ({}))) as Json };
  };
  const commandeRelais = async (cmd: string) =>
    (await (await fetch(`http://127.0.0.1:3299/${cmd}`)).json()) as {
      actif: boolean;
      retenu: boolean;
      enAttente: number;
      compteurs: { annulations: number; evenements: number; total: number };
    };
  type SessionLue = { id: string; jourMetier?: string; statut?: string } | null;
  const posteEtCaisse = (structureId: string, userId: string) =>
    js<{ ok: boolean; data?: { poste: { id: string; code: string }; session: SessionLue } }>(
      `${pont}.caisse.etatCaisse(${JSON.stringify(structureId)}, ${JSON.stringify(userId)})`,
    );
  const theoriqueEspeces = async (structureId: string, sessionId: string) => {
    const b = await js<{ ok: boolean; data?: { theorique: { mode: string; montant: number }[] } }>(
      `${pont}.caisse.getBilan(${JSON.stringify(structureId)}, ${JSON.stringify(sessionId)})`,
    );
    return b.data?.theorique.find((t) => t.mode === "ESPECES")?.montant ?? null;
  };
  const attendreEnvoye = () =>
    attendre(async () => {
      const e = await etatPoste();
      return e.fileEnAttente === 0 && e.enLigne;
    }, 90_000);
  const ouvrirCaisseUI = async () => {
    await aller("/dashboard/caisse");
    await attendre(
      () =>
        js<boolean>(
          `document.querySelectorAll('input[aria-label^="Nombre de billets"]').length > 0 || Array.from(document.querySelectorAll("button")).some((b) => b.textContent.trim() === "Fermer la caisse")`,
        ),
      30_000,
    );
    if (await cliquerBouton("Ouvrir sans compter")) return attendre(() => aLaLigne("Caisse ouverte"), 30_000);
    return true;
  };
  const fermerCaisseUI = async (commentaire: string) => {
    await aller("/dashboard/caisse");
    await attendre(
      () => js<boolean>(`Array.from(document.querySelectorAll("button")).some((b) => b.textContent.trim() === "Fermer la caisse" && !b.disabled)`),
      40_000,
    );
    await cliquerBouton("Fermer la caisse");
    await attendre(() => js<boolean>(`!!document.querySelector("#fermeture-caisse")`), 10_000);
    await remplir("#commentaire-fermeture", commentaire);
    await cliquerBouton("Fermer ma caisse");
    await attendre(() => contient("Fermer la caisse ?"), 10_000);
    await cliquerBouton("Confirmer la fermeture", `document.querySelector('[role="dialog"]')`);
    return attendre(async () => !(await js<boolean>(`!!document.querySelector("#fermeture-caisse input")`)) && (await contient("Commentaire")), 30_000);
  };
  const lireDialogue = () => js<string | null>(`(() => { const d = document.querySelector('[role="dialog"]'); return d ? d.innerText : null; })()`);
  /** Annule une vente depuis « Ventes du jour » : bouton, motif, confirmation. Rend le message de la page. */
  const annulerDepuisListe = async (numero: string, motif: string, jour?: string) => {
    await aller("/dashboard/ventes");
    if (jour !== undefined) {
      // Une vente d'une caisse web restée ouverte d'un autre jour est listée à son jour métier.
      await attendre(() => js<boolean>(`!!document.querySelector("#date-ventes")`), 30_000);
      await remplir("#date-ventes", jour);
    }
    await attendre(() => contient(numero), 30_000);
    const clic = await attendre(() => cliquerBouton(`Annuler la vente ${numero}`), 20_000);
    if (!clic) return { ok: false, message: "bouton Annuler absent ou désactivé", dialogue: null as string | null };
    await attendre(() => js<boolean>(`!!document.querySelector("#motif-annulation")`), 10_000);
    await remplir("#motif-annulation", motif);
    await cliquerBouton("Annuler la vente", `document.querySelector('[role="dialog"]')`);
    await attendre(
      async () =>
        (await lireDialogue()) === null ||
        (await js<boolean>(`!!document.querySelector('[role="dialog"] [role="alert"]:not(:empty)') && !(document.querySelector('[role="dialog"]').innerText.includes("Annulation..."))`)),
      40_000,
    );
    await pause(500);
    const dialogue = await lireDialogue();
    const t = await texte();
    const message = t.split("\n").find((l) => l.startsWith(`Vente ${numero} annulée`)) ?? null;
    return { ok: dialogue === null && message !== null, message, dialogue };
  };
  const choisirOption = (selecteur: string, valeur: string) =>
    js<boolean>(`(() => {
      const el = document.querySelector(${JSON.stringify(selecteur)});
      if (!el) return false;
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(el, ${JSON.stringify(valeur)});
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return el.value === ${JSON.stringify(valeur)};
    })()`);
  type ReponsePontSonde = { ok: boolean; status?: number; code?: string; message?: string; data?: unknown };
  const reglagesPont = async () => (await js<ReponsePontSonde>(`${pont}.impression.lireReglages()`)).data as {
    imprimante: string | null;
    formatRecu: string;
    impressionAutomatique: boolean;
  };
  const nbFenetres = () => BrowserWindow.getAllWindows().length;
  /** Surveillant PowerShell qui saisit le nom de fichier dans la boîte du pilote « Microsoft Print to PDF » (le seul dialogue). */
  const lancerSurveillant = (cible: string, delaiS: number) => {
    const script = process.env.MC_SURVEILLANT_PS1;
    if (!script) return null;
    return spawn("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script, cible, String(delaiS)], { stdio: "ignore" });
  };
  const dossierPdf = () => sortie;
  /** Pages, largeur et hauteur (mm) d'un PDF, par la table des pages (MediaBox). Le texte est lu hors application par pdftotext. */
  const mesuresPdf = (chemin: string) => {
    const brut = readFileSync(chemin).toString("latin1");
    const boites = [...brut.matchAll(/\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/g)].map((m) => ({
      largeurMm: Math.round(((Number(m[3]) - Number(m[1])) * 25.4 * 100) / 72) / 100,
      hauteurMm: Math.round(((Number(m[4]) - Number(m[2])) * 25.4 * 100) / 72) / 100,
    }));
    const pages = (brut.match(/\/Type\s*\/Page(?![s\w])/g) ?? []).length;
    return { pages, boites, octets: statSync(chemin).size };
  };

  try {
    if (opts.phase === "1") {
      // Étape 1 : en ligne, catalogue et plage chargés, stock de deux fiches
      const connecte = await connexionDemo();
      noter("connexion démo", connecte);
      await aller("/dashboard/vente");
      await attendre(() => contient("Rechercher un médicament"), 60_000);
      const pret = await attendre(async () => {
        const e = await etatPoste();
        return e.enLigne && e.dernierContactLe !== null;
      }, 120_000);
      const e1 = await etatPoste();
      noter("1 en ligne, contact serveur", pret, { enLigne: e1.enLigne, fileEnAttente: e1.fileEnAttente });
      noter("1 bandeau En ligne", await aLaLigne("En ligne"));
      await defauts("vente en ligne");
      const { structureId, userId } = await identite();
      const stock = await js<{ ok: boolean; data?: Fiche[] }>(`${pont}.caisse.chargerStock(${JSON.stringify(structureId)})`);
      const fiches = stock.data ?? [];
      const sans = (f: Fiche) => f.medicament.ordonnanceRequise !== true;
      const boite = fiches.find((f) => sans(f) && f.deconditionnable !== true && (f.prixUnitaire ?? 0) > 0 && f.quantite >= 20);
      const decond = fiches.find(
        (f) =>
          sans(f) &&
          f.deconditionnable === true &&
          f.uniteMinimale !== "PLAQUETTE" &&
          (f.coefficientBoite ?? 1) >= 3 &&
          (f.prixUnite ?? 0) > 0 &&
          f.quantite >= (f.coefficientBoite ?? 1) * 3,
      );
      const plaq = fiches.find(
        (f) =>
          sans(f) &&
          f.uniteMinimale === "PLAQUETTE" &&
          f.deconditionnable === true &&
          (f.prixUnite ?? 0) > 0 &&
          f.quantite >= (f.coefficientBoite ?? 1) * 2,
      );
      const zero = fiches.find((f) => f.quantite === 0 && (f.quantiteVendable ?? 0) === 0 && (f.prixUnitaire ?? 0) > 0);
      noter("1 fiches choisies", boite !== undefined && decond !== undefined && zero !== undefined, {
        fichesLues: fiches.length,
        boite: resume(boite),
        decond: resume(decond),
        plaquette: resume(plaq),
        zero: resume(zero),
      });
      ecrireEtat({
        structureId,
        userId,
        choix: { boite: resume(boite), decond: resume(decond), plaq: resume(plaq), zero: resume(zero) },
        ventes: [],
      });
      // Étape 2 : coupure du relais
      await relais("off");
      const coupe = await attendre(async () => (await etatPoste()).horsLigne, 150_000);
      const e2 = await etatPoste();
      noter("2 hors connexion constaté", coupe, { horsLigne: e2.horsLigne, fileEnAttente: e2.fileEnAttente });
      await attendre(() => contient("Hors connexion"), 10_000);
      noter("2 bandeau Hors connexion, 0 en attente", (await contient("Hors connexion")) && (await contient("(0 en attente d'envoi)")));
      await defauts("vente hors ligne (bandeau)");
    } else if (opts.phase === "2") {
      const etat = lireEtat();
      const choix = etat.choix as Record<string, ReturnType<typeof resume>>;
      // Étape 3 : redémarrage hors ligne
      await aller("/dashboard");
      const versVente = await attendre(() => chemin() === "/dashboard/vente", 40_000);
      noter("3 toujours connecté, /dashboard mène à la vente", versVente && !chemin().includes("/auth/login"), { chemin: chemin() });
      await attendre(() => contient("Rechercher un médicament"), 30_000);
      await attendre(async () => (await etatPoste()).horsLigne, 60_000);
      await attendre(() => contient("Hors connexion"), 10_000);
      const t3 = await texte();
      noter("3 menu complet et bandeau", t3.includes("Se déconnecter") && t3.includes("Hors connexion"), {
        liensMenu: await js<number>(`document.querySelectorAll("aside nav a").length`),
        bandeau: t3.split("\n").find((l) => l.includes("Hors connexion")) ?? null,
      });
      noter("3 la vente n'affiche pas la page réservée", !t3.includes("Cette action demande une connexion."));
      await defauts("vente hors ligne");

      // Étape 4 : ouvrir la caisse en un geste, fond compté
      await aller("/dashboard/caisse");
      await attendre(() => js<boolean>(`document.querySelectorAll('input[aria-label^="Nombre de billets"]').length > 0`), 30_000);
      await defauts("caisse fermée hors ligne");
      const champs = await js<string[]>(
        `Array.from(document.querySelectorAll('input[aria-label^="Nombre de billets"]')).map((e) => e.getAttribute("aria-label"))`,
      );
      await remplir(`input[aria-label="${champs[1]}"]`, "2");
      await remplir(`input[aria-label="${champs[2]}"]`, "1");
      await pause(300);
      const totalFond = (await texte()).split("\n").find((l) => l.startsWith("Total compté")) ?? null;
      await cliquerBouton("Ouvrir la caisse avec ce fond");
      const ouverte = await attendre(() => aLaLigne("Caisse ouverte"), 30_000);
      noter("4 caisse ouverte en un geste, fond compté", ouverte, {
        totalFond,
        fond: (await texte()).split("\n").find((l) => l.startsWith("Fond de caisse")) ?? null,
      });
      await defauts("caisse ouverte");

      // Étape 4 : ventes
      const ventes: Json[] = [];
      const jouer = async (nom: string, cle: string, o: { plus?: number; mode?: string }) => {
        const v = await vendre(nom, o);
        ventes.push({ cle, nom, ...v });
        noter(`4 vente ${cle}`, (v as { ok: boolean }).ok === true, v);
        await cliquerBouton("Nouvelle vente");
      };
      if (choix.boite) await jouer(choix.boite.nom, "1 boîte, espèces", { mode: "Espèces" });
      if (choix.decond) await jouer(choix.decond.nom, "3 unités, Orange Money", { plus: 2, mode: "Orange Money" });
      if (choix.plaq) await jouer(choix.plaq.nom, "1 plaquette, espèces", { mode: "Espèces" });
      else noter("4 vente plaquette", null, "aucune fiche à la plaquette dans le stock de la Pharmacie de Kaloum");
      if (choix.zero) await jouer(choix.zero.nom, "médicament à 0, espèces", { mode: "Espèces" });

      // Listes après les ventes : 0 et « à régulariser », jamais de négatif
      for (const cle of ["boite", "decond", "plaq", "zero"]) {
        const f = choix[cle];
        if (!f) continue;
        await aller("/dashboard/vente");
        await attendre(() => js<boolean>(`!!document.querySelector("#recherche-vente")`), 30_000);
        await remplir("#recherche-vente", f.nom);
        await pause(500);
        const ligne = await js<string | null>(
          `(() => { const li = Array.from(document.querySelectorAll("li")).find((x) => (x.textContent || "").includes(${JSON.stringify(f.nom)})); return li ? li.innerText : null; })()`,
        );
        const defaut = await defauts(`liste de vente après vente (${cle})`);
        noter(`4 liste ${cle}`, ligne !== null && defaut.moinsStock === 0, { ligne: ligne?.replace(/\n+/g, " | ") ?? null, avant: f });
      }
      const eFile = await etatPoste();
      noter("4 N en attente d'envoi", eFile.fileEnAttente > 0, {
        fileEnAttente: eFile.fileEnAttente,
        bandeau: (await texte()).split("\n").find((l) => l.includes("en attente d'envoi")) ?? null,
      });

      // Étape 5 : mouvement de caisse
      await aller("/dashboard/caisse");
      await attendre(() => aLaLigne("Caisse ouverte"), 30_000);
      await attendre(
        () => js<boolean>(`Array.from(document.querySelectorAll("button")).some((b) => b.textContent.trim() === "Mouvement de caisse" && !b.disabled)`),
        20_000,
      );
      await cliquerBouton("Mouvement de caisse");
      await attendre(() => js<boolean>(`!!document.querySelector("#montant-mouvement")`), 10_000);
      await cliquerBouton("Prélèvement (sortie d'argent)", `document.querySelector('[role="dialog"]')`, false);
      await remplir("#montant-mouvement", "1000");
      await remplir("#motif-mouvement", "Essai de prélèvement hors ligne");
      await cliquerBouton("Enregistrer", `document.querySelector('[role="dialog"]')`);
      const mvtFait = await attendre(async () => !(await js<boolean>(`!!document.querySelector("#montant-mouvement")`)), 20_000);
      noter("5 mouvement de caisse (prélèvement motivé)", mvtFait, {
        message: (await texte()).split("\n").find((l) => l.toLowerCase().includes("mouvement")) ?? null,
      });
      await defauts("caisse après mouvement");

      // Étape 5 : ventes du poste et reçu sans réseau
      await aller("/dashboard/ventes");
      await attendre(() => contient("Réimprimer"), 30_000);
      const listeTexte = await texte();
      noter("5 ventes du poste hors ligne", listeTexte.includes("L'annulation demande une connexion."), {
        nombre: listeTexte.split("\n").find((l) => /^\d+ ventes?$/.test(l.trim())) ?? null,
        note: listeTexte.split("\n").find((l) => l.includes("L'annulation demande")) ?? null,
        boutonsAnnulerActifs: await js<number>(
          `Array.from(document.querySelectorAll("button")).filter((b) => (b.getAttribute("aria-label")||"").startsWith("Annuler la vente") && !b.disabled).length`,
        ),
      });
      await defauts("ventes du poste hors ligne");
      const hrefRecu = await js<string | null>(
        `(() => { const a = document.querySelector('a[aria-label^="Réimprimer le reçu"]'); return a ? a.getAttribute("href") : null; })()`,
      );
      if (hrefRecu) {
        await aller(hrefRecu);
        const recu = await attendre(() => contient("Total"), 30_000);
        const tr = await texte();
        noter("5 reçu d'une vente sans réseau", recu && tr.includes("Pharmacie de Kaloum"), {
          extrait: tr.split("\n").slice(0, 14).join(" | "),
        });
        await defauts("reçu hors ligne");
      }

      // Étape 5 : page réservée au réseau
      await aller("/dashboard/receptions");
      const reservee = await attendre(() => contient("Cette action demande une connexion."), 20_000);
      noter("5 page Réception réservée", reservee && (await contient("Aller à la vente")));
      await defauts("page réservée");

      // Étape 6 : fermeture de la caisse, comptage, écart, commentaire
      await aller("/dashboard/caisse");
      await attendre(
        () => js<boolean>(`Array.from(document.querySelectorAll("button")).some((b) => b.textContent.trim() === "Fermer la caisse" && !b.disabled)`),
        40_000,
      );
      await cliquerBouton("Fermer la caisse");
      await attendre(() => js<boolean>(`!!document.querySelector("#fermeture-caisse")`), 10_000);
      const champsF = await js<string[]>(
        `Array.from(document.querySelectorAll('#fermeture-caisse input[aria-label^="Nombre de billets"]')).map((e) => e.getAttribute("aria-label"))`,
      );
      await remplir(`#fermeture-caisse input[aria-label="${champsF[1]}"]`, "2");
      await remplir(`#fermeture-caisse input[aria-label="${champsF[2]}"]`, "1");
      await remplir("#commentaire-fermeture", "Essai poste hors ligne : comptage de preuve");
      await pause(300);
      await cliquerBouton("Fermer ma caisse");
      await attendre(() => contient("Fermer la caisse ?"), 10_000);
      await cliquerBouton("Confirmer la fermeture", `document.querySelector('[role="dialog"]')`);
      const fermee = await attendre(
        async () => !(await js<boolean>(`!!document.querySelector("#fermeture-caisse input")`)) && (await contient("Commentaire")),
        30_000,
      );
      const tf = await texte();
      noter("6 caisse fermée, bilan affiché", fermee, {
        extrait: tf.split("\n").filter((l) => l.trim() !== "").slice(0, 24).join(" | "),
      });
      await defauts("bilan de fermeture");
      const apresFermeture = await etatPoste();
      noter("6 N avant le retour du serveur", true, { fileEnAttente: apresFermeture.fileEnAttente });
      etat.ventes = ventes.map((v) => ({ numero: v.numero, venteId: v.venteId, cle: v.cle }));
      etat.fileAvantRetour = apresFermeture.fileEnAttente;
      ecrireEtat(etat);
    } else if (opts.phase === "8") {
      // Hors ligne : mouvement de caisse (le type se choisit par sa case)
      await aller("/dashboard/caisse");
      await attendre(() => js<boolean>(`document.querySelectorAll('input[aria-label^="Nombre de billets"]').length > 0`), 30_000);
      await cliquerBouton("Ouvrir sans compter");
      await attendre(() => aLaLigne("Caisse ouverte"), 30_000);
      await attendre(
        () => js<boolean>(`Array.from(document.querySelectorAll("button")).some((b) => b.textContent.trim() === "Mouvement de caisse" && !b.disabled)`),
        20_000,
      );
      await cliquerBouton("Mouvement de caisse");
      await attendre(() => js<boolean>(`!!document.querySelector("#montant-mouvement")`), 10_000);
      await js(`document.querySelector('input[type="radio"][value="PRELEVEMENT"]').click()`);
      await remplir("#montant-mouvement", "1000");
      await remplir("#motif-mouvement", "Essai de prélèvement hors ligne");
      await cliquerBouton("Enregistrer", `document.querySelector('[role="dialog"]')`);
      const ferme = await attendre(async () => !(await js<boolean>(`!!document.querySelector("#montant-mouvement")`)), 20_000);
      const t = await texte();
      noter("8 mouvement de caisse (prélèvement motivé)", ferme, {
        message: t.split("\n").find((l) => /mouvement|prélèvement/i.test(l) && !l.startsWith("Mouvement de caisse")) ?? null,
        fileEnAttente: (await etatPoste()).fileEnAttente,
      });
      await defauts("caisse après mouvement");
      await cliquerBouton("Fermer la caisse");
      await attendre(() => js<boolean>(`!!document.querySelector("#fermeture-caisse")`), 10_000);
      await remplir("#commentaire-fermeture", "Essai poste hors ligne : fermeture de preuve");
      await cliquerBouton("Fermer ma caisse");
      await attendre(() => contient("Fermer la caisse ?"), 10_000);
      await cliquerBouton("Confirmer la fermeture", `document.querySelector('[role="dialog"]')`);
      noter(
        "8 caisse refermée",
        await attendre(async () => !(await js<boolean>(`!!document.querySelector("#fermeture-caisse input")`)) && (await contient("Commentaire")), 30_000),
        { fileEnAttente: (await etatPoste()).fileEnAttente },
      );
    } else if (opts.phase === "7") {
      // Hors ligne : menu pharmacie, caisse sans vente, mouvement de caisse, note des ventes, fermeture
      await aller("/dashboard/vente");
      await attendre(() => contient("Nouvelle vente"), 30_000);
      await attendre(async () => (await etatPoste()).horsLigne, 60_000);
      const liens = await js<string[]>(`Array.from(document.querySelectorAll("aside nav a")).map((a) => a.textContent.trim())`);
      noter("7 menu pharmacie complet hors ligne", liens.length >= 8 && liens.includes("Nouvelle vente"), { liens });
      await aller("/dashboard/caisse");
      await attendre(() => js<boolean>(`document.querySelectorAll('input[aria-label^="Nombre de billets"]').length > 0`), 30_000);
      await cliquerBouton("Ouvrir sans compter");
      noter("7 caisse ouverte sans compter", await attendre(() => aLaLigne("Caisse ouverte"), 30_000));
      await attendre(
        () => js<boolean>(`Array.from(document.querySelectorAll("button")).some((b) => b.textContent.trim() === "Mouvement de caisse" && !b.disabled)`),
        20_000,
      );
      await cliquerBouton("Mouvement de caisse");
      await attendre(() => js<boolean>(`!!document.querySelector("#montant-mouvement")`), 10_000);
      await cliquerBouton("Prélèvement (sortie d'argent)", `document.querySelector('[role="dialog"]')`, false);
      await remplir("#montant-mouvement", "1000");
      await remplir("#motif-mouvement", "Essai de prélèvement hors ligne");
      const clic = await cliquerBouton("Enregistrer", `document.querySelector('[role="dialog"]')`);
      const ferme = await attendre(async () => !(await js<boolean>(`!!document.querySelector("#montant-mouvement")`)), 20_000);
      const dialogue = await js<string | null>(`(() => { const d = document.querySelector('[role="dialog"]'); return d ? d.innerText : null; })()`);
      noter("7 mouvement de caisse (prélèvement motivé)", clic && ferme, { clic, dialogueRestant: dialogue?.replace(/\n+/g, " | ").slice(0, 400) ?? null });
      await aller("/dashboard/ventes");
      await attendre(() => contient("Total du jour"), 30_000);
      const tv = await texte();
      noter("7 note d'annulation hors ligne", tv.includes("L'annulation demande une connexion."), {
        note: tv.split("\n").find((l) => l.includes("L'annulation demande")) ?? null,
        boutonsAnnulerActifs: await js<number>(
          `Array.from(document.querySelectorAll("button")).filter((b) => (b.getAttribute("aria-label")||"").startsWith("Annuler la vente") && !b.disabled).length`,
        ),
        boutonsAnnulerDesactives: await js<number>(
          `Array.from(document.querySelectorAll("button")).filter((b) => (b.getAttribute("aria-label")||"").startsWith("Annuler la vente") && b.disabled).length`,
        ),
      });
      await defauts("ventes du poste hors ligne (menu corrigé)");
      await aller("/dashboard/caisse");
      await attendre(
        () => js<boolean>(`Array.from(document.querySelectorAll("button")).some((b) => b.textContent.trim() === "Fermer la caisse" && !b.disabled)`),
        40_000,
      );
      await cliquerBouton("Fermer la caisse");
      await attendre(() => js<boolean>(`!!document.querySelector("#fermeture-caisse")`), 10_000);
      await remplir("#commentaire-fermeture", "Essai poste hors ligne : fermeture de preuve");
      await cliquerBouton("Fermer ma caisse");
      await attendre(() => contient("Fermer la caisse ?"), 10_000);
      await cliquerBouton("Confirmer la fermeture", `document.querySelector('[role="dialog"]')`);
      const fermee = await attendre(async () => !(await js<boolean>(`!!document.querySelector("#fermeture-caisse input")`)) && (await contient("Commentaire")), 30_000);
      noter("7 caisse refermée", fermee, { fileEnAttente: (await etatPoste()).fileEnAttente });
      await defauts("bilan de fermeture 2");
    } else if (opts.phase === "6") {
      // Diagnostic du menu hors ligne : profil local et session de la page
      const journalPage: string[] = [];
      wc.on("console-message", (...args: unknown[]) => {
        const p = args[0] as { message?: string } | undefined;
        const m = p && typeof p === "object" && "message" in p ? p.message : args[2];
        if (typeof m === "string" && journalPage.length < 40) journalPage.push(`${Math.round(performance.now() / 1000)}s ${m.slice(0, 140)}`);
      });
      await aller("/dashboard/vente");
      await attendre(() => contient("Rechercher un médicament"), 40_000);
      await attendre(async () => (await etatPoste()).horsLigne, 60_000);
      const diag = await js<Json>(`(async () => {
        const p = await ${pont}.profil.lire();
        const stocke = JSON.parse(localStorage.getItem("user") || "null");
        return {
          profilPresent: p !== null,
          cles: p ? Object.keys(p).sort() : null,
          structureType: p ? p.structureType : null,
          nbPermissions: p && Array.isArray(p.permissions) ? p.permissions.length : null,
          memeId: !!(p && stocke && p.id === stocke.id),
          roleSession: stocke ? stocke.role : null,
        };
      })()`);
      const essaiFetch = await js<Json>(`(async () => {
        const t0 = performance.now();
        try {
          await fetch(${JSON.stringify(opts.urlApi)} + "/auth/verify", { credentials: "include" });
          return { resultat: "reponse", ms: Math.round(performance.now() - t0), enLigneNavigateur: navigator.onLine };
        } catch (e) {
          return { resultat: String(e).slice(0, 80), ms: Math.round(performance.now() - t0), enLigneNavigateur: navigator.onLine };
        }
      })()`);
      const chargement = await contient("Chargement");
      const liens = await js<string[]>(`Array.from(document.querySelectorAll("aside nav a")).map((a) => a.textContent.trim())`);
      journalPage.push(`essaiFetch ${JSON.stringify(essaiFetch)} chargementAffiche=${chargement}`);
      noter("6 diagnostic du profil local et du menu", null, { diag, liens, journalPage });
    } else if (opts.phase === "3") {
      // Étape 7 : le relais revient, N tombe à 0 sans geste
      const etat = lireEtat();
      const structureId = String(etat.structureId);
      await aller("/dashboard/ventes");
      await attendre(() => contient("Réimprimer"), 40_000);
      const avant = await etatPoste();
      noter("7 avant le retour", true, { fileEnAttente: avant.fileEnAttente, horsLigne: avant.horsLigne });
      const debut = Date.now();
      await relais("on");
      const vide = await attendre(async () => {
        const e = await etatPoste();
        return e.fileEnAttente === 0 && e.enLigne;
      }, 240_000);
      const e7 = await etatPoste();
      noter("7 N tombe à 0 sans geste", vide, {
        secondes: Math.round((Date.now() - debut) / 1000),
        fileEnAttente: e7.fileEnAttente,
        enLigne: e7.enLigne,
        rejetes: e7.rejetes,
        messageEnvoi: e7.messageEnvoi,
      });
      noter("7 bandeau", true, {
        bandeau: (await texte()).split("\n").find((l) => l.includes("En ligne") || l.includes("Hors connexion") || l.includes("Connexion")) ?? null,
      });

      // Côté serveur : ventes, session, anomalie, stock
      const ventes = (etat.ventes ?? []) as { numero: string | null; venteId: string | null; cle: string }[];
      const jour = new Date().toLocaleDateString("sv-SE", { timeZone: "Africa/Conakry" });
      const liste = await api(`/pharmacie/${structureId}/ventes?date=${jour}`);
      const numerosServeur = (((liste.corps.data as Json | undefined)?.ventes as { numero: string }[] | undefined) ?? []).map((v) => v.numero);
      noter("7 ventes présentes au serveur avec le même numéro", ventes.length > 0 && ventes.every((v) => v.numero !== null && numerosServeur.includes(v.numero)), {
        attendues: ventes.length,
        trouvees: ventes.filter((v) => v.numero !== null && numerosServeur.includes(v.numero)).length,
      });
      const premiere = ventes.find((v) => v.venteId);
      let sessionId: string | null = null;
      if (premiere?.venteId) {
        const v = await api(`/pharmacie/${structureId}/ventes/${premiere.venteId}`);
        sessionId = String(((v.corps.data as Json | undefined)?.session as { id?: string } | undefined)?.id ?? "");
      }
      if (sessionId) {
        const b = await api(`/pharmacie/${structureId}/caisse/sessions/${sessionId}/bilan`);
        const data = b.corps.data as Json | undefined;
        const statut = data?.statut ?? (data?.session as Json | undefined)?.statut ?? null;
        noter("7 session fermée au serveur", statut === "FERMEE" || statut === "INCLUSE_DANS_CLOTURE", {
          status: b.status,
          statut,
          cles: Object.keys(data ?? {}).slice(0, 12),
        });
      }
      const ano = await api(`/pharmacie/${structureId}/anomalies?statut=OUVERTE&limite=100`);
      const brut = JSON.stringify(ano.corps);
      const venteZero = ventes.find((v) => v.cle.includes("à 0"));
      noter(
        "7 anomalie STOCK_NEGATIF de la vente à 0",
        venteZero?.venteId ? brut.includes(venteZero.venteId) && brut.includes("STOCK_NEGATIF") : null,
        { status: ano.status, contientSTOCK_NEGATIF: brut.includes("STOCK_NEGATIF") },
      );
      // Stock : serveur et poste doivent dire la même chose
      const web = await api(`/pharmacie/stock/${structureId}`);
      const stocksWeb = ((web.corps.data as Json | undefined)?.stocks ?? []) as Json[];
      const poste = await js<{ data?: Json[] }>(`${pont}.caisse.chargerStock(${JSON.stringify(structureId)})`);
      const comparaison: Json = {};
      let identiques = true;
      for (const cle of ["boite", "decond", "plaq", "zero"]) {
        const f = (etat.choix as Record<string, { id: string } | null>)[cle];
        if (!f) continue;
        const w = stocksWeb.find((s) => s.id === f.id);
        const p = poste.data?.find((s) => s.id === f.id);
        const wq = [w?.quantite, w?.quantiteARegulariser ?? 0];
        const pq = [p?.quantite, p?.quantiteARegulariser ?? 0];
        comparaison[cle] = { web: wq, poste: pq };
        if (wq[0] !== pq[0] || wq[1] !== pq[1]) identiques = false;
      }
      noter("7 stock web égal au stock du poste (0 et à régulariser)", identiques, comparaison);
      await aller("/dashboard/ventes");
      await attendre(() => contient("Réimprimer"), 30_000);
      const tv = await texte();
      noter("7 liste des ventes en ligne, rien « en cours d'envoi »", !tv.includes("En cours d'envoi"), {
        nombre: tv.split("\n").find((l) => /^\d+ ventes?$/.test(l.trim())) ?? null,
      });
      await defauts("ventes en ligne après retour");
      await aller("/dashboard/vente");
      await attendre(() => contient("Rechercher un médicament"), 30_000);
      await defauts("vente en ligne après retour");

      // Étape 8 : rejeu d'un événement remis à A_ENVOYER
      const baseLocale = sqlite();
      const dernier = baseLocale
        .prepare("SELECT sequence, evenementId, statut FROM evenements WHERE type = 'VENTE' ORDER BY sequence DESC LIMIT 1")
        .get() as { sequence: number; evenementId: string; statut: string } | undefined;
      const venteAvant = ((await api(`/pharmacie/${structureId}/ventes?date=${jour}`)).corps.data as Json | undefined)?.nombre;
      if (dernier) {
        baseLocale.prepare("UPDATE evenements SET statut = 'A_ENVOYER' WHERE sequence = ?").run(dernier.sequence);
        baseLocale.close();
        opts.declencher();
        const reparti = await attendre(async () => (await etatPoste()).fileEnAttente === 0, 90_000);
        const base2 = sqlite();
        const apres = base2.prepare("SELECT statut FROM evenements WHERE sequence = ?").get(dernier.sequence) as { statut: string };
        base2.close();
        const venteApres = ((await api(`/pharmacie/${structureId}/ventes?date=${jour}`)).corps.data as Json | undefined)?.nombre;
        noter("8 rejeu : renvoyé, aucun doublon de vente", reparti && apres.statut === "ENVOYE" && venteAvant === venteApres, {
          statutLocal: apres.statut,
          ventesAvant: venteAvant,
          ventesApres: venteApres,
        });
      } else {
        baseLocale.close();
        noter("8 rejeu", null, "aucun événement de vente local");
      }
    } else if (opts.phase === "4") {
      // Étape 8 ter : port 47613 occupé, stockage vide sur 47614
      const base = sqlite();
      const dernier = base.prepare("SELECT sequence FROM evenements WHERE type = 'VENTE' ORDER BY sequence DESC LIMIT 1").get() as
        | { sequence: number }
        | undefined;
      if (dernier) base.prepare("UPDATE evenements SET statut = 'A_ENVOYER' WHERE sequence = ?").run(dernier.sequence);
      base.close();
      const t0 = Date.now();
      const portUtilise = Number(new URL(opts.origine).port);
      await aller("/dashboard");
      const trace: { t: number; chemin: string }[] = [];
      let vuConnexion = false;
      let arrivee: number | null = null;
      while (Date.now() - t0 < 90_000) {
        let c = "";
        try {
          c = chemin();
        } catch {
          c = "";
        }
        if (trace.length === 0 || trace[trace.length - 1].chemin !== c) trace.push({ t: Math.round((Date.now() - t0) / 100) / 10, chemin: c });
        if (c.startsWith("/auth/login")) vuConnexion = true;
        if (c.startsWith("/dashboard") && (await js<boolean>(`!!document.querySelector("aside")`).catch(() => false))) {
          arrivee = Date.now() - t0;
          break;
        }
        await pause(150);
      }
      noter("8 ter port d'écoute", portUtilise === 47614, { port: portUtilise });
      noter("8 ter session reprise du profil (tableau de bord)", arrivee !== null, {
        secondes: arrivee === null ? null : Math.round(arrivee / 100) / 10,
        pageDeConnexionVue: vuConnexion,
        trace,
      });
      const jetonObtenu = await attendre(jetonValide, 60_000);
      noter("8 ter un jeton obtenu du cookie", jetonObtenu);
      const reparti = await attendre(async () => {
        const e = await etatPoste();
        return e.fileEnAttente === 0 && e.enLigne;
      }, 120_000);
      noter("8 ter envoi repris sans geste", reparti, { depuisDebutSecondes: Math.round((Date.now() - t0) / 1000) });
      await defauts("vente après port changé");
    } else if (opts.phase === "5") {
      // Étape 8 bis : cookie de refresh à la déconnexion
      const cookiePresent = async () => (await session.defaultSession.cookies.get({ name: "refresh_token" })).length > 0;
      await relais("on");
      const connecte = await connexionDemo();
      await attendre(async () => (await etatPoste()).enLigne, 90_000);
      noter("8 bis connexion en ligne", connecte);
      noter("8 bis cookie de refresh présent après connexion", await cookiePresent());
      const { structureId } = await identite();
      await cliquerBouton("Se déconnecter");
      const confirmation = await attendre(() => contient("ne pourrez pas vous reconnecter"), 3_000);
      if (confirmation) await cliquerBouton("Se déconnecter", `document.querySelector('[role="dialog"]')`);
      const surLogin = await attendre(() => chemin().startsWith("/auth/login"), 30_000);
      await pause(1500);
      const presentApres = await cookiePresent();
      noter("8 bis déconnexion en ligne : plus de cookie", surLogin && !presentApres, { cookiePresent: presentApres, pageConnexion: surLogin });

      // Déconnexion sans réseau
      await connexionDemo();
      await attendre(async () => (await etatPoste()).enLigne, 90_000);
      noter("8 bis cookie présent après nouvelle connexion", await cookiePresent());
      await relais("off");
      await attendre(async () => (await etatPoste()).horsLigne, 150_000);
      await cliquerBouton("Se déconnecter");
      await attendre(() => contient("ne pourrez pas vous reconnecter"), 10_000);
      await cliquerBouton("Se déconnecter", `document.querySelector('[role="dialog"]')`);
      const surLogin2 = await attendre(() => chemin().startsWith("/auth/login"), 30_000);
      await pause(1500);
      const presentApres2 = await cookiePresent();
      noter("8 bis déconnexion hors ligne : plus de cookie", surLogin2 && !presentApres2, { cookiePresent: presentApres2, pageConnexion: surLogin2 });
      await relais("on");
      await pause(30_000);
      noter("8 bis retour du serveur : aucune session rouverte, page de connexion", chemin().startsWith("/auth/login") && !(await jetonValide()), {
        chemin: chemin(),
      });
      const stock = await js<{ ok: boolean; status?: number }>(`${pont}.caisse.chargerStock(${JSON.stringify(structureId)})`);
      const vente = await js<{ ok: boolean; status?: number }>(
        `${pont}.caisse.creerVente(${JSON.stringify(structureId)}, { lignes: [{ stockId: "x", quantite: 1 }] }, "00000000-0000-4000-8000-0000000000bb")`,
      );
      noter("8 bis vente du pont refusée en 401", !stock.ok && stock.status === 401 && !vente.ok && vente.status === 401, {
        stock: stock.status,
        vente: vente.status,
      });
      noter("8 bis profil local effacé", (await js<unknown>(`${pont}.profil.lire()`)) === null);
    } else if (opts.phase === "10") {
      // PD05, preuve 1 à 4 : impression directe, PDF de 58 mm, 80 mm et A4, « Microsoft Print to PDF », hors ligne, échec sans effet.
      const imp = opts.impression;
      if (!imp) throw new Error("service d'impression absent");
      await relais("on");
      noter("10 connexion démo", await connexionDemo());
      await attendre(async () => {
        const e = await etatPoste();
        return e.enLigne && e.dernierContactLe !== null;
      }, 120_000);
      const { structureId } = await identite();
      noter("10 caisse du poste ouverte", await ouvrirCaisseUI());
      const v1 = (await vendre("SRO", { mode: "Espèces" })) as { ok: boolean; venteId?: string | null; numero?: string | null };
      noter("10 vente d'essai (SRO, espèces)", v1.ok === true, v1);
      const venteId = String(v1.venteId ?? "");
      await attendreEnvoye();

      // Sans imprimante choisie : une réponse, aucune fenêtre, aucune boîte de dialogue.
      const fenetresAvant = nbFenetres();
      const sansImp = await js<ReponsePontSonde>(`${pont}.impression.imprimerVente(${JSON.stringify(venteId)})`);
      noter("10 sans imprimante : IMPRIMANTE_NON_CHOISIE, aucune fenêtre ouverte", sansImp.ok === false && sansImp.code === "IMPRIMANTE_NON_CHOISIE" && nbFenetres() === fenetresAvant, {
        code: sansImp.code,
        message: sansImp.message,
        fenetres: nbFenetres(),
      });
      // Le reçu : sans imprimante, lien « Choisir l'imprimante » et repli sur window.print (remplacé par un compteur, pour ne pas ouvrir la boîte du système).
      await aller(`/dashboard/ventes/${encodeURIComponent(venteId)}/recu`);
      await attendre(() => contient("Total"), 30_000);
      await js(`window.__impressions = 0; window.print = () => { window.__impressions += 1; }; 0`);
      await cliquerBouton("Imprimer");
      await attendre(() => contient("Choisir l'imprimante"), 10_000);
      noter("10 reçu : lien « Choisir l'imprimante » et repli sur window.print", (await contient("Choisir l'imprimante")) && (await js<number>(`window.__impressions`)) === 1, {
        appelsWindowPrint: await js<number>(`window.__impressions`),
      });
      const texteRecu = await js<string>(`document.querySelector("article").innerText`);
      noter("10 reçu à l'écran : accents intacts", texteRecu.includes("Pharmacie de Kaloum") && texteRecu.includes("Reçu n°") && texteRecu.includes("Espèces"), { extrait: texteRecu.split("\n").slice(0, 16).join(" | ") });

      // Page « Ce poste » : liste, choix de l'imprimante, format, case d'impression automatique.
      await aller("/dashboard/poste");
      await attendre(() => contient("Réglages de ce poste"), 30_000);
      await attendre(() => js<boolean>(`document.querySelectorAll("#imprimante option").length > 1`), 20_000);
      const options = await js<string[]>(`Array.from(document.querySelectorAll("#imprimante option")).map((o) => o.value)`);
      const tPoste = await texte();
      const menu = await js<string[]>(`Array.from(document.querySelectorAll("aside nav a")).map((a) => a.textContent.trim())`);
      noter("10 page Ce poste : imprimantes listées, menu « Ce poste », version et poste", options.includes("Microsoft Print to PDF") && menu.includes("Ce poste") && tPoste.includes("Version de l'application"), {
        imprimantes: options,
        poste: tPoste.split("\n").filter((l) => /Code du poste|Nom du poste|Version|Dernier/.test(l)),
        aEssai: tPoste.includes("Imprimer un ticket d'essai"),
      });
      await defauts("page Ce poste");
      await choisirOption("#imprimante", "Microsoft Print to PDF");
      await pause(600);
      let rg = await reglagesPont();
      noter("10 impression automatique active dès qu'une imprimante est choisie", rg.imprimante === "Microsoft Print to PDF" && rg.impressionAutomatique === true, rg);
      await js(`Array.from(document.querySelectorAll("label")).find((l) => l.textContent.trim() === "Ticket 80 mm").click()`);
      await pause(500);
      await js(`Array.from(document.querySelectorAll("label")).find((l) => l.textContent.includes("Imprimer le ticket après chaque vente")).querySelector("input").click()`);
      await pause(500);
      rg = await reglagesPont();
      noter("10 format 80 mm et case décochée enregistrés", rg.formatRecu === "80" && rg.impressionAutomatique === false, rg);
      await js(`Array.from(document.querySelectorAll("label")).find((l) => l.textContent.includes("Imprimer le ticket après chaque vente")).querySelector("input").click()`);
      await pause(500);
      rg = await reglagesPont();
      noter("10 case recochée", rg.impressionAutomatique === true, rg);

      // 1. PDF du reçu : 58 mm, 80 mm et A4, en ligne.
      for (const f of ["58", "80", "A4"] as const) {
        const fichier = path.join(dossierPdf(), `recu-${f}-en-ligne.pdf`);
        const x = await imp.exporterPdf(venteId, f, fichier);
        noter(`10 PDF ${f} en ligne`, x.ok && existsSync(fichier), { ...x, mesures: x.ok ? mesuresPdf(fichier) : null });
      }

      // 2. Microsoft Print to PDF : le rappel renvoie le succès après la saisie du nom de fichier (boîte du pilote, jamais de l'application).
      const cibleEnLigne = path.join(dossierPdf(), "ticket-microsoft-print-to-pdf-en-ligne.pdf");
      if (existsSync(cibleEnLigne)) unlinkSync(cibleEnLigne);
      const surveillant = lancerSurveillant(cibleEnLigne, 75);
      if (surveillant === null) {
        noter("10 Microsoft Print to PDF", null, "MC_SURVEILLANT_PS1 absent : non joué pour ne pas laisser de boîte ouverte");
      } else {
        const t0 = Date.now();
        const rep = await Promise.race([js<ReponsePontSonde>(`${pont}.impression.imprimerVente(${JSON.stringify(venteId)})`), pause(85_000).then(() => null)]);
        noter("10 Microsoft Print to PDF : rappel de succès, fichier écrit", rep !== null && rep.ok === true && existsSync(cibleEnLigne), {
          secondes: Math.round((Date.now() - t0) / 100) / 10,
          reponse: rep,
          mesures: existsSync(cibleEnLigne) ? mesuresPdf(cibleEnLigne) : null,
          fenetresApres: nbFenetres(),
        });
      }

      // 3. Réseau coupé : ticket réimprimé depuis la base locale.
      await relais("off");
      const coupe = await attendre(async () => (await etatPoste()).horsLigne, 150_000);
      noter("10 réseau coupé constaté", coupe);
      const pdfHors = path.join(dossierPdf(), "recu-58-hors-ligne.pdf");
      const xh = await imp.exporterPdf(venteId, "58", pdfHors);
      noter("10 PDF 58 mm hors ligne, depuis la base locale", xh.ok && existsSync(pdfHors), { ...xh, mesures: xh.ok ? mesuresPdf(pdfHors) : null });
      const cibleHors = path.join(dossierPdf(), "ticket-microsoft-print-to-pdf-hors-ligne.pdf");
      if (existsSync(cibleHors)) unlinkSync(cibleHors);
      const surveillant2 = lancerSurveillant(cibleHors, 75);
      if (surveillant2 !== null) {
        const t1 = Date.now();
        const rep2 = await Promise.race([js<ReponsePontSonde>(`${pont}.impression.imprimerVente(${JSON.stringify(venteId)})`), pause(85_000).then(() => null)]);
        noter("10 hors ligne : impression directe réussie depuis la base locale", rep2 !== null && rep2.ok === true && existsSync(cibleHors), {
          secondes: Math.round((Date.now() - t1) / 100) / 10,
          reponse: rep2,
          mesures: existsSync(cibleHors) ? mesuresPdf(cibleHors) : null,
        });
      }
      await relais("on");
      await attendre(async () => (await etatPoste()).enLigne, 150_000);

      // 4. Échec d'impression : sans effet sur la vente, message et « Réimprimer ».
      await js(`${pont}.impression.enregistrerReglages({ imprimante: "Imprimante absente PD05" })`);
      const ech = await js<ReponsePontSonde>(`${pont}.impression.imprimerVente(${JSON.stringify(venteId)})`);
      noter("10 imprimante absente : IMPRESSION_ECHOUEE avec le message de la fiche", ech.ok === false && ech.code === "IMPRESSION_ECHOUEE" && (ech.message ?? "").startsWith("Le ticket n'a pas pu être imprimé."), { code: ech.code, message: ech.message, fenetres: nbFenetres() });
      const baseAvant = sqlite();
      const nAvant = (baseAvant.prepare("SELECT count(*) n FROM ventes").get() as { n: number }).n;
      baseAvant.close();
      const v2 = (await vendre("SRO", { mode: "Espèces" })) as { ok: boolean; venteId?: string | null; numero?: string | null };
      // Le message arrive quand la fenêtre cachée a échoué à imprimer, quelques secondes après la vente.
      await attendre(() => contient("n'a pas pu être imprimé"), 40_000);
      const tv2 = await texte();
      const baseApres = sqlite();
      const nApres = (baseApres.prepare("SELECT count(*) n FROM ventes").get() as { n: number }).n;
      baseApres.close();
      noter("10 impression automatique en échec : vente enregistrée, message et « Réimprimer »", v2.ok === true && nApres === nAvant + 1 && tv2.includes("Le ticket n'a pas pu être imprimé.") && (await js<boolean>(`Array.from(document.querySelectorAll("button")).some((b) => b.textContent.trim() === "Réimprimer")`)), {
        ventesLocalesAvant: nAvant,
        ventesLocalesApres: nApres,
        message: tv2.split("\n").find((l) => l.includes("n'a pas pu être imprimé")) ?? null,
      });
      await defauts("succès de vente avec échec d'impression");
      await attendreEnvoye();
      const e10 = await etatPoste();
      noter("10 la vente part quand même au serveur", e10.fileEnAttente === 0 && e10.rejetes === 0, { fileEnAttente: e10.fileEnAttente, rejetes: e10.rejetes });
      // Imprimante gardée pour la phase 10b (redémarrage) : « Microsoft Print to PDF », 80 mm.
      await js(`${pont}.impression.enregistrerReglages({ imprimante: "Microsoft Print to PDF" })`);
      writeFileSync(path.join(sortie, "etat_pd05.json"), JSON.stringify({ structureId, venteId }, null, 2) + "\n");
    } else if (opts.phase === "10m") {
      // Diagnostic court : contenu des PDF et boîte du pilote « Microsoft Print to PDF ».
      const imp = opts.impression;
      if (!imp) throw new Error("service d'impression absent");
      const { venteId } = JSON.parse(readFileSync(path.join(sortie, "etat_pd05.json"), "utf8")) as { venteId: string };
      await relais("on");
      await aller("/dashboard/poste");
      await attendre(() => contient("Réglages de ce poste"), 60_000);
      await attendre(async () => (await etatPoste()).enLigne, 120_000);
      for (const f of ["58", "80", "A4"] as const) {
        const fichier = path.join(dossierPdf(), `diag-${f}.pdf`);
        const x = await imp.exporterPdf(venteId, f, fichier);
        noter(`10m PDF ${f}`, x.ok, { ...x, mesures: x.ok ? mesuresPdf(fichier) : null });
      }
      const cible = path.join(dossierPdf(), "diag-ms.pdf");
      if (existsSync(cible)) unlinkSync(cible);
      await js(`${pont}.impression.enregistrerReglages({ imprimante: "Microsoft Print to PDF", formatRecu: "80" })`);
      lancerSurveillant(cible, 40);
      const t0 = Date.now();
      const rep = await Promise.race([js<ReponsePontSonde>(`${pont}.impression.imprimerVente(${JSON.stringify(venteId)})`), pause(60_000).then(() => null)]);
      noter("10m Microsoft Print to PDF", rep?.ok === true, { secondes: Math.round((Date.now() - t0) / 100) / 10, reponse: rep, fichier: existsSync(cible) });
      await js(`${pont}.impression.enregistrerReglages({ imprimante: null })`);
    } else if (opts.phase === "11d") {
      await relais("on");
      await aller("/dashboard/ventes");
      await attendre(() => contient("Total du jour"), 60_000);
      await attendre(async () => (await etatPoste()).enLigne, 120_000);
      await pause(3000);
      const t = await texte();
      noter("11d liste", null, {
        lignes: t.split("\n").filter((l) => /T1-000[34]|page|Page|ventes?$/.test(l)).slice(0, 30),
        boutons: await js<string[]>(`Array.from(document.querySelectorAll("button")).map((b) => b.getAttribute("aria-label") || b.textContent.trim()).filter((x) => x.startsWith("Annuler")).slice(0, 12)`),
        horsLigne: (await etatPoste()).horsLigne,
      });
    } else if (opts.phase === "10b") {
      // PD05 : les réglages survivent au redémarrage ; l'imprimante est ensuite retirée pour que les phases suivantes n'ouvrent aucune boîte.
      await aller("/dashboard/poste");
      const lu = await attendre(async () => (await js<ReponsePontSonde>(`${pont}.impression.lireReglages()`)).ok === true, 60_000);
      const rg = await reglagesPont();
      noter("10b réglages gardés au redémarrage (imprimante, format, impression automatique)", lu && rg.imprimante === "Microsoft Print to PDF" && rg.formatRecu === "80" && rg.impressionAutomatique === true, rg);
      await attendre(() => contient("Réglages de ce poste"), 30_000);
      await attendre(() => js<boolean>(`!!document.querySelector("#imprimante") && document.querySelector("#imprimante").value !== ""`), 20_000);
      noter("10b la page affiche l'imprimante gardée", (await js<string>(`document.querySelector("#imprimante").value`)) === "Microsoft Print to PDF");
      await choisirOption("#imprimante", "");
      await pause(600);
      const apres = await reglagesPont();
      noter("10b imprimante retirée : plus d'impression automatique", apres.imprimante === null && apres.impressionAutomatique === false, apres);
    } else if (opts.phase === "11") {
      // PD05 7 bis : annulation en ligne depuis le poste, sur le bon tiroir (D745, D753). Écrit dans la base de dev, Pharmacie de Kaloum.
      await relais("on");
      noter("11 connexion démo", await connexionDemo());
      await attendre(async () => {
        const e = await etatPoste();
        return e.enLigne && e.dernierContactLe !== null;
      }, 120_000);
      const { structureId, userId } = await identite();
      noter("11 caisse du poste ouverte", await ouvrirCaisseUI());
      await attendreEnvoye();
      const pc = await posteEtCaisse(structureId, userId);
      const posteId = pc.data?.poste.id ?? "";
      const S = pc.data?.session?.id ?? "";
      const e0 = await etatPoste();
      noter("11 1 en ligne, file vide, caisse S ouverte sur le poste", e0.enLigne && e0.fileEnAttente === 0 && S !== "", { poste: pc.data?.poste.code, sessionOuverte: S !== "", fileEnAttente: e0.fileEnAttente });
      const stockPoste = await js<{ data?: Fiche[] }>(`${pont}.caisse.chargerStock(${JSON.stringify(structureId)})`);
      const sro = (stockPoste.data ?? []).find((f) => f.medicament.nom === "SRO");
      const stockWeb = async () => {
        const w = await api(`/pharmacie/stock/${structureId}`);
        return (((w.corps.data as Json | undefined)?.stocks ?? []) as Json[]).find((s) => s.id === sro?.id)?.quantite as number | undefined;
      };
      const rejetsAvant = e0.rejetes;
      // 1. une vente sur le poste (P1)
      const p1 = (await vendre("SRO", { mode: "Espèces" })) as { ok: boolean; venteId?: string | null; numero?: string | null };
      await attendreEnvoye();
      const th1 = await theoriqueEspeces(structureId, S);
      noter("11 1 vente P1 du poste envoyée, théorique espèces relevé", p1.ok === true && th1 !== null, { numero: p1.numero, theoriqueEspeces: th1 });
      // 2. une vente sur une caisse web (W1), par l'API de la pharmacie
      const w1 = await apiEcrire("POST", `/pharmacie/${structureId}/ventes`, { lignes: [{ stockId: sro?.id, quantite: 1 }], clientNom: "Essai PD05" }, { "Idempotency-Key": randomUUID() });
      const w1d = w1.corps.data as { id?: string; numero?: string; jourMetier?: string; session?: { id?: string; ouverteAutomatiquement?: boolean }; poste?: { id?: string } } | undefined;
      noter("11 2 vente W1 sur une caisse web (autre que S)", w1.status === 201 && w1d?.session?.id !== S && w1d?.poste?.id !== posteId, {
        status: w1.status,
        numero: w1d?.numero,
        caisseWebDifferente: w1d?.session?.id !== S,
        posteWebDifferent: w1d?.poste?.id !== posteId,
        caisseWebOuverteParLeTest: w1d?.session?.ouverteAutomatiquement === true,
      });
      // 2 bis. annuler P1 depuis « Ventes du jour »
      const th2 = await theoriqueEspeces(structureId, S);
      const a1 = await annulerDepuisListe(String(p1.numero), "Essai PD05 : annulation d'une vente du poste");
      noter("11 2 annulation de P1 depuis Ventes du jour", a1.ok, a1);
      const sP1 = await api(`/pharmacie/${structureId}/ventes/${p1.venteId}`);
      const dP1 = sP1.corps.data as { statut?: string; annulation?: { id: string; numero: string; posteId: string; sessionCaisseId: string; jourMetier: string } } | undefined;
      noter("11 3 pièce d'annulation de P1 : posteId du poste et sessionCaisseId = S", dP1?.annulation?.posteId === posteId && dP1?.annulation?.sessionCaisseId === S, {
        statut: dP1?.statut,
        posteIdEstLePoste: dP1?.annulation?.posteId === posteId,
        sessionEstS: dP1?.annulation?.sessionCaisseId === S,
        jourMetier: dP1?.annulation?.jourMetier,
      });
      const th3 = await theoriqueEspeces(structureId, S);
      noter("11 4 théorique diminué du montant (P1)", th2 !== null && th3 !== null && th3 === th2 - 3000, { avant: th2, apres: th3 });
      // annuler W1
      const a2 = await annulerDepuisListe(String(w1d?.numero), "Essai PD05 : annulation d'une vente d'une caisse web", w1d?.jourMetier);
      noter("11 2 annulation de W1 (caisse web) depuis Ventes du jour", a2.ok, a2);
      const sW1 = await api(`/pharmacie/${structureId}/ventes/${w1d?.id}`);
      const dW1 = sW1.corps.data as { statut?: string; session?: { id?: string }; annulation?: { numero: string; posteId: string; sessionCaisseId: string; jourMetier: string } } | undefined;
      noter("11 3 pièce d'annulation de W1 : poste et S, ni la caisse web du vendeur ni celle de la vente", dW1?.annulation?.posteId === posteId && dW1?.annulation?.sessionCaisseId === S && dW1?.annulation?.sessionCaisseId !== w1d?.session?.id, {
        statut: dW1?.statut,
        posteIdEstLePoste: dW1?.annulation?.posteId === posteId,
        sessionEstS: dW1?.annulation?.sessionCaisseId === S,
        sessionDifferenteDeLaCaisseWeb: dW1?.annulation?.sessionCaisseId !== w1d?.session?.id,
      });
      const th4 = await theoriqueEspeces(structureId, S);
      noter("11 4 théorique diminué du montant (W1)", th3 !== null && th4 !== null && th4 === th3 - 3000, { avant: th3, apres: th4 });
      // stock rendu après la photographie
      const stockRendu = await attendre(async () => {
        const p = await js<{ data?: Fiche[] }>(`${pont}.caisse.chargerStock(${JSON.stringify(structureId)})`);
        const qp = (p.data ?? []).find((f) => f.id === sro?.id)?.quantite;
        return qp !== undefined && qp === (await stockWeb());
      }, 120_000);
      const pFinal = await js<{ data?: Fiche[] }>(`${pont}.caisse.chargerStock(${JSON.stringify(structureId)})`);
      noter("11 4 stock du poste égal au stock du serveur après la photographie", stockRendu, { poste: (pFinal.data ?? []).find((f) => f.id === sro?.id)?.quantite, serveur: await stockWeb() });
      // liste : vente marquée annulée, pièce listée à son jour
      await aller("/dashboard/ventes");
      await attendre(() => contient(String(p1.numero)), 30_000);
      const lignesListe = await js<string[]>(`Array.from(document.querySelectorAll("li")).map((l) => l.innerText.replace(/\\n+/g, " | ")).filter((t) => t.includes(${JSON.stringify(String(p1.numero))}) || t.includes(${JSON.stringify(String(dP1?.annulation?.numero))}))`);
      noter("11 4 vente marquée annulée et pièce d'annulation listée", lignesListe.some((l) => l.includes("Annulée")) && lignesListe.some((l) => l.includes("Annulation")), { lignes: lignesListe, jourPiece: dP1?.annulation?.jourMetier });
      await defauts("ventes du jour après annulations");
      // une vente suivante reste sur S, sans SESSION_INCONNUE
      const p2 = (await vendre("SRO", { mode: "Espèces" })) as { ok: boolean; venteId?: string | null; numero?: string | null };
      const fini2 = await attendreEnvoye();
      const e2 = await etatPoste();
      const sP2 = await api(`/pharmacie/${structureId}/ventes/${p2.venteId}`);
      const sessionP2 = (sP2.corps.data as { session?: { id?: string } } | undefined)?.session?.id;
      noter("11 4 vente suivante P2 reste sur S, envoyée sans rejet", fini2 && sessionP2 === S && e2.rejetes === rejetsAvant, { surS: sessionP2 === S, rejetes: e2.rejetes, rejetsAvant });

      // 5. caisse locale fermée, nouvelle annulation : caisse ouverte par le serveur adoptée à son jourMetier
      const fermee = await fermerCaisseUI("Essai PD05 : fermeture avant l'annulation 5");
      const envoyeApresFermeture = await attendreEnvoye();
      const eF = await etatPoste();
      noter("11 5 caisse S fermée sur le poste et envoyée", fermee && envoyeApresFermeture, { fileEnAttente: eF.fileEnAttente, rejetes: eF.rejetes, messageEnvoi: eF.messageEnvoi, enLigne: eF.enLigne });
      const w2 = await apiEcrire("POST", `/pharmacie/${structureId}/ventes`, { lignes: [{ stockId: sro?.id, quantite: 1 }], clientNom: "Essai PD05" }, { "Idempotency-Key": randomUUID() });
      const w2d = w2.corps.data as { id?: string; numero?: string } | undefined;
      const a3 = await annulerDepuisListe(String(w2d?.numero), "Essai PD05 : annulation avec caisse locale fermée", (w2d as { jourMetier?: string } | undefined)?.jourMetier);
      const sW2 = await api(`/pharmacie/${structureId}/ventes/${w2d?.id}`);
      const dW2 = sW2.corps.data as { annulation?: { sessionCaisseId: string; posteId: string; jourMetier: string } } | undefined;
      const S2 = dW2?.annulation?.sessionCaisseId ?? "";
      const pc2 = await posteEtCaisse(structureId, userId);
      noter("11 5 caisse ouverte par le serveur adoptée à son jourMetier", a3.ok && S2 !== "" && S2 !== S && pc2.data?.session?.id === S2 && pc2.data?.session?.jourMetier === dW2?.annulation?.jourMetier, {
        annulationOk: a3.ok,
        messageAnnulation: a3.message,
        dialogue: a3.dialogue?.split("\n").filter((l) => l.trim() !== "").slice(-3),
        nouvelleCaisse: S2 !== S,
        adopteeSurLePoste: pc2.data?.session?.id === S2,
        jourMetierServeur: dW2?.annulation?.jourMetier,
        jourMetierPoste: pc2.data?.session?.jourMetier,
      });
      const rejetsAvant3 = (await etatPoste()).rejetes;
      const p3 = (await vendre("SRO", { mode: "Espèces" })) as { ok: boolean; venteId?: string | null; numero?: string | null };
      const fini3 = await attendreEnvoye();
      const sP3 = await api(`/pharmacie/${structureId}/ventes/${p3.venteId}`);
      const sessionP3 = (sP3.corps.data as { session?: { id?: string } } | undefined)?.session?.id;
      noter("11 5 vente suivante P3 sur la caisse adoptée, envoyée sans rejet", fini3 && sessionP3 === S2 && (await etatPoste()).rejetes === rejetsAvant3, { surS2: sessionP3 === S2, rejetes: (await etatPoste()).rejetes });

      // 6. file non vide : message d'attente, aucun appel d'annulation (l'envoi des événements est retenu, la connexion reste)
      const avantRetenue = (await commandeRelais("retenir")).compteurs.annulations;
      const p4 = (await vendre("SRO", { mode: "Espèces" })) as { ok: boolean; venteId?: string | null; numero?: string | null };
      await pause(1500);
      const eRetenu = await etatPoste();
      const a4 = await annulerDepuisListe(String(p3.numero), "Essai PD05 : file non vide");
      const apresRetenue = (await commandeRelais("etat")).compteurs.annulations;
      const sP3b = await api(`/pharmacie/${structureId}/ventes/${p3.venteId}`);
      noter("11 6 file non vide : message d'attente, aucun appel d'annulation", eRetenu.enLigne && eRetenu.fileEnAttente >= 1 && !a4.ok && (a4.dialogue ?? "").includes("Envoi des ventes en cours") && apresRetenue === avantRetenue && (sP3b.corps.data as { statut?: string } | undefined)?.statut === "VALIDEE", {
        enLigne: eRetenu.enLigne,
        fileEnAttente: eRetenu.fileEnAttente,
        message: (a4.dialogue ?? "").split("\n").find((l) => l.includes("Envoi des ventes")) ?? null,
        appelsAnnulationAvant: avantRetenue,
        appelsAnnulationApres: apresRetenue,
        venteToujoursValidee: (sP3b.corps.data as { statut?: string } | undefined)?.statut,
      });
      await cliquerBouton("Fermer", `document.querySelector('[role="dialog"]')`);
      await commandeRelais("liberer");
      const fini4 = await attendreEnvoye();
      noter("11 6 envoi libéré, file vidée sans rejet", fini4 && (await etatPoste()).rejetes === rejetsAvant3, { p4: p4.numero });

      // Fermeture de la caisse adoptée, puis de la caisse web ouverte par le test.
      noter("11 caisse S2 fermée", await fermerCaisseUI("Essai PD05 : fermeture de la caisse adoptée"));
      await attendreEnvoye();
      if (w1d?.session?.ouverteAutomatiquement === true && w1d.session.id) {
        const f = await apiEcrire("POST", `/pharmacie/${structureId}/caisse/sessions/${w1d.session.id}/fermer`, { commentaire: "Essai PD05 : caisse web ouverte par le test" });
        noter("11 caisse web ouverte par le test : fermée", f.status === 200, { status: f.status });
      } else {
        noter("11 caisse web du vendeur", null, "ouverte avant le test : laissée telle quelle");
      }
      writeFileSync(path.join(sortie, "etat_pd05_annulation.json"), JSON.stringify({ structureId, S, S2, posteId }, null, 2) + "\n");
    } else if (opts.phase === "12a") {
      // PD05 7 bis, plaquette : fiche de test créée par l'API de la pharmacie (les mêmes routes que les écrans), réception de 2 boîtes.
      await relais("on");
      // Le pharmacien détient catalogue:write et reception:write (l'administrateur de structure n'a pas le premier).
      noter("12a connexion démo (pharmacien de Kaloum)", await connexionDemo("Keita"));
      await attendre(async () => (await etatPoste()).enLigne, 120_000);
      const { structureId } = await identite();
      const nom = "TEST PD05 Plaquette (à ignorer)";
      let medicamentId = "";
      const cree = await apiEcrire("POST", `/pharmacie/catalogue`, { nom, categorie: "Test PD05", ordonnanceRequise: false, formes: ["plaquette"] });
      if (cree.status === 201) medicamentId = String((cree.corps.data as { id?: string } | undefined)?.id ?? "");
      else {
        // Entrée déjà créée par un compte qui détient catalogue:write (le compte de la session n'en a pas forcément).
        medicamentId = process.env.MC_MEDICAMENT_TEST_ID ?? "";
      }
      noter("12a médicament de test au catalogue", medicamentId !== "", { status: cree.status, reutilise: cree.status !== 201 });
      const fiche = await apiEcrire("POST", `/pharmacie/stock/${structureId}`, { medicamentId, prixUnitaire: 25000 });
      const stockId = String((fiche.corps.data as { id?: string } | undefined)?.id ?? "");
      noter("12a fiche de stock de test créée", fiche.status === 200 && stockId !== "", { status: fiche.status });
      const maj = await apiEcrire("PATCH", `/pharmacie/${structureId}/stock/${stockId}/fiche`, {
        uniteMinimale: "PLAQUETTE",
        coefficientBoite: 10,
        deconditionnable: true,
        prixUnite: 3000,
        prixUnitaire: 25000,
        qualifie: true,
      });
      noter("12a fiche PLAQUETTE, 10 par boîte, 3 000 GNF la plaquette", maj.status === 200, { status: maj.status, message: (maj.corps as { message?: string }).message });
      const rec = await apiEcrire("POST", `/pharmacie/${structureId}/receptions`, {
        reference: "PD05-ESSAI",
        lignes: [{ stockId, nombreBoites: 2, numeroLot: "PD05-TEST", dateExpiration: "2027-12-31" }],
      });
      noter("12a réception de 2 boîtes (20 plaquettes)", rec.status === 201 || rec.status === 200, { status: rec.status });
      const lu = await api(`/pharmacie/stock/${structureId}`);
      const f = (((lu.corps.data as Json | undefined)?.stocks ?? []) as Json[]).find((s) => s.id === stockId);
      noter("12a fiche lue au serveur", f?.quantite === 20, { quantite: f?.quantite, unite: f?.uniteMinimale, coef: f?.coefficientBoite, prixUnite: f?.prixUnite });
      writeFileSync(path.join(sortie, "etat_pd05_plaquette.json"), JSON.stringify({ structureId, stockId, medicamentId, nom }, null, 2) + "\n");
    } else if (opts.phase === "12b") {
      // PD05 7 bis, plaquette, réseau coupé (le relais est coupé avant le lancement).
      const pl = JSON.parse(readFileSync(path.join(sortie, "etat_pd05_plaquette.json"), "utf8")) as { structureId: string; stockId: string; nom: string };
      await relais("on");
      await aller("/dashboard/vente");
      await attendre(() => contient("Rechercher un médicament"), 60_000);
      // Le catalogue du poste reçoit la fiche de test à la photographie du démarrage ; la coupure vient ensuite.
      const recue = await attendre(async () => {
        const p = await js<{ data?: Fiche[] }>(`${pont}.caisse.chargerStock(${JSON.stringify(pl.structureId)})`);
        return (p.data ?? []).some((f) => f.id === pl.stockId);
      }, 180_000);
      noter("12b fiche de test reçue par la photographie du démarrage", recue);
      await relais("off");
      const horsLigne = await attendre(async () => (await etatPoste()).horsLigne, 150_000);
      noter("12b réseau coupé constaté", horsLigne);
      const poste0 = await js<{ data?: Fiche[] }>(`${pont}.caisse.chargerStock(${JSON.stringify(pl.structureId)})`);
      const fiche0 = (poste0.data ?? []).find((f) => f.id === pl.stockId);
      noter("12b la fiche de test est dans le catalogue du poste (20 plaquettes)", fiche0?.quantite === 20, resume(fiche0));
      noter("12b caisse du poste ouverte sans compter", await ouvrirCaisseUI());
      const ligneListe = async () => {
        await aller("/dashboard/vente");
        await attendre(() => js<boolean>(`!!document.querySelector("#recherche-vente")`), 30_000);
        await remplir("#recherche-vente", pl.nom);
        await pause(600);
        return js<string | null>(`(() => { const li = Array.from(document.querySelectorAll("li")).find((x) => (x.textContent || "").includes(${JSON.stringify(pl.nom)})); return li ? li.innerText.replace(/\\n+/g, " | ") : null; })()`);
      };
      const avant = await ligneListe();
      noter("12b liste avant la vente : prix de la plaquette", (avant ?? "").includes("la plaquette"), { ligne: avant });
      // 1 plaquette
      const vA = (await vendre(pl.nom, { enUnites: true, mode: "Espèces" })) as { ok: boolean; numero?: string | null; venteId?: string | null; messageARegulariser?: boolean };
      noter("12b vente d'1 plaquette (3 000 GNF)", vA.ok === true && vA.messageARegulariser === false, vA);
      const apresA = await ligneListe();
      noter("12b « 1 boîte et 9 plaquettes » et « 3 000 GNF la plaquette »", (apresA ?? "").includes("1 boîte et 9 plaquettes") && /3\s000\sGNF la plaquette/.test((apresA ?? "").replace(/[   ]/g, " ")), { ligne: apresA });
      await defauts("liste après 1 plaquette");
      // Boîte entamée : visible quand la plaquette est remise au panier
      await remplir("#recherche-vente", pl.nom);
      await attendre(() => cliquerBouton(`Ajouter ${pl.nom} au panier`), 15_000);
      await pause(500);
      await js(`(() => { const g = Array.from(document.querySelectorAll('[role="group"]')).find((x) => x.getAttribute("aria-label") === ${JSON.stringify(`Unité de vente de ${pl.nom}`)}); const b = g && Array.from(g.querySelectorAll("button")).find((x) => !/oîte/.test(x.textContent || "")); if (b && b.getAttribute("aria-pressed") !== "true") b.click(); })()`);
      await pause(500);
      const tPanier = await texte();
      noter("12b « Boîte entamée : il reste 9 plaquettes »", tPanier.split("\n").some((l) => l.trim() === "Boîte entamée : il reste 9 plaquettes"), {
        ligne: tPanier.split("\n").find((l) => l.startsWith("Boîte entamée")) ?? null,
      });
      // Retirer la ligne du panier, puis vendre 25 plaquettes (il en reste 19)
      await cliquerBouton(`Retirer ${pl.nom} du panier`);
      const vB = (await vendre(pl.nom, { enUnites: true, plus: 24, mode: "Espèces" })) as { ok: boolean; numero?: string | null; venteId?: string | null; messageARegulariser?: boolean; avertissement?: string | null };
      noter("12b vente de 25 plaquettes pour 19 en stock : acceptée, à régulariser", vB.ok === true && vB.messageARegulariser === true, vB);
      const apresB = await ligneListe();
      noter("12b stock affiché 0 et « 6 plaquettes à régulariser », aucun négatif", (apresB ?? "").includes("6 plaquettes à régulariser") && !/(^|[\s(:,])-\s?\d/.test(apresB ?? ""), { ligne: apresB });
      const defB = await defauts("liste après vente au-delà du stock");
      const posteApres = await js<{ data?: Fiche[] }>(`${pont}.caisse.chargerStock(${JSON.stringify(pl.structureId)})`);
      noter("12b stock du poste : 0 et 6 à régulariser", (posteApres.data ?? []).find((f) => f.id === pl.stockId)?.quantite === 0 && (posteApres.data ?? []).find((f) => f.id === pl.stockId)?.quantiteARegulariser === 6 && defB.moinsStock === 0, resume((posteApres.data ?? []).find((f) => f.id === pl.stockId)));
      const eFile = await etatPoste();
      noter("12b 2 ventes en attente d'envoi", eFile.fileEnAttente >= 2, { fileEnAttente: eFile.fileEnAttente });
      writeFileSync(path.join(sortie, "etat_pd05_plaquette.json"), JSON.stringify({ ...pl, ventes: [{ cle: "1 plaquette", ...vA }, { cle: "25 plaquettes", ...vB }] }, null, 2) + "\n");
    } else if (opts.phase === "13") {
      // PD05 7 bis, plaquette, réseau revenu : mêmes quantités au serveur, reçu d'une plaquette en 58 mm.
      const imp = opts.impression;
      if (!imp) throw new Error("service d'impression absent");
      const pl = JSON.parse(readFileSync(path.join(sortie, "etat_pd05_plaquette.json"), "utf8")) as {
        structureId: string;
        stockId: string;
        nom: string;
        ventes: { cle: string; numero: string; venteId: string }[];
      };
      await aller("/dashboard/ventes");
      await attendre(() => contient("Réimprimer"), 40_000);
      await relais("on");
      const vide = await attendre(async () => {
        const e = await etatPoste();
        return e.fileEnAttente === 0 && e.enLigne;
      }, 240_000);
      const e13 = await etatPoste();
      noter("13 réseau revenu : file vidée sans rejet", vide && e13.rejetes === 0, { fileEnAttente: e13.fileEnAttente, rejetes: e13.rejetes });
      const web = await api(`/pharmacie/stock/${pl.structureId}`);
      const fw = (((web.corps.data as Json | undefined)?.stocks ?? []) as Json[]).find((s) => s.id === pl.stockId);
      // La photographie suivante rapporte le stock du serveur au poste ; l'annulation en force une, sinon on lit la vue du poste telle quelle.
      const poste = await js<{ data?: Fiche[] }>(`${pont}.caisse.chargerStock(${JSON.stringify(pl.structureId)})`);
      const fp = (poste.data ?? []).find((f) => f.id === pl.stockId);
      noter("13 au serveur : 0 et 6 plaquettes à régulariser, comme sur le poste", fw?.quantite === 0 && fw?.quantiteARegulariser === 6 && fp?.quantite === 0 && fp?.quantiteARegulariser === 6, {
        serveur: { quantite: fw?.quantite, aRegulariser: fw?.quantiteARegulariser },
        poste: { quantite: fp?.quantite, aRegulariser: fp?.quantiteARegulariser },
      });
      const jour = new Date().toLocaleDateString("sv-SE", { timeZone: "Africa/Conakry" });
      const liste = await api(`/pharmacie/${pl.structureId}/ventes?date=${jour}`);
      const numerosServeur = (((liste.corps.data as Json | undefined)?.ventes as { numero: string }[] | undefined) ?? []).map((v) => v.numero);
      noter("13 les 2 ventes sont au serveur avec le même numéro", pl.ventes.every((v) => numerosServeur.includes(v.numero)), { ventes: pl.ventes.map((v) => v.numero) });
      const ano = await api(`/pharmacie/${pl.structureId}/anomalies?statut=OUVERTE&limite=100`);
      const brut = JSON.stringify(ano.corps);
      noter("13 anomalie STOCK_NEGATIF de la vente au-delà du stock", brut.includes(pl.ventes[1].venteId) && brut.includes("STOCK_NEGATIF"), { status: ano.status });
      for (const v of pl.ventes) {
        const det = await api(`/pharmacie/${pl.structureId}/ventes/${v.venteId}`);
        const d = det.corps.data as { total?: number; provisoire?: boolean; lignes?: { quantite: number; nombreAffiche: number; uniteAffichee: string }[] } | undefined;
        noter(`13 vente « ${v.cle} » au serveur`, true, { total: d?.total, provisoire: d?.provisoire, lignes: d?.lignes?.map((l) => `${l.nombreAffiche} ${l.uniteAffichee} = ${l.quantite} u`) });
      }
      // Reçu d'une plaquette en 58 mm, plus le ticket provisoire
      const pdf1 = path.join(dossierPdf(), "recu-plaquette-58.pdf");
      const x1 = await imp.exporterPdf(pl.ventes[0].venteId, "58", pdf1);
      noter("13 PDF 58 mm du reçu d'une plaquette", x1.ok && existsSync(pdf1), { ...x1, mesures: x1.ok ? mesuresPdf(pdf1) : null });
      const pdf2 = path.join(dossierPdf(), "recu-plaquette-provisoire-58.pdf");
      const x2 = await imp.exporterPdf(pl.ventes[1].venteId, "58", pdf2);
      noter("13 PDF 58 mm du ticket provisoire (25 plaquettes)", x2.ok && existsSync(pdf2), { ...x2, mesures: x2.ok ? mesuresPdf(pdf2) : null });
      await aller(`/dashboard/ventes/${encodeURIComponent(pl.ventes[1].venteId)}/recu`);
      await attendre(() => contient("Total"), 30_000);
      noter("13 texte du ticket provisoire à l'écran", true, { article: (await js<string>(`document.querySelector("article").innerText`)).split("\n").join(" | ") });
      noter("13 caisse du poste fermée", await fermerCaisseUI("Essai PD05 : fermeture après la plaquette"));
      await attendreEnvoye();
    }
  } catch (e) {
    r.erreurScenario = e instanceof Error ? e.message.split("\n")[0] : "erreur";
  }

  r.etapes = etapes;
  r.fin = new Date().toISOString();
  writeFileSync(path.join(sortie, `scenario-${opts.phase}.json`), JSON.stringify(r, null, 2) + "\n");
  app.quit();
}
