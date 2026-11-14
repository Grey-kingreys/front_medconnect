import type { LotEnStock, StockInfo, StockMedicament } from "../api_pharmacie";
import type { PontAnomalie, PontDesktop, PontStock } from "./contrat_desktop";
import type { SourcePharmacie } from "./source_pharmacie";
import { lire } from "./source_desktop";

const MESSAGE_APPLICATION_ANCIENNE =
  "Cette fonction n'est pas disponible dans cette version de l'application. Mettez l'application à jour.";

/** Alertes de la page du stock, calculées comme le serveur : rupture à 0, stock bas sous le seuil en boîtes. */
function alertesLocales(stocks: StockMedicament[], seuilBoites: number): StockInfo["alertes"] {
  const alertes: StockInfo["alertes"] = { stockBas: [], rupture: [] };
  for (const s of stocks) {
    const coefficient = s.coefficientBoite ?? 1;
    if (s.quantite <= 0) {
      alertes.rupture.push({ id: s.id, nom: s.medicament.nom, quantiteARegulariser: s.quantiteARegulariser });
    } else if (s.quantite < seuilBoites * coefficient) {
      alertes.stockBas.push({ id: s.id, nom: s.medicament.nom, quantite: s.quantite });
    }
  }
  return alertes;
}

/** Lots à solde positif d'une fiche, au format de la route des lots. */
function lotsDeLaFiche(fiche: StockMedicament, jour: string): LotEnStock[] {
  const reliquats = new Map((fiche.reliquat ?? []).map((r) => [r.lotId, r.unitesRestantes]));
  return (fiche.lots ?? []).map((l) => ({
    id: l.id,
    numeroLot: l.numeroLot,
    dateExpiration: l.dateExpiration,
    dateReception: "",
    quantite: l.quantite,
    reliquat: reliquats.get(l.id) ?? 0,
    coefficientReception: l.coefficientReception ?? fiche.coefficientBoite ?? 1,
    lotTechnique: l.lotTechnique,
    perime: l.dateExpiration !== null && l.dateExpiration < jour,
  }));
}

/** Source de la pharmacie par le pont desktop (cœur local). Un refus devient une `ApiError` comme en ligne. */
export function creerSourcePharmacieDesktop(pont: PontDesktop): SourcePharmacie {
  const stock = (): PontStock => {
    if (pont.stock === undefined || typeof pont.stock.sortir !== "function") throw new Error(MESSAGE_APPLICATION_ANCIENNE);
    return pont.stock;
  };
  const anomalie = (): PontAnomalie => {
    if (pont.anomalie === undefined || typeof pont.anomalie.lister !== "function") throw new Error(MESSAGE_APPLICATION_ANCIENNE);
    return pont.anomalie;
  };
  const chargerStock = async (structureId: string) => lire(await pont.caisse.chargerStock(structureId)).data;

  return {
    enLigneSeulement: false,
    chargerStock,
    async chargerStockInfo(structureId) {
      const stocks = await chargerStock(structureId);
      const ref = lire(await pont.caisse.chargerReferentiels(structureId)).data;
      return { stocks, alertes: alertesLocales(stocks, ref.parametres.seuilStockBas) };
    },
    async listerLots(structureId, stockId) {
      const fiche = (await chargerStock(structureId)).find((s) => s.id === stockId);
      return fiche === undefined ? [] : lotsDeLaFiche(fiche, new Date().toISOString().slice(0, 10));
    },
    async sortirDuStock(structureId, corps) {
      return lire(await stock().sortir(structureId, { ...corps, id: corps.id ?? crypto.randomUUID() }));
    },
    async corrigerQuantite(structureId, stockId, corps) {
      return lire(await stock().corriger(structureId, stockId, corps));
    },
    async listerAnomalies(structureId, options) {
      return lire(await anomalie().lister(structureId, options));
    },
    async traiterAnomalie(structureId, anomalieId, commentaire) {
      return lire(await anomalie().traiter(structureId, anomalieId, { commentaire }));
    },
    async exporterStock(structureId, options) {
      const s = stock();
      if (typeof s.exporter !== "function") throw new Error(MESSAGE_APPLICATION_ANCIENNE);
      return lire(await s.exporter(structureId, options)).data;
    },
  };
}
