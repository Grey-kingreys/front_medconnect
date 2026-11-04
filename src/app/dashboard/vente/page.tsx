"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { AlertCircle, CircleCheck, Loader2, Minus, Plus, Search, Trash2, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { messageErreurPour } from "@/hooks/useToast";
import { nouvelleCleIdempotence } from "@/lib/api_carnet";
import type { StockMedicament } from "@/lib/api_pharmacie";
import type { Referentiels } from "@/lib/api_caisse";
import {
  codeErreurVente,
  lignesErreurVente,
  type LotErreurVente,
  type PaiementDemande,
  type UniteVente,
  type Vente,
} from "@/lib/api_ventes";
import { estErreurReseau } from "@/lib/erreurs_api";
import { sourceCaisse } from "@/lib/caisse/source_active";
import { etatPosteAttendu, horsLigneSurPoste, useEtatPoste } from "@/lib/caisse/etat_poste";
import type { EtatCaisse } from "@/lib/caisse/source";
import { LIBELLES_UNITE_MINIMALE, aArticle, formaterARegulariser, formaterQuantite } from "@/lib/caisse/regles/quantites";
import { MSG_TELEPHONE_INVALIDE, AIDE_TELEPHONE } from "@/lib/erreur_telephone";
import { lireContexteAcces } from "@/lib/acces";
import { formaterGNF } from "@/lib/format_gnf";
import { estRouteAutorisee } from "@/lib/navigation_tableau_de_bord";
import {
  ALERTE_INFO,
  BOUTON_ICONE,
  BOUTON_PRIMAIRE,
  CARTE,
  CHAMP,
  FOCUS,
  POLICE_TITRE,
} from "@/components/pharmacie/classes";
import { ErreurAvecReessai } from "@/components/pharmacie/ErreurAvecReessai";
import { formaterHeure, formaterJour, jourConakry } from "../ventes/affichage";
import { ConfirmationVente } from "./ConfirmationVente";
import { SortieLotPerime } from "./SortieLotPerime";
import {
  LIBELLES_RAISON_LISTE,
  LONGUEUR_MAX_NOM_CLIENT,
  NOMBRE_MAX_RESULTATS,
  PANIER_VIDE,
  QUANTITE_MAX_LIGNE,
  ajouterAuPanier,
  autreUnite,
  avertissementStock,
  changerNombre,
  changerUnite,
  cleDe,
  cleLigne,
  cleStockagePanier,
  corpsVente,
  definirSortieManuelle,
  demandeEnUm,
  enregistrerPanier,
  lirePanierStocke,
  medicamentsSurOrdonnance,
  messageCorrections,
  montantLigne,
  panierPlein,
  peutAjouter,
  peutAugmenter,
  plafondVente,
  raisonListe,
  raisonNonVendable,
  rechercherDansStock,
  reconcilierPanier,
  retirerDuPanier,
  retirerLignes,
  telephoneClientValide,
  texteAvertissement,
  totalPanier,
  uniteParDefaut,
  type PanierVente,
} from "./panier";

const MSG_COCHER_ORDONNANCE = "Cochez « J'ai vu l'ordonnance » pour vendre ces médicaments.";
const MSG_RECALCUL = "Le total a été recalculé : vérifiez le paiement puis validez à nouveau.";
const MSG_PROBLEME = "Un problème est survenu, réessayez dans un instant.";
const MSG_RESEAU =
  "La vente n'a peut-être pas été enregistrée. Vérifiez votre connexion puis appuyez sur « Réessayer » : elle ne sera pas comptée deux fois. Le panier reste bloqué en attendant, « Modifier la saisie » le débloque.";
const MSG_MODIFIER_SAISIE =
  "Avant de valider à nouveau, vérifiez dans les ventes du jour que la vente précédente n'a pas été enregistrée : sinon elle serait comptée deux fois.";
const CODES_FICHE = ["VENTE_UNITE_INTERDITE", "PRIX_UNITE_MANQUANT", "PRIX_MANQUANT", "FICHE_MODIFIEE", "STOCK_INTROUVABLE"];
const CODES_CAISSE = ["POSTE_INCONNU", "SESSION_AUTRE_UTILISATEUR", "JOURNEE_CLOTUREE"];

const CLASSE_BADGE_OUVERT = "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
const CLASSE_BADGE_FERME = "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300";

type CibleFocus = "telephone" | "ordonnance";

interface SortieEnCours {
  stockId: string;
  nom: string;
  lots: LotErreurVente[];
  erreur: string | null;
}

const majuscule = (texte: string) => texte.charAt(0).toUpperCase() + texte.slice(1);

/** Texte et classes du badge de l'état de la caisse. */
function badgeCaisse(etat: EtatCaisse): { texte: string; classe: string } {
  const session = etat.session;
  if (session === null) {
    return { texte: "Caisse fermée : elle s'ouvrira à la première vente", classe: CLASSE_BADGE_FERME };
  }
  if (session.jourMetier !== jourConakry(new Date())) {
    return {
      texte: `Caisse ouverte, ventes comptées pour le ${formaterJour(session.jourMetier)}`,
      classe: CLASSE_BADGE_OUVERT,
    };
  }
  return { texte: `Caisse ouverte depuis ${formaterHeure(session.ouverteLe)}`, classe: CLASSE_BADGE_OUVERT };
}

export default function NouvelleVentePage() {
  const { user, loading, profile } = useAuth();
  const peutVoirVentes = user ? estRouteAutorisee("/dashboard/ventes", lireContexteAcces(user, profile ?? null)) : false;
  const peutVoirCaisse = user ? estRouteAutorisee("/dashboard/caisse", lireContexteAcces(user, profile ?? null)) : false;
  const structureId = user?.structureId;
  const userId = user?.id;
  const cleStock = structureId && userId ? cleStockagePanier(structureId, userId) : null;
  // Poste desktop hors ligne : aucun plafond de stock, la vente sera à régulariser (D737). Faux sur le web.
  const posteSuivi = useEtatPoste();
  const sansPlafond = horsLigneSurPoste(posteSuivi);
  // Poste desktop dont l'état n'est pas encore connu : on attend, sans appliquer ni retirer le plafond à tort.
  const etatAttendu = etatPosteAttendu(posteSuivi);

  const [stock, setStock] = useState<StockMedicament[] | null>(null);
  const [referentiels, setReferentiels] = useState<Referentiels | null>(null);
  const [etatCaisse, setEtatCaisse] = useState<EtatCaisse | null>(null);
  const [erreurChargement, setErreurChargement] = useState<string | null>(null);
  const [essai, setEssai] = useState(0);
  const [panier, setPanier] = useState<PanierVente>(PANIER_VIDE);
  const [derniereCle, setDerniereCle] = useState<string | null>(null);
  const [texte, setTexte] = useState("");
  const [info, setInfo] = useState<string | null>(null);
  const [bandeau, setBandeau] = useState<string | null>(null);
  const [reessayable, setReessayable] = useState(false);
  const [confirmation, setConfirmation] = useState(false);
  const [sortie, setSortie] = useState<SortieEnCours | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [succes, setSucces] = useState<Vente | null>(null);
  const [erreurTelephone, setErreurTelephone] = useState(false);
  const [erreurOrdonnance, setErreurOrdonnance] = useState(false);

  const champTelephone = useRef<HTMLInputElement>(null);
  const caseOrdonnance = useRef<HTMLInputElement>(null);
  const titreSucces = useRef<HTMLHeadingElement>(null);
  const focusAFaire = useRef<CibleFocus | null>(null);
  const envoiEnCours = useRef(false);
  const paiementsEnvoyes = useRef<PaiementDemande[] | null>(null);

  // Saisie verrouillée pendant un envoi et tant que son résultat est inconnu (échec réseau, D688) :
  // la même clé ne doit jamais porter un autre contenu, le serveur rejouerait l'ancienne vente sans comparer.
  const verrouille = envoi || reessayable;

  // Enregistrement du panier à chaque changement, une fois le stock connu (déclaré avant le chargement).
  useEffect(() => {
    if (stock !== null && cleStock !== null) enregistrerPanier(cleStock, panier);
  }, [panier, stock, cleStock]);

  // Chargement du stock, des modes de paiement et de l'état de la caisse, puis relecture du panier enregistré.
  // Un échec des modes ou de la caisse ne bloque pas la vente : espèces seulement, badge masqué.
  useEffect(() => {
    if (!structureId || !userId) return;
    let actif = true;
    Promise.all([
      sourceCaisse().chargerStock(structureId),
      sourceCaisse().chargerReferentiels(structureId).catch(() => null),
      sourceCaisse().etatCaisse(structureId, userId).catch(() => null),
    ])
      .then(([stocks, refs, caisse]) => {
        if (!actif) return;
        const { panier: corrige, corrections } = reconcilierPanier(
          lirePanierStocke(cleStockagePanier(structureId, userId)),
          stocks,
        );
        setStock(stocks);
        setReferentiels(refs);
        setEtatCaisse(caisse);
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

  // F2 : bascule l'unité de la dernière ligne ajoutée (boîte et unité).
  useEffect(() => {
    const surTouche = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "F2") return;
      e.preventDefault();
      if (confirmation || sortie !== null || derniereCle === null || verrouille) return;
      const ligne = panier.lignes.find((l) => cleDe(l) === derniereCle);
      const fiche = ligne ? stock?.find((s) => s.id === ligne.stockId) : undefined;
      if (!ligne || !fiche) return;
      const nouveau = changerUnite(panier, derniereCle, fiche);
      if (nouveau === panier) return;
      setPanier(nouveau);
      setDerniereCle(cleLigne(ligne.stockId, autreUnite(ligne.unite)));
    };
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [panier, stock, derniereCle, confirmation, sortie, verrouille]);

  const reessayerChargement = () => {
    setErreurChargement(null);
    setStock(null);
    setEssai((n) => n + 1);
  };

  const badge = etatCaisse ? badgeCaisse(etatCaisse) : null;

  const enTete = (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white" style={POLICE_TITRE}>
          Nouvelle vente
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Recherchez les médicaments, ajustez les quantités puis validez la vente.
        </p>
      </div>
      {badge && (
        <div className="flex flex-wrap items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${badge.classe}`}>{badge.texte}</span>
          {peutVoirCaisse && (
            <Link href="/dashboard/caisse" className={`text-xs font-semibold text-primary-700 dark:text-primary-400 underline ${FOCUS}`}>
              Ma caisse
            </Link>
          )}
        </div>
      )}
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
  const nombreDansPanier = (stockId: string, unite: UniteVente) =>
    panier.lignes.find((l) => l.stockId === stockId && l.unite === unite)?.nombre ?? 0;

  const ajouter = (s: StockMedicament) => {
    const unite = uniteParDefaut(s);
    setPanier(ajouterAuPanier(panier, s, unite, nouvelleCleIdempotence, sansPlafond));
    setDerniereCle(cleLigne(s.id, unite));
  };

  // Entrée dans la recherche : ajoute le premier résultat vendable dans son unité par défaut et vide le champ.
  const surToucheRecherche = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (verrouille || texte.trim() === "") return;
    const premier = resultats.find(
      (s) => raisonListe(s, uniteParDefaut(s), sansPlafond) === null && peutAjouter(panier, s, uniteParDefaut(s), sansPlafond),
    );
    if (!premier) return;
    ajouter(premier);
    setTexte("");
  };

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

  // `envoye` est le panier tel qu'il a été envoyé, avec sa clé et ses lots périmés choisis.
  const gererEchec = (err: unknown, envoye: PanierVente) => {
    setEnvoi(false);
    setConfirmation(false);
    setReessayable(false);
    const code = codeErreurVente(err);
    const lignesErreur = lignesErreurVente(err);
    const message = messageErreurPour(err, MSG_PROBLEME);
    const reseau = estErreurReseau(err);
    // Un refus du serveur n'enregistre rien : la clé est renouvelée au prochain envoi. Après un échec réseau, la même clé rejoue.
    const refuse = (base: PanierVente): PanierVente => ({ ...base, cleIdempotence: null });
    const lignesCitees = () => lignesErreur.map((l) => l.stockId);

    if (code === "SORTIE_MANUELLE_REQUISE") {
      const ligne = lignesErreur.find((l) => l.lots !== undefined && l.lots.length > 0);
      enregistrerEtAppliquer(refuse(envoye));
      if (ligne?.lots) {
        const nom = ligne.nom ?? stocks.find((s) => s.id === ligne.stockId)?.medicament.nom ?? "ce médicament";
        setSortie({ stockId: ligne.stockId, nom, lots: ligne.lots, erreur: null });
      } else {
        setSortie(null);
        setBandeau(message);
      }
      return;
    }

    // Stock plus bas que la demande : le message du serveur est affiché tel quel, le panier reste modifiable,
    // le stock est relu pour dire sous chaque ligne ce qu'il reste. La clé est renouvelée : la vente corrigée n'est pas un rejeu.
    if (code === "STOCK_INSUFFISANT") {
      enregistrerEtAppliquer(refuse(envoye));
      setEssai((n) => n + 1);
      setSortie(null);
      setBandeau(message);
      return;
    }

    if (code === "MOTIF_REQUIS" || code === "STOCK_LOT_NEGATIF") {
      enregistrerEtAppliquer(refuse(envoye));
      if (sortie !== null) setSortie({ ...sortie, erreur: message });
      else setBandeau(message);
      return;
    }

    setSortie(null);
    if (code !== null && CODES_FICHE.includes(code)) {
      enregistrerEtAppliquer(refuse(retirerLignes(envoye, code === "STOCK_INTROUVABLE" ? lignesCitees() : [])));
      setEssai((n) => n + 1);
      setBandeau(message);
    } else if (code === "PAIEMENTS_INCOHERENTS" || code === "MODE_PAIEMENT_INCONNU") {
      enregistrerEtAppliquer(refuse(envoye));
      setEssai((n) => n + 1);
      setBandeau(`${message} ${MSG_RECALCUL}`);
    } else if (code === "ORDONNANCE_NON_CONFIRMEE") {
      enregistrerEtAppliquer(refuse({ ...envoye, ordonnanceVue: false }));
      setEssai((n) => n + 1);
      setErreurOrdonnance(true);
      if (surOrdonnance.length === 0) setBandeau(MSG_COCHER_ORDONNANCE);
      focusAFaire.current = "ordonnance";
    } else if (code !== null && CODES_CAISSE.includes(code)) {
      enregistrerEtAppliquer(refuse(envoye));
      setEssai((n) => n + 1);
      setBandeau(message);
    } else if (code === "VALIDATION") {
      enregistrerEtAppliquer(refuse(envoye));
      setBandeau(messageErreurPour(err, "Vérifiez les informations du client puis réessayez."));
    } else if (reseau) {
      // Résultat inconnu : panier figé tel qu'envoyé, même clé ; seuls « Réessayer » et « Modifier la saisie » restent.
      enregistrerEtAppliquer(envoye);
      setReessayable(true);
      setBandeau(MSG_RESEAU);
    } else {
      // 403 (droit manquant) et tout autre refus : message du serveur, sinon texte par défaut.
      enregistrerEtAppliquer(refuse(envoye));
      setBandeau(message);
    }
  };

  const envoyerVente = (paiements: PaiementDemande[] | null, base: PanierVente = panier) => {
    if (envoiEnCours.current) return;
    let cle = base.cleIdempotence;
    let envoye = base;
    if (cle === null) {
      cle = nouvelleCleIdempotence();
      envoye = { ...base, cleIdempotence: cle };
      enregistrerEtAppliquer(envoye);
    }
    paiementsEnvoyes.current = paiements;
    envoiEnCours.current = true;
    setEnvoi(true);
    setBandeau(null);
    setReessayable(false);
    const aSurOrdonnance = medicamentsSurOrdonnance(envoye, stocks).length > 0;
    sourceCaisse()
      .creerVente(structureId, corpsVente(envoye, aSurOrdonnance, paiements), cle)
      .then((vente) => {
        envoiEnCours.current = false;
        setEnvoi(false);
        setConfirmation(false);
        setSortie(null);
        setPanier(PANIER_VIDE);
        setDerniereCle(null);
        setSucces(vente);
        // Sur le poste, le stock local est relu : la liste montre la quantité diminuée.
        if (sourceCaisse().enLigneSeulement === false) {
          sourceCaisse()
            .chargerStock(structureId)
            .then(setStock)
            .catch(() => undefined);
        }
        // Badge à jour : la première vente peut avoir ouvert la caisse.
        if (userId) {
          sourceCaisse()
            .etatCaisse(structureId, userId)
            .then(setEtatCaisse)
            .catch(() => undefined);
        }
      })
      .catch((err: unknown) => {
        envoiEnCours.current = false;
        gererEchec(err, envoye);
      });
  };

  const confirmerSortie = (lotId: string, motif: string) => {
    if (sortie === null) return;
    const avecSortie = definirSortieManuelle(panier, sortie.stockId, { lotId, motif });
    setPanier(avecSortie);
    envoyerVente(paiementsEnvoyes.current, { ...avecSortie, cleIdempotence: null });
  };

  // Débloque le panier après un échec réseau : nouvelle clé au prochain envoi, le vendeur est prévenu de vérifier.
  const modifierSaisie = () => {
    enregistrerEtAppliquer({ ...panier, cleIdempotence: null });
    setReessayable(false);
    setBandeau(null);
    setInfo(MSG_MODIFIER_SAISIE);
  };

  const fermerSortie = () => {
    if (sortie !== null) setPanier(definirSortieManuelle(panier, sortie.stockId, null));
    setSortie(null);
  };

  const nouvelleVente = () => {
    setSucces(null);
    setPanier(PANIER_VIDE);
    setDerniereCle(null);
    setTexte("");
    setInfo(null);
    setBandeau(null);
    setEssai((n) => n + 1);
  };

  const lignesConfirmation = panier.lignes.flatMap((ligne) => {
    const s = stocks.find((x) => x.id === ligne.stockId);
    const montant = s ? montantLigne(ligne, s) : null;
    if (!s || montant === null) return [];
    return [
      {
        cle: cleDe(ligne),
        nom: s.medicament.nom,
        nombre: ligne.nombre,
        unite: ligne.unite,
        libelleUnite: LIBELLES_UNITE_MINIMALE[s.uniteMinimale ?? "UNITE"].singulier,
        montant,
      },
    ];
  });
  const client = [panier.clientNom.trim(), panier.clientTelephone.trim()].filter((v) => v !== "").join(", ");

  const ficheSortie = sortie ? stocks.find((s) => s.id === sortie.stockId) : undefined;
  const dialogues = (
    <>
      <ConfirmationVente
        isOpen={confirmation}
        onClose={() => setConfirmation(false)}
        onConfirmer={(paiements) => envoyerVente(paiements)}
        envoiEnCours={envoi}
        lignes={lignesConfirmation}
        total={total}
        client={client}
        ordonnanceVue={surOrdonnance.length > 0 && panier.ordonnanceVue}
        modes={referentiels?.modesPaiement ?? []}
      />
      {/* Remonté pour chaque fiche citée : deux fiches périmées successives ne partagent ni lot choisi ni motif. */}
      <SortieLotPerime
        key={sortie?.stockId ?? "aucune-sortie"}
        isOpen={sortie !== null}
        nom={sortie?.nom ?? ""}
        lots={(sortie?.lots ?? []).map((l) => ({
          id: l.lotId,
          numeroLot: l.numeroLot,
          dateExpiration: l.dateExpiration,
          quantite: l.quantite,
        }))}
        coefficient={ficheSortie?.coefficientBoite ?? 1}
        unite={ficheSortie?.uniteMinimale ?? "UNITE"}
        envoiEnCours={envoi}
        erreur={sortie?.erreur ?? null}
        onClose={fermerSortie}
        onConfirmer={confirmerSortie}
      />
    </>
  );

  if (succes) {
    const paiements = Array.isArray(succes.paiements) ? succes.paiements : null;
    const rendu = paiements?.find((p) => p.rendu !== null && p.rendu > 0)?.rendu ?? null;
    const autreJour = typeof succes.jourMetier === "string" && succes.jourMetier !== jourConakry(new Date());
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
          {sourceCaisse().enLigneSeulement === false && succes.provisoire === true && (
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Vente enregistrée. Une partie est à régulariser par le titulaire.
            </p>
          )}
          {succes.rejeu === true && (
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Cette vente était déjà enregistrée : elle n&apos;a pas été comptée deux fois.
            </p>
          )}
          <div className="text-sm text-slate-700 dark:text-slate-300 space-y-1">
            <p>Numéro : {succes.numero}</p>
            <p className="font-bold text-slate-900 dark:text-white">Total : {formaterGNF(succes.total)}</p>
            {paiements?.map((p) => (
              <p key={p.id}>
                {p.libelle} : {formaterGNF(p.montant)}
                {p.reference ? `, référence ${p.reference}` : ""}
              </p>
            ))}
            {rendu !== null && <p className="font-bold text-slate-900 dark:text-white">Monnaie à rendre : {formaterGNF(rendu)}</p>}
          </div>
          {autreJour && typeof succes.jourMetier === "string" && (
            <p role="status" className={ALERTE_INFO}>
              Vente comptée pour le {formaterJour(succes.jourMetier)} (journée d&apos;aujourd&apos;hui déjà clôturée).
            </p>
          )}
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

  const derniereLigne = derniereCle ? panier.lignes.find((l) => cleDe(l) === derniereCle) : undefined;
  const derniereFiche = derniereLigne ? stocks.find((s) => s.id === derniereLigne.stockId) : undefined;
  const unitesReliquat = derniereFiche?.reliquat?.reduce((somme, r) => somme + r.unitesRestantes, 0) ?? 0;
  const libelleReliquat = derniereFiche ? LIBELLES_UNITE_MINIMALE[derniereFiche.uniteMinimale ?? "UNITE"] : null;

  let corps;
  if ((stock === null && erreurChargement === null) || etatAttendu) {
    corps = (
      <div role="status" className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
        Chargement du stock...
      </div>
    );
  } else if (stock === null) {
    corps = <ErreurAvecReessai message={erreurChargement ?? MSG_PROBLEME} onReessayer={reessayerChargement} />;
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
      <div className="grid grid-cols-1 lg:grid-cols-5 lg:grid-rows-[minmax(0,1fr)] gap-6 lg:flex-1 lg:min-h-0">
        <section className={`${CARTE} lg:col-span-3 space-y-4 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain`} aria-label="Recherche de médicaments">
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
                onKeyDown={surToucheRecherche}
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
                const unite = uniteParDefaut(s);
                const raison = raisonListe(s, unite, sansPlafond);
                const dansPanier = nombreDansPanier(s.id, unite);
                const nom = s.medicament.nom;
                const coefficient = s.coefficientBoite ?? 1;
                const libelleUnite = LIBELLES_UNITE_MINIMALE[s.uniteMinimale ?? "UNITE"];
                const demandeMini = unite === "UNITE" ? 1 : coefficient;
                const avertissement =
                  raison === null
                    ? avertissementStock(s, Math.max(demandeEnUm(panier, s), demandeMini), sansPlafond)
                    : null;
                const aRegulariser = formaterARegulariser(
                  s.quantiteARegulariser,
                  coefficient,
                  s.uniteMinimale ?? "UNITE",
                );
                const prixBoite = typeof s.prixUnitaire === "number" && s.prixUnitaire > 0 ? s.prixUnitaire : null;
                const prixUnite =
                  s.deconditionnable === true && typeof s.prixUnite === "number" && s.prixUnite > 0 ? s.prixUnite : null;
                return (
                  <li key={s.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 dark:text-white">{nom}</p>
                      {s.medicament.nomGenerique && (
                        <p className="text-sm text-slate-600 dark:text-slate-400">{s.medicament.nomGenerique}</p>
                      )}
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Reste : {formaterQuantite(s.quantite, coefficient, s.uniteMinimale ?? "UNITE")}
                        {aRegulariser !== null && `, ${aRegulariser}`}
                        {prixBoite !== null && ` · ${formaterGNF(prixBoite)}`}
                        {prixUnite !== null && ` · ${formaterGNF(prixUnite)} ${libelleUnite.article}`}
                        {s.medicament.ordonnanceRequise && " · Sur ordonnance"}
                      </p>
                      {avertissement !== null && (
                        <p className="text-sm text-amber-700 dark:text-amber-300">{texteAvertissement(avertissement, s)}</p>
                      )}
                    </div>
                    {raison !== null ? (
                      <span className="inline-flex self-start sm:self-center px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300">
                        {LIBELLES_RAISON_LISTE[raison]}
                      </span>
                    ) : dansPanier === 0 && panierPlein(panier) ? (
                      <span className="text-sm text-slate-600 dark:text-slate-400">Panier complet</span>
                    ) : !peutAjouter(panier, s, unite, sansPlafond) ? (
                      <span className="text-sm text-slate-600 dark:text-slate-400">Plus assez de stock à ajouter</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => ajouter(s)}
                        disabled={verrouille}
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

        <div className="lg:col-span-2 space-y-4 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:pr-1">
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
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => envoyerVente(paiementsEnvoyes.current)}
                      disabled={envoi}
                      className={`px-3 py-1.5 rounded-xl text-sm font-bold bg-rose-700 text-white hover:bg-rose-800 disabled:opacity-60 ${FOCUS}`}
                    >
                      Réessayer
                    </button>
                    <button
                      type="button"
                      onClick={modifierSaisie}
                      disabled={envoi}
                      className={`px-3 py-1.5 rounded-xl text-sm font-medium hover:bg-rose-100 dark:hover:bg-rose-500/20 disabled:opacity-60 ${FOCUS}`}
                    >
                      Modifier la saisie
                    </button>
                  </div>
                )}
              </div>
              {/* Pas de fermeture tant que le résultat est inconnu : le panier bloqué n'aurait plus d'issue. */}
              {!reessayable && (
                <button
                  type="button"
                  onClick={() => setBandeau(null)}
                  aria-label="Fermer le message"
                  className={`p-1 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-500/20 ${FOCUS}`}
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              )}
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
                  const montant = s ? montantLigne(ligne, s) : null;
                  if (!s || montant === null) return null;
                  const cle = cleDe(ligne);
                  const nom = s.medicament.nom;
                  // Toujours un nombre ici (montant calculé, donc prix présent) ; le type ne le sait pas, d'où le test sans repli.
                  const prix = ligne.unite === "UNITE" ? s.prixUnite : s.prixUnitaire;
                  const libelleUnite = LIBELLES_UNITE_MINIMALE[s.uniteMinimale ?? "UNITE"];
                  const autre = autreUnite(ligne.unite);
                  const autrePossible = raisonNonVendable(s, autre) === null;
                  const peutPlus = peutAugmenter(panier, cle, s, sansPlafond);
                  const avertissementLigne = avertissementStock(s, demandeEnUm(panier, s), sansPlafond);
                  // Au-dessus du stock (stock relu après un refus) : le texte dit ce qu'il reste ; au plafond : le « + » s'arrête.
                  const texteStock =
                    avertissementLigne === "stock-insuffisant" || avertissementLigne === "a-regulariser"
                      ? texteAvertissement(avertissementLigne, s)
                      : !peutPlus && ligne.nombre < QUANTITE_MAX_LIGNE && plafondVente(s) > 0
                        ? demandeEnUm(panier, s) >= plafondVente(s)
                          ? "Vous avez pris tout le stock disponible."
                          : "Il ne reste pas assez de stock pour une boîte de plus."
                        : null;
                  const boutonsUnite: { unite: UniteVente; libelle: string }[] = [
                    { unite: "BOITE", libelle: "Boîte" },
                    { unite: "UNITE", libelle: majuscule(libelleUnite.pluriel) },
                  ];
                  return (
                    <li key={cle} className="py-3 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 dark:text-white">{nom}</p>
                          {typeof prix === "number" && (
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                              {formaterGNF(prix)} × {ligne.nombre}
                            </p>
                          )}
                        </div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white whitespace-nowrap">
                          {formaterGNF(montant)}
                        </p>
                      </div>
                      <div role="group" aria-label={`Unité de vente de ${nom}`} className="flex flex-wrap gap-2">
                        {boutonsUnite.map((b) => {
                          const actif = ligne.unite === b.unite;
                          return (
                            <button
                              key={b.unite}
                              type="button"
                              aria-pressed={actif}
                              disabled={verrouille || (!actif && !autrePossible)}
                              onClick={() => {
                                if (actif) return;
                                setPanier(changerUnite(panier, cle, s));
                                setDerniereCle(cleLigne(s.id, autre));
                              }}
                              className={`px-3 py-1.5 rounded-xl border text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${FOCUS} ${
                                actif
                                  ? "border-primary-600 bg-primary-50 dark:bg-primary-500/15 text-primary-700 dark:text-primary-300"
                                  : "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                              }`}
                            >
                              {b.libelle}
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setPanier(changerNombre(panier, cle, -1, s))}
                          disabled={verrouille || ligne.nombre <= 1}
                          aria-label={`Diminuer la quantité de ${nom}`}
                          className={BOUTON_ICONE}
                        >
                          <Minus className="w-4 h-4" aria-hidden="true" />
                        </button>
                        <span className="min-w-8 text-center text-sm font-bold text-slate-900 dark:text-white">
                          {ligne.nombre}
                        </span>
                        <button
                          type="button"
                          onClick={() => setPanier(changerNombre(panier, cle, 1, s, sansPlafond))}
                          disabled={verrouille || !peutPlus}
                          aria-label={`Augmenter la quantité de ${nom}`}
                          className={BOUTON_ICONE}
                        >
                          <Plus className="w-4 h-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPanier(retirerDuPanier(panier, cle))}
                          disabled={verrouille}
                          aria-label={`Retirer ${nom} du panier`}
                          className={`ml-auto inline-flex items-center gap-1.5 px-2 py-2 rounded-xl text-sm text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-500/15 disabled:opacity-40 disabled:cursor-not-allowed ${FOCUS}`}
                        >
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                          Retirer
                        </button>
                      </div>
                      {texteStock !== null && (
                        <p className="text-sm text-amber-700 dark:text-amber-300">{texteStock}</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {panier.lignes.length > 0 && (
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {`F2 : passer de la boîte ${aArticle(libelleReliquat?.article ?? "l'unité")} pour la dernière ligne`}
              </p>
            )}
            {unitesReliquat > 0 && libelleReliquat && (
              <p className="text-sm text-slate-700 dark:text-slate-300">
                {`Boîte entamée : il reste ${unitesReliquat.toLocaleString("fr-FR")} ${unitesReliquat > 1 ? libelleReliquat.pluriel : libelleReliquat.singulier}`}
              </p>
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
                    disabled={verrouille}
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
                  disabled={verrouille}
                  onChange={(e) => setPanier({ ...panier, clientNom: e.target.value })}
                  className={`${CHAMP} disabled:opacity-60`}
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
                  disabled={verrouille}
                  onChange={(e) => {
                    setPanier({ ...panier, clientTelephone: e.target.value });
                    setErreurTelephone(false);
                  }}
                  aria-describedby="aide-telephone"
                  className={`${CHAMP} disabled:opacity-60`}
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
              disabled={panier.lignes.length === 0 || verrouille}
              className={`${BOUTON_PRIMAIRE} w-full`}
            >
              Valider la vente
            </button>
            {panier.lignes.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setPanier(PANIER_VIDE);
                  setDerniereCle(null);
                  setErreurOrdonnance(false);
                  setErreurTelephone(false);
                }}
                disabled={verrouille}
                className={`w-full px-4 py-2 rounded-2xl text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${FOCUS}`}
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
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in lg:h-[calc(100dvh-4rem)] lg:flex lg:flex-col lg:space-y-0 lg:gap-6">
      <div className="lg:shrink-0 space-y-4">
        {enTete}
        {sourceCaisse().enLigneSeulement !== false && (
          <p className={ALERTE_INFO}>Cette page a besoin d&apos;internet : sans connexion, aucune vente n&apos;est enregistrée.</p>
        )}
      </div>
      {corps}
      {dialogues}
    </div>
  );
}
