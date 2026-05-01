"use client";

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
        role: res.data.role,
        structureId: res.data.structureId,
      };
      setUser(u);
      localStorage.setItem("user", JSON.stringify(u));
    } catch (err) {
      // Si 404 (User non trouvé) ou 401 après refresh échoué → logout
      if (err instanceof ApiError && (err.status === 404 || err.status === 401)) {
        setUser(null);
        setProfile(null);
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("user");
        router.push("/auth/login");
        return;
      }

      // Token principal expiré → tenter le refresh
      try {
        const refreshRes = await refreshAccessToken();
        localStorage.setItem("access_token", refreshRes.data.access_token);
        localStorage.setItem("refresh_token", refreshRes.data.refresh_token);
        // Réessayer
        const retryRes = await getMe();
        setProfile(retryRes.data);
        const u: AuthUser = {
          id: retryRes.data.id,
          email: retryRes.data.email,
          nom: retryRes.data.nom,
          prenom: retryRes.data.prenom,
          telephone: retryRes.data.telephone,
          role: retryRes.data.role,
          structureId: retryRes.data.structureId,
        };
        setUser(u);
        localStorage.setItem("user", JSON.stringify(u));
      } catch (refreshErr) {
        // Session complètement expirée ou compte supprimé
        setUser(null);
        setProfile(null);
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("user");
      }
    }
  }, [router]);

  // ── Connexion : met à jour le state + localStorage immédiatement ──
  const loginUser = useCallback(
    (data: LoginResponse | RegisterResponse) => {
      // 1. Stocker les tokens
      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("refresh_token", data.refreshToken);
      localStorage.setItem("user", JSON.stringify(data.user));

      // 2. Mettre à jour le state React (le contexte se propage partout)
      setUser(data.user);
      setProfile(null); // sera chargé en arrière-plan

      // 3. Charger le profil complet en arrière-plan (non bloquant)
      refreshProfile();
    },
    [refreshProfile]
  );

  // ── Déconnexion ───────────────────────────────────────────────
  const handleLogout = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      setUser(null);
      setProfile(null);
      router.push("/auth/login");
    }
  }, [router]);

  // ── Vérification initiale de l'authentification ───────────────
  useEffect(() => {
    const checkAuth = async () => {
      console.log("[Auth] Checking session...");
      try {
        const token = localStorage.getItem("access_token");
        const storedUser = localStorage.getItem("user");

        if (!token || !storedUser) {
          console.log("[Auth] No session found in storage");
          setUser(null);
          setProfile(null);
          return;
        }

        try {
          const parsed = JSON.parse(storedUser) as AuthUser;
          setUser(parsed);
          console.log("[Auth] User loaded from storage:", parsed.email);
        } catch (e) {
          console.error("[Auth] Failed to parse stored user", e);
          setUser(null);
        }

        try {
          console.log("[Auth] Verifying token...");
          await verifyToken();
          await refreshProfile();
          console.log("[Auth] Session verified");
        } catch {
          console.log("[Auth] Token invalid or expired, attempting refresh...");
          try {
            const refreshRes = await refreshAccessToken();
            localStorage.setItem("access_token", refreshRes.data.access_token);
            localStorage.setItem("refresh_token", refreshRes.data.refresh_token);
            await refreshProfile();
            console.log("[Auth] Session refreshed");
          } catch {
            console.warn("[Auth] Session expired completely");
            setUser(null);
            setProfile(null);
            localStorage.removeItem("access_token");
            localStorage.removeItem("refresh_token");
            localStorage.removeItem("user");
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

    // Le token expire en 15 min, on le rafraîchit toutes les 13 min
    const interval = setInterval(async () => {
      console.log("[Auth] Silent refresh starting...");
      try {
        const refreshRes = await refreshAccessToken();
        localStorage.setItem("access_token", refreshRes.data.access_token);
        localStorage.setItem("refresh_token", refreshRes.data.refresh_token);
        console.log("[Auth] Silent refresh successful");
      } catch (err) {
        console.error("[Auth] Silent refresh failed", err);
      }
    }, 13 * 60 * 1000); 

    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // ── Redirection automatique si non connecté sur page protégée ──
  useEffect(() => {
    if (loading) return;

    const isProtectedRoute =
      pathname?.startsWith("/dashboard") || pathname?.startsWith("/profil");
    const isAuthRoute = pathname?.startsWith("/auth");

    if (!user && isProtectedRoute) {
      router.push("/auth/login");
    }

    // Si connecté et sur une page auth, rediriger vers le dashboard
    if (user && isAuthRoute) {
      router.push("/dashboard");
    }
  }, [user, loading, pathname, router]);

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
