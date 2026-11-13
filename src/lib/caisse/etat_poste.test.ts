import { describe, expect, it } from "vitest";
import type { EtatPosteDesktop, PontDesktop } from "./contrat_desktop";
import { etatPosteAttendu, horsLigneSurPoste } from "./etat_poste";
import { routeHorsLigneAutorisee } from "./routes_hors_ligne";

const pont = {} as PontDesktop;
const etat = (surcharge: Partial<EtatPosteDesktop>): EtatPosteDesktop => ({
  enLigne: false,
  horsLigne: false,
  connexionARefaire: false,
  nonEnregistre: false,
  catalogueDisponible: true,
  fileEnAttente: 0,
  rejetes: 0,
  plageEpuisee: false,
  heureFausse: false,
  posteDesactive: false,
  autrePharmacie: false,
  dernierContactLe: null,
  photographieLe: null,
  messageEnvoi: null,
  ...surcharge,
});

describe("hors ligne sur le poste", () => {
  it("n'est vrai qu'après un échec réel de contact", () => {
    expect(horsLigneSurPoste({ pont, etat: etat({ horsLigne: true }) })).toBe(true);
  });

  it("le démarrage, la connexion à refaire et le poste non enregistré ne sont pas une coupure", () => {
    expect(horsLigneSurPoste({ pont, etat: etat({}) })).toBe(false);
    expect(horsLigneSurPoste({ pont, etat: etat({ connexionARefaire: true }) })).toBe(false);
    expect(horsLigneSurPoste({ pont, etat: etat({ nonEnregistre: true }) })).toBe(false);
  });

  it("sur le web et tant que l'état est inconnu, rien ne bloque", () => {
    expect(horsLigneSurPoste({ pont: null, etat: null })).toBe(false);
    expect(horsLigneSurPoste({ pont, etat: null })).toBe(false);
    expect(etatPosteAttendu({ pont, etat: null })).toBe(true);
    expect(etatPosteAttendu({ pont: null, etat: null })).toBe(false);
  });
});

describe("pages permises hors ligne", () => {
  it("garde la vente, la caisse, les ventes et leurs sous-pages, le poste et le profil", () => {
    for (const chemin of ["/dashboard/vente", "/dashboard/caisse", "/dashboard/ventes/abc/recu", "/dashboard/poste", "/dashboard/profil"]) {
      expect(routeHorsLigneAutorisee(chemin)).toBe(true);
    }
    for (const chemin of ["/dashboard", "/dashboard/stock", "/dashboard/receptions", "/dashboard/ventesx", "/dashboard/credits", "/dashboard/credits/c1"]) {
      expect(routeHorsLigneAutorisee(chemin)).toBe(false);
    }
  });
});
