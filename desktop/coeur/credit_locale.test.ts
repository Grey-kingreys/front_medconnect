import { afterEach, describe, expect, it } from "vitest";
import { permissionsRequises } from "@/lib/caisse/permissions_pont";
import { schemasCredit } from "@/lib/caisse/contrat_desktop_schemas";
import { VENDEUR, coeurPret, evenements, fermerTout, fiche, photo, uuid } from "./aide_tests";
import { RefusCaisse } from "./refus";
import type { ClientCreditSynchro, PriseCreditSynchro } from "./types_synchro";

afterEach(fermerTout);

const ID = (n: number) => uuid(n, "cccccccc");
const VENTE = (n: number) => uuid(n, "dddddddd");

function refus(f: () => unknown): RefusCaisse {
  try {
    f();
  } catch (e) {
    expect(e).toBeInstanceOf(RefusCaisse);
    return e as RefusCaisse;
  }
  throw new Error("Un refus était attendu.");
}

const prisePhoto = (n: number, total: number, extra: Partial<PriseCreditSynchro> = {}): PriseCreditSynchro => ({
  venteId: VENTE(n),
  numero: `T1-000000${n}`,
  createdAt: `2026-10-0${n}T09:00:00.000Z`,
  jourMetier: `2026-10-0${n}`,
  vendeurNom: "Mariama Diallo",
  total,
  annulee: false,
  motifAnnulation: null,
  dateLimite: null,
  resteSurPrise: total,
  lignes: [{ nomMedicament: "Paracétamol", nombreAffiche: 2, uniteAffichee: "BOITE", sousTotal: total }],
  ...extra,
});

const clientPhoto = (n: number, prises: PriseCreditSynchro[], remboursements: ClientCreditSynchro["remboursements"] = []): ClientCreditSynchro => {
  const pris = prises.filter((p) => !p.annulee).reduce((s, p) => s + p.total, 0);
  const rembourse = remboursements.reduce((s, r) => s + r.montant, 0);
  return {
    id: ID(n),
    nomComplet: `Client ${n}`,
    telephone: `+224 62${n} 00 00 00`,
    note: null,
    createdAt: "2026-10-01T08:00:00.000Z",
    resteAPayer: Math.max(0, pris - rembourse),
    totalPris: pris,
    totalRembourse: rembourse,
    statut: pris - rembourse > 0 ? "EN_COURS" : "SOLDE",
    prises,
    remboursements,
  };
};

function avecClients(clients: ClientCreditSynchro[], sequenceAppliquee = 0) {
  const { s, c } = coeurPret();
  c.appliquerPhotographie({ ...photo([fiche(1)], { plages: [{ id: "p1", debut: 1, fin: 500 }], sequenceAppliquee }), clientsCredit: clients }, null, null);
  return { s, c };
}

describe("cahier de crédit local", () => {
  it("lit les clients de la photographie : reste et statut calculés ici, retard avec l'horloge du poste", () => {
    const { c } = avecClients([
      clientPhoto(1, [prisePhoto(1, 10000, { dateLimite: "2026-10-15" })]),
      clientPhoto(2, [prisePhoto(2, 4000)], [{ id: ID(90), montant: 4000, note: null, verseEnCaisse: false, auteurNom: "X", createdAt: "2026-10-03T09:00:00.000Z" }]),
      clientPhoto(3, [prisePhoto(3, 3000)]),
    ]);
    const liste = c.listerCredits();
    expect(liste.clients.map((x) => [x.nomComplet, x.statut, x.resteAPayer])).toEqual([
      ["Client 1", "EN_RETARD", 10000],
      ["Client 3", "EN_COURS", 3000],
      ["Client 2", "SOLDE", 0],
    ]);
    expect(liste.resteTotal).toBe(13000);
    expect(c.listerCredits({ statut: "SOLDE" }).total).toBe(1);
    expect(c.listerCredits({ q: "client 3" }).clients.map((x) => x.id)).toEqual([ID(3)]);
    expect(c.listerCredits({ q: "99999" }).total).toBe(0);
    const fiche1 = c.lireFicheCredit(ID(1));
    expect(fiche1.prises[0]).toMatchObject({ resteSurPrise: 10000, soldee: false, dateLimite: "2026-10-15" });
  });

  it("vente à crédit avec un nouveau client : client puis vente au journal, stock baissé, aucun argent encaissé", () => {
    const { s, c } = coeurPret();
    const v = c.enregistrerVente({ lignes: [{ stockId: "s1", quantite: 2 }], nouveauClientCredit: { nomComplet: "Awa Sow", telephone: "+224 622 00 00 00" }, dateLimiteCredit: "2026-12-01" }, VENTE(1), VENDEUR);
    expect(v.total).toBe(10000);
    expect(v.paiements.map((p) => [p.mode, p.montant])).toEqual([["CREDIT", 10000]]);
    expect(v.credit).toMatchObject({ nomComplet: "Awa Sow", dateLimite: "2026-12-01" });
    expect(v.clientNom).toBe("Awa Sow");
    const evts = evenements(s).filter((e) => e.type === "CLIENT_CREDIT_CREE" || e.type === "VENTE");
    expect(evts.map((e) => e.type)).toEqual(["CLIENT_CREDIT_CREE", "VENTE"]);
    const clientId = evts[0].corps.id as string;
    expect(evts[0].corps).toEqual({ id: clientId, nomComplet: "Awa Sow", telephone: "+224 622 00 00 00" });
    expect(evts[1].corps).toMatchObject({ venteId: VENTE(1), clientCreditId: clientId, dateLimiteCredit: "2026-12-01", paiements: [{ mode: "CREDIT", montant: 10000 }] });
    expect(evts[1].sequence).toBe(evts[0].sequence + 1);
    expect(s.lire("SELECT * FROM paiements_locaux")).toEqual([]);
    expect(c.lireStock()[0].quantite).toBe(38);
    const f = c.lireFicheCredit(clientId);
    expect(f).toMatchObject({ resteAPayer: 10000, totalPris: 10000, statut: "EN_COURS", dateLimite: "2026-12-01" });
    expect(f.prises[0].lignes[0]).toMatchObject({ nomMedicament: "Produit 00001", sousTotal: 10000 });
  });

  it("vente à crédit sur un client existant, rejouée avec la même clé : une seule prise", () => {
    const { s, c } = avecClients([clientPhoto(1, [prisePhoto(1, 2000)])]);
    const corps = { lignes: [{ stockId: "s1", quantite: 1 }], clientCreditId: ID(1) };
    c.enregistrerVente(corps, VENTE(5), VENDEUR);
    expect(c.enregistrerVente(corps, VENTE(5), VENDEUR).rejeu).toBe(true);
    expect(c.lireFicheCredit(ID(1)).resteAPayer).toBe(7000);
    expect(evenements(s).filter((e) => e.type === "VENTE")).toHaveLength(1);
  });

  it("refus d'une vente à crédit : client inconnu, deux clients, autre paiement, date passée", () => {
    const { s, c } = coeurPret();
    const base = { lignes: [{ stockId: "s1", quantite: 1 }] };
    expect(refus(() => c.enregistrerVente({ ...base, clientCreditId: ID(9) }, VENTE(1), VENDEUR)).code).toBe("CLIENT_CREDIT_INTROUVABLE");
    expect(refus(() => c.enregistrerVente({ ...base, clientCreditId: ID(9), nouveauClientCredit: { nomComplet: "Awa Sow" } }, VENTE(2), VENDEUR)).code).toBe("VALIDATION");
    expect(refus(() => c.enregistrerVente({ ...base, nouveauClientCredit: { nomComplet: "Awa Sow" }, paiements: [{ mode: "ESPECES", montant: 5000 }] }, VENTE(3), VENDEUR)).code).toBe("CREDIT_PAIEMENTS_INCOHERENTS");
    expect(refus(() => c.enregistrerVente({ ...base, nouveauClientCredit: { nomComplet: "Awa Sow" }, dateLimiteCredit: "2026-11-03" }, VENTE(4), VENDEUR)).code).toBe("DATE_LIMITE_PASSEE");
    expect(refus(() => c.enregistrerVente({ ...base, dateLimiteCredit: "2026-12-01" }, VENTE(5), VENDEUR)).code).toBe("CREDIT_PAIEMENTS_INCOHERENTS");
    expect(evenements(s)).toEqual([]);
    expect(s.lire("SELECT * FROM clients_credit_locaux")).toEqual([]);
  });

  it("remboursement : reste recalculé, rejouable, refus au-delà du reste ou sur un crédit soldé", () => {
    const { s, c } = avecClients([clientPhoto(1, [prisePhoto(1, 10000)])]);
    const r = c.enregistrerRemboursementCredit(ID(1), { id: ID(50), montant: 4000, note: "Payé par sa sœur" }, VENDEUR);
    expect(r).toMatchObject({ resteAPayer: 6000, statut: "EN_COURS" });
    expect(r.remboursement).toMatchObject({ id: ID(50), montant: 4000, verseEnCaisse: false, mouvementCaisseId: null });
    const rejeu = c.enregistrerRemboursementCredit(ID(1), { id: ID(50), montant: 4000 }, VENDEUR);
    expect(rejeu.resteAPayer).toBe(6000);
    expect(evenements(s).filter((e) => e.type === "REMBOURSEMENT_CREDIT")).toHaveLength(1);
    expect(evenements(s)[0].corps).toEqual({ id: ID(50), clientId: ID(1), montant: 4000, note: "Payé par sa sœur", verseEnCaisse: false });

    const trop = refus(() => c.enregistrerRemboursementCredit(ID(1), { id: ID(51), montant: 6001 }, VENDEUR));
    expect(trop.code).toBe("MONTANT_SUPERIEUR_AU_RESTE");
    expect(trop.details).toEqual({ resteAPayer: 6000 });
    expect(c.enregistrerRemboursementCredit(ID(1), { id: ID(52), montant: 6000 }, VENDEUR)).toMatchObject({ resteAPayer: 0, statut: "SOLDE" });
    expect(refus(() => c.enregistrerRemboursementCredit(ID(1), { id: ID(53), montant: 1 }, VENDEUR)).code).toBe("CREDIT_DEJA_SOLDE");
    expect(refus(() => c.enregistrerRemboursementCredit(ID(9), { id: ID(54), montant: 1 }, VENDEUR)).code).toBe("CLIENT_CREDIT_INTROUVABLE");
    expect(refus(() => c.enregistrerRemboursementCredit(ID(1), { id: "pas-un-uuid", montant: 1 }, VENDEUR)).code).toBe("VALIDATION");
  });

  it("remboursement versé en caisse : entrée de caisse locale dans la caisse ouverte, sans événement de mouvement en plus", () => {
    const { s, c } = avecClients([clientPhoto(1, [prisePhoto(1, 10000)])]);
    expect(refus(() => c.enregistrerRemboursementCredit(ID(1), { id: ID(50), montant: 1000, verseEnCaisse: true }, VENDEUR)).code).toBe("CAISSE_NON_OUVERTE");
    expect(s.lire("SELECT * FROM remboursements_credit_locaux")).toEqual([]);

    const session = c.ouvrirSession({ id: ID(70), comptage: { montantEspeces: 20000 } }, VENDEUR);
    const r = c.enregistrerRemboursementCredit(ID(1), { id: ID(51), montant: 3000, verseEnCaisse: true }, VENDEUR);
    expect(r.remboursement).toMatchObject({ verseEnCaisse: true, mouvementCaisseId: ID(51) });
    expect(s.lire("SELECT id, sessionId, type, mode, montant FROM mouvements_caisse")).toEqual([{ id: ID(51), sessionId: session.id, type: "APPORT", mode: "ESPECES", montant: 3000 }]);
    const evt = evenements(s).filter((e) => e.type === "REMBOURSEMENT_CREDIT");
    expect(evt[0].corps).toMatchObject({ id: ID(51), verseEnCaisse: true, sessionId: session.id });
    expect(evenements(s).some((e) => e.type === "MOUVEMENT_CAISSE")).toBe(false);
    expect(c.bilan(session.id, VENDEUR).theorique.find((t) => t.mode === "ESPECES")?.montant).toBe(23000);
  });

  it("une nouvelle photographie qui contient déjà les opérations du poste ne les compte pas deux fois", () => {
    const { s, c } = avecClients([clientPhoto(1, [prisePhoto(1, 10000)])]);
    c.enregistrerRemboursementCredit(ID(1), { id: ID(50), montant: 4000 }, VENDEUR);
    const sequence = evenements(s)[0].sequence;
    expect(c.lireFicheCredit(ID(1)).resteAPayer).toBe(6000);
    const serveur = clientPhoto(1, [prisePhoto(1, 10000)], [{ id: ID(50), montant: 4000, note: null, verseEnCaisse: false, auteurNom: "Mariama Diallo", createdAt: "2026-11-04T10:00:00.000Z" }]);
    c.appliquerPhotographie({ ...photo([fiche(1)], { plages: [{ id: "p1", debut: 1, fin: 500 }], sequenceAppliquee: sequence }), clientsCredit: [serveur] }, null, null);
    expect(c.lireFicheCredit(ID(1))).toMatchObject({ resteAPayer: 6000, totalRembourse: 4000 });
    expect(c.lireFicheCredit(ID(1)).remboursements).toHaveLength(1);
  });

  it("client créé et modifié sur le poste, puis date limite d'une prise", () => {
    const { s, c } = avecClients([clientPhoto(1, [prisePhoto(1, 10000)])]);
    const nouveau = c.creerClientCredit({ id: ID(20), nomComplet: "  Awa Sow ", telephone: "622 11 22 33" }, VENDEUR);
    expect(nouveau).toMatchObject({ id: ID(20), nomComplet: "Awa Sow", resteAPayer: 0, statut: "SOLDE" });
    expect(c.creerClientCredit({ id: ID(20), nomComplet: "Autre" }, VENDEUR).nomComplet).toBe("Awa Sow");
    expect(refus(() => c.creerClientCredit({ id: ID(21), nomComplet: "A" }, VENDEUR)).code).toBe("VALIDATION");
    expect(refus(() => c.creerClientCredit({ id: ID(21), nomComplet: "Awa Sow", telephone: "abc" }, VENDEUR)).code).toBe("VALIDATION");

    const modifie = c.modifierClientCredit(ID(1), { telephone: null, note: "Voisin du marché" }, VENDEUR);
    expect(modifie).toMatchObject({ telephone: null, note: "Voisin du marché" });
    expect(evenements(s).filter((e) => e.type === "CLIENT_CREDIT_MODIFIE")[0].corps).toEqual({ id: ID(1), champs: { telephone: null, note: "Voisin du marché" } });
    const avant = evenements(s).length;
    c.modifierClientCredit(ID(1), { note: "Voisin du marché" }, VENDEUR);
    expect(evenements(s)).toHaveLength(avant);

    expect(c.modifierDateLimiteCredit(VENTE(1), "2026-12-24", VENDEUR).prises[0].dateLimite).toBe("2026-12-24");
    expect(evenements(s).slice(-1)[0]).toMatchObject({ type: "DATE_LIMITE_MODIFIEE", corps: { venteId: VENTE(1), dateLimite: "2026-12-24" } });
    expect(c.modifierDateLimiteCredit(VENTE(1), null, VENDEUR).dateLimite).toBeNull();
    expect(refus(() => c.modifierDateLimiteCredit(VENTE(1), "2026-11-03", VENDEUR)).code).toBe("DATE_LIMITE_PASSEE");
    expect(refus(() => c.modifierDateLimiteCredit(VENTE(9), null, VENDEUR)).code).toBe("PRISE_INTROUVABLE");
    c.enregistrerRemboursementCredit(ID(1), { id: ID(60), montant: 10000 }, VENDEUR);
    expect(refus(() => c.modifierDateLimiteCredit(VENTE(1), "2026-12-24", VENDEUR)).code).toBe("PRISE_SOLDEE");
  });

  it("l'historique retiré par la borne de la photographie compte dans le reste, sans apparaître dans la fiche", () => {
    const client = { ...clientPhoto(1, [prisePhoto(2, 3000)]), resteAPayer: 2000, totalPris: 8000, totalRembourse: 6000, anterieur: { totalPris: 5000, totalRembourse: 6000 } };
    const { c } = avecClients([client]);
    const f = c.lireFicheCredit(ID(1));
    expect(f).toMatchObject({ resteAPayer: 2000, totalPris: 8000, totalRembourse: 6000, statut: "EN_COURS" });
    expect(f.prises).toHaveLength(1);
    expect(c.enregistrerRemboursementCredit(ID(1), { id: ID(80), montant: 2000 }, VENDEUR)).toMatchObject({ resteAPayer: 0, statut: "SOLDE" });
  });

  it("la photographie sans cahier de crédit (serveur plus ancien) laisse le cahier vide", () => {
    const { c } = coeurPret();
    expect(c.listerCredits()).toMatchObject({ total: 0, clients: [] });
  });

  it("droits et schémas du pont : lecture credit:read, écritures credit:write", () => {
    expect(permissionsRequises("credit", "lister")).toEqual(["credit:read"]);
    expect(permissionsRequises("credit", "enregistrerRemboursement")).toEqual(["credit:write"]);
    expect(permissionsRequises("credit", "creerVente")).toBeNull();
    expect(schemasCredit.enregistrerRemboursement.safeParse(["ph1", ID(1), { id: ID(2), montant: 0 }]).success).toBe(false);
    expect(schemasCredit.enregistrerRemboursement.safeParse(["ph1", ID(1), { id: ID(2), montant: 500, prix: 1 }]).success).toBe(false);
    expect(schemasCredit.modifierDateLimite.safeParse(["ph1", VENTE(1), { dateLimite: null }]).success).toBe(true);
  });
});
