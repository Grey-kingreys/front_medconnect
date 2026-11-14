/**
 * Préparation des paiements d'une vente, portée de back_medconnect
 * (src/pharmacie/vente-regles.ts, preparerPaiements). Sans Nest.
 * Pure : aucun import de React, de Next ni d'accès réseau.
 */
import { CODE_ESPECES } from "./caisse";

export interface ModeConnu {
  id: string;
  code: string;
  libelle: string;
  comptagePhysique: boolean;
  referenceAutorisee: boolean;
  ordre: number;
}

export interface PaiementDemande {
  mode: string;
  montant: number;
  reference?: string;
  montantRecu?: number;
}

export interface PaiementPrevu {
  modePaiementId: string;
  code: string;
  montant: number;
  referenceExterne: string | null;
  montantRecu: number | null;
}

export type ResultatPaiements =
  | { ok: true; paiements: PaiementPrevu[] }
  | { ok: false; code: "MODE_PAIEMENT_INCONNU"; mode: string }
  | { ok: false; code: "MODE_EN_DOUBLE" }
  | { ok: false; code: "MONTANT_RECU_INSUFFISANT" }
  | { ok: false; code: "PAIEMENTS_INCOHERENTS"; somme: number };

/** Paiements d'une vente (D538). `modes` = modes ACTIFS seulement. */
export function preparerPaiements(
  total: number,
  demandes: readonly PaiementDemande[] | undefined,
  modes: readonly ModeConnu[],
): ResultatPaiements {
  const liste: readonly PaiementDemande[] = demandes ?? [{ mode: CODE_ESPECES, montant: total }];
  const parCode = new Map(modes.map((m) => [m.code, m]));

  for (const d of liste) {
    if (!parCode.has(d.mode)) {
      return { ok: false, code: "MODE_PAIEMENT_INCONNU", mode: d.mode };
    }
  }
  if (new Set(liste.map((d) => d.mode)).size !== liste.length) {
    return { ok: false, code: "MODE_EN_DOUBLE" };
  }
  for (const d of liste) {
    const mode = parCode.get(d.mode) as ModeConnu;
    if (mode.comptagePhysique && d.montantRecu !== undefined && d.montantRecu < d.montant) {
      return { ok: false, code: "MONTANT_RECU_INSUFFISANT" };
    }
  }
  const somme = liste.reduce((s, d) => s + d.montant, 0);
  if (somme !== total) {
    return { ok: false, code: "PAIEMENTS_INCOHERENTS", somme };
  }

  return {
    ok: true,
    paiements: liste.map((d) => {
      const mode = parCode.get(d.mode) as ModeConnu;
      const reference = d.reference?.trim() ?? "";
      return {
        modePaiementId: mode.id,
        code: mode.code,
        montant: d.montant,
        referenceExterne: mode.referenceAutorisee && reference !== "" ? reference : null,
        montantRecu: mode.comptagePhysique ? (d.montantRecu ?? null) : null,
      };
    }),
  };
}
