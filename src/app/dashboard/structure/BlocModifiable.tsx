"use client";

import { useId } from "react";
import { AlertCircle, CheckCircle2, Loader2, Save } from "lucide-react";
import type { EtatBloc } from "./enregistrement";

const POLICE_TITRE = { fontFamily: "var(--font-outfit, var(--font-inter))" } as const;
const CARTE = "bg-white dark:bg-[#0f172a]/80 border border-slate-200 dark:border-slate-800/50 rounded-3xl p-6";
const FOCUS = "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500";
const BOUTON_PRIMAIRE = `inline-flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl text-sm font-bold transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${FOCUS}`;

interface BlocModifiableProps {
  titre: string;
  description?: string;
  /** false : pas de formulaire, pas de bouton, seulement l'affichage en lecture */
  modifiable: boolean;
  etat: EtatBloc;
  /** true si la saisie diffère des valeurs enregistrées */
  modifie: boolean;
  onEnregistrer: () => void;
  children: React.ReactNode;
}

/** Cadre d'un bloc de la page, avec son bouton « Enregistrer » toujours visible en bas. */
export function BlocModifiable({ titre, description, modifiable, etat, modifie, onEnregistrer, children }: BlocModifiableProps) {
  const idTitre = useId();
  const enCours = etat.statut === "enregistrement";

  const entete = (
    <>
      <h2 id={idTitre} className="text-lg font-bold text-slate-900 dark:text-white" style={POLICE_TITRE}>
        {titre}
      </h2>
      {description && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>}
    </>
  );

  return (
    <section aria-labelledby={idTitre} className={CARTE}>
      {modifiable ? (
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            onEnregistrer();
          }}
          className="space-y-5"
        >
          <div>{entete}</div>
          {children}
          <div className="space-y-3">
            <button type="submit" disabled={enCours || !modifie} className={BOUTON_PRIMAIRE}>
              {enCours ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  Enregistrement…
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" aria-hidden="true" />
                  Enregistrer
                </>
              )}
            </button>
            {etat.statut === "succes" && (
              <p role="status" className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                Modifications enregistrées.
              </p>
            )}
            {etat.statut === "erreur" && (
              <p role="alert" className="flex items-start gap-2 text-sm font-medium text-emergency-600 dark:text-emergency-400">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
                {etat.message}
              </p>
            )}
          </div>
        </form>
      ) : (
        <div className="space-y-5">
          <div>{entete}</div>
          {children}
        </div>
      )}
    </section>
  );
}
