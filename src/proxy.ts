/**
 * Garde serveur (Next.js 16 : `proxy` remplace `middleware`).
 *
 * Tableau de bord : vérification optimiste uniquement. On regarde la présence du
 * cookie témoin `mc_connecte` (posé par `src/hooks/useAuth.tsx`, sans aucun secret)
 * et on renvoie vers la page de connexion s'il manque. Cela évite d'afficher le
 * tableau de bord à un visiteur non connecté. L'autorisation réelle reste faite par
 * l'API sur chaque requête (jeton Bearer) : un cookie témoin forgé ne donne accès à
 * aucune donnée. Pas d'appel réseau ici, et pas d'en-têtes de sécurité (ils sont dans
 * next.config.ts).
 *
 * `/debug` : outil interne, 404 en production. `src/app/debug/layout.tsx` appelle déjà
 * `notFound()`, mais le `loading.tsx` racine ouvre une frontière Suspense : la réponse
 * part en streaming avec un statut 200. Seul le proxy peut fixer un vrai statut 404.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/debug")) {
    if (process.env.NODE_ENV === "production") {
      return new NextResponse(null, { status: 404 });
    }
    return NextResponse.next();
  }

  if (!request.cookies.has("mc_connecte")) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard", "/dashboard/:path*", "/debug", "/debug/:path*"],
};
