/** Montant en francs guinéens : entier arrondi, milliers séparés par une espace insécable, suffixe « GNF ». */
export function formaterGNF(montant: number): string {
  const arrondi = Math.round(montant);
  const signe = arrondi < 0 ? "-" : "";
  const chiffres = String(Math.abs(arrondi)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${signe}${chiffres} GNF`;
}
