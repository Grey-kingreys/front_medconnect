import type { MetadataRoute } from "next";

// Pages de contenu, villes et services prévus pour le référencement : à réactiver
// (les ajouter à la sortie de sitemap()) quand les pages existeront sous src/app/.
// Non exportée : un fichier de métadonnées Next n'expose que sa fonction par défaut.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const ROUTES_A_REACTIVER = {
  contenu: ["/about", "/features", "/pricing", "/contact", "/faq", "/privacy", "/terms"],
  villes: ["conakry", "labe", "kindia", "kankan", "nzerekore", "boke", "mamou", "faranah"].map(
    (ville) => `/locations/${ville}`
  ),
  services: [
    "carnet-sante",
    "diagnostic-ia",
    "pharmacie-ligne",
    "urgences",
    "geolocalisation",
    "teleconsultation",
  ].map((service) => `/services/${service}`),
};

/**
 * Sitemap pour MedConnecte Guinée
 * Ne liste que les pages publiques qui existent réellement.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://medconnecte.com";
  const currentDate = new Date();

  // Accueil et catalogue public
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: currentDate,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/catalogue`,
      lastModified: currentDate,
      changeFrequency: "weekly",
      priority: 0.8,
    },
  ];

  // Connexion et inscription
  const authRoutes: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/auth/login`,
      lastModified: currentDate,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/auth/register`,
      lastModified: currentDate,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/auth/forgot-password`,
      lastModified: currentDate,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];

  // Pages légales
  const legalRoutes: MetadataRoute.Sitemap = ["/cgu", "/confidentialite", "/mentions-legales", "/rgpd"].map(
    (route) => ({
      url: `${baseUrl}${route}`,
      lastModified: currentDate,
      changeFrequency: "yearly" as const,
      priority: 0.3,
    })
  );

  return [...staticRoutes, ...authRoutes, ...legalRoutes];
}
