"use client";

import { Suspense, useEffect, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useDialogA11y } from "@/hooks/useDialogA11y";
import { messageErreurPour } from "@/hooks/useToast";
import { lireContexteAcces } from "@/lib/acces";
import { listerAnomalies, traiterAnomalie, type Anomalie, type PageAnomalies, type TypeAnomalie } from "@/lib/api_pilotage";
import { codeErreur, estErreurReseau } from "@/lib/erreurs_api";
import { formaterGNF } from "@/lib/format_gnf";
import {
  ALERTE_SUCCES,
  BOUTON_PRIMAIRE,
  BOUTON_SECONDAIRE,
  CARTE,
  CHAMP,
  FOCUS,
  POLICE_TITRE,
} from "@/components/pharmacie/classes";
import { ErreurAvecReessai } from "@/components/pharmacie/ErreurAvecReessai";
import { formaterDateHeure } from "../ventes/affichage";

type Onglet = "OUVERTE" | "TRAITEE";

/** Types proposés dans le filtre, avec leur libellé pour le titulaire. */
const FILTRES_TYPE: { type: TypeAnomalie; libelle: string }[] = [
  { type: "STOCK_NEGATIF", libelle: "Vente sans stock" },
  { type: "ECART_INVENTAIRE", libelle: "Écart d'inventaire" },
  { type: "CONDITIONNEMENT_CONCURRENT", libelle: "Deux boîtes entamées du même lot" },
  { type: "REMONTEE_APRES_CLOTURE", libelle: "Vente remontée après la clôture" },
  { type: "ECART_CAISSE", libelle: "Écart de caisse" },
  { type: "FOND_NON_COMPTE", libelle: "Fond de caisse non compté" },
  { type: "PLAGE_EPUISEE", libelle: "Numéros de tickets épuisés" },
  { type: "PRIX_DIVERGENT", libelle: "Prix différent du prix enregistré" },
  { type: "ORDONNANCE_NON_CONFIRMEE", libelle: "Ordonnance non confirmée" },
  { type: "VENTE_UNITE_INTERDITE", libelle: "Vente à l'unité signalée" },
  { type: "PRODUIT_ARCHIVE", libelle: "Médicament archivé vendu" },
  { type: "EVENEMENT_REJETE", libelle: "Opération de caisse rejetée" },
  { type: "SEQUENCE_MANQUANTE", libelle: "Opération de caisse manquante" },
];

const MESSAGE_RESEAU = "Le traitement n'a peut-être pas été enregistré. Fermez cette fenêtre et vérifiez la liste.";
const MESSAGE_COMMENTAIRE = "Indiquez ce que vous avez vérifié ou fait (3 caractères au moins).";
const LONGUEUR_MAX_COMMENTAIRE = 500;
const BOUTON_PAGE = `px-4 py-2 rounded-2xl text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${FOCUS}`;

type Etat = { statut: "chargement" } | { statut: "pret"; donnees: PageAnomalies } | { statut: "erreur"; message: string };

/** Libellé de l'anomalie : un seul par type connu (le même que le filtre), sinon celui du serveur pour un type inconnu. */
const titreAnomalie = (a: Anomalie) =>
  FILTRES_TYPE.find((f) => f.type === a.type)?.libelle ?? (a.libelle.trim() !== "" ? a.libelle : "Anomalie");

/** Somme à rapprocher à la main : `details.total` (vente remontée) ou `montantEncaisse` (caisse fermée après la clôture). */
function montantAnomalie(a: Anomalie): number | null {
  if (a.type !== "REMONTEE_APRES_CLOTURE") return null;
  const brut = typeof a.details?.montantEncaisse === "number" ? a.details.montantEncaisse : a.details?.total;
  return typeof brut === "number" && Number.isFinite(brut) ? brut : null;
}

/** Type demandé par l'adresse (`?type=`), ignoré s'il est inconnu. */
function typeDepuisAdresse(valeur: string | null): TypeAnomalie | "" {
  return FILTRES_TYPE.find((f) => f.type === valeur)?.type ?? "";
}

const texteDetail = (a: Anomalie) =>
  typeof a.details?.message === "string" && a.details.message !== "" ? a.details.message : "Pas de détail.";

interface TraitementProps {
  anomalie: Anomalie;
  envoiEnCours: boolean;
  erreur: string | null;
  /** Vrai quand un nouvel envoi serait refusé : seul le bouton de fermeture reste actif. */
  bloque: boolean;
  onClose: () => void;
  onEnregistrer: (commentaire: string) => void;
}

function ContenuTraitement({ anomalie, envoiEnCours, erreur, bloque, onClose, onEnregistrer, dialogProps, titleId }: TraitementProps & {
  dialogProps: ReturnType<typeof useDialogA11y>["dialogProps"];
  titleId: string;
}) {
  const [commentaire, setCommentaire] = useState("");
  const [refuse, setRefuse] = useState(false);
  const champ = useRef<HTMLTextAreaElement>(null);

  const enregistrer = () => {
    if (commentaire.trim().length < 3) {
      setRefuse(true);
      champ.current?.focus();
      return;
    }
    onEnregistrer(commentaire.trim());
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
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-500/15 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
            </div>
            <h3 id={titleId} className="text-xl font-bold text-slate-900 dark:text-white">
              Marquer comme traitée
            </h3>
          </div>

          <div className="space-y-1 text-sm text-slate-700 dark:text-slate-200">
            <p className="font-bold text-slate-900 dark:text-white">{titreAnomalie(anomalie)}</p>
            <p>{texteDetail(anomalie)}</p>
          </div>

          <div>
            <label htmlFor="commentaire-anomalie" className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">
              Ce que vous avez vérifié ou fait
            </label>
            <textarea
              ref={champ}
              id="commentaire-anomalie"
              rows={3}
              maxLength={LONGUEUR_MAX_COMMENTAIRE}
              value={commentaire}
              onChange={(e) => {
                setCommentaire(e.target.value);
                setRefuse(false);
              }}
              aria-describedby="aide-commentaire-anomalie"
              className={CHAMP}
            />
            <div className="flex items-center justify-between gap-3 mt-1 text-xs text-slate-600 dark:text-slate-400">
              <p id="aide-commentaire-anomalie">Entre 3 et 500 caractères.</p>
              <p>
                {commentaire.length} / {LONGUEUR_MAX_COMMENTAIRE}
              </p>
            </div>
            {refuse && (
              <p role="alert" className="text-sm text-rose-700 dark:text-rose-300 mt-1">
                {MESSAGE_COMMENTAIRE}
              </p>
            )}
          </div>

          {erreur && (
            <div role="alert" className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 text-sm">
              {erreur}
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row gap-3 w-full">
            <button type="button" onClick={onClose} disabled={envoiEnCours} className={`flex-1 ${BOUTON_SECONDAIRE} disabled:opacity-50`}>
              {bloque ? "Fermer" : "Annuler"}
            </button>
            <button
              type="button"
              onClick={enregistrer}
              disabled={envoiEnCours || bloque}
              className={`flex-[2] ${BOUTON_PRIMAIRE}`}
            >
              {envoiEnCours && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              {envoiEnCours ? "Enregistrement..." : "Enregistrer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DialogueTraitement({ cible, envoiEnCours, onClose, ...reste }: Omit<TraitementProps, "anomalie"> & { cible: Anomalie | null }) {
  const { dialogProps, titleId } = useDialogA11y({ isOpen: cible !== null, onClose, closeOnEscape: !envoiEnCours });
  if (!cible) return null;
  return (
    <ContenuTraitement
      key={cible.id}
      {...reste}
      anomalie={cible}
      envoiEnCours={envoiEnCours}
      onClose={onClose}
      dialogProps={dialogProps}
      titleId={titleId}
    />
  );
}

function AnomaliesContenu() {
  const { user, loading, profile } = useAuth();
  const parametres = useSearchParams();
  const structureId = user?.structureId;
  const peutGerer = user ? lireContexteAcces(user, profile ?? null).permissions.has("anomalie:gerer") : false;

  const [onglet, setOnglet] = useState<Onglet>("OUVERTE");
  const [type, setType] = useState<TypeAnomalie | "">(() => typeDepuisAdresse(parametres.get("type")));
  const [page, setPage] = useState(1);
  const [etat, setEtat] = useState<Etat>({ statut: "chargement" });
  const [essai, setEssai] = useState(0);
  const [ouvertes, setOuvertes] = useState<number | null>(null);
  const [cible, setCible] = useState<Anomalie | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreurDialogue, setErreurDialogue] = useState<string | null>(null);
  const [bloque, setBloque] = useState(false);
  const [aVerifier, setAVerifier] = useState(false);
  const [succes, setSucces] = useState<string | null>(null);
  const envoiEnCours = useRef(false);
  const boutonsOnglet = useRef<Record<Onglet, HTMLButtonElement | null>>({ OUVERTE: null, TRAITEE: null });

  useEffect(() => {
    if (!structureId || !peutGerer) return;
    let actif = true;
    listerAnomalies(structureId, { statut: onglet, ...(type !== "" ? { type } : {}), page })
      .then((res) => {
        if (!actif) return;
        setOuvertes(res.data.ouvertes);
        // Dernière page vidée par un traitement : on revient à la page d'avant.
        if (res.data.anomalies.length === 0 && page > 1) {
          setPage(page - 1);
          return;
        }
        setEtat({ statut: "pret", donnees: res.data });
      })
      .catch((err: unknown) => {
        if (!actif) return;
        setEtat({
          statut: "erreur",
          message: messageErreurPour(err, "Impossible d'afficher les anomalies. Vérifiez votre connexion puis réessayez."),
        });
      });
    return () => {
      actif = false;
    };
  }, [structureId, peutGerer, onglet, type, page, essai]);

  const recharger = () => {
    setEtat({ statut: "chargement" });
    setEssai((n) => n + 1);
  };

  const changerOnglet = (nouveau: Onglet) => {
    if (nouveau === onglet) return;
    setSucces(null);
    setOnglet(nouveau);
    setPage(1);
    setEtat({ statut: "chargement" });
  };

  const changerType = (valeur: string) => {
    setType(FILTRES_TYPE.some((f) => f.type === valeur) ? (valeur as TypeAnomalie) : "");
    setPage(1);
    setEtat({ statut: "chargement" });
  };

  const changerPage = (nouvelle: number) => {
    setPage(nouvelle);
    setEtat({ statut: "chargement" });
  };

  const clavierOnglets = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const suivant: Onglet = onglet === "OUVERTE" ? "TRAITEE" : "OUVERTE";
    changerOnglet(suivant);
    boutonsOnglet.current[suivant]?.focus();
  };

  const fermerDialogue = () => {
    setCible(null);
    setErreurDialogue(null);
    setBloque(false);
    if (aVerifier) {
      setAVerifier(false);
      recharger();
    }
  };

  const ouvrirTraitement = (anomalie: Anomalie) => {
    setSucces(null);
    setErreurDialogue(null);
    setBloque(false);
    setAVerifier(false);
    setCible(anomalie);
  };

  const enregistrer = (commentaire: string) => {
    if (!structureId || !cible || envoiEnCours.current) return;
    envoiEnCours.current = true;
    setEnvoi(true);
    setErreurDialogue(null);
    traiterAnomalie(structureId, cible.id, commentaire)
      .then((res) => {
        envoiEnCours.current = false;
        setEnvoi(false);
        setCible(null);
        setSucces(res.message);
        recharger();
      })
      .catch((err: unknown) => {
        envoiEnCours.current = false;
        setEnvoi(false);
        if (estErreurReseau(err)) {
          // Un second envoi serait refusé si le premier avait abouti : on laisse la liste dire ce qu'il en est.
          setBloque(true);
          setAVerifier(true);
          setErreurDialogue(MESSAGE_RESEAU);
        } else if (codeErreur(err) === "ANOMALIE_DEJA_TRAITEE") {
          setBloque(true);
          setAVerifier(true);
          setErreurDialogue(messageErreurPour(err, "Cette anomalie a déjà été traitée."));
        } else {
          setErreurDialogue(messageErreurPour(err, "Un problème est survenu, réessayez dans un instant."));
        }
      });
  };

  if (loading || user === null) {
    return (
      <div role="status" className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
        Chargement...
      </div>
    );
  }

  const enTete = (
    <div>
      <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white" style={POLICE_TITRE}>
        Anomalies
      </h1>
      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
        Ce qui demande votre attention : écarts de caisse et d&apos;inventaire, ventes sans stock, ventes remontées après une clôture.
      </p>
    </div>
  );

  if (!structureId || !peutGerer) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
        {enTete}
        <div className={CARTE}>
          <p className="text-sm text-slate-700 dark:text-slate-300">
            {structureId
              ? "Vous n'avez pas accès aux anomalies de cette pharmacie. Adressez-vous au titulaire."
              : "Votre compte n'est rattaché à aucune pharmacie. Adressez-vous à l'administrateur de votre pharmacie."}
          </p>
          <Link href="/dashboard" className={`${BOUTON_PRIMAIRE} mt-4`}>
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    );
  }

  let corps;
  if (etat.statut === "chargement") {
    corps = (
      <div role="status" className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
        Chargement des anomalies...
      </div>
    );
  } else if (etat.statut === "erreur") {
    corps = <ErreurAvecReessai message={etat.message} onReessayer={recharger} />;
  } else {
    const { anomalies, total, parPage } = etat.donnees;
    const totalPages = Math.max(1, Math.ceil(total / Math.max(1, parPage)));
    corps = (
      <>
        {anomalies.length === 0 ? (
          <div className={CARTE}>
            <p className="text-sm text-slate-700 dark:text-slate-300">
              {type !== ""
                ? onglet === "OUVERTE"
                  ? "Aucune anomalie de ce type à traiter."
                  : "Aucune anomalie traitée pour ce filtre."
                : onglet === "OUVERTE"
                  ? "Aucune anomalie à traiter. Tout est en ordre."
                  : "Aucune anomalie traitée pour ce filtre."}
            </p>
            {type !== "" && (
              <button type="button" onClick={() => changerType("")} className={`${BOUTON_PRIMAIRE} mt-4`}>
                Voir tous les types
              </button>
            )}
          </div>
        ) : (
          <ul className="space-y-4">
            {anomalies.map((a) => (
              <li key={a.id} className={`${CARTE} space-y-3`}>
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white" style={POLICE_TITRE}>
                    {titreAnomalie(a)}
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{formaterDateHeure(a.creeLe)}</p>
                </div>
                {a.attribueeA && <p className="text-sm text-slate-700 dark:text-slate-300">Pour : {a.attribueeA.nom}</p>}
                <p className="text-sm text-slate-800 dark:text-slate-200">{texteDetail(a)}</p>
                {montantAnomalie(a) !== null && (
                  <p className="text-sm font-bold text-slate-900 dark:text-white">Montant : {formaterGNF(montantAnomalie(a) ?? 0)}</p>
                )}
                {a.rattachement && (
                  <>
                    <p className="text-sm text-slate-800 dark:text-slate-200">{a.rattachement.message}</p>
                    {(a.rattachement.etat === "RATTACHEE" || a.rattachement.etat === "VENTE_ANNULEE") && (
                      <div className={ALERTE_SUCCES}>
                        Le stock est déjà régularisé : il reste seulement à confirmer que c&apos;est vérifié.
                      </div>
                    )}
                  </>
                )}
                {a.statut === "TRAITEE" ? (
                  <p className="text-sm text-slate-700 dark:text-slate-300">
                    Traitée{a.traiteeLe ? ` le ${formaterDateHeure(a.traiteeLe)}` : ""}
                    {a.traiteePar ? ` par ${a.traiteePar.nom}` : ""}
                    {a.commentaireTraitement ? ` : ${a.commentaireTraitement}` : ""}
                  </p>
                ) : (
                  <button type="button" onClick={() => ouvrirTraitement(a)} className={BOUTON_PRIMAIRE}>
                    Marquer comme traitée
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {totalPages > 1 && (
          <nav aria-label="Pagination" className="flex items-center justify-between gap-3">
            <button type="button" onClick={() => changerPage(page - 1)} disabled={page <= 1} className={BOUTON_PAGE}>
              Page précédente
            </button>
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Page {page} sur {totalPages}
            </p>
            <button type="button" onClick={() => changerPage(page + 1)} disabled={page >= totalPages} className={BOUTON_PAGE}>
              Page suivante
            </button>
          </nav>
        )}
      </>
    );
  }

  const classeOnglet = (actif: boolean) =>
    `px-4 py-2 rounded-2xl text-sm font-medium transition-colors ${FOCUS} ${
      actif
        ? "bg-primary-600 text-white"
        : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/50"
    }`;

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {enTete}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div role="tablist" aria-label="Statut des anomalies" className="flex gap-2">
          <button
            ref={(el) => {
              boutonsOnglet.current.OUVERTE = el;
            }}
            type="button"
            role="tab"
            id="onglet-ouvertes"
            aria-selected={onglet === "OUVERTE"}
            aria-controls="panneau-anomalies"
            tabIndex={onglet === "OUVERTE" ? 0 : -1}
            onClick={() => changerOnglet("OUVERTE")}
            onKeyDown={clavierOnglets}
            className={classeOnglet(onglet === "OUVERTE")}
          >
            À traiter{ouvertes !== null ? ` (${ouvertes})` : ""}
          </button>
          <button
            ref={(el) => {
              boutonsOnglet.current.TRAITEE = el;
            }}
            type="button"
            role="tab"
            id="onglet-traitees"
            aria-selected={onglet === "TRAITEE"}
            aria-controls="panneau-anomalies"
            tabIndex={onglet === "TRAITEE" ? 0 : -1}
            onClick={() => changerOnglet("TRAITEE")}
            onKeyDown={clavierOnglets}
            className={classeOnglet(onglet === "TRAITEE")}
          >
            Traitées
          </button>
        </div>
        <div>
          <label htmlFor="type-anomalie" className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">
            Type
          </label>
          <select id="type-anomalie" value={type} onChange={(e) => changerType(e.target.value)} className={`${CHAMP} w-auto`}>
            <option value="">Tous les types</option>
            {FILTRES_TYPE.map((f) => (
              <option key={f.type} value={f.type}>
                {f.libelle}
              </option>
            ))}
          </select>
        </div>
      </div>

      {succes && (
        <div role="status" className={ALERTE_SUCCES}>
          {succes}
        </div>
      )}

      <div id="panneau-anomalies" role="tabpanel" aria-labelledby={onglet === "OUVERTE" ? "onglet-ouvertes" : "onglet-traitees"} className="space-y-6">
        {corps}
      </div>

      <DialogueTraitement
        cible={cible}
        envoiEnCours={envoi}
        erreur={erreurDialogue}
        bloque={bloque}
        onClose={fermerDialogue}
        onEnregistrer={enregistrer}
      />
    </div>
  );
}

export default function AnomaliesPage() {
  return (
    <Suspense
      fallback={
        <div role="status" className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
          Chargement...
        </div>
      }
    >
      <AnomaliesContenu />
    </Suspense>
  );
}
