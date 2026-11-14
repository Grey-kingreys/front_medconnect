/** Pages qui fonctionnent sans réseau sur le poste desktop (D744) ; les autres demandent une connexion. */
const ROUTES_HORS_LIGNE = [
  "/dashboard/vente",
  "/dashboard/caisse",
  "/dashboard/ventes",
  "/dashboard/stock",
  "/dashboard/poste",
  "/dashboard/profil",
] as const;

/** Vrai si la page se lit hors ligne : la route elle-même ou une sous-page (le reçu d'une vente, par exemple). */
export function routeHorsLigneAutorisee(chemin: string): boolean {
  return ROUTES_HORS_LIGNE.some((route) => chemin === route || chemin.startsWith(`${route}/`));
}
