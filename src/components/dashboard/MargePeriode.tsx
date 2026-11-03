"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { AlertCircle, Percent, TrendingUp, Wallet } from "lucide-react";
import { ApiError } from "@/lib/api_auth";
import { getRapportMarge, type RapportMarge } from "@/lib/api_pilotage";
import { afficherDatePeremption } from "@/lib/date_peremption";
import { formaterGNF } from "@/lib/format_gnf";
import { formaterTaux, tauxMarge } from "@/lib/marge_affichage";
import { ErreurAvecReessai } from "@/components/pharmacie/ErreurAvecReessai";
import { ALERTE_ATTENTION, ALERTE_ERREUR, BOUTON_SECONDAIRE, CHAMP } from "@/components/pharmacie/classes";
import { Carte, Chargement, Valeur, pluriel } from "./ApercuPharmacie";

type Etat =
  | { statut: "chargement" }
  | { statut: "pret"; rapport: RapportMarge }
  | { statut: "refuse"; message: string }
  | { statut: "erreur" }
  | { statut: "masque" };

interface Periode {
  du: string;
  au: string;
}

/** Du 1er du mois à aujourd'hui, jours de Conakry (UTC+0). */
function periodeParDefaut(): Periode {
  const aujourdhui = new Date().toISOString().slice(0, 10);
  return { du: `${aujourdhui.slice(0, 8)}01`, au: aujourdhui };
}

const JOUR_EN_MS = 86_400_000;
const PERIODE_MAX_JOURS = 92;

/** Refus d'une période avant tout appel au serveur ; null si elle est acceptable. */
function refuserPeriode(p: Periode, aujourdhui: string): string | null {
  if (p.du === "" || p.au === "") return "Choisissez une date de début et une date de fin.";
  if (p.du > p.au) return "La date de début doit être avant la date de fin.";
  if (p.au > aujourdhui) return "La date de fin ne peut pas être après aujourd'hui.";
  const jours = (Date.parse(`${p.au}T00:00:00Z`) - Date.parse(`${p.du}T00:00:00Z`)) / JOUR_EN_MS + 1;
  if (jours > PERIODE_MAX_JOURS) return "La période ne peut pas dépasser 92 jours. Choisissez un mois ou un trimestre.";
  return null;
}

export default function MargePeriode({ structureId }: { structureId: string | undefined }) {
  const titreId = useId();
  const idDu = useId();
  const idAu = useId();
  const [saisie, setSaisie] = useState<Periode>(periodeParDefaut);
  const [periode, setPeriode] = useState<Periode>(saisie);
  const [aujourdhui] = useState(() => saisie.au);
  const [refusLocal, setRefusLocal] = useState<string | null>(null);
  const [etat, setEtat] = useState<Etat>({ statut: "chargement" });
  const [essai, setEssai] = useState(0);

  useEffect(() => {
    if (!structureId) return;
    let actif = true;
    getRapportMarge(structureId, periode)
      .then((res) => {
        if (actif) setEtat({ statut: "pret", rapport: res.data });
      })
      .catch((err: unknown) => {
        if (!actif) return;
        if (err instanceof ApiError && err.status === 403) setEtat({ statut: "masque" });
        else if (err instanceof ApiError && err.status === 400) setEtat({ statut: "refuse", message: err.message });
        else setEtat({ statut: "erreur" });
      });
    return () => {
      actif = false;
    };
  }, [structureId, periode, essai]);

  const courant: Etat = !structureId ? { statut: "erreur" } : etat;
  if (courant.statut === "masque") return null;

  const afficher = (e: FormEvent) => {
    e.preventDefault();
    const refus = refuserPeriode(saisie, aujourdhui);
    setRefusLocal(refus);
    if (refus !== null) return;
    setEtat({ statut: "chargement" });
    setPeriode({ ...saisie });
  };
  const reessayer = () => {
    setEtat({ statut: "chargement" });
    setEssai((n) => n + 1);
  };

  const rapport = courant.statut === "pret" ? courant.rapport : null;
  const occupe = courant.statut === "chargement";
  // Aucune vente au coût connu : la marge est inconnue, jamais 0 GNF (D698).
  // Un total négatif (annulation seule sur la période) reste une marge connue, affichée avec son signe.
  const margeConnue = rapport !== null && rapport.chiffreAffairesValorise !== 0;

  return (
    <section aria-labelledby={titreId} aria-busy={occupe} className="space-y-4">
      <h3 id={titreId} className="text-base font-semibold text-slate-900 dark:text-white">
        Marge
      </h3>
      <form onSubmit={afficher} noValidate className="flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="sm:w-48">
          <label htmlFor={idDu} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Du
          </label>
          <input
            id={idDu}
            type="date"
            value={saisie.du}
            max={saisie.au || undefined}
            onChange={(e) => setSaisie((s) => ({ ...s, du: e.target.value }))}
            className={CHAMP}
          />
        </div>
        <div className="sm:w-48">
          <label htmlFor={idAu} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Au
          </label>
          <input
            id={idAu}
            type="date"
            value={saisie.au}
            min={saisie.du || undefined}
            max={aujourdhui}
            onChange={(e) => setSaisie((s) => ({ ...s, au: e.target.value }))}
            className={CHAMP}
          />
        </div>
        <button type="submit" className={`${BOUTON_SECONDAIRE} border border-slate-300 dark:border-slate-700`}>
          Afficher
        </button>
      </form>
      <p className="text-xs text-slate-600 dark:text-slate-400">92 jours au plus.</p>

      {(refusLocal !== null || courant.statut === "refuse") && (
        <p role="alert" className={ALERTE_ERREUR}>
          <AlertCircle className="w-5 h-5 shrink-0" aria-hidden="true" />
          {refusLocal ?? (courant.statut === "refuse" ? courant.message : "")}
        </p>
      )}
      {courant.statut === "erreur" && (
        <ErreurAvecReessai message="La marge n'a pas pu être chargée. Vérifiez votre connexion puis réessayez." onReessayer={reessayer} />
      )}

      {courant.statut === "chargement" && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Carte libelle="Chiffre d'affaires" icone={Wallet} couleur="text-emerald-600 dark:text-emerald-400">
            <Chargement />
          </Carte>
          <Carte libelle="Marge" icone={TrendingUp} couleur="text-primary-600 dark:text-primary-400">
            <Chargement />
          </Carte>
          <Carte libelle="Taux de marge" icone={Percent} couleur="text-secondary-600 dark:text-secondary-400">
            <Chargement />
          </Carte>
        </div>
      )}

      {rapport && (
        <>
          {rapport.periodeAvantFiabilite && rapport.debutFiabilite !== null && (
            <p role="status" className={ALERTE_ATTENTION}>
              <AlertCircle className="w-5 h-5 shrink-0" aria-hidden="true" />
              {`Avant le ${afficherDatePeremption(rapport.debutFiabilite)}, les ventes n'ont pas de coût d'achat : la marge de cette période est incomplète.`}
            </p>
          )}
          {rapport.nombrePieces === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-400">Aucune vente sur cette période.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Carte libelle="Chiffre d'affaires" icone={Wallet} couleur="text-emerald-600 dark:text-emerald-400">
                <Valeur>{formaterGNF(rapport.chiffreAffairesTotal)}</Valeur>
              </Carte>
              <Carte
                libelle="Marge"
                icone={TrendingUp}
                couleur="text-primary-600 dark:text-primary-400"
                sousTexte={
                  margeConnue
                    ? `sur ${formaterGNF(rapport.chiffreAffairesValorise)} de ventes au coût connu`
                    : rapport.nonValorisable.nombreVentes > 0
                      ? `${pluriel(rapport.nonValorisable.nombreVentes, "vente", "ventes")} sans coût d'achat connu`
                      : "Aucune vente au coût connu"
                }
              >
                <Valeur>{margeConnue ? formaterGNF(rapport.marge) : "inconnue"}</Valeur>
              </Carte>
              <Carte libelle="Taux de marge" icone={Percent} couleur="text-secondary-600 dark:text-secondary-400">
                <Valeur>{formaterTaux(tauxMarge(rapport))}</Valeur>
              </Carte>
            </div>
          )}
          {rapport.nonValorisable.nombreVentes > 0 && (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {`Ventes sans coût d'achat connu : ${rapport.nonValorisable.nombreVentes.toLocaleString("fr-FR")} pour ${formaterGNF(rapport.nonValorisable.chiffreAffaires)}, hors marge.`}
            </p>
          )}
          {rapport.provisoires.nombreLignes > 0 && (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {`Ventes à régulariser : ${pluriel(rapport.provisoires.nombreLignes, "ligne", "lignes")} pour ${formaterGNF(rapport.provisoires.chiffreAffaires)}, hors marge.`}
            </p>
          )}
          {rapport.debutFiabilite !== null && (
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {`Marge fiable depuis le ${afficherDatePeremption(rapport.debutFiabilite)}`}
            </p>
          )}
        </>
      )}
    </section>
  );
}
