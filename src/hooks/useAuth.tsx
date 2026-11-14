"use client";

// Dette préexistante, backlog points 21 et 22
/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  AuthUser,
  UserProfile,
  LoginResponse,
  RegisterResponse,
  getMe,
  logout as apiLogout,
  refreshAccessToken,
  verifyToken,
  ApiError,
} from "@/lib/api_auth";
import { EVENEMENT_DECONNEXION_FORCEE } from "@/lib/deconnexion_forcee";
import { pontDesktop } from "@/lib/caisse/contrat_desktop";
import { deconnecterPoste, panneReseauDesktop, pousserJeton } from "@/lib/connexion_desktop";
import { DeleteConfirmModal } from "@/components/modals/DeleteConfirmModal";
import { LogOut } from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────

interface AuthContextType {
  user: AuthUser | null;
  profile: UserProfile | null;
  loading: boolean;
  isAuthenticated: boolean;
  /** Appelé après un login/register réussi pour mettre à jour le state immédiatement */
  loginUser: (data: LoginResponse | RegisterResponse) => void;
  refreshProfile: () => Promise<void>;
  logout: () => Promise<void>;
}

/** Utilisateur d'affichage tiré d'un profil (reprise desktop sans stockage), mêmes champs que `refreshProfile`. */
function utilisateurDepuisProfil(p: UserProfile): AuthUser {
  return {
    id: p.id,
    email: p.email,
    nom: p.nom,
    prenom: p.prenom,
    telephone: p.telephone,
    dateNaissance: p.dateNaissance,
    taille: p.taille,
    poids: p.poids,
    role: p.role,
    structureId: p.structureId,
  };
}

// ─── Cookie témoin de session ───────────────────────────────────
// `mc_connecte=1` ne contient aucun secret : il indique seulement à `src/proxy.ts`
// qu'une session existe côté client (vérification optimiste, l'API reste juge).

function poserCookieConnecte() {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `mc_connecte=1; path=/; max-age=${30 * 24 * 60 * 60}; SameSite=Lax${secure}`;
}

function supprimerCookieConnecte() {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `mc_connecte=; path=/; max-age=0; SameSite=Lax${secure}`;
}

// ─── Context ────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAuthenticated: false,
  loginUser: () => {},
  refreshProfile: async () => {},
  logout: async () => {},
});

// ─── Provider ───────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("user");
      try { return stored ? JSON.parse(stored) : null; } catch { return null; }
    }
    return null;
  });
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(() => {
    if (typeof window !== "undefined") {
      return !localStorage.getItem("access_token");
    }
    return true;
  });

  // ── Application desktop : profil confirmé par le serveur, relu hors ligne (PD04b) ──
  // Repris seulement s'il est celui de l'utilisateur en session ; sinon, pas de reprise (profil nul, rien n'est purgé).
  const chargerProfilLocal = useCallback(async (): Promise<boolean> => {
    const pont = pontDesktop();
    if (!pont) return false;
    try {
      const local = await pont.profil.lire();
      const stocke = localStorage.getItem("user");
      const idSession = stocke ? (JSON.parse(stocke) as AuthUser).id : null;
      if (local && idSession && local.id === idSession) {
        setProfile(local);
        return true;
      }
    } catch {
      // Profil local illisible : aucune reprise
    }
    return false;
  }, []);

  // ── Récupérer le profil complet depuis l'API ──────────────────
  const refreshProfile = useCallback(async () => {
    try {
      const res = await getMe();
      setProfile(res.data);
      const u: AuthUser = {
        id: res.data.id,
        email: res.data.email,
        nom: res.data.nom,
        prenom: res.data.prenom,
        telephone: res.data.telephone,
        dateNaissance: res.data.dateNaissance,
        taille: res.data.taille,
        poids: res.data.poids,
        role: res.data.role,
        structureId: res.data.structureId,
      };
      setUser(u);
      localStorage.setItem("user", JSON.stringify(u));
      poserCookieConnecte();
    } catch (err) {
      // Si 404 (User non trouvé) ou 401 après refresh échoué → logout
      if (err instanceof ApiError && (err.status === 404 || err.status === 401)) {
        setUser(null);
        setProfile(null);
        localStorage.removeItem("access_token");
        localStorage.removeItem("user");
        supprimerCookieConnecte();
        deconnecterPoste();
        router.push("/auth/login");
        return;
      }

      // Application desktop : une panne de réseau ne purge rien, le profil vient de la base locale
      if (panneReseauDesktop(err)) {
        await chargerProfilLocal();
        return;
      }

      // Token principal expiré → tenter le refresh
      try {
        const refreshRes = await refreshAccessToken();
        localStorage.setItem("access_token", refreshRes.data.access_token);
        pousserJeton(refreshRes.data.access_token);
        // Réessayer
        const retryRes = await getMe();
        setProfile(retryRes.data);
        const u: AuthUser = {
          id: retryRes.data.id,
          email: retryRes.data.email,
          nom: retryRes.data.nom,
          prenom: retryRes.data.prenom,
          telephone: retryRes.data.telephone,
          dateNaissance: retryRes.data.dateNaissance,
          taille: retryRes.data.taille,
          poids: retryRes.data.poids,
          role: retryRes.data.role,
          structureId: retryRes.data.structureId,
        };
        setUser(u);
        localStorage.setItem("user", JSON.stringify(u));
        poserCookieConnecte();
      } catch (errRafraichissement) {
        if (panneReseauDesktop(errRafraichissement)) {
          await chargerProfilLocal();
          return;
        }
        // Session complètement expirée ou compte supprimé
        setUser(null);
        setProfile(null);
        localStorage.removeItem("access_token");
        localStorage.removeItem("user");
        supprimerCookieConnecte();
        deconnecterPoste();
      }
    }
  }, [router, chargerProfilLocal]);

  // ── Connexion : met à jour le state + localStorage immédiatement ──
  const loginUser = useCallback(
    (data: LoginResponse | RegisterResponse) => {
      // 1. Stocker l'access token (le refresh token vit dans un cookie httpOnly).
      localStorage.setItem("access_token", data.access_token);
      pousserJeton(data.access_token);
      localStorage.setItem("user", JSON.stringify(data.user));
      // Cookie témoin posé avant toute redirection vers /dashboard (garde de src/proxy.ts)
      poserCookieConnecte();

      // 2. Mettre à jour le state React (le contexte se propage partout)
      setUser(data.user);
      setProfile(null); // sera chargé en arrière-plan

      // 3. Charger le profil complet en arrière-plan (non bloquant)
      refreshProfile();
    },
    [refreshProfile]
  );

  // ── Déconnexion ───────────────────────────────────────────────
  const effectuerDeconnexion = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      // apiLogout vide le localStorage : retirer aussi le cookie témoin
      supprimerCookieConnecte();
      deconnecterPoste();
      setUser(null);
      setProfile(null);
      router.push("/auth/login");
    }
  }, [router]);

  // Application desktop, hors ligne : se déconnecter empêche de se reconnecter, le vendeur confirme d'abord
  const [confirmationHorsLigne, setConfirmationHorsLigne] = useState(false);
  const handleLogout = useCallback(async () => {
    const pont = pontDesktop();
    if (pont) {
      const etat = await pont.etat().catch(() => null);
      if (etat && !etat.enLigne) {
        setConfirmationHorsLigne(true);
        return;
      }
    }
    await effectuerDeconnexion();
  }, [effectuerDeconnexion]);

  // ── Déconnexion forcée (appareil déconnecté à distance, compte désactivé) ──
  // Le stockage est déjà vidé par deconnexionForcee : on vide l'état et on ouvre la connexion
  useEffect(() => {
    const surDeconnexionForcee = () => {
      supprimerCookieConnecte();
      deconnecterPoste();
      setUser(null);
      setProfile(null);
      router.push("/auth/login");
    };
    window.addEventListener(EVENEMENT_DECONNEXION_FORCEE, surDeconnexionForcee);
    return () => window.removeEventListener(EVENEMENT_DECONNEXION_FORCEE, surDeconnexionForcee);
  }, [router]);

  // ── Application desktop : obtenir un jeton pour le processus principal ──
  // Panne de réseau : rien à faire, le moteur réessaiera. Refus du serveur : session retirée, poste déconnecté.
  const rafraichirPourPoste = useCallback(async () => {
    // Sans utilisateur ni jeton en stockage (déconnecté), pas de refresh : le vendeur suivant ne reprend rien
    if (!localStorage.getItem("user") && !localStorage.getItem("access_token")) return;
    try {
      const res = await refreshAccessToken();
      localStorage.setItem("access_token", res.data.access_token);
      pousserJeton(res.data.access_token);
    } catch (err) {
      if (panneReseauDesktop(err)) return;
      if (err instanceof ApiError && err.status === 401) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user");
        supprimerCookieConnecte();
        deconnecterPoste();
        setUser(null);
        setProfile(null);
        router.push("/auth/login");
      }
    }
  }, [router]);

  // ── Vérification initiale de l'authentification ───────────────
  useEffect(() => {
    const checkAuth = async () => {
      console.log("[Auth] Checking session...");
      try {
        const token = localStorage.getItem("access_token");
        const storedUser = localStorage.getItem("user");

        // Application desktop : jeton retiré ou expiré mais utilisateur et profil local présents,
        // la session reste (reprise hors ligne) tant que le serveur n'a rien refusé
        // Stockage vide (autre origine, port changé) : la session d'affichage se rétablit du profil du pont, sans jeton
        const pont = pontDesktop();
        if (!token && pont) {
          try {
            const local = await pont.profil.lire();
            const reprise = storedUser ? (JSON.parse(storedUser) as AuthUser) : local ? utilisateurDepuisProfil(local) : null;
            if (local && reprise && local.id === reprise.id) {
              setUser(reprise);
              setProfile(local);
              localStorage.setItem("user", JSON.stringify(reprise));
              poserCookieConnecte();
              // Sans jeton, ni envoi ni contrôle du serveur : on en demande un tout de suite, une session refusée tombe ici.
              void rafraichirPourPoste();
              return;
            }
          } catch {
            // Profil ou utilisateur illisible : pas de reprise
          }
        }

        // Aucune déconnexion du poste ici : un stockage vide ne prouve pas que le serveur a refusé la session,
        // et des ventes peuvent attendre (l'identité du poste ne tombe que sur un refus ou une déconnexion volontaire)
        if (!token || !storedUser) {
          console.log("[Auth] No session found in storage");
          supprimerCookieConnecte();
          setUser(null);
          setProfile(null);
          return;
        }

        try {
          const parsed = JSON.parse(storedUser) as AuthUser;
          setUser(parsed);
          console.log("[Auth] User loaded from storage:", parsed.email);
          // Application desktop : le menu et les droits viennent du profil local tout de suite, sans attendre
          // les nouvelles tentatives du contrôle du jeton (plusieurs secondes sans réseau).
          if (pont) await chargerProfilLocal();
        } catch (e) {
          console.error("[Auth] Failed to parse stored user", e);
          setUser(null);
        }

        try {
          console.log("[Auth] Verifying token...");
          await verifyToken();
          await refreshProfile();
          console.log("[Auth] Session verified");
        } catch (errVerification) {
          // Application desktop : panne de réseau, la session reste, le profil vient de la base locale
          if (panneReseauDesktop(errVerification)) {
            pousserJeton(null);
            await chargerProfilLocal();
            return;
          }
          console.log("[Auth] Token invalid or expired, attempting refresh...");
          try {
            const refreshRes = await refreshAccessToken();
            localStorage.setItem("access_token", refreshRes.data.access_token);
            pousserJeton(refreshRes.data.access_token);
            await refreshProfile();
            console.log("[Auth] Session refreshed");
          } catch (errRafraichissement) {
            if (panneReseauDesktop(errRafraichissement)) {
              pousserJeton(null);
              await chargerProfilLocal();
              return;
            }
            console.warn("[Auth] Session expired completely");
            setUser(null);
            setProfile(null);
            localStorage.removeItem("access_token");
            localStorage.removeItem("user");
            supprimerCookieConnecte();
            deconnecterPoste();
          }
        }
      } catch (err) {
        console.error("[Auth] Fatal error during checkAuth", err);
      } finally {
        console.log("[Auth] Check complete, setting loading to false");
        setLoading(false);
      }
    };

    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isAuthenticated = !!user;

  // ── Rafraîchissement automatique en arrière-plan (Silent Refresh) ──
  useEffect(() => {
    if (!isAuthenticated) return;

    // Le token expire en 15 min, on le rafraîchit toutes les 12 min
    const interval = setInterval(async () => {
      console.log("[Auth] Silent refresh starting...");
      try {
        const refreshRes = await refreshAccessToken();
        localStorage.setItem("access_token", refreshRes.data.access_token);
        pousserJeton(refreshRes.data.access_token);
        poserCookieConnecte();
        console.log("[Auth] Silent refresh successful");
      } catch (err) {
        console.error("[Auth] Silent refresh failed", err);
      }
    }, 12 * 60 * 1000); 

    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // ── Application desktop : le processus principal demande un jeton (moteur de synchronisation) ──
  useEffect(() => {
    const pont = pontDesktop();
    if (!pont) return;
    return pont.surDemandeJeton(() => {
      void rafraichirPourPoste();
    });
  }, [rafraichirPourPoste]);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // ── Redirection automatique si non connecté sur page protégée ──
  useEffect(() => {
    if (!mounted || loading) return;

    const isProtectedRoute =
      pathname?.startsWith("/dashboard") || pathname?.startsWith("/profil");
    const isAuthRoute = pathname?.startsWith("/auth");

    if (!user && isProtectedRoute) {
      router.push("/auth/login");
    }

    // Si connecté et sur une page auth, rediriger vers le dashboard
    // (cookie témoin posé d'abord, sinon src/proxy.ts renverrait ici en boucle
    // un utilisateur connecté avant l'introduction du cookie)
    if (user && isAuthRoute) {
      poserCookieConnecte();
      router.push("/dashboard");
    }
  }, [user, loading, pathname, router, mounted]);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        isAuthenticated,
        loginUser,
        refreshProfile,
        logout: handleLogout,
      }}
    >
      {children}
      <DeleteConfirmModal
        isOpen={confirmationHorsLigne}
        onClose={() => setConfirmationHorsLigne(false)}
        onConfirm={async () => {
          // Hors ligne, l'appel de déconnexion échoue mais la session locale est déjà retirée
          await effectuerDeconnexion().catch(() => {});
        }}
        title="Se déconnecter sans connexion ?"
        description="Sans connexion, vous ne pourrez pas vous reconnecter tant qu'internet n'est pas revenu. Les ventes de ce poste restent enregistrées."
        confirmLabel="Se déconnecter"
        libelleEnCours="Déconnexion..."
        libelleAnnuler="Rester connecté"
        icone={LogOut}
      />
    </AuthContext.Provider>
  );
}

// ─── Hook ───────────────────────────────────────────────────────

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth doit être utilisé dans un AuthProvider");
  }
  return context;
}

/**
 * Traitement unique du succès d'une connexion (formulaire ou compte de démonstration) :
 * stockage du jeton et de l'utilisateur, cookie témoin, profil chargé en arrière-plan
 * (via `loginUser`), puis direction le tableau de bord, qui s'adapte au rôle.
 */
export function useTerminerConnexion() {
  const { loginUser } = useAuth();
  const router = useRouter();
  return useCallback(
    (data: LoginResponse) => {
      loginUser(data);
      router.push("/dashboard");
    },
    [loginUser, router]
  );
}
