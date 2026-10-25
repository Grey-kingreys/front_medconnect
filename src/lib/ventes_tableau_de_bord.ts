import type { VentesDuJour } from "./api_ventes";

export interface ResumeVentesDuJour {
  totalJour: number;
  nombre: number;
  /** Ventes de la page lue au statut ANNULEE. */
  annulees: number;
  /** Vrai quand la journée tient sur plusieurs pages : seules les dernières ventes sont lues. */
  partiel: boolean;
  ventesLues: number;
}

export interface ResumeMesVentes {
  /** Somme des ventes validées du vendeur. */
  total: number;
  /** Nombre de ventes validées du vendeur. */
  nombre: number;
  annulees: number;
  partiel: boolean;
  ventesLues: number;
}

function ventesDe(data: VentesDuJour) {
  return Array.isArray(data.ventes) ? data.ventes : [];
}

/** Chiffres du pilotage : totaux du serveur, annulées comptées sur la page lue (D17). */
export function resumerVentesDuJour(data: VentesDuJour): ResumeVentesDuJour {
  const ventes = ventesDe(data);
  return {
    totalJour: data.totalJour,
    nombre: data.nombre,
    annulees: ventes.filter((v) => v.statut === "ANNULEE").length,
    partiel: data.totalPages > 1,
    ventesLues: ventes.length,
  };
}

/** Chiffres du comptoir : seules les ventes du vendeur connecté sont comptées (D18). */
export function resumerMesVentes(data: VentesDuJour, utilisateurId: string): ResumeMesVentes {
  const ventes = ventesDe(data);
  const miennes = ventes.filter((v) => v.vendeur.id === utilisateurId);
  const validees = miennes.filter((v) => v.statut === "VALIDEE");
  return {
    total: validees.reduce((somme, v) => somme + v.total, 0),
    nombre: validees.length,
    annulees: miennes.filter((v) => v.statut === "ANNULEE").length,
    partiel: data.totalPages > 1,
    ventesLues: ventes.length,
  };
}
