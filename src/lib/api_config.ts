import { apiFetch } from "./api_auth";

/** Numéro servi si la configuration publique est illisible (même défaut que le back). */
export const NUMERO_URGENCE_PAR_DEFAUT = "15";

// Seuls chiffres, espaces et « + » : la valeur part dans un lien tel:
const NUMERO_VALIDE = /^\+?[0-9 ]{2,20}$/;

const estObjet = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

/**
 * Numéro d'urgence médicale lu dans GET /app/config (route publique).
 * Un seul essai, sans trace d'échec ; « 15 » en repli. Ne lève jamais d'exception.
 */
export async function getNumeroUrgenceMedicale(): Promise<string> {
  try {
    const res = await apiFetch<unknown>("/app/config", {}, { tentativeUnique: true, sansJournal: true });
    const data: unknown = res?.data;
    const liste = estObjet(data) ? data.numerosUrgence : undefined;
    if (Array.isArray(liste)) {
      const entree: unknown = liste.find((e: unknown) => estObjet(e) && e.code === "URGENCE_MEDICALE");
      if (estObjet(entree) && typeof entree.numero === "string") {
        const numero = entree.numero.trim();
        if (NUMERO_VALIDE.test(numero)) return numero;
      }
    }
  } catch {
    // repli ci-dessous
  }
  return NUMERO_URGENCE_PAR_DEFAUT;
}
