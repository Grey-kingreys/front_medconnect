"use client";

import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useDialogA11y } from "@/hooks/useDialogA11y";
import type { UniteMinimale } from "@/lib/api_pharmacie";
import { ChoixLot, type LotChoisissable } from "@/components/pharmacie/ChoixLot";
import { CHAMP, FOCUS } from "@/components/pharmacie/classes";
import { LONGUEUR_MAX_MOTIF, motifValide } from "../ventes/affichage";

interface SortieLotPerimeProps {
  isOpen: boolean;
  nom: string;
  lots: LotChoisissable[];
  coefficient: number;
  unite: UniteMinimale;
  envoiEnCours: boolean;
  /** Message du serveur à afficher dans le dialogue (motif manquant, lot vide). */
  erreur: string | null;
  onClose: () => void;
  onConfirmer: (lotId: string, motif: string) => void;
}

type ProprietesDialogue = ReturnType<typeof useDialogA11y>["dialogProps"];

interface ContenuProps extends Omit<SortieLotPerimeProps, "isOpen"> {
  dialogProps: ProprietesDialogue;
  titleId: string;
}

/** Contenu du dialogue : monté à chaque ouverture, donc le choix et le motif repartent toujours à vide. */
function ContenuSortie({
  nom,
  lots,
  coefficient,
  unite,
  envoiEnCours,
  erreur,
  onClose,
  onConfirmer,
  dialogProps,
  titleId,
}: ContenuProps) {
  const [lotId, setLotId] = useState<string | null>(null);
  const [motif, setMotif] = useState("");
  const [refuse, setRefuse] = useState(false);

  const confirmer = () => {
    if (lotId === null || !motifValide(motif)) {
      setRefuse(true);
      return;
    }
    onConfirmer(lotId, motif.trim());
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={envoiEnCours ? undefined : onClose} aria-hidden="true" />
      <div
        {...dialogProps}
        className="relative w-full max-w-md max-h-[90dvh] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 animate-slide-up"
      >
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-500/15 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-6 h-6 text-amber-700 dark:text-amber-300" aria-hidden="true" />
            </div>
            <h3 id={titleId} className="text-xl font-bold text-slate-900 dark:text-white">
              Sortie d&apos;un lot périmé
            </h3>
          </div>

          <p className="text-sm text-slate-700 dark:text-slate-200">
            Il ne reste que des boîtes périmées de {nom}. Choisissez le lot à sortir et indiquez pourquoi vous le vendez.
          </p>

          <ChoixLot
            lots={lots}
            valeur={lotId}
            onChange={(id) => {
              setLotId(id);
              setRefuse(false);
            }}
            legende="Lot à sortir"
            coefficient={coefficient}
            unite={unite}
          />

          <div>
            <label htmlFor="motif-sortie-lot" className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">
              Motif
            </label>
            <textarea
              id="motif-sortie-lot"
              rows={3}
              maxLength={LONGUEUR_MAX_MOTIF}
              value={motif}
              onChange={(e) => {
                setMotif(e.target.value);
                setRefuse(false);
              }}
              aria-describedby="aide-motif-sortie-lot"
              className={CHAMP}
            />
            <p id="aide-motif-sortie-lot" className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              Par exemple : demande du médecin, aucun autre lot disponible
            </p>
          </div>

          {refuse && (
            <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">
              Choisissez un lot et indiquez un motif de 3 caractères au moins.
            </p>
          )}
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
              Revenir au panier
            </button>
            <button
              type="button"
              onClick={confirmer}
              disabled={envoiEnCours}
              className={`flex-[2] flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl text-sm font-bold transition-colors disabled:opacity-60 ${FOCUS}`}
            >
              {envoiEnCours && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              {envoiEnCours ? "Enregistrement..." : "Vendre ce lot"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Dialogue qui demande le lot périmé à sortir et le motif quand il ne reste que du périmé. */
export function SortieLotPerime({ isOpen, onClose, envoiEnCours, ...reste }: SortieLotPerimeProps) {
  const { dialogProps, titleId } = useDialogA11y({ isOpen, onClose, closeOnEscape: !envoiEnCours });

  if (!isOpen) return null;

  return (
    <ContenuSortie {...reste} onClose={onClose} envoiEnCours={envoiEnCours} dialogProps={dialogProps} titleId={titleId} />
  );
}
