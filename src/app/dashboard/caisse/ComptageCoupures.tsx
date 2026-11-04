"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import type { Coupure, LigneComptage } from "@/lib/api_caisse";
import { formaterGNF } from "@/lib/format_gnf";
import { CHAMP } from "@/components/pharmacie/classes";
import { NOMBRE_MAX_BILLETS, totalComptage } from "./comptage";

interface ComptageCoupuresProps {
  coupures: Coupure[];
  valeur: LigneComptage[];
  onChange: (lignes: LigneComptage[]) => void;
  /** Appelé par Entrée dans le dernier champ. */
  onTermine: () => void;
  desactive?: boolean;
  legende: string;
}

/** Chiffres seuls, entier de 0 à 10 000 ; un champ vide compte 0. */
function nombreDepuisTexte(texte: string): number {
  const chiffres = texte.replace(/\D/g, "");
  if (chiffres === "") return 0;
  return Math.min(Number.parseInt(chiffres, 10), NOMBRE_MAX_BILLETS);
}

/** Comptage des billets par coupure, au clavier : Entrée passe à la coupure suivante. */
export function ComptageCoupures({ coupures, valeur, onChange, onTermine, desactive = false, legende }: ComptageCoupuresProps) {
  const champs = useRef<(HTMLInputElement | null)[]>([]);
  const ordonnees = [...coupures].sort((a, b) => a.ordre - b.ordre);

  useEffect(() => {
    champs.current[0]?.focus();
  }, []);

  const changer = (valeurFaciale: number, texte: string) => {
    const nombre = nombreDepuisTexte(texte);
    const existe = valeur.some((l) => l.valeurFaciale === valeurFaciale);
    onChange(
      existe
        ? valeur.map((l) => (l.valeurFaciale === valeurFaciale ? { ...l, nombre } : l))
        : [...valeur, { valeurFaciale, nombre }],
    );
  };

  const surTouche = (e: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (index < ordonnees.length - 1) champs.current[index + 1]?.focus();
    else onTermine();
  };

  return (
    <fieldset disabled={desactive} className="space-y-3 min-w-0">
      <legend className="text-sm font-bold text-slate-900 dark:text-white mb-2">{legende}</legend>
      {ordonnees.map((c, index) => {
        const nombre = valeur.find((l) => l.valeurFaciale === c.valeurFaciale)?.nombre ?? 0;
        const libelle = formaterGNF(c.valeurFaciale);
        return (
          <div key={c.valeurFaciale} className="flex items-center gap-3">
            <span className="flex-1 text-sm text-slate-700 dark:text-slate-300">Billets de {libelle}</span>
            <input
              ref={(el) => {
                champs.current[index] = el;
              }}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              aria-label={`Nombre de billets de ${libelle}`}
              value={String(nombre)}
              onChange={(e) => changer(c.valeurFaciale, e.target.value)}
              onFocus={(e) => e.target.select()}
              onKeyDown={(e) => surTouche(e, index)}
              className={`${CHAMP} !w-24 text-right`}
            />
            <span className="w-32 text-right text-sm font-medium text-slate-900 dark:text-white">
              {formaterGNF(c.valeurFaciale * nombre)}
            </span>
          </div>
        );
      })}
      <p aria-live="polite" className="pt-2 text-sm font-bold text-slate-900 dark:text-white">
        Total compté : {formaterGNF(totalComptage(valeur))}
      </p>
    </fieldset>
  );
}
