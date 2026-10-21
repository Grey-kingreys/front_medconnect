import type { Metadata, Viewport } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/components/ThemeProvider";
import StructuredData from "@/components/StructuredData";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";


const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || "https://medconnecte.com"),
  title: {
    default: "MedConnecte — Plateforme de Santé Numérique en Guinée",
    template: "%s | MedConnecte Guinée",
  },
  manifest: "/manifest.json",
  description:
    "Carnet de santé numérique, diagnostic IA, pharmacie en ligne et urgences 24/7 en Guinée. Géolocalisez hôpitaux et cliniques à Conakry, Labé, Kindia. Gratuit, sécurisé, hors-ligne.",
  keywords: [
    "MedConnecte Guinée",
    "santé numérique Conakry",
    "carnet de santé électronique",
    "pharmacie en ligne Guinée",
    "diagnostic médical IA",
    "géolocalisation hôpital Conakry",
    "urgence médicale 24/7",
    "dossier médical numérique",
    "téléconsultation Guinée",
    "application santé Afrique",
    "gestion médicaments Guinée",
    "rappel vaccination",
    "premiers secours Guinée",
    "hôpital Conakry",
    "clinique Guinée",
    "ordonnance en ligne",
    "consultation médicale distance",
    "suivi médical digital",
  ],
  authors: [{ name: "MedConnecte Team", url: `${process.env.NEXT_PUBLIC_BASE_URL || "https://medconnecte.com"}/about` }],
  creator: "MedConnecte",
  publisher: "MedConnecte Guinée",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "fr_GN",
    url: process.env.NEXT_PUBLIC_BASE_URL || "https://medconnecte.com",
    siteName: "MedConnecte Guinée",
    title: "MedConnecte — Votre santé connectée en Guinée",
    description:
      "Carnet de santé intelligent, diagnostic IA, pharmacie digitale et urgences 24/7. La plateforme santé 360° pour la Guinée. Gratuit et sécurisé.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "MedConnecte — Plateforme de Santé Numérique Guinée",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MedConnecte — Santé Numérique en Guinée",
    description:
      "Carnet de santé intelligent, diagnostic IA, pharmacie en ligne et urgences 24/7. Gratuit, sécurisé, hors-ligne.",
    images: ["/og-image.png"],
    creator: "@MedConnecteGN",
    site: "@MedConnecteGN",
  },
  alternates: {
    canonical: process.env.NEXT_PUBLIC_BASE_URL || "https://medconnecte.com",
    languages: {
      "fr-GN": process.env.NEXT_PUBLIC_BASE_URL || "https://medconnecte.com",
      "fr": `${process.env.NEXT_PUBLIC_BASE_URL || "https://medconnecte.com"}/fr`,
    },
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || "",
  },
  category: "health",
  classification: "Healthcare Technology",
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "application-name": "MedConnecte",
    "msapplication-TileColor": "#3b82f6",
    "msapplication-config": "/browserconfig.xml",
    "twitter:domain": "medconnecte.com",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${inter.variable} ${outfit.variable} h-full antialiased`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-white text-slate-900 dark:bg-[#0f172a] dark:text-white transition-colors duration-300">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AuthProvider>
            <StructuredData />
            {children}
            {/* Remplace le script qui désinscrivait tous les service workers :
                l'ancien SW serwist est maintenant écrasé par un SW minimal sans
                cache, nécessaire à l'installabilité de la PWA. */}
            <ServiceWorkerRegistration />
          </AuthProvider>
        </ThemeProvider>

      </body>
    </html>
  );
}
