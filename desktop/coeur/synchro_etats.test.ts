/** États du moteur avant tout cycle : le démarrage n'est pas une coupure (PD04c). */
import { afterEach, describe, expect, it } from "vitest";
import { MAINTENANT, coeurPret, fermerTout, uuid } from "./aide_tests";
import { FauxClient, FauxServeur } from "./fixtures/faux_serveur";
import { MoteurSynchro } from "./synchro";

afterEach(fermerTout);

function moteurPret() {
  const { c } = coeurPret();
  const serveur = new FauxServeur({ id: "po1", code: "D1", appareilId: c.appareilId() });
  serveur.ouvrirPlage("p1", 1, 500);
  const client = new FauxClient(serveur);
  let n = 0;
  const moteur = new MoteurSynchro(c, client, {
    versionApp: "0.1.0",
    libellePoste: "Comptoir",
    horloge: () => new Date(MAINTENANT),
    genererId: () => uuid(++n, "cccccccc"),
    journal: () => undefined,
  });
  return { moteur, client, serveur };
}

describe("états du moteur", () => {
  it("démarre en DEMARRAGE : ni en ligne ni hors ligne tant que rien n'a été tenté", () => {
    expect(moteurPret().moteur.etat().etat).toBe("DEMARRAGE");
  });

  it("un contact sans jeton qui échoue pose HORS_LIGNE, un contact réussi sort de la coupure", () => {
    const { moteur } = moteurPret();
    moteur.signalerContact(true);
    expect(moteur.etat().etat).toBe("DEMARRAGE");
    moteur.signalerContact(false);
    expect(moteur.etat().etat).toBe("HORS_LIGNE");
    moteur.signalerContact(true);
    expect(moteur.etat().etat).toBe("DEMARRAGE");
  });

  it("le premier cycle réussi donne EN_LIGNE, un échec de contact au repos le passe HORS_LIGNE", async () => {
    const { moteur } = moteurPret();
    await moteur.cycle("demarrage");
    expect(moteur.etat().etat).toBe("EN_LIGNE");
    moteur.signalerContact(true);
    expect(moteur.etat().etat).toBe("EN_LIGNE");
    moteur.signalerContact(false);
    expect(moteur.etat().etat).toBe("HORS_LIGNE");
  });
});
