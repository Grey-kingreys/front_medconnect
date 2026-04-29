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
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

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
        role: res.data.role,
        structureId: res.data.structureId,
      };
      setUser(u);
      localStorage.setItem("user", JSON.stringify(u));
    } catch {
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
          role: retryRes.data.role,
          structureId: retryRes.data.structureId,
        };
        setUser(u);
        localStorage.setItem("user", JSON.stringify(u));
      } catch {
        // Session complètement expirée
        setUser(null);
        setProfile(null);
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("user");
      }
    }
  }, []);

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
      setLoading(true);
      const token = localStorage.getItem("access_token");
      const storedUser = localStorage.getItem("user");

      if (!token || !storedUser) {
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      // Charger le user du localStorage immédiatement
      try {
        const parsed = JSON.parse(storedUser) as AuthUser;
        setUser(parsed);
      } catch {
        setUser(null);
      }

      // Vérifier le token et charger le profil complet
      try {
        await verifyToken();
        await refreshProfile();
      } catch {
        // Token expiré, tenter le refresh
        try {
          const refreshRes = await refreshAccessToken();
          localStorage.setItem("access_token", refreshRes.data.access_token);
          localStorage.setItem("refresh_token", refreshRes.data.refresh_token);
          await refreshProfile();
        } catch {
          // Session complètement expirée
          setUser(null);
          setProfile(null);
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
          localStorage.removeItem("user");
        }
      }

      setLoading(false);
    };

    checkAuth();
  }, [refreshProfile]);

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

  const isAuthenticated = !!user;

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
