import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/components/ThemeProvider";

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
  title: {
    default: "MedConnect — Votre santé connectée",
    template: "%s | MedConnect",
  },
  description:
    "MedConnect : votre carnet de santé numérique, géolocalisation médicale, urgences, auto-diagnostic IA et pharmacie en ligne. Améliorez votre accès aux soins.",
  keywords: [
    "santé",
    "carnet de santé",
    "médecin",
    "pharmacie",
    "urgence",
    "IA",
    "diagnostic",
    "géolocalisation",
    "PWA",
    "MedConnect",
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
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
