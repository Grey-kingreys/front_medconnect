// Scénario de preuve de la fiche PD04c, joué dans l'application réelle (DOM réel), actif seulement avec
// MC_SONDE=1 et MC_SCENARIO=<phase> hors application empaquetée. Le relais local (127.0.0.1:3299) coupe l'API :
// ni Docker ni le réseau de la machine ne sont touchés. Écrit un JSON de booléens, de comptes et de textes d'écran
// (jamais de jeton, de cookie ni de mot de passe) dans MC_SONDE_SORTIE, puis quitte.
import { app, session, type BrowserWindow } from "electron";
import { createRequire } from "node:module";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { CoeurCaisse } from "../coeur/coeur";

type Json = Record<string, unknown>;

export interface OptionsScenario {
  fenetre: BrowserWindow;
  origine: string;
  coeur: CoeurCaisse;
  dossier: string;
  urlApi: string;
  declencher: () => void;
  phase: string;
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

  const connexionDemo = async () => {
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
  const vendre = async (nom: string, options: { plus?: number; mode?: string }) => {
    await aller("/dashboard/vente");
    if (!(await attendre(() => js<boolean>(`!!document.querySelector("#recherche-vente")`), 30_000))) {
      return { ok: false, raison: "écran de vente absent" };
    }
    await remplir("#recherche-vente", nom);
    const ajoute = await attendre(() => cliquerBouton(`Ajouter ${nom} au panier`), 15_000);
    if (!ajoute) return { ok: false, raison: "bouton Ajouter absent ou désactivé" };
    await pause(300);
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
    }
  } catch (e) {
    r.erreurScenario = e instanceof Error ? e.message.split("\n")[0] : "erreur";
  }

  r.etapes = etapes;
  r.fin = new Date().toISOString();
  writeFileSync(path.join(sortie, `scenario-${opts.phase}.json`), JSON.stringify(r, null, 2) + "\n");
  app.quit();
}
