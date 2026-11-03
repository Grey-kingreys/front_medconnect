"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { AlertCircle, CalendarCheck, CircleCheck, Download, Loader2, Lock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useDialogA11y } from "@/hooks/useDialogA11y";
import { messageErreurPour } from "@/hooks/useToast";
import {
  cloturerJournee,
  exporterCloture,
  getPreparationCloture,
  listerClotures,
  listerRemonteesApresCloture,
  type Cloture,
  type PosteAttendu,
  type PreparationCloture,
  type RemonteeApresCloture,
  type SessionResume,
  type TotalCloture,
} from "@/lib/api_caisse";
import { codeErreur, detailsErreur, estErreurReseau } from "@/lib/erreurs_api";
import { lireContexteAcces } from "@/lib/acces";
import { formaterGNF } from "@/lib/format_gnf";
import {
  ALERTE_ATTENTION,
  ALERTE_ERREUR,
  ALERTE_INFO,
  ALERTE_SUCCES,
  BOUTON_PRIMAIRE,
  BOUTON_SECONDAIRE,
  CARTE,
  CHAMP,
  FOCUS,
  POLICE_TITRE,
} from "@/components/pharmacie/classes";
import { ErreurAvecReessai } from "@/components/pharmacie/ErreurAvecReessai";
import { formaterDateHeure, formaterHeure, formaterJour, jourConakry } from "../ventes/affichage";

const LONGUEUR_MIN_MOTIF = 3;
const LONGUEUR_MAX_MOTIF = 500;
const MESSAGE_CLOTURE_INCERTAINE =
  "La clôture n'a peut-être pas été enregistrée. Appuyez sur « Vérifier » pour recharger la journée.";
const MESSAGE_EXPORT_RESEAU = "Le fichier n'a pas pu être téléchargé. Vérifiez votre connexion puis réessayez.";
const LIEN = `underline underline-offset-2 text-primary-700 dark:text-primary-300 rounded ${FOCUS}`;

const motifForcageValide = (motif: string) => {
  const longueur = motif.trim().length;
  return longueur >= LONGUEUR_MIN_MOTIF && longueur <= LONGUEUR_MAX_MOTIF;
};

/** « +2 000 GNF », « -2 000 GNF » ou « aucun » : l'écart est signé et jamais recalculé ici. */
function libelleEcart(ecart: number): string {
  if (ecart === 0) return "aucun";
  return ecart > 0 ? `+${formaterGNF(ecart)}` : formaterGNF(ecart);
}

function libelleStatut(session: SessionResume): string {
  if (session.statut === "OUVERTE") return "Ouverte";
  if (session.statut === "INCLUSE_DANS_CLOTURE") return "Incluse dans une clôture";
  return session.fermeeLe ? `Fermée à ${formaterHeure(session.fermeeLe)}` : "Fermée";
}

function Dialogue({
  isOpen,
  onClose,
  envoiEnCours,
  titre,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  envoiEnCours: boolean;
  titre: string;
  children: ReactNode;
}) {
  const { dialogProps, titleId } = useDialogA11y({ isOpen, onClose, closeOnEscape: !envoiEnCours });
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={envoiEnCours ? undefined : onClose} aria-hidden="true" />
      <div
        {...dialogProps}
        className="relative w-full max-w-md max-h-[90dvh] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 animate-slide-up"
      >
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary-50 dark:bg-primary-500/15 flex items-center justify-center shrink-0">
              <Lock className="w-6 h-6 text-primary-700 dark:text-primary-300" aria-hidden="true" />
            </div>
            <h3 id={titleId} className="text-xl font-bold text-slate-900 dark:text-white">
              {titre}
            </h3>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

function BoutonsDialogue({
  envoiEnCours,
  onRevenir,
  onConfirmer,
  libelleConfirmer,
  libelleEnCours,
}: {
  envoiEnCours: boolean;
  onRevenir: () => void;
  onConfirmer: () => void;
  libelleConfirmer: string;
  libelleEnCours: string;
}) {
  return (
    <div className="flex flex-col-reverse sm:flex-row gap-3 w-full">
      <button type="button" onClick={onRevenir} disabled={envoiEnCours} className={`flex-1 ${BOUTON_SECONDAIRE} disabled:opacity-50`}>
        Revenir
      </button>
      <button type="button" onClick={onConfirmer} disabled={envoiEnCours} className={`flex-[2] ${BOUTON_PRIMAIRE}`}>
        {envoiEnCours && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
        {envoiEnCours ? libelleEnCours : libelleConfirmer}
      </button>
    </div>
  );
}

/** Motif de la clôture forcée : monté à chaque ouverture, il repart donc toujours à vide. */
function ContenuForcage({
  postes,
  envoiEnCours,
  erreur,
  onRevenir,
  onConfirmer,
}: {
  postes: PosteAttendu[];
  envoiEnCours: boolean;
  erreur: string | null;
  onRevenir: () => void;
  onConfirmer: (motif: string) => void;
}) {
  const [motif, setMotif] = useState("");
  const [motifRefuse, setMotifRefuse] = useState(false);

  const confirmer = () => {
    if (!motifForcageValide(motif)) {
      setMotifRefuse(true);
      return;
    }
    onConfirmer(motif.trim());
  };

  return (
    <>
      <ul className="space-y-1 text-sm font-medium text-slate-900 dark:text-white">
        {postes.map((p) => (
          <li key={p.posteId}>
            {p.libelle} ({p.posteCode})
          </li>
        ))}
      </ul>
      <p className="text-sm text-slate-700 dark:text-slate-200">
        Les ventes de ce poste remontées plus tard seront comptées le jour de leur arrivée et signalées.
      </p>
      <div>
        <label htmlFor="motif-forcage" className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">
          Motif
        </label>
        <textarea
          id="motif-forcage"
          rows={3}
          maxLength={LONGUEUR_MAX_MOTIF}
          value={motif}
          onChange={(e) => {
            setMotif(e.target.value);
            setMotifRefuse(false);
          }}
          aria-describedby="aide-motif-forcage"
          className={CHAMP}
        />
        <p id="aide-motif-forcage" className="text-xs text-slate-600 dark:text-slate-400 mt-1">
          Par exemple : poste en panne, coupure de courant. Entre 3 et 500 caractères.
        </p>
        {motifRefuse && (
          <p role="alert" className="text-sm text-rose-700 dark:text-rose-300 mt-1">
            Indiquez un motif de 3 à 500 caractères.
          </p>
        )}
      </div>
      {erreur && (
        <div role="alert" className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 text-sm">
          {erreur}
        </div>
      )}
      <BoutonsDialogue
        envoiEnCours={envoiEnCours}
        onRevenir={onRevenir}
        onConfirmer={confirmer}
        libelleConfirmer="Clôturer quand même"
        libelleEnCours="Clôture..."
      />
    </>
  );
}

function TableauTotaux({ totaux }: { totaux: TotalCloture[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <caption className="sr-only">Totaux par mode de paiement</caption>
        <thead>
          <tr className="text-slate-600 dark:text-slate-400">
            <th scope="col" className="py-2 pr-4 font-medium">
              Mode
            </th>
            <th scope="col" className="py-2 pr-4 font-medium text-right">
              Attendu
            </th>
            <th scope="col" className="py-2 pr-4 font-medium text-right">
              Compté
            </th>
            <th scope="col" className="py-2 font-medium text-right">
              Écart
            </th>
          </tr>
        </thead>
        <tbody className="text-slate-900 dark:text-white">
          {totaux.map((t) => (
            <tr key={t.mode} className="border-t border-slate-200 dark:border-slate-800">
              <th scope="row" className="py-3 pr-4 font-medium text-left">
                {t.libelle}
              </th>
              <td className="py-3 pr-4 text-right whitespace-nowrap">{formaterGNF(t.theorique)}</td>
              {t.compte === null ? (
                <td className="py-3 pr-4 text-right">
                  <span>non rapproché</span>
                  {t.sessionsNonRapprochees === undefined ? (
                    <span className="block text-xs text-slate-600 dark:text-slate-400">
                      Aucun relevé n&apos;a été saisi pour ce mode à la fermeture d&apos;au moins une caisse.
                    </span>
                  ) : (
                    t.sessionsNonRapprochees > 0 && (
                      <span className="block text-xs text-slate-600 dark:text-slate-400">
                        {t.sessionsNonRapprochees} caisse(s) sans relevé
                      </span>
                    )
                  )}
                </td>
              ) : (
                <td className="py-3 pr-4 text-right whitespace-nowrap">{formaterGNF(t.compte)}</td>
              )}
              <td
                className={`py-3 text-right whitespace-nowrap ${t.ecart !== null && t.ecart < 0 ? "text-rose-700 dark:text-rose-300" : ""}`}
              >
                {t.compte === null || t.ecart === null ? "" : libelleEcart(t.ecart)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function CloturesPage() {
  const { user, loading, profile } = useAuth();
  const structureId = user?.structureId;
  const peutVoirAnomalies = user ? lireContexteAcces(user, profile ?? null).permissions.has("anomalie:gerer") : false;
  const aujourdhui = jourConakry(new Date());

  const [jour, setJour] = useState(aujourdhui);
  const [version, setVersion] = useState(0);
  const [preparation, setPreparation] = useState<PreparationCloture | null>(null);
  const [erreurPreparation, setErreurPreparation] = useState<{ jour: string; message: string; reseau: boolean } | null>(null);
  const [remontees, setRemontees] = useState<RemonteeApresCloture[] | null>(null);
  const [totalRemontees, setTotalRemontees] = useState(0);
  const [erreurRemontees, setErreurRemontees] = useState(false);
  const [moisCharge, setMoisCharge] = useState<{ mois: string; clotures: Cloture[] } | null>(null);
  const [erreurMois, setErreurMois] = useState<string | null>(null);

  const [confirmationOuverte, setConfirmationOuverte] = useState(false);
  const [forcageOuvert, setForcageOuvert] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreurDialogue, setErreurDialogue] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const [refus, setRefus] = useState<string | null>(null);
  const [erreurCloture, setErreurCloture] = useState<{ titre: string; liste: string[] } | null>(null);
  const [incertain, setIncertain] = useState(false);
  const [exportEnCours, setExportEnCours] = useState(false);
  const [erreurExport, setErreurExport] = useState<string | null>(null);

  const mois = jour.slice(0, 7);
  const recharger = useCallback(() => setVersion((n) => n + 1), []);

  useEffect(() => {
    if (!structureId) return;
    let actif = true;
    getPreparationCloture(structureId, jour)
      .then((res) => {
        if (!actif) return;
        setPreparation(res.data);
        setErreurPreparation(null);
      })
      .catch((err) => {
        if (!actif) return;
        const reseau = estErreurReseau(err);
        setErreurPreparation({
          jour,
          reseau,
          message: reseau ? "La journée n'a pas pu être chargée. Vérifiez votre connexion puis réessayez." : messageErreurPour(err, "La journée n'a pas pu être chargée."),
        });
      });
    return () => {
      actif = false;
    };
  }, [structureId, jour, version]);

  useEffect(() => {
    if (!structureId || !peutVoirAnomalies) return;
    let actif = true;
    listerRemonteesApresCloture(structureId)
      .then((liste) => {
        if (!actif) return;
        setRemontees(liste.anomalies);
        setTotalRemontees(liste.total);
        setErreurRemontees(false);
      })
      .catch(() => {
        if (actif) setErreurRemontees(true);
      });
    return () => {
      actif = false;
    };
  }, [structureId, peutVoirAnomalies, version]);

  useEffect(() => {
    if (!structureId) return;
    let actif = true;
    listerClotures(structureId, mois)
      .then((res) => {
        if (!actif) return;
        setMoisCharge({ mois, clotures: res.data.clotures });
        setErreurMois(null);
      })
      .catch(() => {
        if (actif) setErreurMois(mois);
      });
    return () => {
      actif = false;
    };
  }, [structureId, mois, version]);

  const choisirJour = (nouveau: string) => {
    if (nouveau === "" || nouveau === jour) return;
    setJour(nouveau);
    setSucces(null);
    setRefus(null);
    setErreurCloture(null);
    setIncertain(false);
    setErreurExport(null);
    setConfirmationOuverte(false);
    setForcageOuvert(false);
  };

  const verifier = () => {
    setIncertain(false);
    // Si la relecture échoue, l'erreur s'affiche à la place de l'état d'avant, qui n'est peut-être plus vrai.
    setPreparation(null);
    recharger();
  };

  const cloturer = async (corps: { jour: string; forcer?: true; motifForcage?: string }) => {
    if (!structureId || envoi) return;
    setEnvoi(true);
    setErreurDialogue(null);
    setSucces(null);
    setRefus(null);
    setErreurCloture(null);
    setIncertain(false);
    try {
      const res = await cloturerJournee(structureId, corps);
      setConfirmationOuverte(false);
      setForcageOuvert(false);
      setSucces(res.message || `La journée du ${formaterJour(corps.jour)} est clôturée.`);
      // Relecture immédiate : le bouton reste désactivé (envoi en cours) jusqu'à ce que la journée apparaisse clôturée.
      try {
        const relue = await getPreparationCloture(structureId, corps.jour);
        setPreparation(relue.data);
        setErreurPreparation(null);
      } catch {
        // La relecture a échoué : le rechargement ci-dessous réessaie, sans laisser croire que la journée reste à clôturer.
        setPreparation(null);
      }
      recharger();
    } catch (err) {
      const code = codeErreur(err);
      if (code === "MOTIF_REQUIS") {
        setErreurDialogue(messageErreurPour(err, "Indiquez un motif de 3 à 500 caractères."));
        return;
      }
      setConfirmationOuverte(false);
      setForcageOuvert(false);
      if (code === "JOURNEE_DEJA_CLOTUREE") {
        // La préparation rechargée montre la clôture : rien à signaler.
        setPreparation(null);
        recharger();
      } else if (code === "CLOTURE_INCOMPLETE" || code === "CAISSES_A_FERMER") {
        const liste = detailsErreur(err)
          .map((d) => d.message)
          .filter((m): m is string => typeof m === "string" && m !== "");
        setErreurCloture({ titre: messageErreurPour(err, "La journée ne peut pas encore être clôturée."), liste });
        recharger();
      } else if (estErreurReseau(err)) {
        // Issue inconnue : jamais de renvoi automatique, la personne vérifie d'abord la journée.
        setIncertain(true);
      } else {
        setRefus(messageErreurPour(err, "La clôture n'a pas pu être enregistrée. Réessayez dans un instant."));
      }
    } finally {
      setEnvoi(false);
    }
  };

  const telecharger = async () => {
    if (!structureId || exportEnCours) return;
    setErreurExport(null);
    setExportEnCours(true);
    try {
      const { blob, filename } = await exporterCloture(structureId, jour);
      const url = URL.createObjectURL(blob);
      const lien = document.createElement("a");
      lien.href = url;
      lien.download = filename;
      document.body.appendChild(lien);
      lien.click();
      lien.remove();
      // Lien temporaire révoqué après usage
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (err) {
      setErreurExport(estErreurReseau(err) ? MESSAGE_EXPORT_RESEAU : messageErreurPour(err, MESSAGE_EXPORT_RESEAU));
    } finally {
      setExportEnCours(false);
    }
  };

  const enTete = (
    <div>
      <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white" style={POLICE_TITRE}>
        Clôture de caisse
      </h1>
      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
        Vérifiez les caisses de la journée, puis clôturez-la. Une journée clôturée ne change plus.
      </p>
    </div>
  );

  if (loading || user === null) {
    return (
      <div role="status" className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
        Chargement...
      </div>
    );
  }

  if (!structureId) {
    return (
      <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
        {enTete}
        <div className={CARTE}>
          <p className="text-sm text-slate-700 dark:text-slate-300">
            Votre compte n&apos;est rattaché à aucune pharmacie. Adressez-vous à l&apos;administrateur de votre pharmacie.
          </p>
          <Link href="/dashboard" className={`${BOUTON_PRIMAIRE} mt-4`}>
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    );
  }

  const prepActuelle = preparation !== null && preparation.jour === jour ? preparation : null;
  const erreurActuelle = erreurPreparation !== null && erreurPreparation.jour === jour ? erreurPreparation : null;
  const cloture = prepActuelle?.cloture ?? null;

  const selecteurJour = (
    <div className={CARTE}>
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label htmlFor="jour-cloture" className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">
            Journée à vérifier
          </label>
          <input
            id="jour-cloture"
            type="date"
            max={aujourdhui}
            value={jour}
            onChange={(e) => choisirJour(e.target.value)}
            className={CHAMP}
          />
        </div>
        {jour !== aujourdhui && (
          <button type="button" onClick={() => choisirJour(aujourdhui)} className={`${LIEN} text-sm pb-3`}>
            Aujourd&apos;hui
          </button>
        )}
      </div>
      <h2 className="text-lg font-bold text-slate-900 dark:text-white mt-4 capitalize" style={POLICE_TITRE}>
        {formaterJour(jour)}
      </h2>
    </div>
  );

  const blocRetour = (
    <>
      {succes !== null && (
        <p role="status" className={ALERTE_SUCCES}>
          <CircleCheck className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
          <span>{succes}</span>
        </p>
      )}
      {refus !== null && (
        <div role="alert" className={ALERTE_ERREUR}>
          <AlertCircle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
          <span>{refus}</span>
        </div>
      )}
      {erreurCloture !== null && (
        <div role="alert" className={ALERTE_ERREUR}>
          <AlertCircle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
          <div className="space-y-2">
            <p className="font-bold">{erreurCloture.titre}</p>
            {erreurCloture.liste.length > 0 && (
              <ul className="list-disc pl-5 space-y-1">
                {erreurCloture.liste.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
      {incertain && (
        <div className="space-y-3">
          <div role="alert" className={ALERTE_ERREUR}>
            <AlertCircle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
            <span>{MESSAGE_CLOTURE_INCERTAINE}</span>
          </div>
          <button type="button" onClick={verifier} className={BOUTON_PRIMAIRE}>
            Vérifier
          </button>
        </div>
      )}
    </>
  );

  const blocRemontees = peutVoirAnomalies && (erreurRemontees || (remontees !== null && remontees.length > 0)) && (
    <section className={CARTE} aria-labelledby="titre-remontees">
      <h2 id="titre-remontees" className="text-lg font-bold text-slate-900 dark:text-white mb-4" style={POLICE_TITRE}>
        Sommes arrivées après une clôture (toutes journées)
      </h2>
      {erreurRemontees ? (
        <p className="text-sm text-slate-700 dark:text-slate-300">
          Les sommes arrivées après une clôture n&apos;ont pas pu être vérifiées.
        </p>
      ) : (
        <div className="space-y-4">
          <ul className="space-y-3">
            {(remontees ?? []).map((a) => (
              <li key={a.id} className={ALERTE_ATTENTION}>
                <span>{typeof a.details.message === "string" && a.details.message !== "" ? a.details.message : a.libelle}</span>
              </li>
            ))}
          </ul>
          {totalRemontees > (remontees ?? []).length && (
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              et {totalRemontees - (remontees ?? []).length} autres, à voir dans les anomalies
            </p>
          )}
          <p className="text-sm text-slate-700 dark:text-slate-300">
            Ces sommes ne figurent dans le total d&apos;aucune clôture. Traitez-les dans les{" "}
            <Link href="/dashboard/anomalies?type=REMONTEE_APRES_CLOTURE" className={LIEN}>
              anomalies
            </Link>
            .
          </p>
        </div>
      )}
    </section>
  );

  const clotures = moisCharge !== null && moisCharge.mois === mois ? moisCharge.clotures : null;
  const blocMois = (
    <section className={CARTE} aria-labelledby="titre-mois">
      <h2 id="titre-mois" className="text-lg font-bold text-slate-900 dark:text-white mb-4" style={POLICE_TITRE}>
        Journées clôturées ce mois-ci
      </h2>
      {clotures === null ? (
        erreurMois === mois ? (
          <p className="text-sm text-slate-700 dark:text-slate-300">
            Les journées clôturées de ce mois n&apos;ont pas pu être chargées.
          </p>
        ) : (
          <p role="status" className="text-sm text-slate-600 dark:text-slate-400">
            Chargement...
          </p>
        )
      ) : clotures.length === 0 ? (
        <p className="text-sm text-slate-700 dark:text-slate-300">Aucune journée clôturée ce mois-ci.</p>
      ) : (
        <ul className="divide-y divide-slate-200 dark:divide-slate-800">
          {clotures.map((c) => {
            const especes = c.totaux.find((t) => t.mode === "ESPECES");
            return (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm text-slate-900 dark:text-white">
                <span className="capitalize">
                  {formaterJour(c.jour)}
                  {c.forcee && <span className="normal-case text-amber-700 dark:text-amber-300">, forcée</span>}
                </span>
                <span className="flex items-center gap-4">
                  {especes !== undefined && <span className="whitespace-nowrap">Espèces attendues : {formaterGNF(especes.theorique)}</span>}
                  <button type="button" onClick={() => choisirJour(c.jour)} className={LIEN} aria-label={`Voir la journée du ${formaterJour(c.jour)}`}>
                    Voir
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );

  let corps: ReactNode;
  if (erreurActuelle !== null && prepActuelle === null) {
    corps = erreurActuelle.reseau ? (
      <ErreurAvecReessai message={erreurActuelle.message} onReessayer={() => setVersion((n) => n + 1)} />
    ) : (
      <div className={CARTE}>
        <div role="alert" className={ALERTE_ERREUR}>
          <AlertCircle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
          <span>{erreurActuelle.message}</span>
        </div>
      </div>
    );
  } else if (prepActuelle === null) {
    corps = (
      <div role="status" className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
        Chargement de la journée...
      </div>
    );
  } else if (cloture !== null) {
    corps = (
      <>
        <p role="status" className={ALERTE_SUCCES}>
          <CalendarCheck className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
          <span>
            Journée clôturée le {formaterDateHeure(cloture.clotureeLe)} par {cloture.clotureParNom ?? "un administrateur"}.
          </span>
        </p>
        {cloture.forcee && (
          <div role="status" className={ALERTE_ATTENTION}>
            <AlertCircle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
            <div className="space-y-2">
              <p className="font-bold">Clôture forcée. Motif : {cloture.motifForcage}</p>
              {cloture.postesManquants.length > 0 && (
                <ul className="list-disc pl-5 space-y-1">
                  {cloture.postesManquants.map((p) => (
                    <li key={p.posteId}>
                      {p.libelle} ({p.posteCode})
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
        <section className={CARTE} aria-labelledby="titre-totaux">
          <h2 id="titre-totaux" className="text-lg font-bold text-slate-900 dark:text-white mb-4" style={POLICE_TITRE}>
            Totaux par mode
          </h2>
          {cloture.totaux.length === 0 ? (
            <p className="text-sm text-slate-700 dark:text-slate-300">Aucun paiement ce jour-là.</p>
          ) : (
            <TableauTotaux totaux={cloture.totaux} />
          )}
        </section>
        <div className="space-y-3">
          <button type="button" onClick={() => void telecharger()} disabled={exportEnCours} className={BOUTON_PRIMAIRE}>
            {exportEnCours ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="w-4 h-4" aria-hidden="true" />
            )}
            {exportEnCours ? "Préparation du fichier..." : "Télécharger le fichier Excel (CSV)"}
          </button>
          {erreurExport !== null && (
            <div role="alert" className={ALERTE_ERREUR}>
              <AlertCircle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
              <span>{erreurExport}</span>
            </div>
          )}
        </div>
      </>
    );
  } else {
    corps = (
      <>
        <section className={CARTE} aria-labelledby="titre-caisses">
          <h2 id="titre-caisses" className="text-lg font-bold text-slate-900 dark:text-white mb-4" style={POLICE_TITRE}>
            Caisses de la journée
          </h2>
          {prepActuelle.sessions.length === 0 ? (
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Aucune caisse ce jour-là. La journée peut être clôturée à vide.
            </p>
          ) : (
            <ul className="divide-y divide-slate-200 dark:divide-slate-800">
              {prepActuelle.sessions.map((s) => (
                <li key={s.id} className="flex flex-wrap items-start justify-between gap-2 py-3 text-sm text-slate-900 dark:text-white">
                  <span>
                    {s.posteLibelle} ({s.posteCode}), {s.utilisateurNom}
                  </span>
                  <span className="text-slate-700 dark:text-slate-300">
                    ouverte à {formaterHeure(s.ouverteLe)}, {libelleStatut(s)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {prepActuelle.postesAttendus.length > 0 && (
          <section className={CARTE} aria-labelledby="titre-a-regler">
            <h2 id="titre-a-regler" className="text-lg font-bold text-slate-900 dark:text-white mb-4" style={POLICE_TITRE}>
              À régler avant de clôturer
            </h2>
            <ul className="space-y-3">
              {prepActuelle.postesAttendus.map((p) => (
                <li key={p.posteId} className={ALERTE_ATTENTION}>
                  <div className="space-y-1">
                    <p className="font-bold">
                      {p.libelle} ({p.posteCode}){p.utilisateurNom ? `, ${p.utilisateurNom}` : ""}
                    </p>
                    <p>{p.message}</p>
                    {p.type === "WEB" && (
                      <p>Le vendeur doit fermer sa caisse depuis «&nbsp;Ma caisse&nbsp;», avec le comptage.</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className={CARTE} aria-labelledby="titre-totaux">
          <h2 id="titre-totaux" className="text-lg font-bold text-slate-900 dark:text-white mb-4" style={POLICE_TITRE}>
            Totaux par mode
          </h2>
          {prepActuelle.totaux.length === 0 ? (
            <p className="text-sm text-slate-700 dark:text-slate-300">Aucun paiement enregistré ce jour-là.</p>
          ) : (
            <TableauTotaux totaux={prepActuelle.totaux} />
          )}
        </section>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                setErreurDialogue(null);
                setConfirmationOuverte(true);
              }}
              disabled={!prepActuelle.peutCloturer || envoi || incertain}
              className={BOUTON_PRIMAIRE}
            >
              Clôturer la journée
            </button>
            {prepActuelle.peutForcer && (
              <button
                type="button"
                onClick={() => {
                  setErreurDialogue(null);
                  setForcageOuvert(true);
                }}
                disabled={envoi || incertain}
                className={`${BOUTON_SECONDAIRE} border border-slate-200 dark:border-slate-700`}
              >
                Clôturer quand même (poste hors connexion)
              </button>
            )}
          </div>
          {!prepActuelle.peutCloturer && (
            <p className={ALERTE_INFO}>Réglez les points ci-dessus pour pouvoir clôturer.</p>
          )}
        </div>

        <Dialogue
          isOpen={confirmationOuverte}
          onClose={() => setConfirmationOuverte(false)}
          envoiEnCours={envoi}
          titre={`Clôturer la journée du ${formaterJour(jour)} ?`}
        >
          <p className="text-sm text-slate-700 dark:text-slate-200">
            Après la clôture, plus aucune vente ni correction ne peut être ajoutée à cette journée : une correction se fera par une annulation, comptée le jour où elle est faite.
          </p>
          <BoutonsDialogue
            envoiEnCours={envoi}
            onRevenir={() => setConfirmationOuverte(false)}
            onConfirmer={() => void cloturer({ jour })}
            libelleConfirmer="Confirmer la clôture"
            libelleEnCours="Clôture..."
          />
        </Dialogue>

        <Dialogue
          isOpen={forcageOuvert}
          onClose={() => setForcageOuvert(false)}
          envoiEnCours={envoi}
          titre="Clôturer sans le poste hors connexion ?"
        >
          <ContenuForcage
            postes={prepActuelle.postesAttendus}
            envoiEnCours={envoi}
            erreur={erreurDialogue}
            onRevenir={() => setForcageOuvert(false)}
            onConfirmer={(motif) => void cloturer({ jour, forcer: true, motifForcage: motif })}
          />
        </Dialogue>
      </>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      {enTete}
      {selecteurJour}
      {blocRetour}
      {corps}
      {blocRemontees}
      {blocMois}
    </div>
  );
}
