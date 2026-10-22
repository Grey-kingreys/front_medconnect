"use client";

import { useRef, useState } from "react";
import { Ban, Loader2 } from "lucide-react";
import { useDialogA11y } from "@/hooks/useDialogA11y";
import { formaterGNF } from "@/lib/format_gnf";
import { LONGUEUR_MAX_MOTIF, motifValide } from "./affichage";

const CHAMP =
  "w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm text-slate-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 transition-all";
const FOCUS = "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500";

interface AnnulationVenteProps {
  isOpen: boolean;
  numero: string;
  total: number;
  envoiEnCours: boolean;
  erreur: string | null;
  onClose: () => void;
  onConfirmer: (motif: string) => void;
}

type ProprietesDialogue = ReturnType<typeof useDialogA11y>["dialogProps"];

interface ContenuProps extends Omit<AnnulationVenteProps, "isOpen"> {
  dialogProps: ProprietesDialogue;
  titleId: string;
}

/** Contenu du dialogue : monté à chaque ouverture, donc le motif repart toujours à vide. */
function ContenuAnnulation({
  numero,
  total,
  envoiEnCours,
  erreur,
  onClose,
  onConfirmer,
  dialogProps,
  titleId,
}: ContenuProps) {
  const [motif, setMotif] = useState("");
  const [motifRefuse, setMotifRefuse] = useState(false);
  const champ = useRef<HTMLTextAreaElement>(null);

  const confirmer = () => {
    if (!motifValide(motif)) {
      setMotifRefuse(true);
      champ.current?.focus();
      return;
    }
    onConfirmer(motif.trim());
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={envoiEnCours ? undefined : onClose} aria-hidden="true" />
      <div
        {...dialogProps}
        className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 animate-slide-up"
      >
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-500/15 flex items-center justify-center shrink-0">
              <Ban className="w-6 h-6 text-rose-700 dark:text-rose-300" aria-hidden="true" />
            </div>
            <h3 id={titleId} className="text-xl font-bold text-slate-900 dark:text-white">
              Annuler la vente {numero} ?
            </h3>
          </div>

          <div className="space-y-2 text-sm text-slate-700 dark:text-slate-200">
            <p className="font-bold text-slate-900 dark:text-white">Montant : {formaterGNF(total)}</p>
            <p>
              Les quantités seront remises dans votre stock. La vente restera visible dans la liste, marquée « Annulée ».
            </p>
          </div>

          <div>
            <label htmlFor="motif-annulation" className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">
              Motif de l&apos;annulation
            </label>
            <textarea
              ref={champ}
              id="motif-annulation"
              rows={3}
              maxLength={LONGUEUR_MAX_MOTIF}
              value={motif}
              onChange={(e) => {
                setMotif(e.target.value);
                setMotifRefuse(false);
              }}
              aria-describedby="aide-motif"
              className={CHAMP}
            />
            <div className="flex items-center justify-between gap-3 mt-1 text-xs text-slate-600 dark:text-slate-400">
              <p id="aide-motif">Entre 3 et 300 caractères.</p>
              <p>
                {motif.length} / {LONGUEUR_MAX_MOTIF}
              </p>
            </div>
            {motifRefuse && (
              <p role="alert" className="text-sm text-rose-700 dark:text-rose-300 mt-1">
                Indiquez un motif de 3 à 300 caractères.
              </p>
            )}
          </div>

          {erreur && (
            <div role="alert" className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 text-sm">
              {erreur}
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row gap-3 w-full">
            <button
              type="button"
              onClick={onClose}
              disabled={envoiEnCours}
              className={`flex-1 px-4 py-3 rounded-2xl text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors disabled:opacity-50 ${FOCUS}`}
            >
              Garder la vente
            </button>
            <button
              type="button"
              onClick={confirmer}
              disabled={envoiEnCours}
              className={`flex-[2] flex items-center justify-center gap-2 px-4 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-sm font-bold transition-colors disabled:opacity-60 ${FOCUS}`}
            >
              {envoiEnCours && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              {envoiEnCours ? "Annulation..." : "Annuler la vente"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Dialogue qui demande le motif avant d'annuler une vente du jour. */
export function AnnulationVente({ isOpen, onClose, envoiEnCours, ...reste }: AnnulationVenteProps) {
  const { dialogProps, titleId } = useDialogA11y({ isOpen, onClose, closeOnEscape: !envoiEnCours });

  if (!isOpen) return null;

  return (
    <ContenuAnnulation
      {...reste}
      onClose={onClose}
      envoiEnCours={envoiEnCours}
      dialogProps={dialogProps}
      titleId={titleId}
    />
  );
}
