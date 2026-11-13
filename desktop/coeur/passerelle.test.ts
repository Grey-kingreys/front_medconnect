import { afterEach, describe, expect, it, vi } from "vitest";
import type { UtilisateurPoste } from "@/lib/caisse/contrat_desktop";
import { VENDEUR, base, coeurPret, fermerTout, outils, uuid } from "./aide_tests";
import { CoeurCaisse } from "./coeur";
import {
  MESSAGE_AUTRE_PHARMACIE,
  MESSAGE_CATALOGUE_A_CHARGER,
  MESSAGE_ECHEC_ENREGISTREMENT,
  MESSAGE_VALIDATION,
  Passerelle,
  construireEtat,
  origineAutorisee,
} from "./passerelle";

afterEach(fermerTout);

const UTILISATEUR: UtilisateurPoste = {
  id: VENDEUR.id,
  nom: VENDEUR.nom,
  structureId: "ph1",
  permissions: ["caisse:utiliser", "vente:write"],
};

function monter(coeur: CoeurCaisse = coeurPret().c) {
  const deps = { coeur, apresVente: vi.fn(), apresRattachement: vi.fn(), etatChange: vi.fn(), journal: vi.fn() };
  return { p: new Passerelle(deps), deps, coeur };
}

const corpsVente = (stockId = "s1") => ({ lignes: [{ stockId, quantite: 1 }] });

describe("origine de l'expéditeur", () => {
  it("accepte seulement l'origine exacte du serveur lancé", () => {
    const origine = "http://127.0.0.1:47613";
    expect(origineAutorisee("http://127.0.0.1:47613/dashboard/vente", origine)).toBe(true);
    expect(origineAutorisee("http://127.0.0.1:47614/dashboard", origine)).toBe(false);
    expect(origineAutorisee("http://localhost:47613/dashboard", origine)).toBe(false);
    expect(origineAutorisee("https://127.0.0.1:47613/", origine)).toBe(false);
    expect(origineAutorisee("http://127.0.0.1:47613.evil.test/", origine)).toBe(false);
    expect(origineAutorisee("file:///attente.html", origine)).toBe(false);
    expect(origineAutorisee("pas une adresse", origine)).toBe(false);
    expect(origineAutorisee(undefined, origine)).toBe(false);
    expect(origineAutorisee("http://127.0.0.1:47613/", "")).toBe(false);
  });
});

describe("validation des messages", () => {
  it("refuse une méthode inconnue, y compris un nom hérité de Object", async () => {
    const { p } = monter();
    for (const nom of ["supprimerTout", "constructor", "__proto__", "toString"]) {
      expect(await p.appeler(nom, [])).toMatchObject({ ok: false, status: 400, code: "VALIDATION", message: MESSAGE_VALIDATION });
    }
  });

  it("refuse des arguments invalides sans rien appeler dans le cœur", async () => {
    const { p, coeur } = monter();
    p.confirmerIdentite(UTILISATEUR);
    const espion = vi.spyOn(coeur, "enregistrerVente");
    const invalides: unknown[][] = [
      [],
      ["ph1", { lignes: "x" }, uuid(1)],
      ["ph1", { lignes: [{ stockId: "s1", quantite: -1 }] }, uuid(1)],
      ["ph1", { lignes: [{ stockId: "s1", quantite: 1, prixUnitaire: 1 }] }, uuid(1)],
      ["ph1", corpsVente(), 12],
      ["ph1", corpsVente(), uuid(1), "en trop"],
    ];
    for (const args of invalides) {
      expect(await p.appeler("creerVente", args)).toMatchObject({ ok: false, status: 400, code: "VALIDATION" });
    }
    expect(espion).not.toHaveBeenCalled();
  });

  it("refuse une identité mal formée sans l'installer", () => {
    const { p } = monter();
    expect(p.confirmerIdentite({ id: "u", nom: "x", structureId: "ph1", permissions: "caisse:utiliser" })).toBe(false);
    expect(p.confirmerIdentite(null)).toBe(false);
    expect(p.confirmerIdentite({ id: "u", nom: "x", permissions: [] })).toBe(false);
    expect(p.utilisateurCourant()).toBeNull();
  });

  it("l'identité se lit comme /auth/me : prénom et nom, structure résolue", () => {
    const { p } = monter();
    expect(
      p.confirmerIdentite({ id: "u1", prenom: "Mariama", nom: "Diallo", structure: { id: "ph1" }, permissions: ["caisse:utiliser"] }),
    ).toBe(true);
    expect(p.utilisateurCourant()).toEqual({ id: "u1", nom: "Mariama Diallo", structureId: "ph1", permissions: ["caisse:utiliser"] });
  });

  it("l'identité confirmée est gardée en base locale, sans jeton, et relue au redémarrage", () => {
    const { p, coeur } = monter();
    p.confirmerIdentite(UTILISATEUR);
    const suite = monter(coeur);
    expect(suite.p.utilisateurCourant()).toEqual(UTILISATEUR);
    expect(JSON.stringify(coeur.lireProfil())).not.toMatch(/jeton|token/i);
  });

  it("garde le profil complet de /auth/me sans aucune clé de jeton, et le rend en lecture seule", () => {
    const { p, coeur } = monter();
    p.confirmerIdentite({
      ...UTILISATEUR,
      structureType: "PHARMACIE",
      role: "ADMIN",
      access_token: "A",
      refresh_token: "B",
      refreshToken: "C",
      imbrique: { refreshToken: "D", garde: 1 },
    });
    const document = JSON.stringify(coeur.lireProfil());
    expect(document).not.toMatch(/access_token|refresh_token|refreshToken/);
    const lu = p.profilLocal();
    expect(lu).toMatchObject({ id: UTILISATEUR.id, structureType: "PHARMACIE", role: "ADMIN", imbrique: { garde: 1 } });
    expect(lu).not.toHaveProperty("utilisateurId");
    p.effacerIdentite();
    expect(p.profilLocal()).toBeNull();
  });

  it("identité effacée : plus d'écriture ni de lecture, même après un redémarrage, la file reste (D756)", async () => {
    const { p, coeur } = monter();
    p.confirmerIdentite(UTILISATEUR);
    await p.appeler("creerVente", ["ph1", corpsVente(), uuid(9, "cccccccc")]);
    const file = coeur.etatLocal().fileEnAttente;
    p.effacerIdentite();
    expect(await p.appeler("creerVente", ["ph1", corpsVente(), uuid(10, "cccccccc")])).toMatchObject({ ok: false, status: 401 });
    expect(coeur.etatLocal().fileEnAttente).toBe(file);
    expect(coeur.lireProfil()).toBeNull();
    const apresRedemarrage = monter(coeur);
    expect(apresRedemarrage.p.utilisateurCourant()).toBeNull();
    expect(await apresRedemarrage.p.appeler("chargerStock", ["ph1"])).toMatchObject({ ok: false, status: 401 });
    expect(await apresRedemarrage.p.appeler("creerVente", ["ph1", corpsVente(), uuid(11, "cccccccc")])).toMatchObject({ ok: false, status: 401 });
    expect(coeur.etatLocal().fileEnAttente).toBe(file);
  });
});

describe("accès", () => {
  it("exige un utilisateur connecté", async () => {
    const { p } = monter();
    expect(await p.appeler("chargerStock", ["ph1"])).toMatchObject({ ok: false, status: 401 });
  });

  it("refuse une autre pharmacie que celle du poste (D741)", async () => {
    const { p } = monter();
    p.confirmerIdentite(UTILISATEUR);
    expect(await p.appeler("chargerStock", ["autre"])).toMatchObject({
      ok: false,
      status: 403,
      message: MESSAGE_AUTRE_PHARMACIE,
    });
    expect(await p.appeler("creerVente", ["autre", corpsVente(), uuid(1)])).toMatchObject({ ok: false, status: 403 });
  });

  it("refuse un compte d'une autre pharmacie même avec la bonne structure en argument", async () => {
    const { p } = monter();
    p.confirmerIdentite({ ...UTILISATEUR, structureId: "autre" });
    expect(await p.appeler("chargerStock", ["ph1"])).toMatchObject({ ok: false, status: 403, message: MESSAGE_AUTRE_PHARMACIE });
  });

  it("refuse en 403 un compte sans caisse:utiliser, avec le message du back", async () => {
    const { p } = monter();
    p.confirmerIdentite({ ...UTILISATEUR, permissions: ["vente:write"] });
    expect(await p.appeler("creerVente", ["ph1", corpsVente(), uuid(1)])).toEqual({
      ok: false,
      status: 403,
      code: "PERMISSION_REFUSEE",
      message: "Vous n'avez pas la permission d'effectuer cette action.",
    });
  });

  it("sans catalogue : 503 avec le message du poste", async () => {
    const coeur = new CoeurCaisse(base(), outils());
    const { p } = monter(coeur);
    p.confirmerIdentite(UTILISATEUR); // rattache le poste à ph1
    expect(coeur.structureRattachee()).toBe("ph1");
    for (const [nom, args] of [
      ["chargerStock", ["ph1"]],
      ["chargerReferentiels", ["ph1"]],
      ["etatCaisse", ["ph1", UTILISATEUR.id]],
    ] as const) {
      expect(await p.appeler(nom, [...args])).toMatchObject({ ok: false, status: 503, message: MESSAGE_CATALOGUE_A_CHARGER });
    }
  });
});

describe("rattachement (D741)", () => {
  it("le premier utilisateur avec caisse:utiliser rattache le poste et lance l'enregistrement", () => {
    const coeur = new CoeurCaisse(base(), outils());
    const { p, deps } = monter(coeur);
    p.confirmerIdentite({ ...UTILISATEUR, permissions: ["vente:read"] });
    expect(coeur.structureRattachee()).toBeNull();
    p.confirmerIdentite(UTILISATEUR);
    expect(coeur.structureRattachee()).toBe("ph1");
    expect(deps.apresRattachement).toHaveBeenCalledTimes(1);
  });

  it("un second compte d'une autre pharmacie ne change pas le rattachement", () => {
    const { p, coeur, deps } = monter();
    p.confirmerIdentite({ ...UTILISATEUR, structureId: "autre" });
    expect(coeur.structureRattachee()).toBe("ph1");
    expect(deps.apresRattachement).not.toHaveBeenCalled();
  });
});

describe("envoi des événements de caisse", () => {
  it("ouvrir puis fermer la caisse lance un cycle d'envoi, comme une vente (sinon la fermeture attendait le battement de 5 min)", async () => {
    const { p, deps } = monter();
    p.confirmerIdentite(UTILISATEUR);
    const ouverture = await p.appeler("ouvrirSession", ["ph1", { id: uuid(7, "dddddddd") }]);
    expect(ouverture).toMatchObject({ ok: true });
    expect(deps.apresVente).toHaveBeenCalledTimes(1);
    const sessionId = (ouverture as { data: { id: string } }).data.id;
    const fermeture = await p.appeler("fermerSession", [
      "ph1",
      sessionId,
      { comptageFermeture: { id: uuid(8, "dddddddd"), coupures: [{ valeurFaciale: 1000, nombre: 0 }] } },
    ]);
    expect(fermeture).toMatchObject({ ok: true });
    expect(deps.apresVente).toHaveBeenCalledTimes(2);
  });

  it("une simple lecture de caisse ne lance aucun cycle", async () => {
    const { p, deps } = monter();
    p.confirmerIdentite(UTILISATEUR);
    await p.appeler("getVente", ["ph1", uuid(9)]);
    expect(deps.apresVente).not.toHaveBeenCalled();
  });
});

describe("appels du cœur", () => {
  it("enregistre une vente, lance un cycle sans l'attendre et prévient le rendu", async () => {
    const { p, deps, coeur } = monter();
    p.confirmerIdentite(UTILISATEUR);
    const reponse = await p.appeler("creerVente", ["ph1", corpsVente(), uuid(1, "cccccccc")]);
    expect(reponse).toMatchObject({ ok: true });
    expect(deps.apresVente).toHaveBeenCalledTimes(1);
    expect(deps.etatChange).toHaveBeenCalled();
    expect(coeur.lireVente(uuid(1, "cccccccc"))).not.toBeNull();
    expect(coeur.etatLocal().fileEnAttente).toBeGreaterThan(0);
  });

  it("une annulation du serveur enregistrée lance un cycle avec photographie (apresAnnulation)", async () => {
    const apresAnnulation = vi.fn();
    const { coeur, deps } = monter();
    const p = new Passerelle({ ...deps, apresAnnulation });
    p.confirmerIdentite(UTILISATEUR);
    await p.appeler("creerVente", ["ph1", corpsVente(), uuid(1, "cccccccc")]);
    const vente = coeur.lireVente(uuid(1, "cccccccc"))!;
    const annulation = {
      id: uuid(9, "cccccccc"),
      numero: `A-${vente.numero}`,
      motif: "Erreur de saisie",
      le: vente.createdAt,
      par: vente.vendeur,
      posteId: vente.poste.id,
      sessionCaisseId: vente.session.id,
      jourMetier: vente.jourMetier,
    };
    const reponse = await p.appeler("enregistrerAnnulationServeur", [{ ...vente, statut: "ANNULEE", annulation }]);
    expect(reponse).toMatchObject({ ok: true });
    expect(apresAnnulation).toHaveBeenCalledTimes(1);
  });

  it("une annulation refusée par le cœur (autre poste) ne lance aucun cycle", async () => {
    const apresAnnulation = vi.fn();
    const { coeur, deps } = monter();
    const p = new Passerelle({ ...deps, apresAnnulation });
    p.confirmerIdentite(UTILISATEUR);
    await p.appeler("creerVente", ["ph1", corpsVente(), uuid(1, "cccccccc")]);
    const vente = coeur.lireVente(uuid(1, "cccccccc"))!;
    const annulation = {
      id: uuid(9, "cccccccc"),
      numero: `A-${vente.numero}`,
      motif: "Erreur de saisie",
      le: vente.createdAt,
      par: vente.vendeur,
      posteId: uuid(77, "cccccccc"),
      sessionCaisseId: vente.session.id,
      jourMetier: vente.jourMetier,
    };
    const reponse = await p.appeler("enregistrerAnnulationServeur", [{ ...vente, statut: "ANNULEE", annulation }]);
    expect(reponse).toMatchObject({ ok: false, status: 409, code: "ANNULATION_AUTRE_POSTE" });
    expect(apresAnnulation).not.toHaveBeenCalled();
  });

  it("un refus du cœur devient ok:false avec son code, sans cycle", async () => {
    const { p, deps } = monter();
    p.confirmerIdentite(UTILISATEUR);
    const reponse = await p.appeler("creerVente", ["ph1", corpsVente("inconnu"), uuid(2, "cccccccc")]);
    expect(reponse).toMatchObject({ ok: false, status: 404 });
    expect(deps.apresVente).not.toHaveBeenCalled();
  });

  it("une erreur imprévue donne un message fixe et ne journalise ni corps ni message", async () => {
    const { p, deps, coeur } = monter();
    p.confirmerIdentite(UTILISATEUR);
    vi.spyOn(coeur, "enregistrerVente").mockImplementation(() => {
      throw new TypeError("Secret-du-corps-de-vente 123456");
    });
    const reponse = await p.appeler("creerVente", ["ph1", corpsVente(), uuid(3, "cccccccc")]);
    expect(reponse).toMatchObject({ ok: false, status: 500, message: MESSAGE_ECHEC_ENREGISTREMENT });
    const journal = JSON.stringify(deps.journal.mock.calls);
    expect(journal).not.toContain("Secret");
    expect(journal).not.toContain("123456");
  });

  it("le superviseur est calculé par caisse:superviser", async () => {
    const { p, coeur } = monter();
    const espion = vi.spyOn(coeur, "ouvrirSession");
    p.confirmerIdentite({ ...UTILISATEUR, permissions: ["caisse:utiliser", "caisse:superviser"] });
    await p.appeler("ouvrirSession", ["ph1", { id: uuid(4, "dddddddd") }]);
    expect(espion.mock.calls[0][1]).toMatchObject({ superviseur: true });
    p.confirmerIdentite(UTILISATEUR);
    await p.appeler("getBilan", ["ph1", uuid(5, "dddddddd")]);
    // Un vendeur ordinaire n'est pas superviseur.
    const espionBilan = vi.spyOn(coeur, "bilan");
    await p.appeler("getBilan", ["ph1", uuid(6, "dddddddd")]);
    expect(espionBilan.mock.calls[0][1]).toMatchObject({ superviseur: false });
  });

  it("etatCaisse rend le poste DESKTOP et la caisse ouverte", async () => {
    const { p } = monter();
    p.confirmerIdentite(UTILISATEUR);
    expect(await p.appeler("etatCaisse", ["ph1", UTILISATEUR.id])).toMatchObject({
      ok: true,
      data: { poste: { id: "po1", code: "D1", type: "DESKTOP" }, session: null },
    });
  });
});

describe("état du poste", () => {
  it("distingue démarrage, coupure réelle, connexion à refaire et poste non enregistré", () => {
    const { coeur } = monter();
    const de = (etat: "DEMARRAGE" | "HORS_LIGNE" | "CONNEXION_A_REFAIRE" | "NON_ENREGISTRE") =>
      construireEtat(
        coeur,
        {
          etat,
          dernierContactLe: null,
          echecsConsecutifs: 0,
          prochainDelaiMs: 1000,
          posteDesactive: false,
          heureFausse: false,
          ecartHeureMs: null,
          enAttenteServeur: 0,
          sequenceAppliqueeServeur: null,
          erreur: null,
          rejets: 0,
          fileEnAttente: 0,
        },
        null,
      );
    expect(de("DEMARRAGE")).toMatchObject({ enLigne: false, horsLigne: false, connexionARefaire: false, nonEnregistre: false });
    expect(de("HORS_LIGNE")).toMatchObject({ enLigne: false, horsLigne: true });
    expect(de("CONNEXION_A_REFAIRE")).toMatchObject({ horsLigne: false, connexionARefaire: true });
    expect(de("NON_ENREGISTRE")).toMatchObject({ horsLigne: false, nonEnregistre: true });
  });

  it("transmet messageEnvoi et signale une autre pharmacie", () => {
    const { coeur } = monter();
    const moteur = {
      etat: "EN_LIGNE",
      dernierContactLe: "2026-11-04T10:00:00.000Z",
      echecsConsecutifs: 0,
      prochainDelaiMs: 1000,
      posteDesactive: false,
      heureFausse: false,
      ecartHeureMs: null,
      enAttenteServeur: 0,
      sequenceAppliqueeServeur: null,
      erreur: "Des ventes de ce poste ne peuvent pas être envoyées.",
      rejets: 2,
      fileEnAttente: 3,
    } as const;
    const e = construireEtat(coeur, moteur, { ...UTILISATEUR, structureId: "autre" });
    expect(e).toMatchObject({
      enLigne: true,
      horsLigne: false,
      catalogueDisponible: true,
      fileEnAttente: 3,
      rejetes: 2,
      autrePharmacie: true,
      messageEnvoi: "Des ventes de ce poste ne peuvent pas être envoyées.",
    });
  });
});
