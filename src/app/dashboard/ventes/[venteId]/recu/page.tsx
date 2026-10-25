"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertCircle, ArrowLeft, Loader2, Printer } from "lucide-react";
import ImageWithFallback from "@/components/ImageWithFallback";
import { useAuth } from "@/hooks/useAuth";
import { messageErreurPour } from "@/hooks/useToast";
import { lireContexteAcces } from "@/lib/acces";
import { ApiError } from "@/lib/api_auth";
import { getVente, type Vente } from "@/lib/api_ventes";
import { formaterGNF } from "@/lib/format_gnf";
import { estRouteAutorisee } from "@/lib/navigation_tableau_de_bord";
import {
  FORMATS_RECU,
  enregistrerFormatRecu,
  formaterDateHeure,
  lireFormatRecu,
  type FormatRecu,
} from "../../affichage";

const POLICE_TITRE = { fontFamily: "var(--font-outfit, var(--font-inter))" } as const;

const CARTE = "bg-white dark:bg-[#0f172a]/80 border border-slate-200 dark:border-slate-800/50 rounded-3xl p-6";
const FOCUS = "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500";
const BOUTON_PRIMAIRE = `inline-flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl text-sm font-bold transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${FOCUS}`;

/** Classes de la feuille selon le format choisi. */
const CLASSES_FEUILLE: Record<FormatRecu, string> = {
  "58": "w-[58mm] max-w-full px-[3mm] py-[4mm] text-[11px] leading-snug",
  "80": "w-[80mm] max-w-full px-[4mm] py-[5mm] text-[12px] leading-snug",
  A4: "w-full max-w-[180mm] p-[10mm] print:p-0 text-sm",
};
const HAUTEUR_LOGO: Record<FormatRecu, string> = { "58": "h-12", "80": "h-12", A4: "h-16" };
const STYLE_IMPRESSION: Record<FormatRecu, string> = {
  "58": "@media print { @page { margin: 0; } }",
  "80": "@media print { @page { margin: 0; } }",
  A4: "@media print { @page { size: A4; margin: 15mm; } }",
};

const SEPARATEUR = "border-t border-dashed border-black/40 my-2";

type Etat =
  | { statut: "chargement" }
  | { statut: "pret"; vente: Vente }
  | { statut: "introuvable" }
  | { statut: "erreur"; message: string };

export default function RecuVentePage() {
  const { venteId } = useParams<{ venteId: string }>();
  const { user, loading, profile } = useAuth();
  const structureId = user?.structureId;
  const contexte = user ? lireContexteAcces(user, profile ?? null) : null;
  const peutVoirVentes = contexte !== null && estRouteAutorisee("/dashboard/ventes", contexte);

  const [etat, setEtat] = useState<Etat>({ statut: "chargement" });
  const [essai, setEssai] = useState(0);
  const [format, setFormat] = useState<FormatRecu>(() => lireFormatRecu());

  useEffect(() => {
    if (!structureId) return;
    let actif = true;
    getVente(structureId, venteId)
      .then((res) => {
        if (actif) setEtat({ statut: "pret", vente: res.data });
      })
      .catch((err: unknown) => {
        if (!actif) return;
        if (err instanceof ApiError && err.status === 404) {
          setEtat({ statut: "introuvable" });
        } else {
          setEtat({
            statut: "erreur",
            message: messageErreurPour(err, "Impossible d'afficher le reçu. Vérifiez votre connexion puis réessayez."),
          });
        }
      });
    return () => {
      actif = false;
    };
  }, [structureId, venteId, essai]);

  const reessayer = () => {
    setEtat({ statut: "chargement" });
    setEssai((n) => n + 1);
  };

  const choisirFormat = (nouveau: FormatRecu) => {
    setFormat(nouveau);
    enregistrerFormatRecu(nouveau);
  };

  const lienRetour = peutVoirVentes
    ? { href: "/dashboard/ventes", libelle: "Retour aux ventes du jour" }
    : { href: "/dashboard", libelle: "Retour à l'accueil" };

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
        Chargement du reçu...
      </div>
    );
  }

  if (etat.statut === "introuvable") {
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
        <div className={CARTE}>
          <p className="text-sm text-slate-700 dark:text-slate-300">
            Cette vente est introuvable. Vérifiez que vous êtes bien dans la bonne pharmacie.
          </p>
          <Link
            href={peutVoirVentes ? "/dashboard/ventes" : "/dashboard"}
            className={`${BOUTON_PRIMAIRE} mt-4`}
          >
            {peutVoirVentes ? "Voir les ventes du jour" : "Retour à l'accueil"}
          </Link>
        </div>
      </div>
    );
  }

  if (etat.statut === "erreur") {
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
        <div className={CARTE}>
          <div
            role="alert"
            className="flex items-center gap-3 p-4 rounded-2xl bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 text-sm"
          >
            <AlertCircle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
            <span>{etat.message}</span>
          </div>
          <button type="button" onClick={reessayer} className={`${BOUTON_PRIMAIRE} mt-4`}>
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  const vente = etat.vente;
  const { pharmacie } = vente;
  const hauteurLogo = HAUTEUR_LOGO[format];
  const lignesAdresse = [pharmacie.adresse, pharmacie.ville].filter((v): v is string => v !== null && v !== "");

  return (
    <div className="max-w-4xl mx-auto print:max-w-none print:m-0 animate-fade-in">
      <style>{STYLE_IMPRESSION[format]}</style>

      <div className="print:hidden space-y-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white" style={POLICE_TITRE}>
            Reçu de la vente
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Choisissez le format de votre imprimante puis appuyez sur « Imprimer ».
          </p>
        </div>
        <Link
          href={lienRetour.href}
          className={`inline-flex items-center gap-2 rounded-xl text-sm font-medium text-primary-700 dark:text-primary-300 hover:underline ${FOCUS}`}
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          {lienRetour.libelle}
        </Link>
        <fieldset>
          <legend className="text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">Format du ticket</legend>
          <div className="flex flex-wrap gap-3">
            {FORMATS_RECU.map((f) => (
              <label
                key={f.valeur}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl border text-sm font-medium cursor-pointer has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary-500 ${
                  format === f.valeur
                    ? "border-primary-600 text-primary-700 dark:text-primary-300"
                    : "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                }`}
              >
                <input
                  type="radio"
                  name="format-recu"
                  value={f.valeur}
                  checked={format === f.valeur}
                  onChange={() => choisirFormat(f.valeur)}
                  className="accent-primary-600 focus:outline-none"
                />
                {f.libelle}
              </label>
            ))}
          </div>
        </fieldset>
        <button type="button" onClick={() => window.print()} className={BOUTON_PRIMAIRE}>
          <Printer className="w-4 h-4" aria-hidden="true" />
          Imprimer
        </button>
      </div>

      <article
        aria-label={`Reçu ${vente.numero}`}
        className={`bg-white text-black border border-slate-300 print:border-0 mx-auto mt-6 print:mt-0 tabular-nums ${CLASSES_FEUILLE[format]}`}
        style={{ fontFamily: "system-ui, sans-serif" }}
      >
        {vente.statut === "ANNULEE" && (
          <>
            <p role="status" className="border-2 border-black font-extrabold tracking-widest text-center py-1">
              ANNULÉE
            </p>
            {vente.annuleeLe && <p className="text-center mt-1">Annulée le {formaterDateHeure(vente.annuleeLe)}</p>}
            <div className={SEPARATEUR} />
          </>
        )}

        <header className="text-center space-y-0.5">
          <ImageWithFallback
            src={pharmacie.logoUrl}
            alt={`Logo de ${pharmacie.nom}`}
            className={`mx-auto ${hauteurLogo} w-auto object-contain`}
            fallback={null}
          />
          <p className="font-bold">{pharmacie.nom}</p>
          {lignesAdresse.map((ligne) => (
            <p key={ligne}>{ligne}</p>
          ))}
          {pharmacie.telephone && <p>Tél. : {pharmacie.telephone}</p>}
        </header>

        <div className={SEPARATEUR} />

        <div className="space-y-0.5">
          <p>Reçu n° {vente.numero}</p>
          <p>Le {formaterDateHeure(vente.createdAt)}</p>
          <p>Vendeur : {vente.vendeur.nom}</p>
          {vente.clientNom && <p>Client : {vente.clientNom}</p>}
          {vente.clientTelephone && <p>Téléphone du client : {vente.clientTelephone}</p>}
        </div>

        <div className={SEPARATEUR} />

        <ul className="space-y-1.5">
          {vente.lignes.map((ligne) => (
            <li key={ligne.id}>
              <p>{ligne.nomMedicament}</p>
              <p className="text-right">{`${ligne.quantite} × ${formaterGNF(ligne.prixUnitaire)} = ${formaterGNF(ligne.sousTotal)}`}</p>
            </li>
          ))}
        </ul>

        <div className={SEPARATEUR} />

        <p className="flex items-center justify-between font-bold text-[1.15em]">
          <span>Total</span>
          <span>{formaterGNF(vente.total)}</span>
        </p>

        <div className={SEPARATEUR} />

        <footer className="text-center">
          <p>Merci de votre confiance</p>
          <p>Reçu : ne vaut pas facture</p>
        </footer>
      </article>
    </div>
  );
}
