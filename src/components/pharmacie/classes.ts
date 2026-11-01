/**
 * Classes visuelles partagées des écrans de la pharmacie, reprises de la page « Nouvelle vente » (D693).
 */
export const POLICE_TITRE = { fontFamily: "var(--font-outfit, var(--font-inter))" } as const;

export const CARTE = "bg-white dark:bg-[#0f172a]/80 border border-slate-200 dark:border-slate-800/50 rounded-3xl p-6";
export const CHAMP =
  "w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm text-slate-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 transition-all";
export const FOCUS = "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500";
export const BOUTON_PRIMAIRE = `inline-flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl text-sm font-bold transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${FOCUS}`;
export const BOUTON_ICONE = `p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${FOCUS}`;
export const BOUTON_SECONDAIRE = `px-4 py-3 rounded-2xl text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors ${FOCUS}`;

export const ALERTE_ERREUR = "flex items-center gap-3 p-4 rounded-2xl bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 text-sm";
export const ALERTE_ATTENTION = "flex items-center gap-3 p-4 rounded-2xl bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 text-sm";
export const ALERTE_INFO = "flex items-center gap-3 p-4 rounded-2xl bg-primary-50 dark:bg-primary-500/15 text-primary-700 dark:text-primary-300 text-sm";
export const ALERTE_SUCCES = "flex items-center gap-3 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-sm";
