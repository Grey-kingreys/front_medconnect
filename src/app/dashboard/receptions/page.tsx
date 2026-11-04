"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Plus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { listerReceptions, type PageReceptions } from "@/lib/api_pharmacie";
import { ALERTE_INFO, BOUTON_PRIMAIRE, CARTE, FOCUS, POLICE_TITRE } from "@/components/pharmacie/classes";
import { ErreurAvecReessai } from "@/components/pharmacie/ErreurAvecReessai";
import { formaterDateHeure } from "../ventes/affichage";

const BOUTON_PAGE = `px-4 py-2 rounded-2xl text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${FOCUS}`;
const MSG_ERREUR = "Les réceptions n'ont pas pu être chargées. Vérifiez votre connexion puis réessayez.";
const NON_RENSEIGNE = "Non renseigné";

type Etat =
  | { statut: "chargement" }
  | { statut: "pret"; page: PageReceptions }
  | { statut: "erreur" };

export default function ReceptionsPage() {
  const { user, loading } = useAuth();
  const structureId = user?.structureId;
  const [page, setPage] = useState(1);
  const [etat, setEtat] = useState<Etat>({ statut: "chargement" });
  const [essai, setEssai] = useState(0);

  useEffect(() => {
    if (!structureId) return;
    let actif = true;
    listerReceptions(structureId, page)
      .then((res) => {
        if (actif) setEtat({ statut: "pret", page: res.data });
      })
      .catch(() => {
        if (actif) setEtat({ statut: "erreur" });
      });
    return () => {
      actif = false;
    };
  }, [structureId, page, essai]);

  const recharger = () => {
    setEtat({ statut: "chargement" });
    setEssai((n) => n + 1);
  };

  const changerPage = (nouvelle: number) => {
    setPage(nouvelle);
    setEtat({ statut: "chargement" });
  };

  if (loading || user === null) {
    return (
      <div role="status" className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
        Chargement...
      </div>
    );
  }

  const lienNouvelle = (
    <Link href="/dashboard/receptions/nouvelle" className={BOUTON_PRIMAIRE}>
      <Plus className="w-4 h-4" aria-hidden="true" />
      Nouvelle réception
    </Link>
  );

  const enTete = (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white" style={POLICE_TITRE}>
          Réceptions
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Enregistrez les livraisons de vos fournisseurs à partir de la facture.
        </p>
      </div>
      {structureId && lienNouvelle}
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

  let corps;
  if (etat.statut === "chargement") {
    corps = (
      <div role="status" className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
        Chargement des réceptions...
      </div>
    );
  } else if (etat.statut === "erreur") {
    corps = <ErreurAvecReessai message={MSG_ERREUR} onReessayer={recharger} />;
  } else {
    const { receptions, parPage, total } = etat.page;
    const totalPages = Math.max(1, Math.ceil(total / (parPage > 0 ? parPage : 20)));
    corps =
      receptions.length === 0 ? (
        <div className={ALERTE_INFO}>
          <p>Aucune réception enregistrée. Enregistrez votre première livraison avec « Nouvelle réception ».</p>
        </div>
      ) : (
        <>
          <div className={`${CARTE} overflow-x-auto`}>
            <table className="w-full text-sm text-left">
              <caption className="sr-only">Livraisons reçues, de la plus récente à la plus ancienne</caption>
              <thead>
                <tr className="text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                  <th scope="col" className="py-2 pr-4 font-semibold">Reçue le</th>
                  <th scope="col" className="py-2 pr-4 font-semibold">Fournisseur</th>
                  <th scope="col" className="py-2 pr-4 font-semibold">Bon de livraison</th>
                  <th scope="col" className="py-2 font-semibold text-right">Lots</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {receptions.map((r) => {
                  const lien = `/dashboard/receptions/${encodeURIComponent(r.id)}`;
                  const classeLien = `block py-3 pr-4 text-slate-900 dark:text-white hover:underline ${FOCUS}`;
                  return (
                    <tr key={r.id}>
                      <td>
                        <Link href={lien} className={`${classeLien} font-bold`}>
                          {formaterDateHeure(r.recueLe)}
                        </Link>
                      </td>
                      <td>
                        <Link href={lien} className={classeLien} tabIndex={-1}>
                          {r.fournisseur?.nom ?? NON_RENSEIGNE}
                        </Link>
                      </td>
                      <td>
                        <Link href={lien} className={classeLien} tabIndex={-1}>
                          {r.reference ?? NON_RENSEIGNE}
                        </Link>
                      </td>
                      <td className="text-right">
                        <Link href={lien} className={`${classeLien} text-right pr-0`} tabIndex={-1}>
                          {r.nombreLots}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <nav aria-label="Pagination" className="flex items-center justify-between gap-3">
              <button type="button" onClick={() => changerPage(page - 1)} disabled={page <= 1} className={BOUTON_PAGE}>
                Précédente
              </button>
              <p className="text-sm text-slate-700 dark:text-slate-300">
                Page {page} sur {totalPages}
              </p>
              <button
                type="button"
                onClick={() => changerPage(page + 1)}
                disabled={page >= totalPages}
                className={BOUTON_PAGE}
              >
                Suivante
              </button>
            </nav>
          )}
        </>
      );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {enTete}
      {corps}
    </div>
  );
}
