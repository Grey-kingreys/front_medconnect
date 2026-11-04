"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { messageErreurPour } from "@/hooks/useToast";
import { ApiError } from "@/lib/api_auth";
import { getMyStock, getReception, type LotRecu, type Reception, type UniteMinimale } from "@/lib/api_pharmacie";
import { formaterQuantite } from "@/lib/caisse/regles/quantites";
import { afficherDatePeremption } from "@/lib/date_peremption";
import { formaterGNF } from "@/lib/format_gnf";
import {
  ALERTE_INFO,
  ALERTE_SUCCES,
  BOUTON_PRIMAIRE,
  BOUTON_SECONDAIRE,
  CARTE,
  FOCUS,
  POLICE_TITRE,
} from "@/components/pharmacie/classes";
import { ErreurAvecReessai } from "@/components/pharmacie/ErreurAvecReessai";
import { formaterDateHeure } from "../../ventes/affichage";
import { CorrectionDateLot } from "./CorrectionDateLot";

const NON_RENSEIGNE = "Non renseigné";
const MSG_ERREUR = "Impossible d'afficher cette réception. Vérifiez votre connexion puis réessayez.";

type Etat =
  | { statut: "chargement" }
  | { statut: "pret"; reception: Reception }
  | { statut: "introuvable" }
  | { statut: "erreur"; message: string };

const lienRetour = (
  <Link
    href="/dashboard/receptions"
    className={`inline-flex items-center gap-2 rounded-xl text-sm font-medium text-primary-700 dark:text-primary-300 hover:underline ${FOCUS}`}
  >
    <ArrowLeft className="w-4 h-4" aria-hidden="true" />
    Retour aux réceptions
  </Link>
);

export default function DetailReceptionPage() {
  const { receptionId } = useParams<{ receptionId: string }>();
  const { user, loading } = useAuth();
  const structureId = user?.structureId;

  const [etat, setEtat] = useState<Etat>({ statut: "chargement" });
  const [essai, setEssai] = useState(0);
  // Unité minimale de chaque fiche, lue du stock quand il se charge (sinon « UNITE »).
  const [unites, setUnites] = useState<Record<string, UniteMinimale>>({});
  const [lotACorriger, setLotACorriger] = useState<LotRecu | null>(null);
  const [succes, setSucces] = useState<string | null>(null);

  useEffect(() => {
    if (!structureId) return;
    let actif = true;
    getReception(structureId, receptionId)
      .then((res) => {
        if (actif) setEtat({ statut: "pret", reception: res.data });
      })
      .catch((err: unknown) => {
        if (!actif) return;
        if (err instanceof ApiError && err.status === 404) {
          setEtat({ statut: "introuvable" });
        } else {
          setEtat({ statut: "erreur", message: messageErreurPour(err, MSG_ERREUR) });
        }
      });
    return () => {
      actif = false;
    };
  }, [structureId, receptionId, essai]);

  // Le stock ne sert qu'à nommer l'unité : un échec laisse « unité » par défaut.
  useEffect(() => {
    if (!structureId) return;
    let actif = true;
    getMyStock(structureId)
      .then((res) => {
        if (!actif) return;
        const lues: Record<string, UniteMinimale> = {};
        for (const s of res.data.stocks) if (s.uniteMinimale) lues[s.id] = s.uniteMinimale;
        setUnites(lues);
      })
      .catch(() => {});
    return () => {
      actif = false;
    };
  }, [structureId]);

  const reessayer = () => {
    setEtat({ statut: "chargement" });
    setEssai((n) => n + 1);
  };

  const fermerCorrection = (rechargerDetail?: boolean) => {
    setLotACorriger(null);
    if (rechargerDetail) {
      setSucces(null);
      setEssai((n) => n + 1);
    }
  };

  // Le message du serveur s'affiche pendant que le détail est relu.
  const correctionReussie = (message: string) => {
    setSucces(message);
    setEssai((n) => n + 1);
  };

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
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
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

  if (etat.statut === "chargement") {
    return (
      <div role="status" className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
        Chargement de la réception...
      </div>
    );
  }

  if (etat.statut === "introuvable") {
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
        <div className={CARTE}>
          <p className="text-sm text-slate-700 dark:text-slate-300">Cette réception est introuvable.</p>
          <Link href="/dashboard/receptions" className={`${BOUTON_PRIMAIRE} mt-4`}>
            Retour aux réceptions
          </Link>
        </div>
      </div>
    );
  }

  if (etat.statut === "erreur") {
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
        <ErreurAvecReessai message={etat.message} onReessayer={reessayer} />
        {lienRetour}
      </div>
    );
  }

  const { reception } = etat;
  // La colonne du coût n'existe que si le serveur a transmis la clé : sans `marge:read`, elle est absente (D698).
  const avecCout = reception.lots.some((l) => "coutAchatBoite" in l);
  const aDesResolutions = (reception.resolutions ?? []).length > 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white" style={POLICE_TITRE}>
          Réception du {formaterDateHeure(reception.recueLe)}
        </h1>
        <p className="text-sm text-slate-700 dark:text-slate-300">
          Fournisseur : {reception.fournisseur?.nom ?? NON_RENSEIGNE}
        </p>
        <p className="text-sm text-slate-700 dark:text-slate-300">
          Bon de livraison : {reception.reference ?? NON_RENSEIGNE}
        </p>
        {lienRetour}
      </div>

      {succes && (
        <div role="status" className={ALERTE_SUCCES}>
          {succes}
        </div>
      )}

      {aDesResolutions && (
        <p role="status" className={ALERTE_INFO}>
          Des ventes faites en attente de stock ont été rattachées à ces lots.
        </p>
      )}

      <div className={`${CARTE} overflow-x-auto`}>
        <table className="w-full text-sm text-left">
          <caption className="sr-only">Lots reçus lors de cette livraison</caption>
          <thead>
            <tr className="text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
              <th scope="col" className="py-2 pr-4 font-semibold">Médicament</th>
              <th scope="col" className="py-2 pr-4 font-semibold">Lot</th>
              <th scope="col" className="py-2 pr-4 font-semibold">Péremption</th>
              <th scope="col" className="py-2 pr-4 font-semibold">Reçu</th>
              <th scope="col" className="py-2 pr-4 font-semibold">Reste en stock</th>
              {avecCout && <th scope="col" className="py-2 pr-4 font-semibold">Coût d&apos;achat d&apos;une boîte</th>}
              <th scope="col" className="py-2 font-semibold"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {reception.lots.map((lot) => {
              const unite = unites[lot.stockId] ?? "UNITE";
              const coefficient = lot.coefficientReception;
              const cout = lot.coutAchatBoite;
              return (
                <tr key={lot.id} className="align-top">
                  <td className="py-3 pr-4 font-bold text-slate-900 dark:text-white">{lot.nom}</td>
                  <td className="py-3 pr-4 text-slate-800 dark:text-slate-200">{lot.numeroLot ?? "Sans numéro"}</td>
                  <td className="py-3 pr-4 text-slate-800 dark:text-slate-200">
                    {lot.dateExpiration ? afficherDatePeremption(lot.dateExpiration) : "Sans date"}
                  </td>
                  <td className="py-3 pr-4 text-slate-800 dark:text-slate-200">
                    {formaterQuantite(lot.quantiteRecue, coefficient, unite)}
                  </td>
                  <td className="py-3 pr-4 text-slate-800 dark:text-slate-200">
                    {formaterQuantite(lot.solde, coefficient, unite)}
                  </td>
                  {avecCout && (
                    <td className="py-3 pr-4 text-slate-800 dark:text-slate-200">
                      {typeof cout === "number" && cout > 0 ? formaterGNF(cout) : "Inconnu"}
                    </td>
                  )}
                  <td className="py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setLotACorriger(lot)}
                      aria-label={`Corriger la date du lot ${lot.numeroLot ?? lot.nom}`}
                      className={`${BOUTON_SECONDAIRE} border border-slate-200 dark:border-slate-700 whitespace-nowrap`}
                    >
                      Corriger la date
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <CorrectionDateLot
        lot={lotACorriger}
        structureId={structureId}
        onClose={fermerCorrection}
        onSucces={correctionReussie}
      />
    </div>
  );
}
