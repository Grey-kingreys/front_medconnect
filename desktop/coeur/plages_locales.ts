import type { Contexte } from "./contexte";

interface LignePlage {
  id: string;
  debut: number;
  fin: number;
  dernierUtilise: number | null;
}

function plages(c: Contexte): LignePlage[] {
  return c.stockage.lire<LignePlage>("SELECT id, debut, fin, dernierUtilise FROM plages ORDER BY debut");
}

/** Numéros encore libres dans toutes les plages du poste. */
export function plageRestante(c: Contexte): number {
  return plages(c).reduce((somme, p) => somme + Math.max(0, p.fin - (p.dernierUtilise ?? p.debut - 1)), 0);
}

/** Prochain numéro libre de la plus petite borne qui en a un, sans rien écrire ; null si toutes sont épuisées. */
export function prochainNumeroPlage(c: Contexte): { plageId: string; numero: number } | null {
  for (const p of plages(c)) {
    const dernier = p.dernierUtilise ?? p.debut - 1;
    if (dernier < p.fin) return { plageId: p.id, numero: dernier + 1 };
  }
  return null;
}

export function consommerNumeroPlage(c: Contexte, plageId: string, numero: number): void {
  c.stockage.executer("UPDATE plages SET dernierUtilise = ? WHERE id = ?", [numero, plageId]);
}
