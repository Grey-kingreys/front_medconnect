"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, ClipboardList, Receipt, ShoppingCart, Wallet } from "lucide-react";
import { ApiError } from "@/lib/api_auth";
import { listerVentes } from "@/lib/api_ventes";
import { formaterGNF } from "@/lib/format_gnf";
import { resumerMesVentes, type ResumeMesVentes } from "@/lib/ventes_tableau_de_bord";
import ApercuPharmacie, { Carte, Chargement, Valeur, pluriel } from "./ApercuPharmacie";
import type { LienVue } from "./PilotagePharmacie";

export interface DroitsComptoir {
  /** Route /dashboard/vente autorisée. */
  peutVendre: boolean;
  /** Route /dashboard/ventes autorisée. */
  peutVoirVentes: boolean;
  /** Route /dashboard/ordonnances autorisée. */
  peutVoirOrdonnances: boolean;
  /** Route /dashboard/stock autorisée. */
  peutVoirStock: boolean;
  /** Route /dashboard/membres autorisée. */
  peutVoirEquipe: boolean;
}

/** Raccourcis de tête de la vue comptoir, dans l'ordre d'affichage. */
export function liensComptoir(d: DroitsComptoir): LienVue[] {
  const liens: LienVue[] = [];
  if (d.peutVendre) liens.push({ href: "/dashboard/vente", libelle: "Nouvelle vente", icone: ShoppingCart });
  if (d.peutVoirOrdonnances) liens.push({ href: "/dashboard/ordonnances", libelle: "Ordonnances reçues", icone: ClipboardList });
  if (d.peutVoirVentes) liens.push({ href: "/dashboard/ventes", libelle: "Voir toutes les ventes du jour", icone: Receipt });
  return liens;
}

type EtatVentes =
  | { statut: "chargement" }
  | { statut: "pret"; resume: ResumeMesVentes }
  | { statut: "erreur" }
  | { statut: "masque" };

const CLASSES_BLOC = "bg-white dark:bg-[#0f172a]/80 border border-slate-200 dark:border-slate-800/50 rounded-2xl p-5";
const CLASSES_VENTE =
  "inline-flex items-center justify-center gap-3 px-6 py-4 rounded-2xl text-lg font-semibold bg-primary-600 text-white hover:bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 w-full sm:w-auto";
const CLASSES_ORDONNANCES =
  "inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl text-base font-medium border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white hover:border-primary-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 w-full sm:w-auto";

export default function ComptoirPharmacie({
  structureId,
  utilisateurId,
  droits,
}: {
  structureId: string | undefined;
  utilisateurId: string;
  droits: DroitsComptoir;
}) {
  const titreId = useId();
  const [etatVentes, setEtatVentes] = useState<EtatVentes>({ statut: "chargement" });
  const [essai, setEssai] = useState(0);
  const { peutVoirVentes } = droits;

  useEffect(() => {
    if (!peutVoirVentes || !structureId) return;
    let actif = true;
    listerVentes(structureId)
      .then((res) => {
        if (actif) setEtatVentes({ statut: "pret", resume: resumerMesVentes(res.data, utilisateurId) });
      })
      .catch((err: unknown) => {
        if (!actif) return;
        setEtatVentes(err instanceof ApiError && err.status === 403 ? { statut: "masque" } : { statut: "erreur" });
      });
    return () => {
      actif = false;
    };
  }, [structureId, utilisateurId, peutVoirVentes, essai]);

  const reessayer = () => {
    setEtatVentes({ statut: "chargement" });
    setEssai((n) => n + 1);
  };

  const ventes: EtatVentes = !peutVoirVentes ? { statut: "masque" } : !structureId ? { statut: "erreur" } : etatVentes;
  const afficherSection = droits.peutVendre || droits.peutVoirOrdonnances || peutVoirVentes;

  let cartes: ReactNode = null;
  if (ventes.statut === "chargement") {
    cartes = (
      <>
        <Carte libelle="Montant de mes ventes" icone={Wallet} couleur="text-emerald-600 dark:text-emerald-400">
          <Chargement />
        </Carte>
        <Carte libelle="Mes ventes" icone={Receipt} couleur="text-primary-600 dark:text-primary-400">
          <Chargement />
        </Carte>
      </>
    );
  } else if (ventes.statut === "pret") {
    const r = ventes.resume;
    cartes =
      r.nombre > 0 || r.annulees > 0 ? (
        <>
          <Carte
            libelle="Montant de mes ventes"
            icone={Wallet}
            couleur="text-emerald-600 dark:text-emerald-400"
            sousTexte="Ventes validées, sans les annulations"
          >
            <Valeur>{formaterGNF(r.total)}</Valeur>
          </Carte>
          <Carte
            libelle="Mes ventes"
            icone={Receipt}
            couleur="text-primary-600 dark:text-primary-400"
            sousTexte={
              r.annulees > 0
                ? pluriel(r.annulees, "vente annulée, non comptée", "ventes annulées, non comptées")
                : "Aujourd'hui"
            }
          >
            <Valeur>{r.nombre.toLocaleString("fr-FR")}</Valeur>
          </Carte>
        </>
      ) : (
        <div className={`sm:col-span-2 ${CLASSES_BLOC}`}>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Vous n&apos;avez encore enregistré aucune vente aujourd&apos;hui.
          </p>
        </div>
      );
  }

  return (
    <>
      {afficherSection && (
        <section
          aria-labelledby={titreId}
          aria-busy={ventes.statut === "chargement"}
          className="space-y-4"
        >
          <h2
            id={titreId}
            className="text-lg font-semibold text-slate-900 dark:text-white"
            style={{ fontFamily: "var(--font-outfit, var(--font-inter))" }}
          >
            Au comptoir
          </h2>
          {(droits.peutVendre || droits.peutVoirOrdonnances) && (
            <div className="flex flex-col sm:flex-row gap-3">
              {droits.peutVendre && (
                <Link href="/dashboard/vente" className={CLASSES_VENTE}>
                  <ShoppingCart className="w-6 h-6" aria-hidden="true" />
                  Nouvelle vente
                </Link>
              )}
              {droits.peutVoirOrdonnances && (
                <Link href="/dashboard/ordonnances" className={CLASSES_ORDONNANCES}>
                  <ClipboardList className="w-4 h-4" aria-hidden="true" />
                  Ordonnances reçues
                </Link>
              )}
            </div>
          )}
          {ventes.statut !== "masque" && (
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">Mes ventes du jour</h3>
              {cartes && <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">{cartes}</div>}
              {ventes.statut === "pret" && ventes.resume.partiel && (
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {`Calculé sur les ${ventes.resume.ventesLues} dernières ventes de la pharmacie.`}
                </p>
              )}
              {ventes.statut === "erreur" && (
                <div role="alert" className="flex flex-col sm:flex-row sm:items-center gap-3 text-sm text-slate-700 dark:text-slate-300">
                  <p>Vos ventes du jour n&apos;ont pas pu être chargées. Vérifiez votre connexion puis réessayez.</p>
                  <button
                    type="button"
                    onClick={reessayer}
                    className="self-start sm:self-auto px-4 py-2 rounded-xl text-sm font-medium bg-primary-500/10 text-primary-700 dark:text-primary-400 hover:bg-primary-500/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                  >
                    Réessayer
                  </button>
                </div>
              )}
              <Link
                href="/dashboard/ventes"
                className="inline-flex items-center gap-1 text-sm font-medium text-primary-700 dark:text-primary-400 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
              >
                Voir toutes les ventes du jour <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
            </div>
          )}
        </section>
      )}
      <ApercuPharmacie
        structureId={structureId}
        titre="Votre stock"
        peutVoirStock={droits.peutVoirStock}
        peutVoirEquipe={droits.peutVoirEquipe}
      />
    </>
  );
}
