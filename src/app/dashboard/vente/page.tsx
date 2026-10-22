"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, CircleCheck, Loader2, Minus, Plus, Search, Trash2, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { messageErreurPour } from "@/hooks/useToast";
import { ApiError } from "@/lib/api_auth";
import { nouvelleCleIdempotence } from "@/lib/api_carnet";
import { getMyStock, type StockMedicament } from "@/lib/api_pharmacie";
import { codeErreurVente, creerVente, lignesErreurVente, type Vente } from "@/lib/api_ventes";
import { MSG_TELEPHONE_INVALIDE, AIDE_TELEPHONE } from "@/lib/erreur_telephone";
import { lireContexteAcces } from "@/lib/acces";
import { formaterGNF } from "@/lib/format_gnf";
import { estRouteAutorisee } from "@/lib/navigation_tableau_de_bord";
import { ConfirmationVente } from "./ConfirmationVente";
import {
  LIBELLES_RAISON,
  LONGUEUR_MAX_NOM_CLIENT,
  NOMBRE_MAX_RESULTATS,
  PANIER_VIDE,
  ajouterAuPanier,
  appliquerStockInsuffisant,
  changerQuantite,
  cleStockagePanier,
  corpsVente,
  enregistrerPanier,
  lirePanierStocke,
  medicamentsSurOrdonnance,
  messageCorrections,
  panierPlein,
  prixArrondi,
  quantiteMaxLigne,
  raisonNonVendable,
  rechercherDansStock,
  reconcilierPanier,
  retirerDuPanier,
  retirerLignes,
  telephoneClientValide,
  totalPanier,
  type PanierVente,
} from "./panier";

const POLICE_TITRE = { fontFamily: "var(--font-outfit, var(--font-inter))" } as const;

const CARTE = "bg-white dark:bg-[#0f172a]/80 border border-slate-200 dark:border-slate-800/50 rounded-3xl p-6";
const CHAMP =
  "w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm text-slate-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 transition-all";
const FOCUS = "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500";
const BOUTON_PRIMAIRE = `inline-flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl text-sm font-bold transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${FOCUS}`;
const BOUTON_ICONE = `p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${FOCUS}`;

const MSG_COCHER_ORDONNANCE = "Cochez « J'ai vu l'ordonnance » pour vendre ces médicaments.";
const STATUTS_RESEAU = [0, 502, 503, 504];

type CibleFocus = "telephone" | "ordonnance";

export default function NouvelleVentePage() {
  const { user, loading, profile } = useAuth();
  const peutVoirVentes = user ? estRouteAutorisee("/dashboard/ventes", lireContexteAcces(user, profile ?? null)) : false;
  const structureId = user?.structureId;
  const userId = user?.id;
  const cleStock = structureId && userId ? cleStockagePanier(structureId, userId) : null;

  const [stock, setStock] = useState<StockMedicament[] | null>(null);
  const [erreurChargement, setErreurChargement] = useState<string | null>(null);
  const [essai, setEssai] = useState(0);
  const [panier, setPanier] = useState<PanierVente>(PANIER_VIDE);
  const [texte, setTexte] = useState("");
  const [info, setInfo] = useState<string | null>(null);
  const [bandeau, setBandeau] = useState<string | null>(null);
  const [reessayable, setReessayable] = useState(false);
  const [confirmation, setConfirmation] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [succes, setSucces] = useState<Vente | null>(null);
  const [erreurTelephone, setErreurTelephone] = useState(false);
  const [erreurOrdonnance, setErreurOrdonnance] = useState(false);

  const champTelephone = useRef<HTMLInputElement>(null);
  const caseOrdonnance = useRef<HTMLInputElement>(null);
  const titreSucces = useRef<HTMLHeadingElement>(null);
  const focusAFaire = useRef<CibleFocus | null>(null);
  const envoiEnCours = useRef(false);

  // Enregistrement du panier à chaque changement, une fois le stock connu (déclaré avant le chargement).
  useEffect(() => {
    if (stock !== null && cleStock !== null) enregistrerPanier(cleStock, panier);
  }, [panier, stock, cleStock]);

  // Chargement du stock, puis relecture du panier enregistré et alignement sur le stock.
  useEffect(() => {
    if (!structureId || !userId) return;
    let actif = true;
    getMyStock(structureId)
      .then((res) => {
        if (!actif) return;
        const stocks = res.data.stocks;
        const { panier: corrige, corrections } = reconcilierPanier(
          lirePanierStocke(cleStockagePanier(structureId, userId)),
          stocks,
          new Date(),
        );
        setStock(stocks);
        setPanier(corrige);
        setErreurChargement(null);
        if (corrections.length > 0) setInfo(messageCorrections(corrections));
      })
      .catch((err: unknown) => {
        if (!actif) return;
        setErreurChargement(
          messageErreurPour(err, "Impossible d'afficher le stock de la pharmacie. Vérifiez votre connexion puis réessayez."),
        );
      });
    return () => {
      actif = false;
    };
  }, [structureId, userId, essai]);

  // Déplace le focus demandé par un gestionnaire une fois l'écran à jour.
  useEffect(() => {
    if (focusAFaire.current === "telephone") champTelephone.current?.focus();
    if (focusAFaire.current === "ordonnance") caseOrdonnance.current?.focus();
    focusAFaire.current = null;
  });

  useEffect(() => {
    if (succes) titreSucces.current?.focus();
  }, [succes]);

  const reessayerChargement = () => {
    setErreurChargement(null);
    setStock(null);
    setEssai((n) => n + 1);
  };

  const enTete = (
    <div>
      <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white" style={POLICE_TITRE}>
        Nouvelle vente
      </h1>
      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
        Recherchez les médicaments, ajustez les quantités puis validez la vente.
      </p>
    </div>
  );

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

  const stocks = stock ?? [];
  const surOrdonnance = medicamentsSurOrdonnance(panier, stocks);
  const total = totalPanier(panier, stocks);
  const resultats = rechercherDansStock(stocks, texte);
  const plusDeResultats =
    resultats.length === NOMBRE_MAX_RESULTATS &&
    rechercherDansStock(
      stocks.filter((s) => !resultats.includes(s)),
      texte,
    ).length > 0;
  const quantiteDansPanier = (stockId: string) => panier.lignes.find((l) => l.stockId === stockId)?.quantite ?? 0;

  const ajouter = (s: StockMedicament) => setPanier(ajouterAuPanier(panier, s, nouvelleCleIdempotence, new Date()));

  const demanderConfirmation = () => {
    setBandeau(null);
    setInfo(null);
    if (!telephoneClientValide(panier.clientTelephone)) {
      setErreurTelephone(true);
      focusAFaire.current = "telephone";
      return;
    }
    if (surOrdonnance.length > 0 && !panier.ordonnanceVue) {
      setErreurOrdonnance(true);
      focusAFaire.current = "ordonnance";
      return;
    }
    setConfirmation(true);
  };

  const enregistrerEtAppliquer = (nouveau: PanierVente) => {
    if (cleStock) enregistrerPanier(cleStock, nouveau);
    setPanier(nouveau);
  };

  const gererEchec = (err: unknown) => {
    setEnvoi(false);
    setConfirmation(false);
    setReessayable(false);
    const code = codeErreurVente(err);
    const lignesErreur = lignesErreurVente(err);
    const nomsCites = () =>
      lignesErreur
        .map((l) => l.nom ?? stocks.find((s) => s.id === l.stockId)?.medicament.nom)
        .filter((n): n is string => typeof n === "string" && n !== "");
    const suiteNoms = () => {
      const noms = nomsCites();
      return noms.length > 0 ? ` : ${noms.join(", ")}` : "";
    };

    if (code === "STOCK_INSUFFISANT") {
      const { panier: corrige, corrections } = appliquerStockInsuffisant(panier, lignesErreur, stocks);
      enregistrerEtAppliquer(corrige);
      setEssai((n) => n + 1);
      setBandeau(
        `Le stock a changé pendant la vente. ${corrections.length > 0 ? `${messageCorrections(corrections)} ` : ""}Vérifiez le panier puis validez à nouveau.`,
      );
    } else if (code === "MEDICAMENT_EXPIRE") {
      enregistrerEtAppliquer(retirerLignes(panier, lignesErreur.map((l) => l.stockId)));
      setEssai((n) => n + 1);
      setBandeau(
        `Certains médicaments ont dépassé leur date de péremption et ont été retirés du panier${suiteNoms()}.`,
      );
    } else if (code === "STOCK_INTROUVABLE") {
      enregistrerEtAppliquer(retirerLignes(panier, lignesErreur.map((l) => l.stockId)));
      setEssai((n) => n + 1);
      setBandeau(
        `Certains médicaments ne sont plus dans le stock de la pharmacie et ont été retirés du panier${suiteNoms()}. Vérifiez le panier puis validez à nouveau.`,
      );
    } else if (code === "PRIX_MANQUANT") {
      enregistrerEtAppliquer(retirerLignes(panier, lignesErreur.map((l) => l.stockId)));
      setEssai((n) => n + 1);
      setBandeau(
        `Certains médicaments n'ont pas de prix et ont été retirés du panier${suiteNoms()}. Renseignez leur prix dans le stock pour pouvoir les vendre.`,
      );
    } else if (code === "ORDONNANCE_NON_CONFIRMEE") {
      enregistrerEtAppliquer({ ...panier, ordonnanceVue: false });
      setEssai((n) => n + 1);
      setErreurOrdonnance(true);
      if (surOrdonnance.length === 0) setBandeau(MSG_COCHER_ORDONNANCE);
      focusAFaire.current = "ordonnance";
    } else if (code === "VALIDATION") {
      setBandeau(messageErreurPour(err, "Vérifiez les informations du client puis réessayez."));
    } else if (err instanceof ApiError && STATUTS_RESEAU.includes(err.status)) {
      setReessayable(true);
      setBandeau(
        "La vente n'a peut-être pas été enregistrée. Vérifiez votre connexion puis appuyez sur « Réessayer » : elle ne sera pas comptée deux fois.",
      );
    } else {
      setBandeau(messageErreurPour(err, "Un problème est survenu, réessayez dans un instant."));
    }
  };

  const envoyerVente = () => {
    if (envoiEnCours.current) return;
    let cle = panier.cleIdempotence;
    if (cle === null) {
      cle = nouvelleCleIdempotence();
      enregistrerEtAppliquer({ ...panier, cleIdempotence: cle });
    }
    envoiEnCours.current = true;
    setEnvoi(true);
    setBandeau(null);
    setReessayable(false);
    creerVente(structureId, corpsVente(panier, surOrdonnance.length > 0), cle)
      .then((res) => {
        envoiEnCours.current = false;
        setEnvoi(false);
        setConfirmation(false);
        setPanier(PANIER_VIDE);
        setSucces(res.data);
      })
      .catch((err: unknown) => {
        envoiEnCours.current = false;
        gererEchec(err);
      });
  };

  const nouvelleVente = () => {
    setSucces(null);
    setPanier(PANIER_VIDE);
    setTexte("");
    setInfo(null);
    setBandeau(null);
    setEssai((n) => n + 1);
  };

  const lignesConfirmation = panier.lignes.flatMap((ligne) => {
    const s = stocks.find((x) => x.id === ligne.stockId);
    return s ? [{ nom: s.medicament.nom, quantite: ligne.quantite, prixUnitaire: prixArrondi(s) }] : [];
  });
  const client = [panier.clientNom.trim(), panier.clientTelephone.trim()].filter((v) => v !== "").join(", ");

  if (succes) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
        {enTete}
        <div className={`${CARTE} flex flex-col items-start gap-4`}>
          <CircleCheck className="w-10 h-10 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
          <h2
            ref={titreSucces}
            tabIndex={-1}
            className="text-xl font-bold text-slate-900 dark:text-white focus:outline-none"
            style={POLICE_TITRE}
          >
            Vente enregistrée
          </h2>
          {succes.rejeu === true && (
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Cette vente était déjà enregistrée : elle n&apos;a pas été comptée deux fois.
            </p>
          )}
          <div className="text-sm text-slate-700 dark:text-slate-300 space-y-1">
            <p>Numéro : {succes.numero}</p>
            <p className="font-bold text-slate-900 dark:text-white">Total : {formaterGNF(succes.total)}</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link href={`/dashboard/ventes/${encodeURIComponent(succes.id)}/recu`} className={BOUTON_PRIMAIRE}>
              Voir et imprimer le reçu
            </Link>
            <button
              type="button"
              onClick={nouvelleVente}
              className={`px-4 py-3 rounded-2xl text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors ${FOCUS}`}
            >
              Nouvelle vente
            </button>
            {peutVoirVentes && (
              <Link
                href="/dashboard/ventes"
                className={`px-4 py-3 rounded-2xl text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors ${FOCUS}`}
              >
                Voir les ventes du jour
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  let corps;
  if (stock === null && erreurChargement === null) {
    corps = (
      <div role="status" className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
        Chargement du stock...
      </div>
    );
  } else if (stock === null) {
    corps = (
      <div className={CARTE}>
        <div
          role="alert"
          className="flex items-center gap-3 p-4 rounded-2xl bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 text-sm"
        >
          <AlertCircle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
          <span>{erreurChargement}</span>
        </div>
        <button type="button" onClick={reessayerChargement} className={`${BOUTON_PRIMAIRE} mt-4`}>
          Réessayer
        </button>
      </div>
    );
  } else if (stock.length === 0) {
    corps = (
      <div className={CARTE}>
        <p className="text-sm text-slate-700 dark:text-slate-300">
          Votre stock est vide. Ajoutez des médicaments à votre stock pour pouvoir les vendre.
        </p>
        <Link href="/dashboard/stock" className={`${BOUTON_PRIMAIRE} mt-4`}>
          Aller au stock
        </Link>
      </div>
    );
  } else {
    corps = (
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <section className={`${CARTE} lg:col-span-3 space-y-4`} aria-label="Recherche de médicaments">
          <div>
            <label htmlFor="recherche-vente" className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">
              Rechercher un médicament
            </label>
            <div className="relative">
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 dark:text-slate-400"
                aria-hidden="true"
              />
              <input
                id="recherche-vente"
                type="search"
                placeholder="Nom ou nom générique"
                value={texte}
                onChange={(e) => setTexte(e.target.value)}
                className={`${CHAMP} pl-12`}
              />
            </div>
          </div>

          {resultats.length === 0 ? (
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Aucun médicament ne correspond à « {texte.trim()} ». Vérifiez l&apos;orthographe ou essayez le nom générique.
            </p>
          ) : (
            <ul className="divide-y divide-slate-200 dark:divide-slate-800">
              {resultats.map((s) => {
                const raison = raisonNonVendable(s, new Date());
                const dansPanier = quantiteDansPanier(s.id);
                const nom = s.medicament.nom;
                return (
                  <li key={s.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 dark:text-white">{nom}</p>
                      {s.medicament.nomGenerique && (
                        <p className="text-sm text-slate-600 dark:text-slate-400">{s.medicament.nomGenerique}</p>
                      )}
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Reste : {s.quantite}
                        {prixArrondi(s) > 0 && ` · ${formaterGNF(prixArrondi(s))}`}
                        {s.medicament.ordonnanceRequise && " · Sur ordonnance"}
                      </p>
                    </div>
                    {raison !== null ? (
                      <span className="inline-flex self-start sm:self-center px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300">
                        {LIBELLES_RAISON[raison]}
                      </span>
                    ) : dansPanier >= quantiteMaxLigne(s) ? (
                      <span className="text-sm text-slate-600 dark:text-slate-400">Tout le stock est dans le panier</span>
                    ) : dansPanier === 0 && panierPlein(panier) ? (
                      <span className="text-sm text-slate-600 dark:text-slate-400">Panier complet</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => ajouter(s)}
                        aria-label={`Ajouter ${nom} au panier`}
                        className={`${BOUTON_PRIMAIRE} self-start sm:self-center`}
                      >
                        <Plus className="w-4 h-4" aria-hidden="true" />
                        Ajouter
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {plusDeResultats && (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Seuls les {NOMBRE_MAX_RESULTATS} premiers résultats sont affichés. Précisez votre recherche.
            </p>
          )}
        </section>

        <div className="lg:col-span-2 lg:sticky lg:top-6 self-start space-y-4">
          {info && (
            <div
              role="status"
              className="p-4 rounded-2xl bg-primary-50 dark:bg-primary-500/15 text-primary-700 dark:text-primary-300 text-sm"
            >
              {info}
            </div>
          )}
          {bandeau && (
            <div
              role="alert"
              className="flex items-start gap-3 p-4 rounded-2xl bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 text-sm"
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
              <div className="flex-1 space-y-2">
                <p>{bandeau}</p>
                {reessayable && (
                  <button
                    type="button"
                    onClick={envoyerVente}
                    disabled={envoi}
                    className={`px-3 py-1.5 rounded-xl text-sm font-bold bg-rose-700 text-white hover:bg-rose-800 disabled:opacity-60 ${FOCUS}`}
                  >
                    Réessayer
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setBandeau(null)}
                aria-label="Fermer le message"
                className={`p-1 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-500/20 ${FOCUS}`}
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          )}

          <section className={`${CARTE} space-y-4`} aria-labelledby="titre-panier">
            <h2 id="titre-panier" className="text-lg font-semibold text-slate-900 dark:text-white" style={POLICE_TITRE}>
              Panier
            </h2>

            {panier.lignes.length === 0 ? (
              <p className="text-sm text-slate-700 dark:text-slate-300">
                Le panier est vide. Recherchez un médicament puis appuyez sur « Ajouter ».
              </p>
            ) : (
              <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                {panier.lignes.map((ligne) => {
                  const s = stocks.find((x) => x.id === ligne.stockId);
                  if (!s) return null;
                  const nom = s.medicament.nom;
                  const prix = prixArrondi(s);
                  return (
                    <li key={ligne.stockId} className="py-3 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 dark:text-white">{nom}</p>
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            {formaterGNF(prix)} × {ligne.quantite}
                          </p>
                        </div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white whitespace-nowrap">
                          {formaterGNF(prix * ligne.quantite)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setPanier(changerQuantite(panier, s, -1))}
                          disabled={ligne.quantite <= 1}
                          aria-label={`Diminuer la quantité de ${nom}`}
                          className={BOUTON_ICONE}
                        >
                          <Minus className="w-4 h-4" aria-hidden="true" />
                        </button>
                        <span className="min-w-8 text-center text-sm font-bold text-slate-900 dark:text-white">
                          {ligne.quantite}
                        </span>
                        <button
                          type="button"
                          onClick={() => setPanier(changerQuantite(panier, s, 1))}
                          disabled={ligne.quantite >= quantiteMaxLigne(s)}
                          aria-label={`Augmenter la quantité de ${nom}`}
                          className={BOUTON_ICONE}
                        >
                          <Plus className="w-4 h-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPanier(retirerDuPanier(panier, ligne.stockId))}
                          aria-label={`Retirer ${nom} du panier`}
                          className={`ml-auto inline-flex items-center gap-1.5 px-2 py-2 rounded-xl text-sm text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-500/15 ${FOCUS}`}
                        >
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                          Retirer
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {panierPlein(panier) && (
              <p role="status" className="text-sm text-slate-700 dark:text-slate-300">
                Le panier contient 50 médicaments différents, le maximum pour une vente. Validez cette vente puis commencez-en une nouvelle.
              </p>
            )}

            <div aria-live="polite" className="flex items-center justify-between text-slate-900 dark:text-white">
              <span className="font-medium">Total</span>
              <span className="text-lg font-bold">{formaterGNF(total)}</span>
            </div>

            {surOrdonnance.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    ref={caseOrdonnance}
                    id="case-ordonnance"
                    type="checkbox"
                    checked={panier.ordonnanceVue}
                    onChange={(e) => {
                      setPanier({ ...panier, ordonnanceVue: e.target.checked });
                      setErreurOrdonnance(false);
                    }}
                    aria-describedby="aide-ordonnance"
                    className={`w-5 h-5 rounded accent-primary-600 ${FOCUS}`}
                  />
                  <label htmlFor="case-ordonnance" className="text-sm font-medium text-slate-900 dark:text-white">
                    J&apos;ai vu l&apos;ordonnance
                  </label>
                </div>
                <p id="aide-ordonnance" className="text-sm text-slate-600 dark:text-slate-400">
                  Médicaments sur ordonnance : {surOrdonnance.join(", ")}.
                </p>
                {erreurOrdonnance && (
                  <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">
                    {MSG_COCHER_ORDONNANCE}
                  </p>
                )}
              </div>
            )}

            <fieldset className="space-y-3">
              <legend className="text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">Client (facultatif)</legend>
              <div>
                <label htmlFor="client-nom" className="block text-sm text-slate-700 dark:text-slate-300 mb-1">
                  Nom du client
                </label>
                <input
                  id="client-nom"
                  type="text"
                  maxLength={LONGUEUR_MAX_NOM_CLIENT}
                  value={panier.clientNom}
                  onChange={(e) => setPanier({ ...panier, clientNom: e.target.value })}
                  className={CHAMP}
                />
              </div>
              <div>
                <label htmlFor="client-telephone" className="block text-sm text-slate-700 dark:text-slate-300 mb-1">
                  Téléphone du client
                </label>
                <input
                  ref={champTelephone}
                  id="client-telephone"
                  type="tel"
                  inputMode="tel"
                  value={panier.clientTelephone}
                  onChange={(e) => {
                    setPanier({ ...panier, clientTelephone: e.target.value });
                    setErreurTelephone(false);
                  }}
                  aria-describedby="aide-telephone"
                  className={CHAMP}
                />
                <p id="aide-telephone" className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  {AIDE_TELEPHONE}
                </p>
                {erreurTelephone && (
                  <p role="alert" className="text-sm text-rose-700 dark:text-rose-300 mt-1">
                    {MSG_TELEPHONE_INVALIDE}
                  </p>
                )}
              </div>
            </fieldset>

            <button
              type="button"
              onClick={demanderConfirmation}
              disabled={panier.lignes.length === 0 || envoi}
              className={`${BOUTON_PRIMAIRE} w-full`}
            >
              Valider la vente
            </button>
            {panier.lignes.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setPanier(PANIER_VIDE);
                  setErreurOrdonnance(false);
                  setErreurTelephone(false);
                }}
                className={`w-full px-4 py-2 rounded-2xl text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors ${FOCUS}`}
              >
                Vider le panier
              </button>
            )}
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      {enTete}
      {corps}
      <ConfirmationVente
        isOpen={confirmation}
        onClose={() => setConfirmation(false)}
        onConfirmer={envoyerVente}
        envoiEnCours={envoi}
        lignes={lignesConfirmation}
        total={total}
        client={client}
        ordonnanceVue={surOrdonnance.length > 0 && panier.ordonnanceVue}
      />
    </div>
  );
}
