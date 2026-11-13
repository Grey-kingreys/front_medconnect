"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { WifiOff } from "lucide-react";

/** Hors ligne, l'accueil du tableau de bord mène à la vente (D744). Monté seulement dans ce cas. */
export function VersLaVente() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard/vente");
  }, [router]);
  return null;
}

/** Remplace une page qui demande le réseau quand le poste est hors ligne (même mise en page que PageNonDisponible). */
export default function ActionEnLigne() {
  return (
    <section
      aria-labelledby="titre-action-en-ligne"
      className="max-w-xl mx-auto mt-8 bg-white dark:bg-[#0f172a]/80 border border-slate-200 dark:border-slate-800/50 rounded-2xl p-6 sm:p-8 text-center"
    >
      <div className="mx-auto mb-4 w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800/50 flex items-center justify-center text-slate-500 dark:text-slate-400">
        <WifiOff className="w-6 h-6" aria-hidden="true" />
      </div>
      <h1
        id="titre-action-en-ligne"
        className="text-lg font-semibold text-slate-900 dark:text-white mb-2"
        style={{ fontFamily: "var(--font-outfit, var(--font-inter))" }}
      >
        Cette action demande une connexion.
      </h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
        Réception, inventaire, clôture, rapports, fiches et prix se font avec internet. Les ventes et la caisse continuent sur ce poste.
      </p>
      <Link
        href="/dashboard/vente"
        className="inline-flex px-4 py-2 rounded-xl text-sm font-medium bg-primary-500/10 text-primary-700 dark:text-primary-400 hover:bg-primary-500/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
      >
        Aller à la vente
      </Link>
    </section>
  );
}
