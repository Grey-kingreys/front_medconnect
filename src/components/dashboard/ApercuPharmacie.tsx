"use client";

import { useEffect, useId, useState, type ComponentType, type ReactNode } from "react";
import Link from "next/link";
import {
  Package,
  XCircle,
  AlertTriangle,
  CalendarClock,
  Ban,
  Wallet,
  Users,
  ArrowRight,
  ShoppingCart,
  Receipt,
} from "lucide-react";
import { getMyStock } from "@/lib/api_pharmacie";
import { getMyStructure } from "@/lib/api_structure";
import { ApiError } from "@/lib/api_auth";
import { formaterGNF } from "@/lib/format_gnf";
import {
  calculerApercuStock,
  type ApercuStock,
  type RaisonSurveillance,
} from "@/lib/apercu_pharmacie";

export interface ApercuPharmacieProps {
  structureId: string | undefined;
  /** Le registre ouvre la page Stock à ce profil (D09). */
  peutVoirStock: boolean;
  /** Le registre ouvre la page Équipe à ce profil (D09). */
  peutVoirEquipe: boolean;
  /** Le registre ouvre Nouvelle vente à ce profil. */
  peutVendre?: boolean;
  /** Le registre ouvre Ventes du jour à ce profil. */
  peutVoirVentes?: boolean;
  /** Date de référence, pour les tests ; par défaut l'instant du calcul. */
  maintenant?: Date;
}

type EtatStock =
  | { statut: "chargement" }
  | { statut: "pret"; apercu: ApercuStock }
  | { statut: "erreur" }
  | { statut: "sansAcces" };
type EtatEquipe =
  | { statut: "chargement" }
  | { statut: "pret"; nombre: number }
  | { statut: "erreur" }
  | { statut: "masque" };

const pluriel = (n: number, singulier: string, plurielTexte: string) => `${n} ${n > 1 ? plurielTexte : singulier}`;

const nombre = (n: number) => n.toLocaleString("fr-FR");

const ICONES_RAISON: Record<RaisonSurveillance, { icone: ComponentType<{ className?: string }>; couleur: string }> = {
  perime: { icone: Ban, couleur: "text-rose-600 dark:text-rose-400" },
  rupture: { icone: XCircle, couleur: "text-rose-600 dark:text-rose-400" },
  stockBas: { icone: AlertTriangle, couleur: "text-amber-600 dark:text-amber-400" },
  expireBientot: { icone: CalendarClock, couleur: "text-amber-600 dark:text-amber-400" },
};

const CLASSES_BLOC = "bg-white dark:bg-[#0f172a]/80 border border-slate-200 dark:border-slate-800/50 rounded-2xl p-5";

function Carte({
  libelle,
  icone,
  couleur,
  className,
  sousTexte,
  children,
}: {
  libelle: string;
  icone: ComponentType<{ className?: string }>;
  couleur: string;
  className?: string;
  sousTexte?: ReactNode;
  children: ReactNode;
}) {
  const Icone = icone;
  return (
    <div
      role="group"
      aria-label={libelle}
      className={`bg-white dark:bg-[#0f172a]/80 border border-slate-200 dark:border-slate-800/50 rounded-2xl p-5 ${className ?? ""}`}
    >
      <div className={`inline-flex p-2 rounded-xl bg-slate-100 dark:bg-slate-800/50 mb-3 ${couleur}`}>
        <Icone className="w-5 h-5" />
      </div>
      {children}
      <p className="text-xs text-slate-600 dark:text-slate-400">{libelle}</p>
      {sousTexte && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{sousTexte}</p>}
    </div>
  );
}

function Valeur({ children }: { children: ReactNode }) {
  return <p className="text-2xl font-bold text-slate-900 dark:text-white mb-1">{children}</p>;
}

function Chargement() {
  return (
    <div className="mb-1 h-8 flex items-center">
      <span aria-hidden="true" className="block h-6 w-12 rounded-md bg-slate-200 dark:bg-slate-700/60 animate-pulse" />
      <span className="sr-only">Chargement</span>
    </div>
  );
}

const LIBELLES_STOCK = {
  disponibles: "Médicaments disponibles",
  ruptures: "En rupture de stock",
  stockBas: "Stock bas",
  expirent: "Expirent dans les 60 jours",
  perimes: "Périmés encore en stock",
  valeur: "Valeur indicative du stock",
} as const;

export default function ApercuPharmacie({
  structureId,
  peutVoirStock,
  peutVoirEquipe,
  peutVendre = false,
  peutVoirVentes = false,
  maintenant,
}: ApercuPharmacieProps) {
  const titreId = useId();
  const [etatStock, setEtatStock] = useState<EtatStock>({ statut: "chargement" });
  const [essaiStock, setEssaiStock] = useState(0);
  const [etatEquipe, setEtatEquipe] = useState<EtatEquipe>({ statut: "chargement" });
  const [essaiEquipe, setEssaiEquipe] = useState(0);

  useEffect(() => {
    if (!peutVoirStock || !structureId) return;
    let actif = true;
    getMyStock(structureId)
      .then((res) => {
        if (actif) {
          setEtatStock({
            statut: "pret",
            apercu: calculerApercuStock(res.data.stocks ?? [], maintenant ?? new Date()),
          });
        }
      })
      .catch((err: unknown) => {
        if (!actif) return;
        setEtatStock(err instanceof ApiError && err.status === 403 ? { statut: "sansAcces" } : { statut: "erreur" });
      });
    return () => {
      actif = false;
    };
    // La date de référence ne sert qu'aux tests : elle ne doit pas relancer le chargement
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [structureId, peutVoirStock, essaiStock]);

  useEffect(() => {
    if (!peutVoirEquipe) return;
    let actif = true;
    getMyStructure()
      .then((res) => {
        if (actif) setEtatEquipe({ statut: "pret", nombre: (res.data.membres ?? []).length });
      })
      .catch((err: unknown) => {
        if (!actif) return;
        setEtatEquipe(err instanceof ApiError && err.status === 403 ? { statut: "masque" } : { statut: "erreur" });
      });
    return () => {
      actif = false;
    };
  }, [peutVoirEquipe, essaiEquipe]);

  const reessayerStock = () => {
    setEtatStock({ statut: "chargement" });
    setEssaiStock((n) => n + 1);
  };
  const reessayerEquipe = () => {
    setEtatEquipe({ statut: "chargement" });
    setEssaiEquipe((n) => n + 1);
  };

  const stock: EtatStock = !peutVoirStock ? { statut: "sansAcces" } : !structureId ? { statut: "erreur" } : etatStock;
  const equipeVisible = peutVoirEquipe && etatEquipe.statut !== "masque";

  const carteEquipe = equipeVisible ? (
    <Carte libelle="Membres de l'équipe" icone={Users} couleur="text-secondary-600 dark:text-secondary-400">
      {etatEquipe.statut === "chargement" && <Chargement />}
      {etatEquipe.statut === "pret" && <Valeur>{nombre(etatEquipe.nombre)}</Valeur>}
      {etatEquipe.statut === "erreur" && (
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
    </Carte>
  ) : null;

  const entete = (
    <h2
      id={titreId}
      className="text-lg font-semibold text-slate-900 dark:text-white"
      style={{ fontFamily: "var(--font-outfit, var(--font-inter))" }}
    >
      Aperçu de votre pharmacie
    </h2>
  );

  const occupe = stock.statut === "chargement" || (peutVoirEquipe && etatEquipe.statut === "chargement");

  let cartes: ReactNode = null;
  let suite: ReactNode = null;

  if (stock.statut === "chargement") {
    const modeles: Array<[string, ComponentType<{ className?: string }>, string, string?]> = [
      [LIBELLES_STOCK.disponibles, Package, "text-primary-600 dark:text-primary-400"],
      [LIBELLES_STOCK.ruptures, XCircle, "text-rose-600 dark:text-rose-400"],
      [LIBELLES_STOCK.stockBas, AlertTriangle, "text-amber-600 dark:text-amber-400"],
      [LIBELLES_STOCK.expirent, CalendarClock, "text-amber-600 dark:text-amber-400"],
      [LIBELLES_STOCK.perimes, Ban, "text-rose-600 dark:text-rose-400"],
      [LIBELLES_STOCK.valeur, Wallet, "text-emerald-600 dark:text-emerald-400", "sm:col-span-2"],
    ];
    cartes = (
      <>
        {modeles.map(([libelle, icone, couleur, className]) => (
          <Carte key={libelle} libelle={libelle} icone={icone} couleur={couleur} className={className}>
            <Chargement />
          </Carte>
        ))}
        {carteEquipe}
      </>
    );
    suite = (
      <div className={CLASSES_BLOC}>
        <p role="status" className="text-sm text-slate-600 dark:text-slate-400">
          Chargement du stock...
        </p>
      </div>
    );
  } else if (stock.statut === "pret") {
    const a = stock.apercu;
    if (a.total > 0) {
      cartes = (
        <>
          <Carte
            libelle={LIBELLES_STOCK.disponibles}
            icone={Package}
            couleur="text-primary-600 dark:text-primary-400"
            sousTexte={`sur ${pluriel(a.total, "médicament enregistré", "médicaments enregistrés")}`}
          >
            <Valeur>{nombre(a.disponibles)}</Valeur>
          </Carte>
          <Carte
            libelle={LIBELLES_STOCK.ruptures}
            icone={XCircle}
            couleur="text-rose-600 dark:text-rose-400"
            sousTexte="Quantité à zéro"
          >
            <Valeur>{nombre(a.ruptures)}</Valeur>
          </Carte>
          <Carte
            libelle={LIBELLES_STOCK.stockBas}
            icone={AlertTriangle}
            couleur="text-amber-600 dark:text-amber-400"
            sousTexte="Moins de 10 unités"
          >
            <Valeur>{nombre(a.stockBas)}</Valeur>
          </Carte>
          <Carte
            libelle={LIBELLES_STOCK.expirent}
            icone={CalendarClock}
            couleur="text-amber-600 dark:text-amber-400"
            sousTexte="Date de péremption proche"
          >
            <Valeur>{nombre(a.expirentBientot)}</Valeur>
          </Carte>
          <Carte
            libelle={LIBELLES_STOCK.perimes}
            icone={Ban}
            couleur="text-rose-600 dark:text-rose-400"
            sousTexte="À retirer de la vente"
          >
            <Valeur>{nombre(a.perimes)}</Valeur>
          </Carte>
          <Carte
            libelle={LIBELLES_STOCK.valeur}
            icone={Wallet}
            couleur="text-emerald-600 dark:text-emerald-400"
            className="sm:col-span-2"
            sousTexte={
              a.sansPrix > 0
                ? `Quantité × prix, hors médicaments périmés. ${pluriel(a.sansPrix, "médicament sans prix n'est pas compté", "médicaments sans prix ne sont pas comptés")}.`
                : "Quantité × prix, hors médicaments périmés."
            }
          >
            <Valeur>{formaterGNF(a.valeur)}</Valeur>
          </Carte>
          {carteEquipe}
        </>
      );
      suite = (
        <div className={CLASSES_BLOC}>
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">À surveiller</h3>
            <Link
              href="/dashboard/stock"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary-700 dark:text-primary-400 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
            >
              Voir tout le stock <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>
          {a.aSurveillerTotal === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Rien à signaler : aucun médicament en rupture, en stock bas, périmé ou proche de la péremption.
            </p>
          ) : (
            <ul className="divide-y divide-slate-200 dark:divide-slate-800">
              {a.aSurveiller.map((ligne) => {
                const { icone: Icone, couleur } = ICONES_RAISON[ligne.raison];
                return (
                  <li key={ligne.stockId} className="py-2 flex items-start gap-3">
                    <Icone className={`w-4 h-4 mt-0.5 shrink-0 ${couleur}`} aria-hidden="true" />
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">{ligne.nom}</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">{ligne.detail}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {a.aSurveillerTotal > a.aSurveiller.length && (
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              {`Et ${pluriel(a.aSurveillerTotal - a.aSurveiller.length, "autre médicament", "autres médicaments")} à vérifier dans le stock.`}
            </p>
          )}
        </div>
      );
    } else {
      cartes = carteEquipe;
      suite = (
        <div className={CLASSES_BLOC}>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">Votre stock est vide</h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Ajoutez vos médicaments un par un ou importez votre fichier Excel pour suivre ici vos ruptures et vos dates de péremption.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/dashboard/stock"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              Ouvrir le stock
            </Link>
            <Link
              href="/dashboard/stock?importer=1"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white hover:border-primary-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              Importer un fichier Excel
            </Link>
          </div>
        </div>
      );
    }
  } else if (stock.statut === "erreur") {
    cartes = carteEquipe;
    suite = (
      <div role="alert" className="flex flex-col sm:flex-row sm:items-center gap-3 text-sm text-slate-700 dark:text-slate-300">
        <p>Les chiffres du stock n&apos;ont pas pu être chargés. Vérifiez votre connexion puis réessayez.</p>
        <button
          type="button"
          onClick={reessayerStock}
          className="self-start sm:self-auto px-4 py-2 rounded-xl text-sm font-medium bg-primary-500/10 text-primary-700 dark:text-primary-400 hover:bg-primary-500/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          Réessayer
        </button>
      </div>
    );
  } else {
    cartes = carteEquipe;
    suite = (
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Le stock de la pharmacie n&apos;est pas ouvert à votre profil. Les médicaments disponibles, les ruptures et les dates de péremption s&apos;afficheront ici dès que cet accès vous sera donné.
      </p>
    );
  }

  return (
    <section aria-labelledby={titreId} aria-busy={occupe} className="space-y-4">
      {entete}
      {(peutVendre || peutVoirVentes) && (
        <div className="flex flex-wrap gap-3">
          {peutVendre && (
            <Link
              href="/dashboard/vente"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              <ShoppingCart className="w-4 h-4" aria-hidden="true" />
              Nouvelle vente
            </Link>
          )}
          {peutVoirVentes && (
            <Link
              href="/dashboard/ventes"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white hover:border-primary-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              <Receipt className="w-4 h-4" aria-hidden="true" />
              Ventes du jour
            </Link>
          )}
        </div>
      )}
      {cartes && <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">{cartes}</div>}
      {suite}
    </section>
  );
}
