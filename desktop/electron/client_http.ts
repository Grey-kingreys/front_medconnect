// Client HTTP réel du moteur de synchronisation : `fetch` du processus principal (jamais du rendu).
// Le jeton est lu à chaque requête dans la mémoire du processus ; il n'est ni journalisé ni écrit.
import { gzipSync } from "node:zlib";
import type { ClientHttp, ReponseHttp } from "../coeur/synchro";

export const DELAI_REQUETE_MS = 30_000;
export const DELAI_PHOTOGRAPHIE_MS = 120_000;

export function creerClientHttp(options: { urlApi: string; jeton: () => string | null }): ClientHttp {
  const base = options.urlApi.replace(/\/+$/, "");
  return {
    async requete(methode, chemin, opts = {}): Promise<ReponseHttp> {
      const entetes: Record<string, string> = { Accept: "application/json", ...opts.entetes };
      const jeton = options.jeton();
      if (jeton !== null) entetes.Authorization = `Bearer ${jeton}`;

      let corps: Uint8Array | string | undefined = opts.corps;
      if (opts.corps !== undefined && opts.gzip === true) {
        corps = gzipSync(Buffer.from(opts.corps, "utf8"));
        entetes["Content-Encoding"] = "gzip";
      }
      const delai = chemin.includes("/synchro/catalogue") ? DELAI_PHOTOGRAPHIE_MS : DELAI_REQUETE_MS;
      // `fetch` décompresse br et gzip lui-même.
      const reponse = await fetch(`${base}${chemin}`, {
        method: methode,
        headers: entetes,
        body: corps as BodyInit | undefined,
        signal: AbortSignal.timeout(delai),
        redirect: "error",
      });
      const retour: Record<string, string> = {};
      reponse.headers.forEach((valeur, nom) => {
        retour[nom] = valeur;
      });
      return { status: reponse.status, entetes: retour, corps: await reponse.text() };
    },
  };
}
