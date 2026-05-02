import type { MetadataRoute } from "next";

/**
 * Configuration robots.txt pour MedConnect Guinée
 * Optimisé pour le SEO et la sécurité
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://medconnect.kingreys.fr";

  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/auth/login",
          "/auth/register",
          "/auth/forgot-password",
        ],
        disallow: [
          "/api/",
          "/dashboard/",
          "/_next/",
          "/admin/",
          "/private/",
          "/auth/reset-password",
          "/auth/setup-structure/",
          "*.json",
          "/search?*",
        ],
      },
      {
        userAgent: "Googlebot",
        allow: [
          "/",
          "/auth/login",
          "/auth/register",
        ],
        disallow: [
          "/api/",
          "/dashboard/",
          "/admin/",
        ],
      },
      {
        // Empêcher l'indexation des bots malveillants
        userAgent: [
          "GPTBot",
          "ChatGPT-User",
          "CCBot",
          "anthropic-ai",
          "Claude-Web",
        ],
        disallow: ["/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
