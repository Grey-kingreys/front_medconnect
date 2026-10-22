"use client";

import { Loader2, ShoppingCart } from "lucide-react";
import { useDialogA11y } from "@/hooks/useDialogA11y";
import { formaterGNF } from "@/lib/format_gnf";

interface ConfirmationVenteProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmer: () => void;
  envoiEnCours: boolean;
  lignes: { nom: string; quantite: number; prixUnitaire: number }[];
  total: number;
  client: string;
  ordonnanceVue: boolean;
}

/** Récapitulatif demandé avant d'enregistrer une vente : la vente retire les quantités du stock. */
export function ConfirmationVente({
  isOpen,
  onClose,
  onConfirmer,
  envoiEnCours,
  lignes,
  total,
  client,
  ordonnanceVue,
}: ConfirmationVenteProps) {
  const { dialogProps, titleId } = useDialogA11y({ isOpen, onClose, closeOnEscape: !envoiEnCours });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={envoiEnCours ? undefined : onClose} aria-hidden="true" />
      <div
        {...dialogProps}
        className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 animate-slide-up"
      >
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary-50 dark:bg-primary-500/15 flex items-center justify-center shrink-0">
              <ShoppingCart className="w-6 h-6 text-primary-700 dark:text-primary-300" aria-hidden="true" />
            </div>
            <h3 id={titleId} className="text-xl font-bold text-slate-900 dark:text-white">
              Valider la vente ?
            </h3>
          </div>

          <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-200">
            {lignes.map((ligne) => (
              <li key={ligne.nom} className="flex items-start justify-between gap-4">
                <span>
                  {ligne.quantite} × {ligne.nom}
                </span>
                <span className="whitespace-nowrap">{formaterGNF(ligne.prixUnitaire * ligne.quantite)}</span>
              </li>
            ))}
          </ul>

          <div className="space-y-1 border-t border-slate-200 dark:border-slate-800 pt-4 text-sm text-slate-700 dark:text-slate-200">
            <p className="font-bold text-slate-900 dark:text-white">Total : {formaterGNF(total)}</p>
            {client !== "" && <p>Client : {client}</p>}
            {ordonnanceVue && <p>Ordonnance vue</p>}
          </div>

          <p className="text-sm text-slate-600 dark:text-slate-300">Les quantités seront retirées de votre stock.</p>

          <div className="flex flex-col-reverse sm:flex-row gap-3 w-full">
            <button
              type="button"
              onClick={onClose}
              disabled={envoiEnCours}
              className="flex-1 px-4 py-3 rounded-2xl text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              Revenir au panier
            </button>
            <button
              type="button"
              onClick={onConfirmer}
              disabled={envoiEnCours}
              className="flex-[2] flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 transition-colors disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
            >
              {envoiEnCours && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              {envoiEnCours ? "Enregistrement..." : "Confirmer la vente"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
