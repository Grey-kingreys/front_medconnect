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
import { formaterTauxTva } from "@/lib/facture_fournisseur";
import { formaterGNF } from "@/lib/format_gnf";
import {
  ALERTE_INFO,
  ALERTE_SUCCES,
  BOUTON_PRIMAIRE,
  CARTE,
  FOCUS,
} from "@/components/pharmacie/classes";
import { ErreurAvecReessai } from "@/components/pharmacie/ErreurAvecReessai";
import { formaterDateHeure } from "../../ventes/affichage";
import { ui } from "@/theme/ui";
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
    className={`inline-flex items-center gap-2 rounded-mc-grand text-mc-normal font-medium text-primary-700 dark:text-primary-300 hover:underline ${FOCUS}`}
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
      <div role="status" className="flex items-center gap-3 text-mc-normal text-slate-600 dark:text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
        Chargement...
      </div>
    );
  }

  if (!structureId) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
        <div className={CARTE}>
          <p className={ui.texte.petit}>
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
      <div role="status" className="flex items-center gap-3 text-mc-normal text-slate-600 dark:text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
        Chargement de la réception...
      </div>
    );
  }

  if (etat.statut === "introuvable") {
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
        <div className={CARTE}>
          <p className={ui.texte.petit}>Cette réception est introuvable.</p>
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
  const entetesFacture: [string, string | null][] = [
    ["N° de facture", reception.numeroFacture ?? null],
    ["Référence de commande", reception.referenceCommande ?? null],
    ["Date de facture", reception.dateFacture ? afficherDatePeremption(reception.dateFacture) : null],
    ["Nombre de pages", typeof reception.nombrePages === "number" ? String(reception.nombrePages) : null],
    // Les montants sont des coûts d'achat : leur clé est absente sans `marge:read`.
    ["Montant HT", typeof reception.montantHT === "number" ? formaterGNF(reception.montantHT) : null],
    ["Total TVA", typeof reception.totalTva === "number" ? formaterGNF(reception.totalTva) : null],
    ["Montant TTC", typeof reception.montantTTC === "number" ? formaterGNF(reception.montantTTC) : null],
    ["Net à payer", typeof reception.netAPayer === "number" ? formaterGNF(reception.netAPayer) : null],
  ];
  const entetesRemplis = entetesFacture.filter(([, v]) => v !== null);
  const colonnesFacture: { titre: string; valeur: (l: LotRecu) => string | null }[] = [
    { titre: "Code fournisseur", valeur: (l) => l.codeArticleFournisseur ?? null },
    { titre: "Code-barres", valeur: (l) => l.codeBarres ?? null },
    { titre: "Qté commandée", valeur: (l) => (typeof l.quantiteCommandee === "number" ? String(l.quantiteCommandee) : null) },
    { titre: "Prix public", valeur: (l) => (typeof l.prixPublicBoite === "number" ? formaterGNF(l.prixPublicBoite) : null) },
    { titre: "Code TVA", valeur: (l) => l.codeTva ?? null },
    { titre: "Taux TVA", valeur: (l) => (typeof l.tauxTvaPourMille === "number" ? formaterTauxTva(l.tauxTvaPourMille) : null) },
    { titre: "Montant HT", valeur: (l) => (typeof l.montantHTLigne === "number" ? formaterGNF(l.montantHTLigne) : null) },
    { titre: "Colisage", valeur: (l) => (typeof l.colisage === "number" ? String(l.colisage) : null) },
    { titre: "Tableau (TB)", valeur: (l) => l.tableau ?? null },
    { titre: "Bon de préparation", valeur: (l) => l.bonPreparation ?? null },
  ];
  // Seules les colonnes saisies sur au moins une ligne s'affichent.
  const colonnesUtiles = colonnesFacture.filter((c) => reception.lots.some((l) => c.valeur(l) !== null));
  const aDesResolutions = (reception.resolutions ?? []).length > 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      <div className="space-y-2">
        <h1 className={ui.titrePage}>
          Réception du {formaterDateHeure(reception.recueLe)}
        </h1>
        <p className={ui.texte.petit}>
          Fournisseur : {reception.fournisseur?.nom ?? NON_RENSEIGNE}
        </p>
        <p className={ui.texte.petit}>
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
        <table className={ui.tableau}>
          <caption className="sr-only">Lots reçus lors de cette livraison</caption>
          <thead>
            <tr className={ui.enteteTableau}>
              <th scope="col" className={ui.celluleEntete}>Médicament</th>
              <th scope="col" className={ui.celluleEntete}>Lot</th>
              <th scope="col" className={ui.celluleEntete}>Péremption</th>
              <th scope="col" className={ui.celluleEntete}>Reçu</th>
              <th scope="col" className={ui.celluleEntete}>Reste en stock</th>
              {avecCout && <th scope="col" className={ui.celluleEntete}>Coût d&apos;achat d&apos;une boîte</th>}
              <th scope="col" className={ui.celluleEntete}><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {reception.lots.map((lot) => {
              const unite = unites[lot.stockId] ?? "UNITE";
              const coefficient = lot.coefficientReception;
              const cout = lot.coutAchatBoite;
              return (
                <tr key={lot.id} className="align-top border-b border-slate-100 dark:border-slate-800">
                  <td className={`${ui.cellule} py-3 font-semibold`}>{lot.nom}</td>
                  <td className={`${ui.cellule} py-3`}>{lot.numeroLot ?? "Sans numéro"}</td>
                  <td className={`${ui.cellule} py-3`}>
                    {lot.dateExpiration ? afficherDatePeremption(lot.dateExpiration) : "Sans date"}
                  </td>
                  <td className={`${ui.cellule} py-3`}>
                    {formaterQuantite(lot.quantiteRecue, coefficient, unite)}
                  </td>
                  <td className={`${ui.cellule} py-3`}>
                    {formaterQuantite(lot.solde, coefficient, unite)}
                  </td>
                  {avecCout && (
                    <td className={`${ui.cellule} py-3`}>
                      {typeof cout === "number" && cout > 0 ? formaterGNF(cout) : "Inconnu"}
                    </td>
                  )}
                  <td className={`${ui.cellule} py-3 text-right`}>
                    <button
                      type="button"
                      onClick={() => setLotACorriger(lot)}
                      aria-label={`Corriger la date du lot ${lot.numeroLot ?? lot.nom}`}
                      className={`${ui.bouton.secondaire} h-mc-controle-petit`}
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

      {entetesRemplis.length > 0 && (
        <section className={`${CARTE} space-y-3`} aria-labelledby="titre-facture">
          <h2 id="titre-facture" className={ui.texte.section}>
            Facture fournisseur
          </h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3 text-mc-normal">
            {entetesRemplis.map(([titre, valeur]) => (
              <div key={titre}>
                <dt className={ui.texte.petit}>{titre}</dt>
                <dd className="text-mc-normal font-medium tabular-nums text-slate-900 dark:text-slate-100">{valeur}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {colonnesUtiles.length > 0 && (
        <section className={`${CARTE} space-y-3`} aria-labelledby="titre-lignes-facture">
          <h2 id="titre-lignes-facture" className={ui.texte.section}>
            Lignes de la facture
          </h2>
          <div className="overflow-x-auto">
            <table className={ui.tableau}>
              <caption className="sr-only">Informations de facture de chaque lot reçu</caption>
              <thead>
                <tr className={ui.enteteTableau}>
                  <th scope="col" className={ui.celluleEntete}>Médicament</th>
                  {colonnesUtiles.map((c) => (
                    <th key={c.titre} scope="col" className={ui.celluleEntete}>
                      {c.titre}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {reception.lots.map((lot) => (
                  <tr key={lot.id} className="align-top border-b border-slate-100 dark:border-slate-800">
                    <th scope="row" className={`${ui.cellule} py-3 font-semibold`}>
                      {lot.nom}
                    </th>
                    {colonnesUtiles.map((c) => (
                      <td key={c.titre} className={`${ui.cellule} py-3`}>
                        {c.valeur(lot) ?? NON_RENSEIGNE}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <CorrectionDateLot
        lot={lotACorriger}
        structureId={structureId}
        onClose={fermerCorrection}
        onSucces={correctionReussie}
      />
    </div>
  );
}
