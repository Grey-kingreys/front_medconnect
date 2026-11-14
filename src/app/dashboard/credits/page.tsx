"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { HandCoins, Plus, Search } from "lucide-react";
import { ui } from "@/theme/ui";
import { POLICE_TITRE } from "@/components/pharmacie/classes";
import { ErreurAvecReessai } from "@/components/pharmacie/ErreurAvecReessai";
import { useAuth } from "@/hooks/useAuth";
import { messageErreurPour } from "@/hooks/useToast";
import { lireContexteAcces } from "@/lib/acces";
import { listerCredits, type FiltreStatutCredit, type ListeCredits } from "@/lib/api_credit";
import { formaterGNF } from "@/lib/format_gnf";
import { formaterDateCourte } from "../ventes/affichage";
import { CLASSE_BADGE_STATUT, formaterJourCourt, libelleStatut } from "./affichage";
import { RemboursementModal } from "./RemboursementModal";

const MSG_CHARGEMENT_ECHOUE = "Le cahier de crédit n'a pas pu être chargé. Vérifiez votre connexion puis réessayez.";

const FILTRES: { valeur: FiltreStatutCredit; libelle: string; actif: string }[] = [
  { valeur: "TOUS", libelle: "Tous", actif: ui.filtre.actif },
  { valeur: "EN_COURS", libelle: "En cours", actif: ui.filtre.actif },
  { valeur: "EN_RETARD", libelle: "En retard", actif: ui.filtre.actifDanger },
  { valeur: "SOLDE", libelle: "Soldé", actif: ui.filtre.actif },
];

export default function CreditsPage() {
  const { user, profile } = useAuth();
  const structureId = user?.structureId;
  const peutEcrire = user ? lireContexteAcces(user, profile ?? null).permissions.has("credit:write") : false;

  const [recherche, setRecherche] = useState("");
  const [rechercheEnvoyee, setRechercheEnvoyee] = useState("");
  const [statut, setStatut] = useState<FiltreStatutCredit>("TOUS");
  const [liste, setListe] = useState<ListeCredits | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [rechargement, setRechargement] = useState(0);
  const [remboursementOuvert, setRemboursementOuvert] = useState(false);
  const [succes, setSucces] = useState<string | null>(null);

  // La recherche part après une courte pause de frappe.
  useEffect(() => {
    const delai = setTimeout(() => setRechercheEnvoyee(recherche), 250);
    return () => clearTimeout(delai);
  }, [recherche]);

  const charger = useCallback(() => {
    if (!structureId) return () => undefined;
    let actif = true;
    listerCredits(structureId, { q: rechercheEnvoyee, statut, parPage: 200 })
      .then((res) => {
        if (!actif) return;
        setListe(res.data);
        setErreur(null);
      })
      .catch((err: unknown) => {
        if (actif) setErreur(messageErreurPour(err, MSG_CHARGEMENT_ECHOUE));
      });
    return () => {
      actif = false;
    };
  }, [structureId, rechercheEnvoyee, statut]);

  useEffect(() => charger(), [charger, rechargement]);

  const aucunFiltre = rechercheEnvoyee.trim() === "" && statut === "TOUS";
  const clients = liste?.clients ?? [];

  return (
    <div className="mx-auto max-w-mc-contenu space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className={ui.titrePage} style={POLICE_TITRE}>
            Cahier de crédit
          </h1>
          <p className="mt-1 text-mc-normal text-slate-600 dark:text-slate-400">
            Suivez ce que vos clients vous doivent.
            {liste && liste.resteTotal > 0 && (
              <>
                {" "}
                Total à recevoir : <span className="whitespace-nowrap font-semibold tabular-nums">{formaterGNF(liste.resteTotal)}</span>
              </>
            )}
          </p>
        </div>
        {peutEcrire && (
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => setRemboursementOuvert(true)} className={ui.bouton.secondaire}>
              <HandCoins className="h-4 w-4" aria-hidden="true" />
              Enregistrer un remboursement
            </button>
            <Link href="/dashboard/credits/nouveau" className={ui.bouton.primaire}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Nouveau crédit
            </Link>
          </div>
        )}
      </div>

      {succes && (
        <div role="status" className={ui.alerte.succes}>
          {succes}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:max-w-xs">
          <label htmlFor="recherche-credit" className="sr-only">
            Rechercher un client
          </label>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
          <input
            id="recherche-credit"
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Nom ou téléphone"
            className={`${ui.champ} pl-9`}
          />
        </div>
        <div className={ui.filtre.groupe} role="group" aria-label="Filtrer par statut">
          {FILTRES.map((f) => (
            <button
              key={f.valeur}
              type="button"
              aria-pressed={statut === f.valeur}
              onClick={() => setStatut(f.valeur)}
              className={`${ui.filtre.base} ${statut === f.valeur ? f.actif : ui.filtre.inactif}`}
            >
              {f.libelle}
            </button>
          ))}
        </div>
      </div>

      {erreur ? (
        <ErreurAvecReessai message={erreur} onReessayer={() => setRechargement((n) => n + 1)} />
      ) : liste === null ? (
        <p role="status" className={`${ui.texte.petit} animate-pulse`}>
          Chargement du cahier de crédit...
        </p>
      ) : (
        <div className={`${ui.carte} overflow-hidden p-0`}>
          <div className="overflow-x-auto">
            <table className={ui.tableau}>
              <thead className={ui.enteteTableau}>
                <tr>
                  <th className={ui.celluleEntete}>Nom complet</th>
                  <th className={`${ui.celluleEntete} hidden md:table-cell`}>Téléphone</th>
                  <th className={`${ui.celluleEntete} hidden lg:table-cell`}>Ce qu&apos;il a pris</th>
                  <th className={`${ui.celluleEntete} text-right`}>Reste à payer</th>
                  <th className={`${ui.celluleEntete} hidden md:table-cell`}>Date de la prise</th>
                  <th className={ui.celluleEntete}>Date limite</th>
                  <th className={ui.celluleEntete}>Statut</th>
                </tr>
              </thead>
              <tbody>
                {clients.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-12 text-center">
                      <HandCoins className="mx-auto mb-3 h-10 w-10 text-slate-300 dark:text-slate-600" aria-hidden="true" />
                      <p className={ui.texte.petit}>
                        {aucunFiltre
                          ? "Aucun crédit pour le moment. Cliquez sur Nouveau crédit pour noter ce qu'un client emporte sans payer."
                          : "Aucun client ne correspond à votre recherche."}
                      </p>
                    </td>
                  </tr>
                ) : (
                  clients.map((c) => (
                    <tr key={c.id} className={ui.ligneTableau}>
                      <td className={`${ui.cellule} max-w-48`}>
                        <Link
                          href={`/dashboard/credits/${encodeURIComponent(c.id)}`}
                          title={c.nomComplet}
                          className="block truncate font-medium text-primary-700 hover:underline dark:text-primary-400"
                        >
                          {c.nomComplet}
                        </Link>
                      </td>
                      <td className={`${ui.cellule} hidden whitespace-nowrap md:table-cell`}>{c.telephone ?? ""}</td>
                      <td className={`${ui.cellule} hidden max-w-xs lg:table-cell`}>
                        <p title={c.resume} className="truncate">
                          {c.resume}
                        </p>
                      </td>
                      <td className={`${ui.cellule} whitespace-nowrap text-right font-semibold tabular-nums`}>
                        {formaterGNF(c.resteAPayer)}
                      </td>
                      <td className={`${ui.cellule} hidden whitespace-nowrap md:table-cell`}>
                        {c.dernierePrise ? formaterDateCourte(c.dernierePrise) : ""}
                      </td>
                      <td className={`${ui.cellule} whitespace-nowrap`}>{formaterJourCourt(c.dateLimite)}</td>
                      <td className={ui.cellule}>
                        <span className={CLASSE_BADGE_STATUT[c.statut]}>{libelleStatut(c.statut)}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {structureId && user && (
        <RemboursementModal
          isOpen={remboursementOuvert}
          structureId={structureId}
          userId={user.id}
          onClose={() => setRemboursementOuvert(false)}
          onSucces={(_resultat, _client, message) => {
            setRemboursementOuvert(false);
            setSucces(message);
            setRechargement((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}
