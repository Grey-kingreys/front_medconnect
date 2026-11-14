import { pontDesktop, type PontDesktop } from "./contrat_desktop";
import type { SourcePharmacie } from "./source_pharmacie";
import { creerSourcePharmacieDesktop } from "./source_pharmacie_desktop";
import { sourcePharmacieEnLigne } from "./source_pharmacie_en_ligne";

let memorisee: { pont: PontDesktop; source: SourcePharmacie } | null = null;

/** Source des écrans de la pharmacie : desktop si le pont existe (mémorisée), sinon l'API. Le web ne change pas. */
export function sourcePharmacie(): SourcePharmacie {
  const pont = pontDesktop();
  if (pont === null) return sourcePharmacieEnLigne;
  if (memorisee === null || memorisee.pont !== pont) memorisee = { pont, source: creerSourcePharmacieDesktop(pont) };
  return memorisee.source;
}
