import type { PontDesktop } from "./contrat_desktop";
import type { SourcePharmacie } from "./source_pharmacie";
import { lire } from "./source_desktop";

/** Source de la pharmacie par le pont desktop (cœur local). Un refus devient une `ApiError` comme en ligne. */
export function creerSourcePharmacieDesktop(pont: PontDesktop): SourcePharmacie {
  return {
    enLigneSeulement: false,
    async chargerStock(structureId) {
      return lire(await pont.caisse.chargerStock(structureId)).data;
    },
  };
}
