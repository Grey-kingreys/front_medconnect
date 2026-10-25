"use client";

import { useEffect, useId, useState, type ComponentType, type ReactNode } from "react";
import Link from "next/link";
import { Ban, Building2, Receipt, Users, Wallet } from "lucide-react";
import { ApiError } from "@/lib/api_auth";
import { listerVentes } from "@/lib/api_ventes";
import { getMyStructure } from "@/lib/api_structure";
import { formaterGNF } from "@/lib/format_gnf";
import { resumerVentesDuJour, type ResumeVentesDuJour } from "@/lib/ventes_tableau_de_bord";
import ApercuPharmacie, { Carte, Chargement, Valeur, pluriel } from "./ApercuPharmacie";

export interface DroitsPilotage {
  /** structure:write ET route /dashboard/structure autorisée. */
  peutModifier: boolean;
  /** Route /dashboard/membres autorisée. */
  peutVoirEquipe: boolean;
  /** Route /dashboard/ventes autorisée. */
  peutVoirVentes: boolean;
  /** Permission vente:annuler. */
  peutAnnuler: boolean;
  /** Route /dashboard/stock autorisée. */
  peutVoirStock: boolean;
}

export interface LienVue {
  href: string;
  libelle: string;
  icone: ComponentType<{ className?: string }>;
}

/** Raccourcis de tête de la vue pilotage, dans l'ordre d'affichage. */
export function liensPilotage(d: DroitsPilotage): LienVue[] {
  const liens: LienVue[] = [];
  if (d.peutModifier) liens.push({ href: "/dashboard/structure", libelle: "Modifier ma pharmacie", icone: Building2 });
  if (d.peutVoirEquipe) liens.push({ href: "/dashboard/membres", libelle: "Équipe", icone: Users });
  if (d.peutVoirVentes) liens.push({ href: "/dashboard/ventes", libelle: "Ventes du jour", icone: Receipt });
  return liens;
}

type EtatVentes =
  | { statut: "chargement" }
  | { statut: "pret"; resume: ResumeVentesDuJour }
  | { statut: "erreur" }
  | { statut: "masque" };
type EtatEquipe =
  | { statut: "chargement" }
  | { statut: "pret"; actifs: number; total: number }
  | { statut: "erreur" }
  | { statut: "masque" };

const CLASSES_BLOC = "bg-white dark:bg-[#0f172a]/80 border border-slate-200 dark:border-slate-800/50 rounded-2xl p-5";
const CLASSES_PRINCIPAL =
  "inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500";
const CLASSES_SECONDAIRE =
  "inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white hover:border-primary-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500";

export default function PilotagePharmacie({
  structureId,
  droits,
}: {
  structureId: string | undefined;
  droits: DroitsPilotage;
}) {
  const titreId = useId();
  const [etatVentes, setEtatVentes] = useState<EtatVentes>({ statut: "chargement" });
  const [essaiVentes, setEssaiVentes] = useState(0);
  const [etatEquipe, setEtatEquipe] = useState<EtatEquipe>({ statut: "chargement" });
  const [essaiEquipe, setEssaiEquipe] = useState(0);
  const { peutVoirVentes, peutVoirEquipe } = droits;

  useEffect(() => {
    if (!peutVoirVentes || !structureId) return;
    let actif = true;
    listerVentes(structureId)
      .then((res) => {
        if (actif) setEtatVentes({ statut: "pret", resume: resumerVentesDuJour(res.data) });
      })
      .catch((err: unknown) => {
        if (!actif) return;
        setEtatVentes(err instanceof ApiError && err.status === 403 ? { statut: "masque" } : { statut: "erreur" });
      });
    return () => {
      actif = false;
    };
  }, [structureId, peutVoirVentes, essaiVentes]);

  useEffect(() => {
    if (!peutVoirEquipe) return;
    let actif = true;
    getMyStructure()
      .then((res) => {
        if (!actif) return;
        const membres = res.data.membres ?? [];
        setEtatEquipe({ statut: "pret", actifs: membres.filter((m) => m.isActive === true).length, total: membres.length });
      })
      .catch((err: unknown) => {
        if (!actif) return;
        setEtatEquipe(err instanceof ApiError && err.status === 403 ? { statut: "masque" } : { statut: "erreur" });
      });
    return () => {
      actif = false;
    };
  }, [peutVoirEquipe, essaiEquipe]);

  const reessayerVentes = () => {
    setEtatVentes({ statut: "chargement" });
    setEssaiVentes((n) => n + 1);
  };
  const reessayerEquipe = () => {
    setEtatEquipe({ statut: "chargement" });
    setEssaiEquipe((n) => n + 1);
  };

  const ventes: EtatVentes = !peutVoirVentes ? { statut: "masque" } : !structureId ? { statut: "erreur" } : etatVentes;
  const equipe: EtatEquipe = !peutVoirEquipe ? { statut: "masque" } : etatEquipe;
  const occupe = ventes.statut === "chargement" || equipe.statut === "chargement";
  const liens = liensPilotage(droits);

  const cartes: ReactNode[] = [];
  if (ventes.statut === "chargement") {
    cartes.push(
      <Carte key="encaisse" libelle="Encaissé aujourd'hui" icone={Wallet} couleur="text-emerald-600 dark:text-emerald-400">
        <Chargement />
      </Carte>,
      <Carte key="enregistrees" libelle="Ventes enregistrées" icone={Receipt} couleur="text-primary-600 dark:text-primary-400">
        <Chargement />
      </Carte>,
      <Carte key="annulees" libelle="Ventes annulées" icone={Ban} couleur="text-rose-600 dark:text-rose-400">
        <Chargement />
      </Carte>,
    );
  } else if (ventes.statut === "pret") {
    const r = ventes.resume;
    if (r.nombre > 0) {
      cartes.push(
        <Carte
          key="encaisse"
          libelle="Encaissé aujourd'hui"
          icone={Wallet}
          couleur="text-emerald-600 dark:text-emerald-400"
          sousTexte="Ventes validées, sans les annulations"
        >
          <Valeur>{formaterGNF(r.totalJour)}</Valeur>
        </Carte>,
        <Carte
          key="enregistrees"
          libelle="Ventes enregistrées"
          icone={Receipt}
          couleur="text-primary-600 dark:text-primary-400"
          sousTexte="Aujourd'hui, annulations comprises"
        >
          <Valeur>{r.nombre.toLocaleString("fr-FR")}</Valeur>
        </Carte>,
        <Carte
          key="annulees"
          libelle="Ventes annulées"
          icone={Ban}
          couleur="text-rose-600 dark:text-rose-400"
          sousTexte={r.partiel ? `Compté sur les ${r.ventesLues} dernières ventes du jour` : "Aujourd'hui"}
        >
          <Valeur>{r.annulees.toLocaleString("fr-FR")}</Valeur>
        </Carte>,
      );
    } else {
      cartes.push(
        <div key="aucune" className={`sm:col-span-2 lg:col-span-3 ${CLASSES_BLOC}`}>
          <p className="text-sm text-slate-600 dark:text-slate-400">Aucune vente enregistrée aujourd&apos;hui pour le moment.</p>
        </div>,
      );
    }
  }

  if (equipe.statut !== "masque") {
    cartes.push(
      <Carte
        key="equipe"
        libelle="Membres actifs"
        icone={Users}
        couleur="text-secondary-600 dark:text-secondary-400"
        sousTexte={
          equipe.statut === "pret"
            ? equipe.total === 0
              ? "Aucun membre dans l'équipe pour l'instant"
              : `sur ${pluriel(equipe.total, "membre de l'équipe", "membres de l'équipe")}`
            : undefined
        }
      >
        {equipe.statut === "chargement" && <Chargement />}
        {equipe.statut === "pret" && <Valeur>{equipe.actifs.toLocaleString("fr-FR")}</Valeur>}
        {equipe.statut === "erreur" && (
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1 h-8 flex items-center gap-2">
            Indisponible{" "}
            <button
              type="button"
              onClick={reessayerEquipe}
              aria-label="Réessayer de charger l'équipe"
              className="text-primary-700 dark:text-primary-400 underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
            >
              Réessayer
            </button>
          </p>
        )}
      </Carte>,
    );
  }

  return (
    <>
      <section aria-labelledby={titreId} aria-busy={occupe} className="space-y-4">
        <h2
          id={titreId}
          className="text-lg font-semibold text-slate-900 dark:text-white"
          style={{ fontFamily: "var(--font-outfit, var(--font-inter))" }}
        >
          Pilotage de la pharmacie
        </h2>
        {liens.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {liens.map((lien, i) => {
              const Icone = lien.icone;
              return (
                <Link key={lien.href} href={lien.href} className={i === 0 ? CLASSES_PRINCIPAL : CLASSES_SECONDAIRE}>
                  <Icone className="w-4 h-4" aria-hidden="true" />
                  {lien.libelle}
                </Link>
              );
            })}
          </div>
        )}
        {droits.peutAnnuler && droits.peutVoirVentes && (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Pour annuler une vente enregistrée par erreur, ouvrez « Ventes du jour ».
          </p>
        )}
        {cartes.length > 0 && <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">{cartes}</div>}
        {ventes.statut === "erreur" && (
          <div role="alert" className="flex flex-col sm:flex-row sm:items-center gap-3 text-sm text-slate-700 dark:text-slate-300">
            <p>Les ventes du jour n&apos;ont pas pu être chargées. Vérifiez votre connexion puis réessayez.</p>
            <button
              type="button"
              onClick={reessayerVentes}
              className="self-start sm:self-auto px-4 py-2 rounded-xl text-sm font-medium bg-primary-500/10 text-primary-700 dark:text-primary-400 hover:bg-primary-500/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              Réessayer
            </button>
          </div>
        )}
      </section>
      <ApercuPharmacie
        structureId={structureId}
        titre="Votre stock"
        peutVoirStock={droits.peutVoirStock}
        peutVoirEquipe={false}
      />
    </>
  );
}
