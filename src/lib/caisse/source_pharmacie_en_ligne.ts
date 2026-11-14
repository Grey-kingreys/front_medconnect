import { exporterStock, getMyStock, listerLotsFiche, sortirDuStock, updateStockQuantite } from "../api_pharmacie";
import { listerAnomalies, traiterAnomalie } from "../api_pilotage";
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
  listerAnomalies: (structureId, options) => listerAnomalies(structureId, options),
  traiterAnomalie: (structureId, anomalieId, commentaire) => traiterAnomalie(structureId, anomalieId, commentaire),
  async exporterStock(structureId, options) {
    const { blob, filename } = await exporterStock(structureId, options);
    const url = URL.createObjectURL(blob);
    const lien = document.createElement("a");
    lien.href = url;
    lien.download = filename;
    document.body.appendChild(lien);
    lien.click();
    lien.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    return { enregistre: true, nomFichier: filename };
  },
};
