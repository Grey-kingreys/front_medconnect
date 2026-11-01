"use client";

import { useId } from "react";
import { formaterDateCourte, jourConakry } from "@/app/dashboard/ventes/affichage";
import type { UniteMinimale } from "@/lib/api_pharmacie";
import { formaterQuantite } from "@/lib/caisse/regles/quantites";
import { FOCUS } from "./classes";

export interface LotChoisissable {
  id: string;
  numeroLot: string | null;
  dateExpiration: string | null;
  quantite: number;
}

interface ChoixLotProps {
  lots: LotChoisissable[];
  valeur: string | null;
  onChange: (id: string) => void;
  legende: string;
  coefficient: number;
  unite: UniteMinimale;
}

/** Libellé d'un lot : « Lot DL23K052, périmé le 01/10/2026, 6 comprimés ». */
export function libelleLot(lot: LotChoisissable, coefficient: number, unite: UniteMinimale, aujourdhui: string): string {
  const numero = lot.numeroLot ? `Lot ${lot.numeroLot}` : "Lot sans numéro";
  let date = "sans date de péremption";
  if (lot.dateExpiration) {
    const perime = lot.dateExpiration.slice(0, 10) < aujourdhui;
    date = `${perime ? "périmé le" : "expire le"} ${formaterDateCourte(lot.dateExpiration)}`;
  }
  return `${numero}, ${date}, ${formaterQuantite(lot.quantite, coefficient, unite)}`;
}

/** Choix d'un lot parmi une liste : boutons radio natifs, utilisables aux flèches du clavier. */
export function ChoixLot({ lots, valeur, onChange, legende, coefficient, unite }: ChoixLotProps) {
  const nom = useId();
  const aujourdhui = jourConakry(new Date());
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">{legende}</legend>
      {lots.map((lot) => {
        const id = `${nom}-${lot.id}`;
        return (
          <div key={lot.id} className="flex items-start gap-3">
            <input
              id={id}
              type="radio"
              name={nom}
              value={lot.id}
              checked={valeur === lot.id}
              onChange={() => onChange(lot.id)}
              className={`mt-0.5 w-5 h-5 accent-primary-600 ${FOCUS}`}
            />
            <label htmlFor={id} className="text-sm text-slate-800 dark:text-slate-200">
              {libelleLot(lot, coefficient, unite, aujourdhui)}
            </label>
          </div>
        );
      })}
    </fieldset>
  );
}
