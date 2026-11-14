import type { VentesDuJour } from "./api_ventes";

export interface ResumeVentesDuJour {
  totalJour: number;
  nombre: number;
  /** Pièces d'annulation de la page lue : une annulation du jour compte même si la vente date d'un autre jour. */
  annulees: number;
  /** Vrai quand la journée tient sur plusieurs pages : seules les dernières ventes sont lues. */
  partiel: boolean;
  ventesLues: number;
}

export interface ResumeMesVentes {
  /** Somme signée des pièces du vendeur : ses annulations sont déduites. */
  total: number;
  /** Nombre de ventes (pièces de type VENTE) du vendeur. */
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
    annulees: ventes.filter((v) => v.typePiece === "ANNULATION").length,
    partiel: data.totalPages > 1,
    ventesLues: ventes.length,
  };
}

/** Chiffres du comptoir : seules les ventes du vendeur connecté sont comptées (D18). */
export function resumerMesVentes(data: VentesDuJour, utilisateurId: string): ResumeMesVentes {
  const ventes = ventesDe(data);
  const miennes = ventes.filter((v) => v.vendeur.id === utilisateurId);
  return {
    total: miennes.reduce((somme, v) => somme + v.total, 0),
    nombre: miennes.filter((v) => v.typePiece === "VENTE").length,
    annulees: miennes.filter((v) => v.typePiece === "ANNULATION").length,
    partiel: data.totalPages > 1,
    ventesLues: ventes.length,
  };
}
