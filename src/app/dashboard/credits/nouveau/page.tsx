"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Minus, Plus, Search, Trash2 } from "lucide-react";
import { ui } from "@/theme/ui";
import { FOCUS, POLICE_TITRE } from "@/components/pharmacie/classes";
import { ErreurAvecReessai } from "@/components/pharmacie/ErreurAvecReessai";
import { useAuth } from "@/hooks/useAuth";
import { messageErreurPour } from "@/hooks/useToast";
import { lireContexteAcces } from "@/lib/acces";
import { nouvelleCleIdempotence } from "@/lib/api_carnet";
import { listerCredits, type ClientCreditResume } from "@/lib/api_credit";
import type { StockMedicament } from "@/lib/api_pharmacie";
import { codeErreurVente, creerVente, type UniteVente } from "@/lib/api_ventes";
import { LIBELLES_UNITE_MINIMALE, formaterQuantite } from "@/lib/caisse/regles/quantites";
import { sourceCaisse } from "@/lib/caisse/source_active";
import { estErreurReseau } from "@/lib/erreurs_api";
import { formaterGNF } from "@/lib/format_gnf";
import { jourConakry } from "../../ventes/affichage";
import {
  LIBELLES_RAISON_LISTE,
  NOMBRE_MAX_RESULTATS,
  PANIER_VIDE,
  ajouterAuPanier,
  autreUnite,
  changerNombre,
  changerUnite,
  cleDe,
  filtrerTelephonePrescripteur,
  medicamentsSurOrdonnance,
  montantLigne,
  peutAjouter,
  peutAugmenter,
  raisonListe,
  raisonNonVendable,
  rechercherDansStock,
  retirerDuPanier,
  telephonePrescripteurValide,
  totalPanier,
  uniteParDefaut,
  type PanierVente,
} from "../../vente/panier";
import { corpsCredit, type ClientChoisi } from "./corps_credit";

const MSG_STOCK_ECHEC = "Le stock n'a pas pu être chargé. Vérifiez votre connexion puis réessayez.";
const MSG_ECHEC = "Le crédit n'a pas pu être enregistré. Réessayez dans un instant.";
const MSG_RESEAU =
  "Le crédit n'a peut-être pas été enregistré. Vérifiez votre connexion puis appuyez sur « Enregistrer le crédit » : il ne sera pas compté deux fois.";
const CODES_CAISSE = ["POSTE_INCONNU", "SESSION_AUTRE_UTILISATEUR", "JOURNEE_CLOTUREE", "CAISSE_NON_OUVERTE"];

type ModeClient = "existant" | "nouveau";

const majuscule = (texte: string) => texte.charAt(0).toUpperCase() + texte.slice(1);

export default function NouveauCreditPage() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const structureId = user?.structureId;
  const permissions = user ? lireContexteAcces(user, profile ?? null).permissions : null;
  const peutVoirCaisse = permissions?.has("caisse:utiliser") ?? false;

  const [stock, setStock] = useState<StockMedicament[] | null>(null);
  const [erreurStock, setErreurStock] = useState<string | null>(null);
  const [essai, setEssai] = useState(0);
  const [panier, setPanier] = useState<PanierVente>(PANIER_VIDE);
  const [texte, setTexte] = useState("");

  const [mode, setMode] = useState<ModeClient>("existant");
  const [rechercheClient, setRechercheClient] = useState("");
  const [clients, setClients] = useState<ClientCreditResume[] | null>(null);
  const [erreurClients, setErreurClients] = useState<string | null>(null);
  const [clientChoisi, setClientChoisi] = useState<ClientCreditResume | null>(null);
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [dateLimite, setDateLimite] = useState("");

  const [erreurs, setErreurs] = useState<{ client?: string; telephone?: string; panier?: string; ordonnance?: string }>({});
  const [bandeau, setBandeau] = useState<string | null>(null);
  const [lienCaisse, setLienCaisse] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [issueInconnue, setIssueInconnue] = useState(false);
  const [ordonnanceVue, setOrdonnanceVue] = useState(false);
  const cleEnvoi = useRef<string | null>(null);
  const envoiRef = useRef(false);

  // Stock de la pharmacie.
  useEffect(() => {
    if (!structureId) return;
    let actif = true;
    sourceCaisse()
      .chargerStock(structureId)
      .then((s) => {
        if (!actif) return;
        setStock(s);
        setErreurStock(null);
      })
      .catch((err: unknown) => {
        if (actif) setErreurStock(messageErreurPour(err, MSG_STOCK_ECHEC));
      });
    return () => {
      actif = false;
    };
  }, [structureId, essai]);

  // Clients existants : recherche par nom ou téléphone.
  useEffect(() => {
    if (!structureId || mode !== "existant") return;
    let actif = true;
    const delai = setTimeout(() => {
      listerCredits(structureId, { q: rechercheClient, parPage: 10 })
        .then((res) => {
          if (!actif) return;
          setClients(res.data.clients);
          setErreurClients(null);
        })
        .catch((err: unknown) => {
          if (actif) setErreurClients(messageErreurPour(err, "La recherche a échoué. Vérifiez votre connexion puis réessayez."));
        });
    }, 250);
    return () => {
      actif = false;
      clearTimeout(delai);
    };
  }, [structureId, rechercheClient, mode]);

  const stocks = stock ?? [];
  const total = totalPanier(panier, stocks);
  const surOrdonnance = medicamentsSurOrdonnance(panier, stocks);
  const resultats = rechercherDansStock(stocks, texte);
  const verrouille = envoi;

  // Toute modification du contenu change la clé d'envoi : seule une relance identique rejoue la même vente.
  const modifierPanier = (nouveau: PanierVente) => {
    cleEnvoi.current = null;
    setIssueInconnue(false);
    setPanier(nouveau);
  };

  const ajouter = (s: StockMedicament) => modifierPanier(ajouterAuPanier(panier, s, uniteParDefaut(s), nouvelleCleIdempotence));

  const enregistrer = async () => {
    if (envoiRef.current || !structureId) return;
    setBandeau(null);
    setLienCaisse(false);
    const e: typeof erreurs = {};
    let client: ClientChoisi | null = null;
    if (mode === "existant") {
      if (clientChoisi === null) e.client = "Choisissez le client dans la liste, ou passez à « Nouveau client ».";
      else client = { genre: "existant", id: clientChoisi.id };
    } else if (nom.trim().length < 2) {
      e.client = "Saisissez le nom complet du client.";
    } else if (!telephonePrescripteurValide(telephone)) {
      e.telephone = "Ce numéro de téléphone n'est pas valide. Exemple : 620 00 00 00";
    } else {
      client = { genre: "nouveau", nomComplet: nom, telephone };
    }
    if (panier.lignes.length === 0) e.panier = "Ajoutez au moins un médicament.";
    if (surOrdonnance.length > 0 && !ordonnanceVue) e.ordonnance = "Cochez « J'ai vu l'ordonnance » pour donner ces médicaments.";
    setErreurs(e);
    if (Object.keys(e).length > 0 || client === null) return;

    envoiRef.current = true;
    setEnvoi(true);
    cleEnvoi.current ??= nouvelleCleIdempotence();
    try {
      const res = await creerVente(
        structureId,
        // La case « J'ai vu l'ordonnance » vit dans la page : on la reporte sur le panier lu par corpsVente.
        corpsCredit({ ...panier, ordonnanceVue }, surOrdonnance.length > 0, client, dateLimite),
        cleEnvoi.current,
      );
      const id = res.data.clientCreditId ?? res.data.credit?.clientCreditId ?? (client.genre === "existant" ? client.id : null);
      router.push(id ? `/dashboard/credits/${encodeURIComponent(id)}` : "/dashboard/credits");
    } catch (err) {
      envoiRef.current = false;
      setEnvoi(false);
      if (estErreurReseau(err)) {
        setIssueInconnue(true);
        setBandeau(MSG_RESEAU);
        return;
      }
      cleEnvoi.current = null;
      const code = codeErreurVente(err);
      if (code === "STOCK_INSUFFISANT") setEssai((n) => n + 1);
      setLienCaisse(code !== null && CODES_CAISSE.includes(code));
      setBandeau(messageErreurPour(err, MSG_ECHEC));
    }
  };

  const retour = (
    <Link href="/dashboard/credits" className={`${ui.bouton.discret} !px-0`}>
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      Retour au cahier de crédit
    </Link>
  );

  if (!structureId) {
    return (
      <p role="status" className={`${ui.texte.petit} animate-pulse`}>
        Chargement...
      </p>
    );
  }

  const nombreDansPanier = (stockId: string, unite: UniteVente) =>
    panier.lignes.find((l) => l.stockId === stockId && l.unite === unite)?.nombre ?? 0;

  return (
    <div className="mx-auto max-w-mc-contenu space-y-6 animate-fade-in">
      {retour}
      <div>
        <h1 className={ui.titrePage} style={POLICE_TITRE}>
          Nouveau crédit
        </h1>
        <p className="mt-1 text-mc-normal text-slate-600 dark:text-slate-400">
          Choisissez le client, ajoutez les médicaments qu&apos;il emporte, puis enregistrez le crédit. Le stock baisse comme pour une vente.
        </p>
      </div>

      {bandeau && (
        <div role="alert" className={ui.alerte.erreur}>
          <div className="space-y-1">
            <p>{bandeau}</p>
            {lienCaisse && peutVoirCaisse && (
              <Link href="/dashboard/caisse" className={`font-semibold underline ${FOCUS}`}>
                Aller à Ma caisse
              </Link>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <section className={`${ui.carte} space-y-3`} aria-labelledby="titre-client">
            <h2 id="titre-client" className={ui.texte.section} style={POLICE_TITRE}>
              Client
            </h2>
            <div className={ui.filtre.groupe} role="group" aria-label="Type de client">
              <button
                type="button"
                aria-pressed={mode === "existant"}
                onClick={() => setMode("existant")}
                className={`${ui.filtre.base} ${mode === "existant" ? ui.filtre.actif : ui.filtre.inactif}`}
              >
                Client existant
              </button>
              <button
                type="button"
                aria-pressed={mode === "nouveau"}
                onClick={() => setMode("nouveau")}
                className={`${ui.filtre.base} ${mode === "nouveau" ? ui.filtre.actif : ui.filtre.inactif}`}
              >
                Nouveau client
              </button>
            </div>

            {mode === "existant" ? (
              <div className="space-y-3">
                {clientChoisi ? (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {clientChoisi.nomComplet}
                      {clientChoisi.telephone && <span className={`ml-2 ${ui.texte.legende}`}>{clientChoisi.telephone}</span>}
                    </p>
                    <button type="button" onClick={() => setClientChoisi(null)} className={ui.bouton.secondaire}>
                      Changer de client
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <label htmlFor="recherche-client" className="sr-only">
                        Rechercher un client
                      </label>
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                      <input
                        id="recherche-client"
                        type="search"
                        value={rechercheClient}
                        onChange={(e) => setRechercheClient(e.target.value)}
                        placeholder="Nom ou téléphone du client"
                        className={`${ui.champ} pl-9`}
                      />
                    </div>
                    {erreurClients && (
                      <p role="alert" className={ui.alerte.erreur}>
                        {erreurClients}
                      </p>
                    )}
                    {clients !== null && clients.length === 0 && (
                      <p className={ui.texte.petit}>Aucun client trouvé. Passez à « Nouveau client » pour l&apos;ajouter.</p>
                    )}
                    {clients !== null && clients.length > 0 && (
                      <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                        {clients.map((c) => (
                          <li key={c.id}>
                            <button
                              type="button"
                              onClick={() => {
                                setClientChoisi(c);
                                setErreurs((x) => ({ ...x, client: undefined }));
                              }}
                              className={`flex w-full items-center justify-between gap-3 px-1 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 ${FOCUS}`}
                            >
                              <span className="min-w-0">
                                <span className="block truncate font-medium text-slate-900 dark:text-white">{c.nomComplet}</span>
                                {c.telephone && <span className={`block ${ui.texte.legende}`}>{c.telephone}</span>}
                              </span>
                              {c.resteAPayer > 0 && (
                                <span className="whitespace-nowrap text-mc-normal tabular-nums">Doit {formaterGNF(c.resteAPayer)}</span>
                              )}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="nouveau-nom" className={ui.label}>
                    Nom complet
                  </label>
                  <input id="nouveau-nom" value={nom} maxLength={100} onChange={(e) => setNom(e.target.value)} className={ui.champ} />
                </div>
                <div>
                  <label htmlFor="nouveau-tel" className={ui.label}>
                    Téléphone (facultatif)
                  </label>
                  <input
                    id="nouveau-tel"
                    inputMode="tel"
                    value={telephone}
                    onChange={(e) => setTelephone(filtrerTelephonePrescripteur(e.target.value))}
                    aria-invalid={erreurs.telephone !== undefined}
                    className={ui.champ}
                  />
                  {erreurs.telephone && (
                    <p role="alert" className={`mt-1 ${ui.dialogue.erreurChamp}`}>
                      {erreurs.telephone}
                    </p>
                  )}
                </div>
              </div>
            )}
            {erreurs.client && (
              <p role="alert" className={ui.dialogue.erreurChamp}>
                {erreurs.client}
              </p>
            )}
          </section>

          <section className={`${ui.carte} space-y-4`} aria-label="Recherche de médicaments">
            <div>
              <label htmlFor="recherche-medicament" className={ui.label}>
                Rechercher un médicament
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                <input
                  id="recherche-medicament"
                  type="search"
                  value={texte}
                  onChange={(e) => setTexte(e.target.value)}
                  placeholder="Nom ou nom générique"
                  className={`${ui.champ} pl-9`}
                />
              </div>
            </div>
            {erreurStock ? (
              <ErreurAvecReessai message={erreurStock} onReessayer={() => setEssai((n) => n + 1)} />
            ) : stock === null ? (
              <p role="status" className={`${ui.texte.petit} animate-pulse`}>
                Chargement du stock...
              </p>
            ) : stock.length === 0 ? (
              <p className={ui.texte.petit}>Votre stock est vide. Ajoutez des médicaments à votre stock pour pouvoir les donner à crédit.</p>
            ) : resultats.length === 0 ? (
              <p className={ui.texte.petit}>Aucun médicament ne correspond à « {texte.trim()} ». Vérifiez l&apos;orthographe ou essayez le nom générique.</p>
            ) : (
              <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                {resultats.map((s) => {
                  const unite = uniteParDefaut(s);
                  const raison = raisonListe(s, unite);
                  const coefficient = s.coefficientBoite ?? 1;
                  const prix = typeof s.prixUnitaire === "number" && s.prixUnitaire > 0 ? s.prixUnitaire : null;
                  return (
                    <li key={s.id} className="flex flex-col justify-between gap-3 py-3 sm:flex-row sm:items-center">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 dark:text-white">{s.medicament.nom}</p>
                        <p className={ui.texte.normal}>
                          Reste : {formaterQuantite(s.quantite, coefficient, s.uniteMinimale ?? "UNITE")}
                          {prix !== null && <span className="whitespace-nowrap tabular-nums">{`, ${formaterGNF(prix)}`}</span>}
                        </p>
                        {s.medicament.ordonnanceRequise && <span className={ui.badge.attention}>Sur ordonnance</span>}
                      </div>
                      {raison !== null ? (
                        <span className={ui.badge.danger}>{LIBELLES_RAISON_LISTE[raison]}</span>
                      ) : !peutAjouter(panier, s, unite) && nombreDansPanier(s.id, unite) > 0 ? (
                        <span className={ui.texte.petit}>Plus assez de stock à ajouter</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => ajouter(s)}
                          disabled={verrouille}
                          aria-label={`Ajouter ${s.medicament.nom}`}
                          className={`${ui.bouton.secondaire} !h-mc-controle-petit !px-3 text-mc-petit shrink-0`}
                        >
                          <Plus className="h-4 w-4" aria-hidden="true" />
                          Ajouter
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {resultats.length === NOMBRE_MAX_RESULTATS && (
              <p className={ui.texte.petit}>Seuls les {NOMBRE_MAX_RESULTATS} premiers résultats sont affichés. Précisez votre recherche.</p>
            )}
          </section>
        </div>

        <section className={`${ui.carte} h-fit space-y-4 lg:col-span-2`} aria-labelledby="titre-prise">
          <h2 id="titre-prise" className={ui.texte.section} style={POLICE_TITRE}>
            Ce qu&apos;il emporte
          </h2>
          {panier.lignes.length === 0 ? (
            <p className={ui.texte.petit}>Aucun médicament pour le moment. Recherchez un médicament puis appuyez sur « Ajouter ».</p>
          ) : (
            <ul className="divide-y divide-slate-200 dark:divide-slate-800">
              {panier.lignes.map((ligne) => {
                const s = stocks.find((x) => x.id === ligne.stockId);
                const montant = s ? montantLigne(ligne, s) : null;
                if (!s || montant === null) return null;
                const cle = cleDe(ligne);
                const nom = s.medicament.nom;
                const libelleUnite = LIBELLES_UNITE_MINIMALE[s.uniteMinimale ?? "UNITE"];
                const autre = autreUnite(ligne.unite);
                const autrePossible = raisonNonVendable(s, autre) === null;
                const boutonsUnite: { unite: UniteVente; libelle: string }[] = [
                  { unite: "BOITE", libelle: "Boîte" },
                  { unite: "UNITE", libelle: majuscule(libelleUnite.pluriel) },
                ];
                return (
                  <li key={cle} className="space-y-2 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 font-semibold text-slate-900 dark:text-white">{nom}</p>
                      <p className="whitespace-nowrap text-mc-normal font-semibold tabular-nums">{formaterGNF(montant)}</p>
                    </div>
                    <div role="group" aria-label={`Unité de ${nom}`} className="flex flex-wrap gap-2">
                      {boutonsUnite.map((b) => {
                        const actif = ligne.unite === b.unite;
                        return (
                          <button
                            key={b.unite}
                            type="button"
                            aria-pressed={actif}
                            disabled={verrouille || (!actif && !autrePossible)}
                            onClick={() => !actif && modifierPanier(changerUnite(panier, cle, s))}
                            className={`rounded-mc-moyen border px-3 py-1.5 text-mc-normal font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS} ${
                              actif
                                ? "border-primary-600 bg-primary-50 text-primary-700 dark:bg-primary-500/15 dark:text-primary-300"
                                : "border-slate-200 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                            }`}
                          >
                            {b.libelle}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="inline-flex items-center rounded-mc-moyen border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900">
                        <button
                          type="button"
                          onClick={() => modifierPanier(changerNombre(panier, cle, -1, s))}
                          disabled={verrouille || ligne.nombre <= 1}
                          aria-label={`Diminuer la quantité de ${nom}`}
                          className={ui.bouton.iconePetit}
                        >
                          <Minus className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <span className="min-w-8 text-center text-mc-normal font-semibold tabular-nums">{ligne.nombre}</span>
                        <button
                          type="button"
                          onClick={() => modifierPanier(changerNombre(panier, cle, 1, s))}
                          disabled={verrouille || !peutAugmenter(panier, cle, s)}
                          aria-label={`Augmenter la quantité de ${nom}`}
                          className={ui.bouton.iconePetit}
                        >
                          <Plus className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => modifierPanier(retirerDuPanier(panier, cle))}
                        disabled={verrouille}
                        aria-label={`Retirer ${nom}`}
                        className={`ml-auto inline-flex h-mc-controle-petit items-center gap-1.5 rounded-mc-moyen px-2 text-mc-normal text-rose-700 hover:bg-rose-50 disabled:opacity-40 dark:text-rose-300 dark:hover:bg-rose-500/15 ${FOCUS}`}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                        Retirer
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {erreurs.panier && (
            <p role="alert" className={ui.dialogue.erreurChamp}>
              {erreurs.panier}
            </p>
          )}

          {surOrdonnance.length > 0 && (
            <div>
              <label className="flex items-start gap-3 text-mc-normal text-slate-800 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={ordonnanceVue}
                  onChange={(e) => setOrdonnanceVue(e.target.checked)}
                  className={`mt-0.5 h-4 w-4 accent-primary-600 ${FOCUS}`}
                />
                J&apos;ai vu l&apos;ordonnance
              </label>
              {erreurs.ordonnance && (
                <p role="alert" className={`mt-1 ${ui.dialogue.erreurChamp}`}>
                  {erreurs.ordonnance}
                </p>
              )}
            </div>
          )}

          <div className="flex items-baseline justify-between gap-3 border-t border-slate-200 pt-3 dark:border-slate-800">
            <span className="text-mc-normal font-medium">Total à crédit</span>
            <span className="whitespace-nowrap text-xl font-semibold tabular-nums text-slate-900 dark:text-white" style={POLICE_TITRE}>
              {formaterGNF(total)}
            </span>
          </div>

          <div>
            <label htmlFor="date-limite-credit" className={ui.label}>
              Date limite de remboursement (facultatif)
            </label>
            <input
              id="date-limite-credit"
              type="date"
              min={jourConakry(new Date())}
              value={dateLimite}
              onChange={(e) => setDateLimite(e.target.value)}
              className={ui.champ}
            />
          </div>

          <button type="button" onClick={() => void enregistrer()} disabled={verrouille} className={`${ui.bouton.primaire} w-full`}>
            {envoi && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {issueInconnue ? "Réessayer l'enregistrement du crédit" : "Enregistrer le crédit"}
          </button>
        </section>
      </div>
    </div>
  );
}
