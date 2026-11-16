import { enregistrerInventaire, getInventaire, listerInventaires, getCatalogue, modifierFiche, upsertStock, creerFournisseur, enregistrerReception, exporterStock, getReception, listerFournisseurs, listerReceptions, getMyStock, listerLotsFiche, sortirDuStock, updateStockQuantite } from "../api_pharmacie";
import { creerClientCredit, enregistrerRemboursement, getFicheClientCredit, listerCredits, modifierClientCredit, modifierDateLimitePrise } from "../api_credit";
import { listerAnomalies, traiterAnomalie } from "../api_pilotage";
import type { SourcePharmacie } from "./source_pharmacie";

/** Le serveur refuse l'identifiant que le poste donne à ses clients et remboursements (champ inconnu) : on le retire. */
function sansIdentifiantDePoste<T extends { id?: string }>(corps: T): Omit<T, "id"> {
  const copie = { ...corps };
  delete copie.id;
  return copie;
}

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
  listerCredits: (structureId, options) => listerCredits(structureId, options),
  lireFicheCredit: (structureId, clientId) => getFicheClientCredit(structureId, clientId),
  // L'identifiant du poste n'a pas de sens en ligne : le serveur le refuserait (champ inconnu).
  creerClientCredit: (structureId, corps) => creerClientCredit(structureId, sansIdentifiantDePoste(corps)),
  modifierClientCredit: (structureId, clientId, corps) => modifierClientCredit(structureId, clientId, corps),
  modifierDateLimitePrise: (structureId, venteId, dateLimite) => modifierDateLimitePrise(structureId, venteId, dateLimite),
  enregistrerRemboursementCredit: (structureId, clientId, corps) => enregistrerRemboursement(structureId, clientId, sansIdentifiantDePoste(corps)),
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
