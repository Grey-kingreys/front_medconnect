/**
 * Règles pures du cahier de crédit, reprises à l'identique de
 * back_medconnect/src/pharmacie/credit/credit-regles.ts : reste à payer, prises soldées, statut.
 * Aucune base, aucune horloge (le jour courant est passé en paramètre, AAAA-MM-JJ).
 * Un remboursement qui dépasse le total des prises n'est imputé nulle part : le reste ne descend jamais sous zéro.
 */
export type StatutCreditRegle = "EN_COURS" | "EN_RETARD" | "SOLDE";

export interface PriseCalcul {
  venteId: string;
  total: number;
  annulee: boolean;
  dateLimite: string | null;
  /** ISO : ordre d'imputation des remboursements (plus ancienne d'abord, puis identifiant). */
  createdAt: string;
}

export interface PriseRepartie extends PriseCalcul {
  rembourse: number;
  reste: number;
  nonSoldee: boolean;
}

export interface EtatCredit {
  resteAPayer: number;
  totalPris: number;
  totalRembourse: number;
  statut: StatutCreditRegle;
  dateLimiteProche: string | null;
  prises: PriseRepartie[];
}

export function repartirRemboursements(prises: readonly PriseCalcul[], totalRembourse: number): PriseRepartie[] {
  const ordre = [...prises].sort(
    (a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0) || (a.venteId < b.venteId ? -1 : a.venteId > b.venteId ? 1 : 0),
  );
  let disponible = Math.max(0, totalRembourse);
  const parId = new Map<string, PriseRepartie>();
  for (const p of ordre) {
    if (p.annulee) {
      parId.set(p.venteId, { ...p, rembourse: 0, reste: 0, nonSoldee: false });
      continue;
    }
    const rembourse = Math.min(disponible, p.total);
    disponible -= rembourse;
    const reste = p.total - rembourse;
    parId.set(p.venteId, { ...p, rembourse, reste, nonSoldee: reste > 0 });
  }
  return prises.map((p) => parId.get(p.venteId) as PriseRepartie);
}

export function calculerEtatCredit(prises: readonly PriseCalcul[], totalRembourse: number, aujourdhui: string): EtatCredit {
  const reparties = repartirRemboursements(prises, totalRembourse);
  const totalPris = reparties.filter((p) => !p.annulee).reduce((s, p) => s + p.total, 0);
  const resteAPayer = reparties.reduce((s, p) => s + p.reste, 0);
  const dates = reparties
    .filter((p) => p.nonSoldee)
    .map((p) => p.dateLimite)
    .filter((d): d is string => d !== null)
    .sort();
  let statut: StatutCreditRegle = "EN_COURS";
  if (resteAPayer <= 0) statut = "SOLDE";
  else if (dates.some((d) => d < aujourdhui)) statut = "EN_RETARD";
  return { resteAPayer, totalPris, totalRembourse: Math.max(0, totalRembourse), statut, dateLimiteProche: dates[0] ?? null, prises: reparties };
}

/** Noms distincts, dans l'ordre, tronqués : « A, B, C et 2 autres ». */
export function resumerMedicaments(noms: readonly string[], max = 3): string {
  const distincts = [...new Set(noms.map((n) => n.trim()).filter(Boolean))];
  if (distincts.length <= max) return distincts.join(", ");
  const reste = distincts.length - max;
  return `${distincts.slice(0, max).join(", ")} et ${reste} autre${reste > 1 ? "s" : ""}`;
}

/** Texte de recherche normalisé : minuscules, sans accents, sans espace de bord. */
export function normaliser(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** Chiffres seuls d'un téléphone (recherche tolérante aux espaces, + et tirets). */
export function chiffres(texte: string): string {
  return texte.replace(/\D/g, "");
}
