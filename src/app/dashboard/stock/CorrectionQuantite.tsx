"use client";

import { useRef, useState } from "react";
import { Loader2, SlidersHorizontal } from "lucide-react";
import { ChoixLot } from "@/components/pharmacie/ChoixLot";
import {
  ALERTE_ERREUR,
  BOUTON_PRIMAIRE,
  BOUTON_SECONDAIRE,
  CHAMP,
  FOCUS,
} from "@/components/pharmacie/classes";
import { useDialogA11y } from "@/hooks/useDialogA11y";
import { messageErreurPour } from "@/hooks/useToast";
import { updateStockQuantite, type StockMedicament } from "@/lib/api_pharmacie";
import { estErreurReseau } from "@/lib/erreurs_api";
import { LIBELLES_UNITE_MINIMALE, formaterARegulariser, formaterQuantite } from "@/lib/caisse/regles/quantites";
import { LONGUEUR_MAX_MOTIF, motifValide } from "../ventes/affichage";

interface CorrectionQuantiteProps {
  isOpen: boolean;
  stock: StockMedicament | null;
  structureId: string;
  /** `rechargerStock` est vrai quand l'issue de l'envoi est inconnue (échec réseau) : la page relit le stock. */
  onClose: (rechargerStock?: boolean) => void;
  /** Reçoit le message du serveur, que la page affiche puis recharge le stock. */
  onSucces: (message: string) => void;
}

const MESSAGE_REFUS_LOCAL = "Indiquez une quantité, le lot concerné et un motif de 3 caractères au moins.";
const MESSAGE_ISSUE_INCONNUE =
  "La correction n'a peut-être pas été enregistrée. Fermez cette fenêtre et vérifiez la quantité affichée avant de recommencer.";
const MESSAGE_ECHEC_PAR_DEFAUT = "La correction n'a pas pu être enregistrée. Vérifiez votre connexion puis réessayez.";

type Sens = "ajouter" | "retirer";
type UniteSaisie = "boites" | "unites";

interface ContenuProps {
  stock: StockMedicament;
  structureId: string;
  onClose: (rechargerStock?: boolean) => void;
  onSucces: (message: string) => void;
}

/** Contenu du dialogue : monté à chaque ouverture, donc tous les champs repartent à vide. */
function ContenuCorrection({ stock, structureId, onClose, onSucces }: ContenuProps) {
  const coefficient = stock.coefficientBoite ?? 1;
  const unite = stock.uniteMinimale ?? "UNITE";
  const aRegulariser = formaterARegulariser(stock.quantiteARegulariser, coefficient, unite);
  const libelleUnite = LIBELLES_UNITE_MINIMALE[unite];
  const lots = stock.lots ?? [];
  const lotObligatoire = lots.length > 1;

  const [sens, setSens] = useState<Sens>("retirer");
  const [quantite, setQuantite] = useState("");
  const [uniteSaisie, setUniteSaisie] = useState<UniteSaisie>("boites");
  const [lotId, setLotId] = useState<string | null>(null);
  const [motif, setMotif] = useState("");
  const [refusLocal, setRefusLocal] = useState(false);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  // Échec réseau : l'issue est inconnue, la saisie est verrouillée (la route ne se rejoue pas).
  const [issueInconnue, setIssueInconnue] = useState(false);
  const envoiRef = useRef(false);

  const fermer = () => onClose(issueInconnue);
  const { dialogProps, titleId } = useDialogA11y({ isOpen: true, onClose: fermer, closeOnEscape: !envoiEnCours });

  const nombre = /^\d+$/.test(quantite.trim()) ? Number(quantite.trim()) : 0;
  const parUnite = coefficient > 1 && uniteSaisie === "unites" ? nombre : nombre * (coefficient > 1 ? coefficient : 1);
  const variationAbsolue = Number.isSafeInteger(parUnite) ? parUnite : 0;
  const formulaireValide = variationAbsolue >= 1 && (!lotObligatoire || lotId !== null) && motifValide(motif);

  const enregistrer = async () => {
    if (envoiRef.current) return;
    if (!formulaireValide) {
      setRefusLocal(true);
      return;
    }
    envoiRef.current = true;
    setEnvoiEnCours(true);
    setErreur(null);
    const corps: { variation: number; lotId?: string; motif: string } = {
      variation: sens === "retirer" ? -variationAbsolue : variationAbsolue,
      motif: motif.trim(),
    };
    if (lotObligatoire && lotId) corps.lotId = lotId;
    try {
      const res = await updateStockQuantite(structureId, stock.id, corps);
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
              <SlidersHorizontal className="w-6 h-6 text-primary-700 dark:text-primary-300" aria-hidden="true" />
            </div>
            <h3 id={titleId} className="text-xl font-bold text-slate-900 dark:text-white">
              Corriger la quantité de {stock.medicament.nom}
            </h3>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              Stock actuel : {formaterQuantite(stock.quantite, coefficient, unite)}
            </p>
            {aRegulariser !== null && (
              <>
                <p className="text-sm text-amber-700 dark:text-amber-300">{aRegulariser}</p>
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  Ces ventes se régularisent à la prochaine réception ou au prochain inventaire.
                </p>
              </>
            )}
          </div>

          <fieldset disabled={issueInconnue || envoiEnCours} className="flex flex-col gap-5 min-w-0">
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">Sens de la correction</legend>
              {(
                [
                  ["retirer", "Retirer du stock"],
                  ["ajouter", "Ajouter au stock"],
                ] as const
              ).map(([valeur, libelle]) => (
                <label key={valeur} className="flex items-center gap-3 text-sm text-slate-800 dark:text-slate-200">
                  <input
                    type="radio"
                    name="sens-correction"
                    checked={sens === valeur}
                    onChange={() => setSens(valeur)}
                    className={`w-5 h-5 accent-primary-600 ${FOCUS}`}
                  />
                  {libelle}
                </label>
              ))}
            </fieldset>

            <div>
              <label htmlFor="quantite-correction" className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">
                Quantité
              </label>
              <input
                id="quantite-correction"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={quantite}
                onChange={(e) => {
                  setQuantite(e.target.value);
                  setRefusLocal(false);
                }}
                className={CHAMP}
              />
              {coefficient > 1 && (
                <fieldset className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
                  <legend className="sr-only">Unité de la quantité</legend>
                  {(
                    [
                      ["boites", "en boîtes"],
                      ["unites", `en ${libelleUnite.pluriel}`],
                    ] as const
                  ).map(([valeur, libelle]) => (
                    <label key={valeur} className="flex items-center gap-3 text-sm text-slate-800 dark:text-slate-200">
                      <input
                        type="radio"
                        name="unite-correction"
                        checked={uniteSaisie === valeur}
                        onChange={() => setUniteSaisie(valeur)}
                        className={`w-5 h-5 accent-primary-600 ${FOCUS}`}
                      />
                      {libelle}
                    </label>
                  ))}
                </fieldset>
              )}
            </div>

            {lotObligatoire && (
              <ChoixLot
                lots={lots}
                valeur={lotId}
                onChange={(id) => {
                  setLotId(id);
                  setRefusLocal(false);
                }}
                legende="Lot concerné"
                coefficient={coefficient}
                unite={unite}
              />
            )}

            <div>
              <label htmlFor="motif-correction" className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">
                Motif de la correction
              </label>
              <textarea
                id="motif-correction"
                rows={3}
                maxLength={LONGUEUR_MAX_MOTIF}
                value={motif}
                onChange={(e) => {
                  setMotif(e.target.value);
                  setRefusLocal(false);
                }}
                aria-describedby="aide-motif-correction"
                className={CHAMP}
              />
              <div id="aide-motif-correction" className="mt-1 space-y-1 text-xs text-slate-600 dark:text-slate-400">
                <p>Par exemple : boîte retrouvée, erreur de comptage</p>
                <p>Pour un médicament cassé, perdu ou périmé, utilisez plutôt « Sortir du stock » (raison enregistrée).</p>
              </div>
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

/** Dialogue de correction de la quantité d'un médicament, avec motif obligatoire (D700). */
export function CorrectionQuantite({ isOpen, stock, structureId, onClose, onSucces }: CorrectionQuantiteProps) {
  if (!isOpen || !stock) return null;
  return <ContenuCorrection stock={stock} structureId={structureId} onClose={onClose} onSucces={onSucces} />;
}
