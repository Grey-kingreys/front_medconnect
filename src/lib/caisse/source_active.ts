import { pontDesktop, type PontDesktop } from "./contrat_desktop";
import type { SourceCaisse } from "./source";
import { creerSourceDesktop } from "./source_desktop";
import { sourceEnLigne } from "./source_en_ligne";

let memorisee: { pont: PontDesktop; source: SourceCaisse } | null = null;

/** Source des écrans de caisse : desktop si le pont existe (mémorisée), sinon l'API. Le web ne change pas. */
export function sourceCaisse(): SourceCaisse {
  const pont = pontDesktop();
  if (pont === null) return sourceEnLigne;
  if (memorisee === null || memorisee.pont !== pont) memorisee = { pont, source: creerSourceDesktop(pont) };
  return memorisee.source;
}
