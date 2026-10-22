"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, Ban, Loader2, Printer, ShoppingCart, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { messageErreurPour, useToast } from "@/hooks/useToast";
import { lireContexteAcces } from "@/lib/acces";
import { ApiError } from "@/lib/api_auth";
import {
  annulerVente,
  codeErreurVente,
  listerVentes,
  type VenteResume,
  type VentesDuJour,
} from "@/lib/api_ventes";
import { formaterGNF } from "@/lib/format_gnf";
import { estRouteAutorisee } from "@/lib/navigation_tableau_de_bord";
import { AnnulationVente } from "./AnnulationVente";
import { LIBELLES_STATUT, formaterHeure, formaterJour, jourConakry, libelleArticles } from "./affichage";

const POLICE_TITRE = { fontFamily: "var(--font-outfit, var(--font-inter))" } as const;

const CARTE = "bg-white dark:bg-[#0f172a]/80 border border-slate-200 dark:border-slate-800/50 rounded-3xl p-6";
const CHAMP =
  "w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm text-slate-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 transition-all";
const FOCUS = "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500";
const BOUTON_PRIMAIRE = `inline-flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl text-sm font-bold transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${FOCUS}`;
const BOUTON_PAGE = `px-4 py-2 rounded-2xl text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${FOCUS}`;

const FORMAT_JOUR = /^\d{4}-\d{2}-\d{2}$/;
const STATUTS_RESEAU = [0, 502, 503, 504];

const CLASSES_STATUT = {
  VALIDEE: "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  ANNULEE: "bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300",
} as const;

type Etat =
  | { statut: "chargement" }
  | { statut: "pret"; journee: VentesDuJour }
  | { statut: "erreur"; message: string };

const libelleNombre = (n: number) => (n === 0 ? "Aucune vente" : n === 1 ? "1 vente" : `${n} ventes`);

export default function VentesDuJourPage() {
  const { user, loading, profile } = useAuth();
  const { notifier } = useToast();
  const structureId = user?.structureId;
  const contexte = user ? lireContexteAcces(user, profile ?? null) : null;
  const peutAnnuler = contexte?.permissions.has("vente:annuler") ?? false;
  const peutVendre = contexte !== null && estRouteAutorisee("/dashboard/vente", contexte);

  const aujourdhui = jourConakry(new Date());
  const [date, setDate] = useState(aujourdhui);
  const [page, setPage] = useState(1);
  const [etat, setEtat] = useState<Etat>({ statut: "chargement" });
  const [essai, setEssai] = useState(0);
  const [cible, setCible] = useState<VenteResume | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreurDialogue, setErreurDialogue] = useState<string | null>(null);
  const [bandeau, setBandeau] = useState<string | null>(null);
  const envoiEnCours = useRef(false);

  useEffect(() => {
    if (!structureId) return;
    let actif = true;
    listerVentes(structureId, { date, page })
      .then((res) => {
        if (actif) setEtat({ statut: "pret", journee: res.data });
      })
      .catch((err: unknown) => {
        if (!actif) return;
        setEtat({
          statut: "erreur",
          message: messageErreurPour(err, "Impossible d'afficher les ventes. Vérifiez votre connexion puis réessayez."),
        });
      });
    return () => {
      actif = false;
    };
  }, [structureId, date, page, essai]);

  const recharger = () => {
    setEtat({ statut: "chargement" });
    setEssai((n) => n + 1);
  };

  const changerDate = (valeur: string) => {
    if (!FORMAT_JOUR.test(valeur)) return;
    setDate(valeur);
    setPage(1);
    setEtat({ statut: "chargement" });
  };

  const changerPage = (nouvelle: number) => {
    setPage(nouvelle);
    setEtat({ statut: "chargement" });
  };

  const fermerDialogue = () => {
    setCible(null);
    setErreurDialogue(null);
  };

  const ouvrirAnnulation = (vente: VenteResume) => {
    setBandeau(null);
    setErreurDialogue(null);
    setCible(vente);
  };

  const refuser = (message: string) => {
    fermerDialogue();
    setBandeau(message);
    recharger();
  };

  const confirmerAnnulation = (motif: string) => {
    if (!structureId || !cible || envoiEnCours.current) return;
    envoiEnCours.current = true;
    setEnvoi(true);
    setErreurDialogue(null);
    annulerVente(structureId, cible.id, motif)
      .then((res) => {
        envoiEnCours.current = false;
        setEnvoi(false);
        fermerDialogue();
        notifier(res.message, "succes");
        recharger();
      })
      .catch((err: unknown) => {
        envoiEnCours.current = false;
        setEnvoi(false);
        const code = codeErreurVente(err);
        if (code === "VENTE_DEJA_ANNULEE") {
          refuser("Cette vente avait déjà été annulée. La liste a été mise à jour.");
        } else if (code === "ANNULATION_HORS_DELAI") {
          refuser("Cette vente ne peut plus être annulée : une vente s'annule seulement le jour même.");
        } else if (code === "VALIDATION") {
          setErreurDialogue(messageErreurPour(err, "Indiquez un motif de 3 à 300 caractères."));
        } else if (err instanceof ApiError && STATUTS_RESEAU.includes(err.status)) {
          setErreurDialogue("L'annulation n'a pas pu être envoyée. Vérifiez votre connexion puis réessayez.");
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
        Ventes du jour
      </h1>
      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
        Retrouvez les ventes d&apos;une journée, réimprimez un reçu ou annulez une vente du jour.
      </p>
    </div>
  );

  if (!structureId) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
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

  const lienNouvelleVente = (
    <Link href="/dashboard/vente" className={BOUTON_PRIMAIRE}>
      <ShoppingCart className="w-4 h-4" aria-hidden="true" />
      Nouvelle vente
    </Link>
  );

  let corps;
  if (etat.statut === "chargement") {
    corps = (
      <div role="status" className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
        Chargement des ventes...
      </div>
    );
  } else if (etat.statut === "erreur") {
    corps = (
      <div className={CARTE}>
        <div
          role="alert"
          className="flex items-center gap-3 p-4 rounded-2xl bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 text-sm"
        >
          <AlertCircle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
          <span>{etat.message}</span>
        </div>
        <button type="button" onClick={recharger} className={`${BOUTON_PRIMAIRE} mt-4`}>
          Réessayer
        </button>
      </div>
    );
  } else {
    const journee = etat.journee;
    corps = (
      <>
        <section className={`${CARTE} space-y-1`} aria-labelledby="titre-resume">
          <h2
            id="titre-resume"
            className="text-lg font-semibold text-slate-900 dark:text-white first-letter:uppercase"
            style={POLICE_TITRE}
          >
            {formaterJour(date)}
          </h2>
          <p aria-live="polite" className="text-slate-900 dark:text-white">
            Total des ventes validées : <span className="font-bold">{formaterGNF(journee.totalJour)}</span>
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-400">Montant indicatif, sans les ventes annulées.</p>
          <p className="text-sm text-slate-700 dark:text-slate-300">{libelleNombre(journee.nombre)}</p>
        </section>

        {journee.ventes.length === 0 ? (
          <div className={CARTE}>
            <p className="text-sm text-slate-700 dark:text-slate-300">Aucune vente le {formaterJour(date)}.</p>
            {date === aujourdhui && peutVendre && <div className="mt-4">{lienNouvelleVente}</div>}
          </div>
        ) : (
          <div className={CARTE}>
            <ul className="divide-y divide-slate-200 dark:divide-slate-800">
              {journee.ventes.map((v) => (
                <li key={v.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 dark:text-white">{v.numero}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {`${formaterHeure(v.createdAt)} · ${libelleArticles(v.nombreArticles)} · ${v.vendeur.nom}`}
                      {v.clientNom ? ` · Client : ${v.clientNom}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-bold text-slate-900 dark:text-white whitespace-nowrap">
                      {formaterGNF(v.total)}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${CLASSES_STATUT[v.statut]}`}>
                      {LIBELLES_STATUT[v.statut]}
                    </span>
                    <Link
                      href={`/dashboard/ventes/${encodeURIComponent(v.id)}/recu`}
                      aria-label={`Réimprimer le reçu ${v.numero}`}
                      className={`inline-flex items-center gap-1.5 px-2 py-2 rounded-xl text-sm font-medium text-primary-700 dark:text-primary-300 hover:bg-slate-100 dark:hover:bg-slate-800/50 ${FOCUS}`}
                    >
                      <Printer className="w-4 h-4" aria-hidden="true" />
                      Réimprimer
                    </Link>
                    {peutAnnuler && v.statut === "VALIDEE" && date === aujourdhui && (
                      <button
                        type="button"
                        onClick={() => ouvrirAnnulation(v)}
                        aria-label={`Annuler la vente ${v.numero}`}
                        className={`inline-flex items-center gap-1.5 px-2 py-2 rounded-xl text-sm font-medium text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-500/15 ${FOCUS}`}
                      >
                        <Ban className="w-4 h-4" aria-hidden="true" />
                        Annuler
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {journee.totalPages > 1 && (
          <nav aria-label="Pagination" className="flex items-center justify-between gap-3">
            <button type="button" onClick={() => changerPage(page - 1)} disabled={page <= 1} className={BOUTON_PAGE}>
              Page précédente
            </button>
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Page {page} sur {journee.totalPages}
            </p>
            <button
              type="button"
              onClick={() => changerPage(page + 1)}
              disabled={page >= journee.totalPages}
              className={BOUTON_PAGE}
            >
              Page suivante
            </button>
          </nav>
        )}
      </>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {enTete}

      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label htmlFor="date-ventes" className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">
            Date
          </label>
          <input
            id="date-ventes"
            type="date"
            max={aujourdhui}
            value={date}
            onChange={(e) => changerDate(e.target.value)}
            className={`${CHAMP} w-auto`}
          />
        </div>
        {peutVendre && lienNouvelleVente}
      </div>

      {bandeau && (
        <div
          role="alert"
          className="flex items-start gap-3 p-4 rounded-2xl bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 text-sm"
        >
          <AlertCircle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
          <p className="flex-1">{bandeau}</p>
          <button
            type="button"
            onClick={() => setBandeau(null)}
            aria-label="Fermer le message"
            className={`p-1 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-500/20 ${FOCUS}`}
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {corps}

      <AnnulationVente
        key={cible?.numero ?? "aucune"}
        isOpen={cible !== null}
        numero={cible?.numero ?? ""}
        total={cible?.total ?? 0}
        envoiEnCours={envoi}
        erreur={erreurDialogue}
        onClose={fermerDialogue}
        onConfirmer={confirmerAnnulation}
      />
    </div>
  );
}
