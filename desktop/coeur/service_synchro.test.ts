import http from "node:http";
import type { AddressInfo } from "node:net";
import { gunzipSync } from "node:zlib";
import { afterEach, describe, expect, it, vi } from "vitest";
import { creerClientHttp } from "../electron/client_http";
import { creerServiceSynchro } from "../electron/synchro";
import { base, coeurPret, fermerTout, outils, uuid } from "./aide_tests";
import { CoeurCaisse } from "./coeur";
import { Passerelle } from "./passerelle";

afterEach(fermerTout);

interface Requete {
  methode: string;
  url: string;
  entetes: http.IncomingHttpHeaders;
  corps: Buffer;
}

async function serveur(repondre: (r: Requete, res: http.ServerResponse) => void) {
  const recues: Requete[] = [];
  const srv = http.createServer((req, res) => {
    const morceaux: Buffer[] = [];
    req.on("data", (m: Buffer) => morceaux.push(m));
    req.on("end", () => {
      const r = { methode: req.method ?? "", url: req.url ?? "", entetes: req.headers, corps: Buffer.concat(morceaux) };
      recues.push(r);
      repondre(r, res);
    });
  });
  await new Promise<void>((ok) => srv.listen(0, "127.0.0.1", ok));
  const url = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
  return { url, recues, fermer: () => new Promise<void>((ok) => srv.close(() => ok())) };
}

const json = (res: http.ServerResponse, status: number, corps: unknown) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(corps));
};

describe("client HTTP du moteur", () => {
  it("ajoute le jeton, compresse en gzip et rend le texte et les en-têtes", async () => {
    const s = await serveur((_r, res) => {
      res.writeHead(200, { "Content-Type": "application/json", Date: "Wed, 04 Nov 2026 10:00:00 GMT" });
      res.end(JSON.stringify({ data: 1 }));
    });
    try {
      const client = creerClientHttp({ urlApi: `${s.url}/`, jeton: () => "jeton-de-test" });
      const rep = await client.requete("POST", "/x", { corps: JSON.stringify({ a: 1 }), gzip: true, entetes: { "Content-Type": "application/json" } });
      expect(rep.status).toBe(200);
      expect(rep.corps).toBe('{"data":1}');
      expect(rep.entetes.date).toBe("Wed, 04 Nov 2026 10:00:00 GMT");
      const r = s.recues[0];
      expect(r.entetes.authorization).toBe("Bearer jeton-de-test");
      expect(r.entetes["content-encoding"]).toBe("gzip");
      expect(JSON.parse(gunzipSync(r.corps).toString("utf8"))).toEqual({ a: 1 });
    } finally {
      await s.fermer();
    }
  });

  it("n'envoie aucun en-tête d'autorisation sans jeton", async () => {
    const s = await serveur((_r, res) => res.end("{}"));
    try {
      await creerClientHttp({ urlApi: s.url, jeton: () => null }).requete("GET", "/x");
      expect(s.recues[0].entetes.authorization).toBeUndefined();
    } finally {
      await s.fermer();
    }
  });
});

/** Service branché sur une passerelle, comme dans main.ts. */
function monter(coeur: CoeurCaisse, urlApi: string) {
  const demanderJeton = vi.fn();
  const journal = vi.fn();
  const notifier = vi.fn();
  let passerelle!: Passerelle;
  const service = creerServiceSynchro({
    coeur,
    urlApi,
    versionApp: "0.1.0",
    libellePoste: "poste",
    genererId: () => uuid(1),
    notifier,
    demanderJeton,
    identite: {
      confirmer: (d) => void passerelle.confirmerIdentite(d),
      effacer: () => passerelle.effacerIdentite(),
      idCourant: () => passerelle.utilisateurCourant()?.id ?? null,
    },
    journal,
  });
  passerelle = new Passerelle({
    coeur,
    apresVente: () => service.declencher("apres-vente"),
    apresRattachement: () => service.declencher("demarrage"),
    etatChange: notifier,
    journal,
  });
  return { service, passerelle, demanderJeton, journal, notifier };
}

const PROFIL_KALOUM = {
  id: "u1",
  prenom: "Mariama",
  nom: "Diallo",
  structure: { id: "ph1" },
  permissions: ["caisse:utiliser"],
};
const PROFIL_AUTRE = { ...PROFIL_KALOUM, id: "u2", structure: { id: "autre" } };

describe("service de synchronisation", () => {
  it("sans jeton : aucune requête, aucune erreur", async () => {
    const s = await serveur((_r, res) => res.end("{}"));
    try {
      const { c } = coeurPret();
      const { service, demanderJeton } = monter(c, s.url);
      service.declencher("demarrage");
      await new Promise((ok) => setTimeout(ok, 100));
      expect(s.recues).toHaveLength(0);
      expect(demanderJeton).not.toHaveBeenCalled();
      service.arreter();
    } finally {
      await s.fermer();
    }
  });

  it("un 401 simple (jeton expiré) demande un nouveau jeton, garde l'identité, et le jeton n'est jamais journalisé (D756)", async () => {
    const s = await serveur((_r, res) => json(res, 401, { message: "Non autorisé" }));
    try {
      const { c } = coeurPret();
      const { service, passerelle, demanderJeton, journal, notifier } = monter(c, s.url);
      passerelle.confirmerIdentite(PROFIL_KALOUM);
      service.definirJeton("jeton-secret-123");
      await vi.waitFor(() => expect(demanderJeton).toHaveBeenCalledTimes(1));
      expect(s.recues[0].url).toBe("/auth/me");
      expect(s.recues[0].entetes.authorization).toBe("Bearer jeton-secret-123");
      expect(passerelle.utilisateurCourant()?.id).toBe("u1");
      expect(c.lireProfil()).not.toBeNull();
      expect(service.etat().etat).toBe("CONNEXION_A_REFAIRE");
      expect(notifier).toHaveBeenCalled();
      expect(JSON.stringify(journal.mock.calls)).not.toContain("jeton-secret");
      service.arreter();
    } finally {
      await s.fermer();
    }
  });

  it("après definirJeton(null), un cycle en vol qui reçoit un 401 ne demande plus de jeton", async () => {
    let liberer: () => void = () => undefined;
    const retenue = new Promise<void>((ok) => (liberer = ok));
    const s = await serveur((r, res) => {
      if (r.url === "/auth/me") return json(res, 200, { data: PROFIL_KALOUM });
      void retenue.then(() => json(res, 401, {}));
    });
    try {
      const { c } = coeurPret();
      const { service, demanderJeton } = monter(c, s.url);
      service.definirJeton("jeton-1");
      await vi.waitFor(() => expect(s.recues.length).toBeGreaterThanOrEqual(2)); // /auth/me puis le cycle, retenu
      service.definirJeton(null);
      liberer();
      await service.attendreFinCycle();
      await new Promise((ok) => setTimeout(ok, 50));
      expect(demanderJeton).not.toHaveBeenCalled();
      service.arreter();
    } finally {
      await s.fermer();
    }
  });
});

describe("identité tirée du serveur (jamais du rendu)", () => {
  it("/auth/me confirme l'identité, qui rattache un poste neuf à sa pharmacie", async () => {
    const s = await serveur((r, res) => (r.url === "/auth/me" ? json(res, 200, { data: PROFIL_KALOUM }) : json(res, 500, {})));
    try {
      const coeur = new CoeurCaisse(base(), outils());
      const { service, passerelle } = monter(coeur, s.url);
      service.definirJeton("jeton");
      await vi.waitFor(() => expect(passerelle.utilisateurCourant()?.id).toBe("u1"));
      expect(coeur.structureRattachee()).toBe("ph1");
      service.arreter();
    } finally {
      await s.fermer();
    }
  });

  it("une réponse /auth/me d'une autre pharmacie donne 403 et ne change pas le rattachement", async () => {
    const s = await serveur((r, res) => (r.url === "/auth/me" ? json(res, 200, { data: PROFIL_AUTRE }) : json(res, 500, {})));
    try {
      const { c } = coeurPret();
      const { service, passerelle } = monter(c, s.url);
      service.definirJeton("jeton");
      await vi.waitFor(() => expect(passerelle.utilisateurCourant()?.id).toBe("u2"));
      expect(c.structureRattachee()).toBe("ph1");
      expect(await passerelle.appeler("chargerStock", ["ph1"])).toMatchObject({ ok: false, status: 403 });
      service.arreter();
    } finally {
      await s.fermer();
    }
  });

  it("/auth/me en panne (500) garde l'identité déjà confirmée", async () => {
    let panne = false;
    const s = await serveur((r, res) =>
      r.url === "/auth/me" ? (panne ? json(res, 500, {}) : json(res, 200, { data: PROFIL_KALOUM })) : json(res, 500, {}),
    );
    try {
      const { c } = coeurPret();
      const { service, passerelle, journal } = monter(c, s.url);
      service.definirJeton("jeton-1");
      await vi.waitFor(() => expect(passerelle.utilisateurCourant()?.id).toBe("u1"));
      panne = true;
      service.definirJeton("jeton-2");
      await vi.waitFor(() => expect(journal.mock.calls.some((a) => String(a[0]).includes("identité non confirmée : 500"))).toBe(true));
      expect(passerelle.utilisateurCourant()?.id).toBe("u1");
      service.arreter();
    } finally {
      await s.fermer();
    }
  });

  describe("identité : expiré, déconnecté, retiré, autre compte (D756)", () => {
    const jetonDe = (userId: string) => `e30.${Buffer.from(JSON.stringify({ userId })).toString("base64url")}.signature`;

    it("definirJeton(null) garde l'identité : reprise hors ligne, même après un redémarrage", async () => {
      const { c } = coeurPret();
      const { service, passerelle } = monter(c, "");
      passerelle.confirmerIdentite(PROFIL_KALOUM);
      service.definirJeton(null);
      expect(passerelle.utilisateurCourant()?.id).toBe("u1");
      expect(monter(c, "").passerelle.utilisateurCourant()?.id).toBe("u1");
      service.arreter();
    });

    it("déconnexion volontaire, sans réseau : plus personne ne vend au nom du précédent, même après un redémarrage", async () => {
      const { c } = coeurPret();
      const { service, passerelle } = monter(c, "");
      passerelle.confirmerIdentite(PROFIL_KALOUM);
      service.deconnecter();
      expect(passerelle.utilisateurCourant()).toBeNull();
      expect(await passerelle.appeler("chargerStock", ["ph1"])).toMatchObject({ ok: false, status: 401 });
      const relance = monter(c, "");
      expect(relance.passerelle.utilisateurCourant()).toBeNull();
      expect(await relance.passerelle.appeler("chargerStock", ["ph1"])).toMatchObject({ ok: false, status: 401 });
      service.arreter();
    });

    for (const code of ["SESSION_REVOQUEE", "REFRESH_REUTILISE", "COMPTE_DESACTIVE"]) {
      it(`401 ${code} : identité et profil local effacés`, async () => {
        const s = await serveur((_r, res) => json(res, 401, { message: "Refusé", code }));
        try {
          const { c } = coeurPret();
          const { service, passerelle } = monter(c, s.url);
          passerelle.confirmerIdentite(PROFIL_KALOUM);
          service.definirJeton("jeton");
          await vi.waitFor(() => expect(passerelle.utilisateurCourant()).toBeNull());
          expect(c.lireProfil()).toBeNull();
          service.arreter();
        } finally {
          await s.fermer();
        }
      });
    }

    it("jeton d'un autre compte : le précédent ne vend plus dès la réception, serveur muet compris", async () => {
      const s = await serveur((r, res) => (r.url === "/auth/me" ? json(res, 500, {}) : json(res, 500, {})));
      try {
        const { c } = coeurPret();
        const { service, passerelle } = monter(c, s.url);
        passerelle.confirmerIdentite(PROFIL_KALOUM);
        service.definirJeton(jetonDe("u9"));
        expect(passerelle.utilisateurCourant()).toBeNull();
        expect(c.lireProfil()).toBeNull();
        service.arreter();
      } finally {
        await s.fermer();
      }
    });

    it("jeton renouvelé du même compte, serveur muet : l'identité reste", async () => {
      const s = await serveur((_r, res) => json(res, 500, {}));
      try {
        const { c } = coeurPret();
        const { service, passerelle } = monter(c, s.url);
        passerelle.confirmerIdentite(PROFIL_KALOUM);
        service.definirJeton(jetonDe("u1"));
        expect(passerelle.utilisateurCourant()?.id).toBe("u1");
        service.arreter();
      } finally {
        await s.fermer();
      }
    });

    it("/auth/me en échec au premier essai : nouvel essai au cycle suivant, puis identité confirmée", async () => {
      let panne = true;
      const s = await serveur((r, res) =>
        r.url === "/auth/me" ? (panne ? json(res, 500, {}) : json(res, 200, { data: PROFIL_KALOUM })) : json(res, 500, {}),
      );
      try {
        const { c } = coeurPret();
        const { service, passerelle, journal } = monter(c, s.url);
        service.definirJeton("jeton");
        await vi.waitFor(() => expect(journal.mock.calls.some((a) => String(a[0]).includes("identité non confirmée : 500"))).toBe(true));
        expect(passerelle.utilisateurCourant()).toBeNull();
        panne = false;
        service.declencher("minuterie");
        await vi.waitFor(() => expect(passerelle.utilisateurCourant()?.id).toBe("u1"));
        service.arreter();
      } finally {
        await s.fermer();
      }
    });
  });

  it("première connexion sans réseau : aucune identité, aucun rattachement", async () => {
    const s = await serveur((_r, res) => res.end("{}"));
    const urlMorte = s.url;
    await s.fermer(); // plus personne n'écoute
    const coeur = new CoeurCaisse(base(), outils());
    const { service, passerelle, journal } = monter(coeur, urlMorte);
    service.definirJeton("jeton");
    await vi.waitFor(() => expect(journal.mock.calls.some((a) => String(a[0]).includes("serveur injoignable"))).toBe(true));
    expect(passerelle.utilisateurCourant()).toBeNull();
    expect(coeur.structureRattachee()).toBeNull();
    expect(await passerelle.appeler("chargerStock", ["ph1"])).toMatchObject({ ok: false, status: 401 });
    service.arreter();
  });
});
