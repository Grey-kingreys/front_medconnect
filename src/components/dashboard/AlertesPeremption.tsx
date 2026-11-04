"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { ArrowRight, Ban, CalendarClock } from "lucide-react";
import { ApiError } from "@/lib/api_auth";
import { getAlertesPeremption, type AlertesPeremption as Alertes, type GroupeAlerte, type LotAlerte } from "@/lib/api_pilotage";
import { afficherDatePeremption } from "@/lib/date_peremption";
import { formaterGNF } from "@/lib/format_gnf";
import { aCoutTransmis } from "@/lib/marge_affichage";
import { ErreurAvecReessai } from "@/components/pharmacie/ErreurAvecReessai";
import { Carte, Chargement, Valeur, pluriel } from "./ApercuPharmacie";

type Etat = { statut: "chargement" } | { statut: "pret"; alertes: Alertes } | { statut: "erreur" } | { statut: "masque" };

/** Nombre de lots détaillés sous les cartes. */
const LOTS_AFFICHES = 5;

const CLASSES_BLOC = "bg-white dark:bg-[#0f172a]/80 border border-slate-200 dark:border-slate-800/50 rounded-2xl p-5";
const CLASSES_LIEN =
  "inline-flex items-center gap-1 text-sm font-medium text-primary-700 dark:text-primary-400 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded";

/** Quantité d'un lot en boîtes entières et unités en plus, jamais négative. */
function quantiteLot(lot: LotAlerte): string {
  const boites = Math.max(0, lot.quantiteBoites);
  const unites = Math.max(0, lot.unitesEnPlus);
  const textBoites = `${boites.toLocaleString("fr-FR")} ${boites > 1 ? "boîtes" : "boîte"}`;
  const textUnites = `${unites.toLocaleString("fr-FR")} ${unites > 1 ? "unités" : "unité"}`;
  if (boites === 0 && unites > 0) return textUnites;
  return unites > 0 ? `${textBoites} et ${textUnites}` : textBoites;
}

function delaiLot(lot: LotAlerte): string {
  const date = afficherDatePeremption(lot.dateExpiration);
  if (lot.joursRestants < 0) return `périmé depuis le ${date}`;
  if (lot.joursRestants === 0) return `expire aujourd'hui, le ${date}`;
  return `expire le ${date}, dans ${pluriel(lot.joursRestants, "jour", "jours")}`;
}

/** Sous-texte d'une carte : valeur de vente, puis coût d'achat seulement si le serveur l'a transmis. */
function SousTexteGroupe({ groupe }: { groupe: GroupeAlerte }) {
  const sansPrix = groupe.nombreLotsSansPrix > 0 ? `, ${pluriel(groupe.nombreLotsSansPrix, "lot sans prix", "lots sans prix")}` : "";
  const coutTransmis = aCoutTransmis(groupe, "valeurCout");
  const inconnus = groupe.nombreLotsCoutInconnu ?? 0;
  return (
    <>
      <span className="block">
        {`Valeur de vente : ${groupe.valeurVente === null ? "inconnue" : formaterGNF(groupe.valeurVente)}${sansPrix}`}
      </span>
      {coutTransmis && (
        <span className="block">
          {`Coût d'achat : ${groupe.valeurCout === null || groupe.valeurCout === undefined ? "inconnu" : formaterGNF(groupe.valeurCout)}${
            inconnus > 0 ? `, ${pluriel(inconnus, "lot au coût inconnu", "lots au coût inconnu")}` : ""
          }`}
        </span>
      )}
    </>
  );
}

export default function AlertesPeremption({ structureId }: { structureId: string | undefined }) {
  const titreId = useId();
  const [etat, setEtat] = useState<Etat>({ statut: "chargement" });
  const [essai, setEssai] = useState(0);

  useEffect(() => {
    if (!structureId) return;
    let actif = true;
    getAlertesPeremption(structureId)
      .then((res) => {
        if (actif) setEtat({ statut: "pret", alertes: res.data });
      })
      .catch((err: unknown) => {
        if (!actif) return;
        setEtat(err instanceof ApiError && err.status === 403 ? { statut: "masque" } : { statut: "erreur" });
      });
    return () => {
      actif = false;
    };
  }, [structureId, essai]);

  const courant: Etat = !structureId ? { statut: "erreur" } : etat;
  if (courant.statut === "masque") return null;

  const reessayer = () => {
    setEtat({ statut: "chargement" });
    setEssai((n) => n + 1);
  };

  const titre = (
    <h3 id={titreId} className="text-base font-semibold text-slate-900 dark:text-white">
      Péremptions à surveiller
    </h3>
  );

  if (courant.statut === "erreur") {
    return (
      <section aria-labelledby={titreId} className="space-y-4">
        {titre}
        <ErreurAvecReessai message="Les péremptions n'ont pas pu être chargées." onReessayer={reessayer} />
      </section>
    );
  }

  if (courant.statut === "chargement") {
    return (
      <section aria-labelledby={titreId} aria-busy="true" className="space-y-4">
        {titre}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Carte libelle="Périmés" icone={Ban} couleur="text-rose-600 dark:text-rose-400">
            <Chargement />
          </Carte>
          <Carte libelle="Dans les prochains jours" icone={CalendarClock} couleur="text-amber-600 dark:text-amber-400">
            <Chargement />
          </Carte>
        </div>
      </section>
    );
  }

  const { alertes } = courant;
  // Du plus court au plus long (le serveur les envoie du plus long au plus court).
  const horizons = [...alertes.horizons].sort((a, b) => a.jours - b.jours);
  const plusLong = horizons.length > 0 ? horizons[horizons.length - 1].jours : 0;
  const lots = [...alertes.perimes.lots, ...horizons.flatMap((h) => h.lots)].sort((a, b) => a.joursRestants - b.joursRestants);
  const lotsVisibles = lots.slice(0, LOTS_AFFICHES);
  const autres = lots.length - lotsVisibles.length;
  const sansDate = alertes.sansDate.nombreLots;
  // Les lots sans date ne sont pas des lots sans péremption : ne jamais les passer sous silence.
  const delai = plusLong > 0 ? ` dans les ${plusLong} prochains jours` : " prochainement";
  const messageSansLot =
    sansDate > 0 ? `Aucun lot daté ne périme${delai}.` : `Aucune péremption${delai}.`;

  return (
    <section aria-labelledby={titreId} className="space-y-4">
      {titre}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Carte
          libelle="Périmés"
          icone={Ban}
          couleur="text-rose-600 dark:text-rose-400"
          sousTexte={<SousTexteGroupe groupe={alertes.perimes} />}
        >
          <Valeur>{alertes.perimes.nombreLots.toLocaleString("fr-FR")}</Valeur>
        </Carte>
        {horizons.map((h) => (
          <Carte
            key={h.jours}
            libelle={`Dans ${h.jours} jours`}
            icone={CalendarClock}
            couleur="text-amber-600 dark:text-amber-400"
            sousTexte={<SousTexteGroupe groupe={h} />}
          >
            <Valeur>{h.nombreLots.toLocaleString("fr-FR")}</Valeur>
          </Carte>
        ))}
      </div>
      <div className={CLASSES_BLOC}>
        {lots.length === 0 ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">{messageSansLot}</p>
        ) : (
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {lotsVisibles.map((lot) => {
              const perime = lot.joursRestants < 0;
              return (
                <li key={lot.lotId} className="py-2 flex items-start gap-3">
                  {perime ? (
                    <Ban className="w-4 h-4 mt-0.5 shrink-0 text-rose-600 dark:text-rose-400" aria-hidden="true" />
                  ) : (
                    <CalendarClock className="w-4 h-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                      {`${lot.nom}, lot ${lot.numeroLot ?? "sans numéro"} : ${quantiteLot(lot)}`}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {delaiLot(lot)}
                      {perime && (
                        <>
                          {" "}
                          <Link href="/dashboard/stock" className={CLASSES_LIEN}>
                            Sortir du stock
                          </Link>
                        </>
                      )}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {autres > 0 && (
          <p className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
            {`Et ${pluriel(autres, "autre lot", "autres lots")}`}
            <Link href="/dashboard/stock" className={CLASSES_LIEN}>
              Voir le stock <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </p>
        )}
        {sansDate > 0 && (
          <p className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
            {`${pluriel(sansDate, "lot sans date de péremption", "lots sans date de péremption")} : datez-les depuis le stock.`}
            <Link href="/dashboard/stock" className={CLASSES_LIEN}>
              Ouvrir le stock <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </p>
        )}
      </div>
    </section>
  );
}
