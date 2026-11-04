// Cookie de refresh de la session Electron, retiré à la déconnexion (D756) : sans cela, le vendeur suivant
// hériterait d'un refresh valide au retour du réseau. Aucun import d'electron : l'objet `cookies` est donné par l'appelant.

export interface CookieSession {
  name: string;
  domain?: string;
  path?: string;
  secure?: boolean;
}

export interface CookiesSession {
  get(filtre: { name: string }): Promise<CookieSession[]>;
  remove(url: string, name: string): Promise<void>;
}

export const NOM_COOKIE_REFRESH = "refresh_token";

/** Retire chaque cookie de refresh de la session, quel que soit son domaine. Renvoie le nombre retiré ; ne lève jamais. */
export async function retirerCookieRefresh(cookies: CookiesSession): Promise<number> {
  let retires = 0;
  try {
    for (const c of await cookies.get({ name: NOM_COOKIE_REFRESH })) {
      const hote = (c.domain ?? "").replace(/^\./, "");
      if (hote === "") continue;
      try {
        await cookies.remove(`${c.secure ? "https" : "http"}://${hote}${c.path ?? "/"}`, NOM_COOKIE_REFRESH);
        retires += 1;
      } catch {
        // Ce cookie reste : on continue avec les autres
      }
    }
  } catch {
    // Session indisponible : rien à retirer
  }
  return retires;
}

/**
 * Retire le cookie puis relit la session : un échec silencieux laisserait le cookie (production : `SameSite=None; Secure`).
 * Vrai si tout est retiré. Journal sans valeur ni domaine. Le vendeur suivant n'en hérite pas pour autant : aucun refresh
 * ne part sans utilisateur en stockage, et sa propre connexion remplace le cookie.
 */
export async function retirerEtControlerCookieRefresh(cookies: CookiesSession, journal: (message: string) => void): Promise<boolean> {
  await retirerCookieRefresh(cookies);
  try {
    const restants = (await cookies.get({ name: NOM_COOKIE_REFRESH })).length;
    if (restants === 0) return true;
    journal(`cookie de refresh non retiré à la déconnexion (${restants})`);
  } catch {
    journal("cookie de refresh : contrôle impossible à la déconnexion");
  }
  return false;
}
