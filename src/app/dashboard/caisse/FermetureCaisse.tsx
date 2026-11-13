"use client";

import { ui } from "@/theme/ui";
import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import Link from "next/link";
import { AlertCircle, CircleCheck, Loader2, Lock } from "lucide-react";
import { useDialogA11y } from "@/hooks/useDialogA11y";
import { messageErreurPour } from "@/hooks/useToast";
import { nouvelleCleIdempotence } from "@/lib/api_carnet";
import { sourceCaisse } from "@/lib/caisse/source_active";
import { fermerSession, type BilanCaisse, type Coupure, type LigneComptage, type ModePaiement } from "@/lib/api_caisse";
import { codeErreur, estErreurReseau } from "@/lib/erreurs_api";
import { formaterGNF } from "@/lib/format_gnf";
import {
  ALERTE_ATTENTION,
  ALERTE_ERREUR,
  ALERTE_INFO,
  BOUTON_PRIMAIRE,
  BOUTON_SECONDAIRE,
  CARTE,
  CHAMP,
  POLICE_TITRE,
} from "@/components/pharmacie/classes";
import { formaterJour } from "../ventes/affichage";
import { ComptageCoupures } from "./ComptageCoupures";
import { lignesAEnvoyer, lignesDepuisReferentiel, totalComptage } from "./comptage";

const CODE_ESPECES = "ESPECES";
const COMMENTAIRE_MAX = 500;
const COMMENTAIRE_MIN = 3;

const MESSAGE_RESEAU =
  "La fermeture n'a peut-être pas été enregistrée. Appuyez sur « Réessayer » : elle ne sera pas faite deux fois.";
const RELEVE_MAX = 1_000_000_000;

type CorpsFermeture = Parameters<typeof fermerSession>[2];

/** Écart signé tel qu'il s'affiche : « +2 000 GNF », « -10 000 GNF » ou « aucun écart ». */
export function texteEcart(ecart: number): string {
  if (ecart === 0) return "aucun écart";
  return ecart > 0 ? `+${formaterGNF(ecart)}` : formaterGNF(ecart);
}

/** Un écart n'est jamais en vert s'il n'est pas nul : rose en manque, ambre en surplus. */
export function classeEcart(ecart: number): string {
  if (ecart < 0) return "text-rose-700 dark:text-rose-300";
  if (ecart > 0) return "text-amber-700 dark:text-amber-300";
  return "text-slate-700 dark:text-slate-300";
}

const chiffres = (valeur: string) => valeur.replace(/\D/g, "").slice(0, 10);

interface FermetureCaisseProps {
  structureId: string;
  sessionId: string;
  /** Bilan chargé avant la fermeture : fournit l'attendu et le seuil d'écart. */
  bilan: BilanCaisse;
  modes: ModePaiement[];
  coupures: Coupure[];
  /** Jour AAAA-MM-JJ de la caisse quand elle date d'un jour précédent, sinon null. */
  jourPasse: string | null;
  /** Appelé avec le bilan figé quand la caisse est fermée. */
  onFermee: (bilan: BilanCaisse) => void;
  /** Appelé avec le message du serveur quand la caisse ne peut plus se fermer telle quelle : la page relit son état. */
  onRefus: (message: string) => void;
}

/** Bloc de fermeture : comptage, relevés facultatifs, aperçu des écarts, commentaire, confirmation. Tout se fait au clavier. */
export function FermetureCaisse({ structureId, sessionId, bilan, modes, coupures, jourPasse, onFermee, onRefus }: FermetureCaisseProps) {
  const modesSansComptage = [...modes].filter((m) => !m.comptagePhysique).sort((a, b) => a.ordre - b.ordre);
  const [lignes, setLignes] = useState<LigneComptage[]>(() => lignesDepuisReferentiel(coupures));
  const [releves, setReleves] = useState<Record<string, string>>({});
  const [commentaire, setCommentaire] = useState("");
  const [idComptage, setIdComptage] = useState(nouvelleCleIdempotence);
  const [confirmation, setConfirmation] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [corpsARejouer, setCorpsARejouer] = useState<CorpsFermeture | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const [demandeFocusCommentaire, setDemandeFocusCommentaire] = useState(0);

  const champsReleves = useRef<(HTMLInputElement | null)[]>([]);
  const champCommentaire = useRef<HTMLTextAreaElement>(null);
  const boutonFermer = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (demandeFocusCommentaire > 0) champCommentaire.current?.focus();
  }, [demandeFocusCommentaire]);

  const theorique = (code: string) => bilan.theorique.find((t) => t.mode === code)?.montant ?? 0;
  const compte = totalComptage(lignes);
  const ecartEspeces = compte - theorique(CODE_ESPECES);
  const commentaireRequis = Math.abs(ecartEspeces) > bilan.seuilEcartCaisse;
  const commentaireManquant = commentaireRequis && commentaire.trim().length < COMMENTAIRE_MIN;
  const verrouille = envoi || corpsARejouer !== null;

  // Après le dernier champ : le commentaire s'il est exigé et vide, sinon le bouton de fermeture.
  const apresSaisie = () => {
    if (commentaireManquant) champCommentaire.current?.focus();
    else boutonFermer.current?.focus();
  };

  const apresBillets = () => {
    if (champsReleves.current[0]) champsReleves.current[0].focus();
    else apresSaisie();
  };

  const surToucheReleve = (e: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (index < modesSansComptage.length - 1) champsReleves.current[index + 1]?.focus();
    else apresSaisie();
  };

  const surToucheCommentaire = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || !(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    boutonFermer.current?.focus();
  };

  const demanderConfirmation = () => {
    if (verrouille) return;
    const indexTrop = modesSansComptage.findIndex((m) => Number(releves[m.code] ?? "") > RELEVE_MAX);
    if (indexTrop >= 0) {
      setErreur(`Le relevé ${modesSansComptage[indexTrop].libelle} ne peut pas dépasser ${formaterGNF(RELEVE_MAX)}.`);
      champsReleves.current[indexTrop]?.focus();
      return;
    }
    if (commentaireManquant) {
      setErreur(
        `Un commentaire est obligatoire : l'écart d'espèces dépasse ${formaterGNF(bilan.seuilEcartCaisse)}. Expliquez-le en quelques mots.`,
      );
      champCommentaire.current?.focus();
      return;
    }
    setErreur(null);
    setConfirmation(true);
  };

  const construireCorps = (): CorpsFermeture => {
    const relevesEnvoyes = modesSansComptage
      .filter((m) => (releves[m.code] ?? "") !== "")
      .map((m) => ({ mode: m.code, montant: Number(releves[m.code]) }));
    const texte = commentaire.trim();
    return {
      comptageFermeture: {
        id: idComptage,
        coupures: lignesAEnvoyer(lignes),
        ...(relevesEnvoyes.length > 0 ? { releves: relevesEnvoyes } : {}),
      },
      ...(texte !== "" ? { commentaire: texte } : {}),
    };
  };

  const envoyer = async (corps: CorpsFermeture) => {
    if (envoi) return;
    setEnvoi(true);
    setErreur(null);
    setCorpsARejouer(null);
    try {
      const res = await sourceCaisse().fermerSession(structureId, sessionId, corps);
      onFermee(res.data);
    } catch (err) {
      if (estErreurReseau(err)) {
        // Issue inconnue : même corps, même identifiant de comptage, saisie en lecture seule (D688).
        setCorpsARejouer(corps);
      } else {
        const code = codeErreur(err);
        const message = messageErreurPour(err, "La caisse n'a pas pu être fermée. Vérifiez votre caisse puis réessayez.");
        if (code === "COMMENTAIRE_ECART_REQUIS") {
          setErreur(message);
          // Le champ est encore verrouillé pendant l'envoi : le focus se pose après le rendu.
          setDemandeFocusCommentaire((n) => n + 1);
        } else {
          // Refus du serveur : rien n'est enregistré, nouvel identifiant, la page relit l'état.
          setIdComptage(nouvelleCleIdempotence());
          onRefus(message);
        }
      }
    } finally {
      setEnvoi(false);
    }
  };

  const confirmer = () => {
    setConfirmation(false);
    void envoyer(construireCorps());
  };

  const surToucheFermer = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    // Touche maintenue : la saisie enchaîne les champs, elle ne doit pas aller jusqu'à fermer la caisse.
    if (!e.repeat) demanderConfirmation();
  };

  return (
    <>
      <div id="fermeture-caisse" className={`${CARTE} space-y-5`}>
        <h2 className={ui.texte.section} style={POLICE_TITRE}>
          Fermeture de la caisse
        </h2>
        {jourPasse !== null && (
          <p role="status" className={ALERTE_INFO}>
            Les ventes de cette caisse sont comptées pour le {formaterJour(jourPasse)}.
          </p>
        )}
        <p className="text-mc-normal text-slate-700 dark:text-slate-300">Comptez l&apos;argent de votre caisse.</p>

        <ComptageCoupures
          coupures={coupures}
          valeur={lignes}
          onChange={setLignes}
          onTermine={apresBillets}
          desactive={verrouille}
          legende="Espèces dans le tiroir"
        />

        {modesSansComptage.length > 0 && (
          <fieldset disabled={verrouille} className="space-y-4 min-w-0">
            <legend className="text-mc-normal font-semibold text-slate-900 dark:text-white mb-2">Relevés du téléphone</legend>
            {modesSansComptage.map((m, index) => (
              <div key={m.code}>
                <label htmlFor={`releve-${m.code}`} className="block text-mc-normal text-slate-700 dark:text-slate-300 mb-1">
                  Relevé {m.libelle} (facultatif)
                </label>
                <input
                  id={`releve-${m.code}`}
                  ref={(el) => {
                    champsReleves.current[index] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={releves[m.code] ?? ""}
                  onChange={(e) => setReleves((r) => ({ ...r, [m.code]: chiffres(e.target.value) }))}
                  onKeyDown={(e) => surToucheReleve(e, index)}
                  aria-describedby={`aide-releve-${m.code}`}
                  className={CHAMP}
                />
                <p id={`aide-releve-${m.code}`} className="text-mc-legende text-slate-600 dark:text-slate-400 mt-1">
                  Montant reçu sur le téléphone de la pharmacie pendant votre service.
                </p>
              </div>
            ))}
          </fieldset>
        )}

        <div aria-live="polite" className="space-y-1 text-mc-normal font-medium">
          <p className={classeEcart(ecartEspeces)}>Écart espèces : {texteEcart(ecartEspeces)}</p>
          {modesSansComptage.map((m) => {
            const saisi = releves[m.code] ?? "";
            if (saisi === "") {
              return (
                <p key={m.code} className="text-slate-700 dark:text-slate-300">
                  {m.libelle} : non rapproché
                </p>
              );
            }
            const ecart = Number(saisi) - theorique(m.code);
            return (
              <p key={m.code} className={classeEcart(ecart)}>
                Écart {m.libelle} : {texteEcart(ecart)}
              </p>
            );
          })}
        </div>

        <div>
          <label htmlFor="commentaire-fermeture" className="block text-mc-normal font-medium text-slate-800 dark:text-slate-200 mb-2">
            {commentaireRequis
              ? `Commentaire (obligatoire : écart supérieur à ${formaterGNF(bilan.seuilEcartCaisse)})`
              : "Commentaire"}
          </label>
          <textarea
            id="commentaire-fermeture"
            ref={champCommentaire}
            rows={3}
            maxLength={COMMENTAIRE_MAX}
            value={commentaire}
            disabled={verrouille}
            onChange={(e) => setCommentaire(e.target.value)}
            onKeyDown={surToucheCommentaire}
            className={CHAMP}
          />
        </div>

        {erreur !== null && (
          <div role="alert" className={ALERTE_ERREUR}>
            <AlertCircle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
            <span>{erreur}</span>
          </div>
        )}

        {corpsARejouer !== null ? (
          <div className="space-y-3">
            <div role="alert" className={ALERTE_ERREUR}>
              <AlertCircle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
              <span>{MESSAGE_RESEAU}</span>
            </div>
            <button type="button" onClick={() => void envoyer(corpsARejouer)} disabled={envoi} className={BOUTON_PRIMAIRE}>
              {envoi && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              Réessayer
            </button>
          </div>
        ) : (
          <button
            ref={boutonFermer}
            type="button"
            onClick={demanderConfirmation}
            onKeyDown={surToucheFermer}
            disabled={envoi}
            className={BOUTON_PRIMAIRE}
          >
            {envoi && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
            Fermer ma caisse
          </button>
        )}
      </div>

      <ConfirmationFermeture isOpen={confirmation} especes={compte} onClose={() => setConfirmation(false)} onConfirmer={confirmer} />
    </>
  );
}

interface ConfirmationFermetureProps {
  isOpen: boolean;
  especes: number;
  onClose: () => void;
  onConfirmer: () => void;
}

interface ContenuConfirmationProps extends Omit<ConfirmationFermetureProps, "isOpen"> {
  dialogProps: ReturnType<typeof useDialogA11y>["dialogProps"];
  titleId: string;
  refConfirmer: RefObject<HTMLButtonElement | null>;
}

function ContenuConfirmation({ especes, onClose, onConfirmer, dialogProps, titleId, refConfirmer }: ContenuConfirmationProps) {
  const surTouche = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (!e.repeat) onConfirmer();
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className={ui.dialogue.fond} onClick={onClose} aria-hidden="true" />
      <div
        {...dialogProps}
        className={ui.dialogue.panneau}
      >
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-mc-moyen bg-primary-50 dark:bg-primary-500/15 flex items-center justify-center shrink-0">
              <Lock className="w-6 h-6 text-primary-700 dark:text-primary-300" aria-hidden="true" />
            </div>
            <h3 id={titleId} className={ui.texte.section}>
              Fermer la caisse ?
            </h3>
          </div>
          <p className="text-mc-normal text-slate-700 dark:text-slate-200">
            Espèces comptées : {formaterGNF(especes)}. Après la fermeture, plus aucune vente ne peut être ajoutée à cette caisse.
          </p>
          <div className="flex flex-col-reverse sm:flex-row gap-3 w-full">
            <button type="button" onClick={onClose} className={`flex-1 ${BOUTON_SECONDAIRE}`}>
              Revenir
            </button>
            <button ref={refConfirmer} type="button" onClick={onConfirmer} onKeyDown={surTouche} className={`flex-[2] ${BOUTON_PRIMAIRE}`}>
              Confirmer la fermeture
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Confirmation avant la fermeture : le focus va au bouton de confirmation, Entrée confirme. */
function ConfirmationFermeture({ isOpen, onClose, ...reste }: ConfirmationFermetureProps) {
  const { dialogProps, titleId } = useDialogA11y({ isOpen, onClose });
  const refConfirmer = useRef<HTMLButtonElement>(null);

  // Déclaré après le hook : le focus va au bouton de confirmation, pas au premier élément.
  useEffect(() => {
    if (isOpen) refConfirmer.current?.focus();
  }, [isOpen]);

  if (!isOpen) return null;

  return <ContenuConfirmation {...reste} onClose={onClose} dialogProps={dialogProps} titleId={titleId} refConfirmer={refConfirmer} />;
}

interface CaisseFermeeProps {
  bilan: BilanCaisse;
  /** Jour AAAA-MM-JJ de la caisse quand elle datait d'un jour précédent, sinon null. */
  jourPasse: string | null;
  onNouvelleCaisse: () => void;
}

/** Écran affiché après la fermeture : le bilan figé du serveur fait foi. */
export function CaisseFermee({ bilan, jourPasse, onNouvelleCaisse }: CaisseFermeeProps) {
  const titre = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    titre.current?.focus();
  }, []);

  const commentaire = bilan.session.commentaireEcart;

  return (
    <div className={`${CARTE} flex flex-col items-start gap-4`}>
      <CircleCheck className="h-10 w-10 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
      <h2
        ref={titre}
        tabIndex={-1}
        className="text-mc-page font-semibold text-slate-900 dark:text-white focus:outline-none"
        style={POLICE_TITRE}
      >
        Caisse fermée
      </h2>
      {jourPasse !== null && (
        <p role="status" className={ALERTE_INFO}>
          Les ventes de cette caisse sont comptées pour le {formaterJour(jourPasse)}.
        </p>
      )}
      <div className="text-mc-normal text-slate-700 dark:text-slate-300 space-y-1">
        <p>Ventes : {bilan.activite.nombreVentes}</p>
        <p>Annulations : {bilan.activite.nombreAnnulations}</p>
        <p className="font-semibold text-slate-900 dark:text-white">Encaissé : {formaterGNF(bilan.activite.montantEncaisse)}</p>
      </div>
      <ul className="w-full space-y-3 text-mc-normal text-slate-700 dark:text-slate-300">
        {bilan.theorique.map((t) => {
          const compteMode = bilan.compte.find((c) => c.mode === t.mode)?.montant ?? null;
          const ecart = bilan.ecarts.find((e) => e.mode === t.mode)?.ecart ?? null;
          return (
            <li key={t.mode} className="space-y-0.5">
              <p className="font-semibold text-slate-900 dark:text-white">{t.libelle}</p>
              <p>Attendu : {formaterGNF(t.montant)}</p>
              <p>Compté : {compteMode === null ? "non rapproché" : formaterGNF(compteMode)}</p>
              {ecart !== null && <p className={`font-medium ${classeEcart(ecart)}`}>Écart : {texteEcart(ecart)}</p>}
            </li>
          );
        })}
      </ul>
      {commentaire && <p className="text-mc-normal text-slate-700 dark:text-slate-300">Commentaire : {commentaire}</p>}
      {!bilan.fond.compte && (
        <p role="status" className={ALERTE_ATTENTION}>
          <AlertCircle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
          <span>Le fond n&apos;avait pas été compté : il est enregistré à 0 et signalé au titulaire.</span>
        </p>
      )}
      <div className="flex flex-col sm:flex-row gap-3">
        <Link href="/dashboard" className={BOUTON_PRIMAIRE}>
          Retour à l&apos;accueil
        </Link>
        <button type="button" onClick={onNouvelleCaisse} className={BOUTON_SECONDAIRE}>
          Ouvrir une nouvelle caisse
        </button>
      </div>
    </div>
  );
}
