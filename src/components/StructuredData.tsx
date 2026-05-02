"use client";

/**
 * Composant StructuredData — Données structurées JSON-LD
 * À importer dans le layout.tsx ou dans la page d'accueil
 */

export default function StructuredData() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://medconnect.kingreys.fr";

  // Schema Organization
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "MedicalOrganization",
    "@id": `${baseUrl}/#organization`,
    name: "MedConnect Guinée",
    url: baseUrl,
    logo: {
      "@type": "ImageObject",
      url: `${baseUrl}/images/logo.png`,
      width: 512,
      height: 512,
    },
    description:
      "Plateforme de santé numérique 360° en Guinée. Carnet de santé intelligent, diagnostic IA, pharmacie en ligne, urgences 24/7 et géolocalisation médicale.",
    telephone: "+224-622-000-000",
    email: "contact@kingreys.fr",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Quartier Kaloum",
      addressLocality: "Conakry",
      addressRegion: "Conakry",
      postalCode: "BP 1234",
      addressCountry: "GN",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: 9.6412,
      longitude: -13.5784,
    },
    sameAs: [
      "https://facebook.com/MedConnectGN",
      "https://twitter.com/MedConnectGN",
      "https://instagram.com/MedConnectGN",
      "https://linkedin.com/company/medconnect-gn",
    ],
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.8",
      reviewCount: "12847",
      bestRating: "5",
      worstRating: "1",
    },
    medicalSpecialty: [
      "Emergency Medicine",
      "General Practice",
      "Pharmacy",
      "Telemedicine",
    ],
  };

  // Schema MedicalWebPage (page d'accueil)
  const medicalWebPageSchema = {
    "@context": "https://schema.org",
    "@type": "MedicalWebPage",
    "@id": `${baseUrl}/#webpage`,
    url: baseUrl,
    name: "MedConnect — Plateforme de Santé Numérique en Guinée",
    description:
      "Carnet de santé numérique, diagnostic IA, pharmacie en ligne, urgences 24/7. Géolocalisez hôpitaux et cliniques à Conakry, Labé, Kindia.",
    inLanguage: "fr-GN",
    isPartOf: {
      "@type": "WebSite",
      "@id": `${baseUrl}/#website`,
      url: baseUrl,
      name: "MedConnect Guinée",
      publisher: {
        "@id": `${baseUrl}/#organization`,
      },
    },
    about: {
      "@type": "MedicalEntity",
      name: "Digital Health Platform",
    },
    audience: {
      "@type": "MedicalAudience",
      audienceType: "Patient",
      geographicArea: {
        "@type": "AdministrativeArea",
        name: "Guinée",
      },
    },
    lastReviewed: new Date().toISOString().split("T")[0],
    specialty: [
      "Emergency Medicine",
      "General Practice",
      "Digital Health",
      "Telemedicine",
    ],
  };

  // Schema WebApplication (PWA)
  const webApplicationSchema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "MedConnect",
    url: baseUrl,
    applicationCategory: "HealthApplication",
    operatingSystem: "All",
    description:
      "Application web progressive (PWA) pour gérer votre santé : carnet médical, diagnostic IA, pharmacie en ligne, urgences.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "GNF",
      availability: "https://schema.org/InStock",
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.8",
      reviewCount: "12847",
    },
    screenshot: `${baseUrl}/og-image.png`,
    featureList: [
      "Carnet de santé numérique",
      "Diagnostic par Intelligence Artificielle",
      "Géolocalisation des hôpitaux et pharmacies",
      "Urgences 24/7",
      "Pharmacie en ligne",
      "Mode hors-ligne",
      "Rappels de vaccination",
      "Gestion des ordonnances",
    ],
  };

  // Schema BreadcrumbList (navigation)
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Accueil",
        item: baseUrl,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Fonctionnalités",
        item: `${baseUrl}/#features`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: "Tarifs",
        item: `${baseUrl}/#pricing`,
      },
      {
        "@type": "ListItem",
        position: 4,
        name: "Connexion",
        item: `${baseUrl}/auth/login`,
      },
    ],
  };

  // Schema FAQPage
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "MedConnect est-il gratuit ?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Oui, MedConnect propose un plan gratuit comprenant le carnet de santé numérique, les guides de premiers secours, le bouton SOS d'urgence et la géolocalisation limitée.",
        },
      },
      {
        "@type": "Question",
        name: "Le diagnostic IA remplace-t-il une consultation médicale ?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Non. Le diagnostic IA de MedConnect est un outil d'orientation préliminaire. Il ne remplace en aucun cas une consultation avec un professionnel de santé qualifié.",
        },
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(organizationSchema),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(medicalWebPageSchema),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(webApplicationSchema),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbSchema),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqSchema),
        }}
      />
    </>
  );
}
