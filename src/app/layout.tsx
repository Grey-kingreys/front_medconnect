import type { Metadata, Viewport } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/components/ThemeProvider";
import StructuredData from "@/components/StructuredData";

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
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || "https://medconnect.gn"),
  title: {
    default: "MedConnect — Plateforme de Santé Numérique en Guinée",
    template: "%s | MedConnect Guinée",
  },
  description:
    "Carnet de santé numérique, diagnostic IA, pharmacie en ligne et urgences 24/7 en Guinée. Géolocalisez hôpitaux et cliniques à Conakry, Labé, Kindia. Gratuit, sécurisé, hors-ligne.",
  keywords: [
    "MedConnect Guinée",
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
  authors: [{ name: "MedConnect Team", url: "https://medconnect.gn/about" }],
  creator: "MedConnect",
  publisher: "MedConnect Guinée",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "fr_GN",
    url: "https://medconnect.gn",
    siteName: "MedConnect Guinée",
    title: "MedConnect — Votre santé connectée en Guinée",
    description:
      "Carnet de santé intelligent, diagnostic IA, pharmacie digitale et urgences 24/7. La plateforme santé 360° pour la Guinée. Gratuit et sécurisé.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "MedConnect — Plateforme de Santé Numérique Guinée",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MedConnect — Santé Numérique en Guinée",
    description:
      "Carnet de santé intelligent, diagnostic IA, pharmacie en ligne et urgences 24/7. Gratuit, sécurisé, hors-ligne.",
    images: ["/og-image.png"],
    creator: "@MedConnectGN",
    site: "@MedConnectGN",
  },
  alternates: {
    canonical: "https://medconnect.gn",
    languages: {
      "fr-GN": "https://medconnect.gn",
      "fr": "https://medconnect.gn/fr",
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
    google: "your-google-verification-token",
  },
  category: "health",
  classification: "Healthcare Technology",
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "application-name": "MedConnect",
    "msapplication-TileColor": "#3b82f6",
    "msapplication-config": "/browserconfig.xml",
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
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-white text-slate-900 dark:bg-[#0f172a] dark:text-white transition-colors duration-300">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AuthProvider>
            <StructuredData />
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
