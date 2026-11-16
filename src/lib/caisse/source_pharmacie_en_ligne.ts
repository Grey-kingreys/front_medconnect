import { enregistrerInventaire, getInventaire, listerInventaires, getCatalogue, modifierFiche, upsertStock, creerFournisseur, enregistrerReception, exporterStock, getReception, listerFournisseurs, listerReceptions, getMyStock, listerLotsFiche, sortirDuStock, updateStockQuantite } from "../api_pharmacie";
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
  enregistrerInventaire: (structureId, corps) => enregistrerInventaire(structureId, corps),
  listerInventaires: (structureId, page) => listerInventaires(structureId, page),
  lireInventaire: (structureId, inventaireId) => getInventaire(structureId, inventaireId),
  listerFournisseurs: (structureId) => listerFournisseurs(structureId),
  creerFournisseur: (structureId, corps) => creerFournisseur(structureId, corps),
  enregistrerReception: (structureId, corps) => enregistrerReception(structureId, corps),
  listerReceptions: (structureId, page) => listerReceptions(structureId, page),
  lireReception: (structureId, receptionId) => getReception(structureId, receptionId),
  async rechercherCatalogue(_structureId, recherche) {
    return (await getCatalogue(recherche)).data;
  },
  async creerFiche(structureId, corps) {
    const res = await upsertStock(structureId, { medicamentId: corps.medicamentId, ...(corps.prixUnitaire != null ? { prixUnitaire: corps.prixUnitaire } : {}), ...(corps.notes ? { notes: corps.notes } : {}) });
    return { ...res, data: { fiche: res.data as never, cree: true } };
  },
  async modifierFiche(structureId, fiche, champs) {
    const { notes, ...corps } = champs;
    if (notes !== undefined) await upsertStock(structureId, { medicamentId: fiche.medicamentId, notes: notes ?? "" });
    const res = Object.keys(corps).length > 0 ? await modifierFiche(structureId, fiche.id, corps) : null;
    return { success: true, message: res?.message ?? "Fiche produit enregistrée.", data: { fiche: (res?.data ?? fiche) as never, modifiee: true } };
  },
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
