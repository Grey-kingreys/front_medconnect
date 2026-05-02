import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://medconnect.gn";

  return {
    title: "Diagnostic Médical par Intelligence Artificielle",
    description:
      "Obtenez un diagnostic préliminaire instantané grâce à notre IA médicale avancée. Analysez vos symptômes, recevez des recommandations et orientations vers les spécialistes en Guinée.",
    keywords: [
      "diagnostic IA Guinée",
      "intelligence artificielle médicale",
      "analyse symptômes en ligne",
      "diagnostic préliminaire Conakry",
      "assistant médical virtuel",
      "santé numérique Guinée",
      "orientation médicale IA",
      "télémédecine Guinée",
    ],
    openGraph: {
      title: "Diagnostic Médical IA — MedConnect Guinée",
      description:
        "Analysez vos symptômes avec notre IA médicale avancée. Diagnostic préliminaire instantané et orientation vers les spécialistes.",
      url: `${baseUrl}/dashboard/diagnostic`,
      siteName: "MedConnect Guinée",
      images: [
        {
          url: "/og-diagnostic-ia.png",
          width: 1200,
          height: 630,
          alt: "Diagnostic Médical par IA — MedConnect",
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Diagnostic Médical IA — MedConnect Guinée",
      description:
        "Analysez vos symptômes avec notre IA médicale. Diagnostic instantané et orientation.",
      images: ["/og-diagnostic-ia.png"],
    },
    alternates: {
      canonical: `${baseUrl}/dashboard/diagnostic`,
    },
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default function DiagnosticLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
