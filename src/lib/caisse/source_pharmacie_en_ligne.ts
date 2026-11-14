import { getMyStock, listerLotsFiche, sortirDuStock, updateStockQuantite } from "../api_pharmacie";
import type { SourcePharmacie } from "./source_pharmacie";

/** Source de la pharmacie par l'API. Les erreurs remontent telles quelles. */
export const sourcePharmacieEnLigne: SourcePharmacie = {
  enLigneSeulement: true,
  async chargerStock(structureId) {
    const res = await getMyStock(structureId);
    return res.data.stocks;
  },
  async chargerStockInfo(structureId) {
    return (await getMyStock(structureId)).data;
  },
  async listerLots(structureId, stockId) {
    return (await listerLotsFiche(structureId, stockId)).data;
  },
  sortirDuStock: (structureId, corps) => sortirDuStock(structureId, corps),
  corrigerQuantite: (structureId, stockId, corps) => updateStockQuantite(structureId, stockId, corps),
};
