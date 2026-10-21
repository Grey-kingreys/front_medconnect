import Link from "next/link";
import { Lock } from "lucide-react";

export default function PageNonDisponible() {
  return (
    <section
      aria-labelledby="titre-page-non-disponible"
      className="max-w-xl mx-auto mt-8 bg-white dark:bg-[#0f172a]/80 border border-slate-200 dark:border-slate-800/50 rounded-2xl p-6 sm:p-8 text-center"
    >
      <div className="mx-auto mb-4 w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800/50 flex items-center justify-center text-slate-500 dark:text-slate-400">
        <Lock className="w-6 h-6" aria-hidden="true" />
      </div>
      <h1
        id="titre-page-non-disponible"
        className="text-lg font-semibold text-slate-900 dark:text-white mb-2"
        style={{ fontFamily: "var(--font-outfit, var(--font-inter))" }}
      >
        Cette page n&apos;est pas disponible pour votre compte.
      </h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
        Si vous pensez en avoir besoin, adressez-vous à l&apos;administrateur de votre établissement.
      </p>
      <Link
        href="/dashboard"
        className="inline-flex px-4 py-2 rounded-xl text-sm font-medium bg-primary-500/10 text-primary-700 dark:text-primary-400 hover:bg-primary-500/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
      >
        Retour à l&apos;accueil
      </Link>
    </section>
  );
}
