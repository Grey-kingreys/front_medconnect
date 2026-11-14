"use client";

import type { KeyboardEvent } from "react";
import { CHAMP } from "@/components/pharmacie/classes";
import { afficherSaisie, chiffresDepuisSaisie } from "./comptage";

interface ChampEspecesProps {
  id: string;
  legende: string;
  /** Chiffres seuls, vide tant que rien n'est saisi. */
  valeur: string;
  onChange: (chiffres: string) => void;
  /** Appelé par Entrée. */
  onTermine: () => void;
  desactive?: boolean;
  autoFocus?: boolean;
  aide?: string;
  /** Message d'erreur affiché sous le champ. */
  erreur?: string | null;
}

/** Un seul champ pour compter les espèces du tiroir : entier en GNF, lettres refusées, milliers acceptés. */
export function ChampEspeces({ id, legende, valeur, onChange, onTermine, desactive = false, autoFocus = false, aide, erreur = null }: ChampEspecesProps) {
  const surTouche = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    onTermine();
  };

  return (
    <div>
      <label htmlFor={id} className="block text-mc-normal font-semibold text-slate-900 dark:text-white mb-2">
        {legende}
      </label>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        autoFocus={autoFocus}
        disabled={desactive}
        value={afficherSaisie(valeur)}
        onChange={(e) => onChange(chiffresDepuisSaisie(e.target.value))}
        onFocus={(e) => e.target.select()}
        onKeyDown={surTouche}
        aria-describedby={[aide ? `${id}-aide` : null, erreur ? `${id}-erreur` : null].filter(Boolean).join(" ") || undefined}
        aria-invalid={erreur ? true : undefined}
        className={`${CHAMP} text-right`}
      />
      {aide && (
        <p id={`${id}-aide`} className="text-mc-legende text-slate-600 dark:text-slate-400 mt-1">
          {aide}
        </p>
      )}
      {erreur && (
        <p id={`${id}-erreur`} className="text-mc-legende text-red-700 dark:text-red-400 mt-1">
          {erreur}
        </p>
      )}
    </div>
  );
}
