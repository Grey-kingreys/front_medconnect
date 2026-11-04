"use client";

import { useRef, useState } from "react";
import { CalendarClock, Loader2 } from "lucide-react";
import {
  ALERTE_ERREUR,
  BOUTON_PRIMAIRE,
  BOUTON_SECONDAIRE,
  CHAMP,
  FOCUS,
} from "@/components/pharmacie/classes";
import { useDialogA11y } from "@/hooks/useDialogA11y";
import { messageErreurPour } from "@/hooks/useToast";
import { corrigerDateLot, type LotRecu } from "@/lib/api_pharmacie";
import { afficherDatePeremption, lireDatePeremption } from "@/lib/date_peremption";
import { estErreurReseau } from "@/lib/erreurs_api";
import { LONGUEUR_MAX_MOTIF, motifValide } from "../../ventes/affichage";

interface CorrectionDateLotProps {
  lot: LotRecu | null;
  structureId: string;
  /** `rechargerDetail` est vrai quand l'issue de l'envoi est inconnue (échec réseau) : la page relit le détail. */
  onClose: (rechargerDetail?: boolean) => void;
  /** Reçoit le message du serveur, que la page affiche après avoir rechargé le détail. */
  onSucces: (message: string) => void;
}

const MESSAGE_REFUS_LOCAL = "Indiquez une date lisible (ou « Sans date ») et un motif de 3 caractères au moins.";
const MESSAGE_ISSUE_INCONNUE =
  "La correction n'a peut-être pas été enregistrée. Fermez cette fenêtre et vérifiez la date affichée avant de recommencer.";
const MESSAGE_ECHEC_PAR_DEFAUT = "La correction n'a pas pu être enregistrée. Vérifiez votre connexion puis réessayez.";

interface ContenuProps {
  lot: LotRecu;
  structureId: string;
  onClose: (rechargerDetail?: boolean) => void;
  onSucces: (message: string) => void;
}

/** Contenu du dialogue : monté à chaque ouverture, donc tous les champs repartent à vide. */
function ContenuCorrection({ lot, structureId, onClose, onSucces }: ContenuProps) {
  const [date, setDate] = useState("");
  const [dateVue, setDateVue] = useState(false);
  const [sansDate, setSansDate] = useState(false);
  const [motif, setMotif] = useState("");
  const [refusLocal, setRefusLocal] = useState(false);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  // Échec réseau : l'issue est inconnue, la saisie est verrouillée (la route ne porte aucun identifiant client).
  const [issueInconnue, setIssueInconnue] = useState(false);
  const envoiRef = useRef(false);

  const fermer = () => onClose(issueInconnue);
  const { dialogProps, titleId } = useDialogA11y({ isOpen: true, onClose: fermer, closeOnEscape: !envoiEnCours });

  const lecture = !sansDate && date.trim() !== "" ? lireDatePeremption(date) : null;
  const messageDate = dateVue && lecture && !lecture.ok ? lecture.message : null;
  const dateLue = lecture && lecture.ok ? afficherDatePeremption(lecture.jour) : null;
  const formulaireValide = (sansDate || (lecture !== null && lecture.ok)) && motifValide(motif);

  const numero = lot.numeroLot ?? "Sans numéro";
  const dateActuelle = lot.dateExpiration ? afficherDatePeremption(lot.dateExpiration) : "Sans date";

  const enregistrer = async () => {
    if (envoiRef.current) return;
    if (!formulaireValide) {
      setDateVue(true);
      setRefusLocal(true);
      return;
    }
    envoiRef.current = true;
    setEnvoiEnCours(true);
    setErreur(null);
    const corps: { dateExpiration?: string; sansPeremption?: true; motif: string } = { motif: motif.trim() };
    if (sansDate) corps.sansPeremption = true;
    else if (lecture && lecture.ok) corps.dateExpiration = lecture.jour;
    try {
      const res = await corrigerDateLot(structureId, lot.id, corps);
      onSucces(res.message);
      onClose(false);
    } catch (err) {
      if (estErreurReseau(err)) {
        setIssueInconnue(true);
        setErreur(MESSAGE_ISSUE_INCONNUE);
      } else {
        setErreur(messageErreurPour(err, MESSAGE_ECHEC_PAR_DEFAUT));
        envoiRef.current = false;
      }
      setEnvoiEnCours(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={envoiEnCours ? undefined : fermer} aria-hidden="true" />
      <div
        {...dialogProps}
        className="relative w-full max-w-md max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 animate-slide-up"
      >
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary-50 dark:bg-primary-500/15 flex items-center justify-center shrink-0">
              <CalendarClock className="w-6 h-6 text-primary-700 dark:text-primary-300" aria-hidden="true" />
            </div>
            <h3 id={titleId} className="text-xl font-bold text-slate-900 dark:text-white">
              Corriger la date de péremption
            </h3>
          </div>

          <p className="text-sm font-bold text-slate-900 dark:text-white">
            {lot.nom}, lot {numero}, date actuelle : {dateActuelle}
          </p>

          <fieldset disabled={issueInconnue || envoiEnCours} className="flex flex-col gap-5 min-w-0">
            <div>
              <label htmlFor="date-correction" className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">
                Nouvelle date de péremption
              </label>
              <input
                id="date-correction"
                type="text"
                autoComplete="off"
                placeholder="06/28"
                value={date}
                disabled={sansDate}
                onChange={(e) => {
                  setDate(e.target.value);
                  setDateVue(false);
                  setRefusLocal(false);
                }}
                onBlur={() => setDateVue(true)}
                aria-invalid={messageDate ? true : undefined}
                aria-describedby={messageDate || dateLue ? "info-date-correction" : undefined}
                className={`${CHAMP} disabled:opacity-60`}
              />
              {messageDate ? (
                <p id="info-date-correction" className="mt-1 text-sm text-rose-700 dark:text-rose-300">
                  {messageDate}
                </p>
              ) : (
                dateLue && (
                  <p id="info-date-correction" className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                    {dateLue}
                  </p>
                )
              )}
              <label className="mt-3 flex items-center gap-3 text-sm text-slate-800 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={sansDate}
                  onChange={(e) => {
                    setSansDate(e.target.checked);
                    setRefusLocal(false);
                  }}
                  className={`w-5 h-5 rounded accent-primary-600 ${FOCUS}`}
                />
                Sans date de péremption
              </label>
            </div>

            <div>
              <label htmlFor="motif-date" className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">
                Motif
              </label>
              <textarea
                id="motif-date"
                rows={3}
                maxLength={LONGUEUR_MAX_MOTIF}
                value={motif}
                onChange={(e) => {
                  setMotif(e.target.value);
                  setRefusLocal(false);
                }}
                aria-describedby="aide-motif-date"
                className={CHAMP}
              />
              <p id="aide-motif-date" className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                Par exemple : erreur de saisie, date relue sur la boîte
              </p>
            </div>
          </fieldset>

          {refusLocal && (
            <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">
              {MESSAGE_REFUS_LOCAL}
            </p>
          )}

          {erreur && (
            <div role="alert" className={ALERTE_ERREUR}>
              {erreur}
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row gap-3 w-full">
            {issueInconnue ? (
              <button type="button" onClick={fermer} className={`flex-1 ${BOUTON_PRIMAIRE}`}>
                Fermer
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={fermer}
                  disabled={envoiEnCours}
                  className={`flex-1 ${BOUTON_SECONDAIRE} disabled:opacity-50`}
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={enregistrer}
                  disabled={envoiEnCours}
                  className={`flex-[2] ${BOUTON_PRIMAIRE}`}
                >
                  {envoiEnCours && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                  {envoiEnCours ? "Enregistrement..." : "Enregistrer la correction"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Dialogue de correction de la date de péremption d'un lot reçu, avec motif obligatoire. */
export function CorrectionDateLot({ lot, structureId, onClose, onSucces }: CorrectionDateLotProps) {
  if (!lot) return null;
  return <ContenuCorrection lot={lot} structureId={structureId} onClose={onClose} onSucces={onSucces} />;
}
