"use client";

import { useState } from "react";
import { AlertCircle, ArrowLeftRight, Loader2 } from "lucide-react";
import { useDialogA11y } from "@/hooks/useDialogA11y";
import { messageErreurPour } from "@/hooks/useToast";
import { nouvelleCleIdempotence } from "@/lib/api_carnet";
import { enregistrerMouvement, type ModePaiement, type TypeMouvementCaisse } from "@/lib/api_caisse";
import { codeErreur, estErreurReseau } from "@/lib/erreurs_api";
import { formaterGNF } from "@/lib/format_gnf";
import { ALERTE_ERREUR, BOUTON_PRIMAIRE, BOUTON_SECONDAIRE, CHAMP } from "@/components/pharmacie/classes";

const CODE_ESPECES = "ESPECES";
const MONTANT_MAX = 100_000_000;
const MOTIF_MIN = 3;
const MOTIF_MAX = 300;

const MESSAGE_REFUS_LOCAL = "Choisissez le type, indiquez un montant et un motif de 3 caractères au moins.";
const MESSAGE_RESEAU =
  "Le mouvement n'a peut-être pas été enregistré. Appuyez sur « Réessayer » : il ne sera pas compté deux fois.";

const TYPES: { valeur: TypeMouvementCaisse; libelle: string }[] = [
  { valeur: "PRELEVEMENT", libelle: "Prélèvement (sortie d'argent)" },
  { valeur: "APPORT", libelle: "Apport (ajout d'argent)" },
  { valeur: "REMBOURSEMENT", libelle: "Remboursement d'un client" },
];

const MODE_ESPECES_SEUL: ModePaiement = {
  code: CODE_ESPECES,
  libelle: "Espèces",
  comptagePhysique: true,
  referenceAutorisee: false,
  ordre: 0,
};

interface MouvementCaisseProps {
  isOpen: boolean;
  onClose: () => void;
  structureId: string;
  sessionId: string;
  modes: ModePaiement[];
  /** Appelé avec le message du serveur quand le mouvement est enregistré. */
  onEnregistre: (message: string) => void;
  /** Appelé avec le message du serveur quand la caisse n'accepte plus de mouvement (fermée, journée clôturée). */
  onRefus: (message: string) => void;
  /** Appelé quand le vendeur ferme le dialogue après un échec réseau : la page relit le bilan et demande de vérifier la liste. */
  onVerifier: () => void;
}

type ProprietesDialogue = ReturnType<typeof useDialogA11y>["dialogProps"];

interface ContenuProps extends Omit<MouvementCaisseProps, "isOpen" | "onVerifier"> {
  onEnAttente: (enAttente: boolean) => void;
  onEnvoi: (enCours: boolean) => void;
  dialogProps: ProprietesDialogue;
  titleId: string;
}

/** Contenu du dialogue : monté à chaque ouverture, donc la saisie et l'identifiant repartent à neuf. */
function ContenuMouvement({
  onClose,
  structureId,
  sessionId,
  modes,
  onEnregistre,
  onRefus,
  onEnAttente,
  onEnvoi,
  dialogProps,
  titleId,
}: ContenuProps) {
  const modesTries = modes.length > 0 ? [...modes].sort((a, b) => a.ordre - b.ordre) : [MODE_ESPECES_SEUL];
  const [id] = useState(nouvelleCleIdempotence);
  const [type, setType] = useState<TypeMouvementCaisse | null>(null);
  const [montant, setMontant] = useState("");
  const [mode, setMode] = useState(CODE_ESPECES);
  const [motif, setMotif] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [aRejouer, setARejouer] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [erreurMontant, setErreurMontant] = useState<string | null>(null);

  const enregistrer = async () => {
    if (envoi) return;
    const valeur = montant === "" ? 0 : Number(montant);
    if (valeur > MONTANT_MAX) {
      setErreurMontant(`Le montant ne peut pas dépasser ${formaterGNF(MONTANT_MAX)}.`);
      document.getElementById("montant-mouvement")?.focus();
      return;
    }
    if (type === null || valeur < 1 || motif.trim().length < MOTIF_MIN) {
      setErreur(MESSAGE_REFUS_LOCAL);
      return;
    }
    setEnvoi(true);
    onEnvoi(true);
    setErreur(null);
    setARejouer(false);
    onEnAttente(false);
    try {
      const corps = { id, type, montant: valeur, motif: motif.trim(), ...(mode !== CODE_ESPECES ? { mode } : {}) };
      const res = await enregistrerMouvement(structureId, sessionId, corps);
      onEnregistre(res.message);
    } catch (err) {
      if (estErreurReseau(err)) {
        // Issue inconnue : même identifiant, saisie en lecture seule (D688).
        setARejouer(true);
        onEnAttente(true);
      } else {
        const message = messageErreurPour(err, "Le mouvement n'a pas pu être enregistré. Vérifiez votre caisse puis réessayez.");
        const code = codeErreur(err);
        if (code === "SESSION_FERMEE" || code === "JOURNEE_CLOTUREE") onRefus(message);
        else setErreur(message);
      }
    } finally {
      setEnvoi(false);
      onEnvoi(false);
    }
  };

  const verrouille = envoi || aRejouer;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={envoi ? undefined : onClose} aria-hidden="true" />
      <div
        {...dialogProps}
        className="relative w-full max-w-md max-h-[90dvh] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 animate-slide-up"
      >
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary-50 dark:bg-primary-500/15 flex items-center justify-center shrink-0">
              <ArrowLeftRight className="w-6 h-6 text-primary-700 dark:text-primary-300" aria-hidden="true" />
            </div>
            <h3 id={titleId} className="text-xl font-bold text-slate-900 dark:text-white">
              Mouvement de caisse
            </h3>
          </div>

          <fieldset disabled={verrouille} className="space-y-5 min-w-0">
            <div role="radiogroup" aria-labelledby="legende-type-mouvement" className="space-y-2">
              <p id="legende-type-mouvement" className="text-sm font-medium text-slate-800 dark:text-slate-200">
                Type de mouvement
              </p>
              {TYPES.map((t) => (
                <label key={t.valeur} className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-200">
                  <input
                    type="radio"
                    name="type-mouvement"
                    value={t.valeur}
                    checked={type === t.valeur}
                    onChange={() => {
                      setType(t.valeur);
                      setErreur(null);
                    }}
                    className="w-4 h-4 accent-primary-600"
                  />
                  {t.libelle}
                </label>
              ))}
            </div>

            <div>
              <label htmlFor="montant-mouvement" className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">
                Montant (GNF)
              </label>
              <input
                id="montant-mouvement"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={montant}
                onChange={(e) => {
                  setMontant(e.target.value.replace(/\D/g, "").slice(0, 12));
                  setErreur(null);
                  setErreurMontant(null);
                }}
                aria-describedby={erreurMontant !== null ? "erreur-montant-mouvement" : undefined}
                aria-invalid={erreurMontant !== null}
                className={CHAMP}
              />
              {erreurMontant !== null && (
                <p id="erreur-montant-mouvement" role="alert" className="text-sm text-rose-700 dark:text-rose-300 mt-1">
                  {erreurMontant}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="mode-mouvement" className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">
                Mode
              </label>
              <select id="mode-mouvement" value={mode} onChange={(e) => setMode(e.target.value)} className={CHAMP}>
                {modesTries.map((m) => (
                  <option key={m.code} value={m.code}>
                    {m.libelle}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="motif-mouvement" className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">
                Motif
              </label>
              <input
                id="motif-mouvement"
                type="text"
                maxLength={MOTIF_MAX}
                value={motif}
                onChange={(e) => {
                  setMotif(e.target.value);
                  setErreur(null);
                }}
                aria-describedby="aide-motif-mouvement"
                className={CHAMP}
              />
              <p id="aide-motif-mouvement" className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                Par exemple : dépôt au coffre, monnaie apportée
              </p>
            </div>
          </fieldset>

          {erreur !== null && (
            <div role="alert" className={ALERTE_ERREUR}>
              <AlertCircle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
              <span>{erreur}</span>
            </div>
          )}
          {aRejouer && (
            <div role="alert" className={ALERTE_ERREUR}>
              <AlertCircle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
              <span>{MESSAGE_RESEAU}</span>
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row gap-3 w-full">
            <button type="button" onClick={onClose} disabled={envoi} className={`flex-1 ${BOUTON_SECONDAIRE} disabled:opacity-50`}>
              {aRejouer ? "Fermer et vérifier" : "Annuler"}
            </button>
            <button type="button" onClick={() => void enregistrer()} disabled={envoi} className={`flex-[2] ${BOUTON_PRIMAIRE}`}>
              {envoi && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              {aRejouer ? "Réessayer" : "Enregistrer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Dialogue d'un prélèvement, d'un apport ou d'un remboursement sur la caisse ouverte. */
export function MouvementCaisse({ isOpen, onClose, onVerifier, ...reste }: MouvementCaisseProps) {
  const [enAttente, setEnAttente] = useState(false);
  // Après un échec réseau, toute fermeture (bouton, fond, Échap) passe par la vérification de la liste.
  const fermer = () => {
    if (enAttente) {
      setEnAttente(false);
      onVerifier();
    } else onClose();
  };
  // Échap est bloqué pendant l'envoi, comme le bouton et le fond : l'issue n'est pas encore connue.
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const { dialogProps, titleId } = useDialogA11y({ isOpen, onClose: fermer, closeOnEscape: !envoiEnCours });

  if (!isOpen) return null;

  return (
    <ContenuMouvement
      {...reste}
      onClose={fermer}
      onEnAttente={setEnAttente}
      onEnvoi={setEnvoiEnCours}
      dialogProps={dialogProps}
      titleId={titleId}
    />
  );
}
