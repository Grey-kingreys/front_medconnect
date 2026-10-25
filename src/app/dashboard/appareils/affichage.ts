import type { AppareilConnecte } from "@/lib/api_appareils";

/** Libellé de la plateforme (D10). */
export function libellePlateforme(appareil: Pick<AppareilConnecte, "type" | "plateforme">): string {
  if (appareil.type === "web") return "Navigateur web";
  if (appareil.plateforme === "ios") return "Application iPhone";
  if (appareil.plateforme === "android") return "Application Android";
  return "Application mobile";
}

function debutDuJour(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Dernière activité en langage simple (D09), sans majuscule initiale (affiché après « Dernière activité : »). */
export function formaterDerniereActivite(iso: string, maintenant: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "inconnue";

  const ecartMs = maintenant.getTime() - date.getTime();
  if (ecartMs < 60_000) return "à l'instant";
  if (ecartMs < 3_600_000) {
    const n = Math.floor(ecartMs / 60_000);
    return n === 1 ? "il y a 1 minute" : `il y a ${n} minutes`;
  }

  const jours = Math.round((debutDuJour(maintenant) - debutDuJour(date)) / 86_400_000);
  const hh = date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  if (jours === 0) return `aujourd'hui à ${hh}`;
  if (jours === 1) return `hier à ${hh}`;
  if (jours < 7) return `il y a ${jours} jours`;
  return `le ${date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`;
}
