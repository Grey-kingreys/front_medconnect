"use client";

import { Fragment, useEffect, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { AlertCircle, CircleCheck, Loader2, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { messageErreurPour } from "@/hooks/useToast";
import { nouvelleCleIdempotence } from "@/lib/api_carnet";
import {
  creerFournisseur,
  enregistrerReception,
  getMyStock,
  listerFournisseurs,
  type CorpsReception,
  type Fournisseur,
  type LigneReceptionDemandee,
  type Reception,
  type StockMedicament,
} from "@/lib/api_pharmacie";
import { ApiError } from "@/lib/api_auth";
import { LIBELLES_UNITE_MINIMALE, deOuD } from "@/lib/caisse/regles/quantites";
import { afficherDatePeremption, lireDatePeremption } from "@/lib/date_peremption";
import { champsErreur, codeErreur, detailsErreur, estErreurReseau } from "@/lib/erreurs_api";
import {
  ALERTE_ATTENTION,
  ALERTE_ERREUR,
  BOUTON_ICONE,
  BOUTON_PRIMAIRE,
  BOUTON_SECONDAIRE,
  CARTE,
  CHAMP,
  FOCUS,
  POLICE_TITRE,
} from "@/components/pharmacie/classes";
import { ErreurAvecReessai } from "@/components/pharmacie/ErreurAvecReessai";
import { jourConakry } from "../../ventes/affichage";
import { rechercherDansStock } from "../../vente/panier";

const CHAMP_INVALIDE = CHAMP.replace("border-slate-200 dark:border-slate-800", "border-rose-500 dark:border-rose-500");
// Quantité : largeur fixe qui ne se réduit jamais (6 chiffres tiennent), chiffres alignés à droite.
const CHAMP_QUANTITE = CHAMP.replace("w-full px-4", "w-20 shrink-0 px-3 text-right");
const CHAMP_QUANTITE_INVALIDE = CHAMP_INVALIDE.replace("w-full px-4", "w-20 shrink-0 px-3 text-right");
const SELECT_UNITE = `px-3 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm text-slate-900 dark:text-white disabled:opacity-60 ${FOCUS}`;
const ICONE = "w-4 h-4 text-slate-600 dark:text-slate-400";

const LIGNES_MAX = 200;
const SUGGESTIONS_MAX = 8;
// Plafonds du back (`LigneReceptionDto`) : 1 000 000 boîtes ou 1 000 000 000 unités par ligne.
const BOITES_MAX = 1_000_000;
const UNITES_MAX = 1_000_000_000;
const NOMBRE_ENTIER = /^\d+$/;

const MSG_PROBLEME = "Un problème est survenu, réessayez dans un instant.";
const MSG_CHARGEMENT = "Impossible d'afficher le stock et les fournisseurs. Vérifiez votre connexion puis réessayez.";
const MSG_COMPLETER = "Complétez les lignes signalées avant d'enregistrer.";
const MSG_RESEAU =
  "La réception n'a peut-être pas été enregistrée. Vérifiez votre connexion puis appuyez sur « Réessayer l'envoi » : elle ne sera pas enregistrée deux fois.";
const MSG_CONFIRMER_MODIFICATION =
  "Avant de modifier, vérifiez dans la liste des réceptions que cette livraison n'a pas déjà été enregistrée. Continuer ?";
const MSG_PEREMPTION_REFUSEE = "Vérifiez cette date de péremption.";

type Champ = "medicament" | "quantite" | "peremption" | "lot" | "cout";
const ORDRE_CHAMPS: readonly Champ[] = ["medicament", "quantite", "peremption", "lot", "cout"];
type ErreursLigne = Partial<Record<Champ, string>>;

interface LigneSaisie {
  cle: number;
  stockId: string | null;
  texte: string;
  enUnites: boolean;
  quantite: string;
  peremption: string;
  /** Vrai une fois le champ quitté : la date lue ou le refus s'affiche alors sous le champ. */
  peremptionVue: boolean;
  sansDate: boolean;
  lot: string;
  cout: string;
}

const ligneVide = (cle: number): LigneSaisie => ({
  cle,
  stockId: null,
  texte: "",
  enUnites: false,
  quantite: "",
  peremption: "",
  peremptionVue: false,
  sansDate: false,
  lot: "",
  cout: "",
});

const estVide = (l: LigneSaisie) =>
  l.stockId === null &&
  l.texte.trim() === "" &&
  l.quantite.trim() === "" &&
  l.peremption.trim() === "" &&
  !l.sansDate &&
  l.lot.trim() === "" &&
  l.cout.trim() === "";

const entier = (texte: string): number | null => {
  const net = texte.replace(/\s/g, "");
  if (!NOMBRE_ENTIER.test(net)) return null;
  const n = Number(net);
  return Number.isSafeInteger(n) && n <= 2147483647 ? n : null;
};

const CHAMP_SERVEUR: Record<string, Champ> = {
  stockId: "medicament",
  nombreBoites: "quantite",
  quantiteUnites: "quantite",
  dateExpiration: "peremption",
  sansPeremption: "peremption",
  numeroLot: "lot",
  coutAchatBoite: "cout",
};

const MESSAGE_CHAMP_SERVEUR: Record<Champ, string> = {
  medicament: "Vérifiez ce médicament.",
  quantite: "Vérifiez cette quantité.",
  peremption: MSG_PEREMPTION_REFUSEE,
  lot: "Vérifiez ce numéro de lot.",
  cout: "Vérifiez ce coût.",
};

const libelleBoites = (n: number) => `${n} ${n > 1 ? "boîtes" : "boîte"}`;

interface Succes {
  reception: Reception;
  message: string;
}

export default function NouvelleReceptionPage() {
  const { user, loading } = useAuth();
  const structureId = user?.structureId;

  const [stock, setStock] = useState<StockMedicament[] | null>(null);
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [erreurChargement, setErreurChargement] = useState<string | null>(null);
  const [essai, setEssai] = useState(0);

  const [cleReception, setCleReception] = useState(() => nouvelleCleIdempotence());
  const [fournisseurId, setFournisseurId] = useState("");
  const [reference, setReference] = useState("");
  const [jour, setJour] = useState(() => jourConakry(new Date()));
  const [lignes, setLignes] = useState<LigneSaisie[]>([ligneVide(1)]);
  const [erreurs, setErreurs] = useState<Record<number, ErreursLigne>>({});

  const [ligneActive, setLigneActive] = useState<number | null>(null);
  const [indexSuggestion, setIndexSuggestion] = useState(0);

  const [nouveauOuvert, setNouveauOuvert] = useState(false);
  const [nomFournisseur, setNomFournisseur] = useState("");
  const [telFournisseur, setTelFournisseur] = useState("");
  const [erreurFournisseur, setErreurFournisseur] = useState<string | null>(null);
  const [fournisseurEnCours, setFournisseurEnCours] = useState(false);

  const [bandeau, setBandeau] = useState<string | null>(null);
  // Vrai quand le bandeau concerne des lignes signalées : il s'affiche alors en tête du tableau, près d'elles.
  const [bandeauLignes, setBandeauLignes] = useState(false);
  const [reessayable, setReessayable] = useState(false);
  const [confirmationModif, setConfirmationModif] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [succes, setSucces] = useState<Succes | null>(null);

  const prochaineCle = useRef(2);
  const zoneLignes = useRef<HTMLDivElement>(null);
  const focusAFaire = useRef<string | null>(null);
  const envoiEnCours = useRef(false);
  const corpsEnvoye = useRef<CorpsReception | null>(null);
  const clesEnvoyees = useRef<number[]>([]);
  const boutonEnvoi = useRef<HTMLButtonElement>(null);
  const titreSucces = useRef<HTMLHeadingElement>(null);

  // Donne le focus au champ `<cle de ligne>:<champ>` du tableau (jamais appelé pendant le rendu).
  const focaliser = (cle: string) => zoneLignes.current?.querySelector<HTMLElement>(`[data-champ="${cle}"]`)?.focus();

  // Saisie verrouillée pendant un envoi et tant que son résultat est inconnu (D688).
  const verrouille = envoi || reessayable;

  useEffect(() => {
    if (!structureId) return;
    let actif = true;
    Promise.all([getMyStock(structureId), listerFournisseurs(structureId)])
      .then(([s, f]) => {
        if (!actif) return;
        const fiches = s.data.stocks.filter((x) => !x.archiveLe);
        setStock(fiches);
        setFournisseurs(f.data);
        setErreurChargement(null);
        // Une fiche ou un fournisseur disparu depuis le dernier chargement doit être choisi à nouveau.
        setLignes((prev) =>
          prev.map((l) => (l.stockId !== null && !fiches.some((x) => x.id === l.stockId) ? { ...l, stockId: null } : l)),
        );
        setFournisseurId((prev) => (prev !== "" && !f.data.some((x) => x.id === prev) ? "" : prev));
      })
      .catch(() => {
        if (actif) setErreurChargement(MSG_CHARGEMENT);
      });
    return () => {
      actif = false;
    };
  }, [structureId, essai]);

  // Déplace le focus demandé par un gestionnaire une fois l'écran à jour.
  useEffect(() => {
    const cible = focusAFaire.current;
    if (cible === null) return;
    focusAFaire.current = null;
    if (cible === "envoi") boutonEnvoi.current?.focus();
    else focaliser(cible);
  });

  useEffect(() => {
    if (succes) titreSucces.current?.focus();
  }, [succes]);

  const reessayerChargement = () => {
    setErreurChargement(null);
    setEssai((n) => n + 1);
  };

  const fiches = stock ?? [];
  const aujourdhui = jourConakry(new Date());
  const uniteDe = (stockId: string | null) =>
    LIBELLES_UNITE_MINIMALE[fiches.find((s) => s.id === stockId)?.uniteMinimale ?? "UNITE"];

  const modifierLigne = (cle: number, changement: Partial<LigneSaisie>, champEfface?: Champ) => {
    setLignes((prev) => prev.map((l) => (l.cle === cle ? { ...l, ...changement } : l)));
    if (champEfface) {
      setErreurs((prev) => {
        if (!prev[cle]?.[champEfface]) return prev;
        const reste = { ...prev[cle] };
        delete reste[champEfface];
        return { ...prev, [cle]: reste };
      });
    }
  };

  const ajouterLigne = () => {
    if (lignes.length >= LIGNES_MAX) return;
    const cle = prochaineCle.current++;
    setLignes((prev) => [...prev, ligneVide(cle)]);
    focusAFaire.current = `${cle}:medicament`;
  };

  const retirerLigne = (cle: number) => {
    setLignes((prev) => {
      const reste = prev.filter((l) => l.cle !== cle);
      return reste.length > 0 ? reste : [ligneVide(prochaineCle.current++)];
    });
    setErreurs((prev) => {
      const reste = { ...prev };
      delete reste[cle];
      return reste;
    });
  };

  const suggestionsDe = (l: LigneSaisie) =>
    l.stockId === null && l.texte.trim() !== "" ? rechercherDansStock(fiches, l.texte).slice(0, SUGGESTIONS_MAX) : [];

  const choisir = (cle: number, fiche: StockMedicament) => {
    modifierLigne(cle, { stockId: fiche.id, texte: fiche.medicament.nom, enUnites: false }, "medicament");
    setLigneActive(null);
    focusAFaire.current = `${cle}:quantite`;
  };

  const surToucheMedicament = (e: KeyboardEvent<HTMLInputElement>, l: LigneSaisie) => {
    const liste = ligneActive === l.cle ? suggestionsDe(l) : [];
    if (e.key === "ArrowDown" && liste.length > 0) {
      e.preventDefault();
      setIndexSuggestion((i) => Math.min(i + 1, liste.length - 1));
    } else if (e.key === "ArrowUp" && liste.length > 0) {
      e.preventDefault();
      setIndexSuggestion((i) => Math.max(i - 1, 0));
    } else if (e.key === "Escape") {
      setLigneActive(null);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (verrouille) return;
      if (liste.length > 0) choisir(l.cle, liste[Math.min(indexSuggestion, liste.length - 1)]);
      else if (l.stockId !== null) focaliser(`${l.cle}:quantite`);
    }
  };

  // Entrée dans Quantité, Péremption ou Lot : champ suivant de la ligne (saisie de facture au clavier, aucun envoi).
  const surToucheChamp = (e: KeyboardEvent<HTMLInputElement>, l: LigneSaisie, champ: "quantite" | "peremption" | "lot") => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (verrouille) return;
    const suivant: Champ = champ === "quantite" ? (l.sansDate ? "lot" : "peremption") : champ === "peremption" ? "lot" : "cout";
    focaliser(`${l.cle}:${suivant}`);
  };

  // Entrée dans le dernier champ d'une ligne : ligne suivante, ou nouvelle ligne si c'était la dernière.
  const surToucheDernierChamp = (e: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (verrouille) return;
    if (index === lignes.length - 1) ajouterLigne();
    else focaliser(`${lignes[index + 1].cle}:medicament`);
  };

  const enregistrerFournisseur = () => {
    if (!structureId || fournisseurEnCours || verrouille) return;
    const nom = nomFournisseur.trim();
    if (nom.length < 2) {
      setErreurFournisseur("Écrivez le nom du fournisseur (2 caractères au moins).");
      return;
    }
    const telephone = telFournisseur.trim();
    setFournisseurEnCours(true);
    setErreurFournisseur(null);
    creerFournisseur(structureId, { nom, ...(telephone !== "" ? { telephone } : {}) })
      .then((res) => {
        setFournisseurEnCours(false);
        const fournisseur: Fournisseur = {
          id: res.data.id,
          nom: res.data.nom,
          telephone: res.data.telephone,
          createdAt: res.data.createdAt,
        };
        setFournisseurs((prev) => (prev.some((f) => f.id === fournisseur.id) ? prev : [...prev, fournisseur]));
        setFournisseurId(fournisseur.id);
        setNouveauOuvert(false);
        setNomFournisseur("");
        setTelFournisseur("");
      })
      .catch((err: unknown) => {
        setFournisseurEnCours(false);
        if (codeErreur(err) === "FOURNISSEUR_EXISTANT") {
          const existant = fournisseurs.find((f) => f.nom.trim().toLowerCase() === nom.toLowerCase());
          if (existant) setFournisseurId(existant.id);
        }
        setErreurFournisseur(messageErreurPour(err, "Le fournisseur n'a pas pu être enregistré. Réessayez dans un instant."));
      });
  };

  const gererEchec = (err: unknown) => {
    setEnvoi(false);
    if (estErreurReseau(err)) {
      setReessayable(true);
      setBandeauLignes(false);
      setBandeau(MSG_RESEAU);
      return;
    }
    setReessayable(false);
    const code = codeErreur(err);
    const message = messageErreurPour(err, MSG_PROBLEME);
    // Lignes signalées, repérées par leur rang dans le corps envoyé (ordre de l'écran).
    const signalees: { rang: number; cle: number; champ: Champ }[] = [];
    const signaler = (rang: number, champ: Champ, texte: string) => {
      const cle = clesEnvoyees.current[rang];
      if (cle === undefined) return;
      signalees.push({ rang, cle, champ });
      setErreurs((prev) => ({ ...prev, [cle]: { ...prev[cle], [champ]: texte } }));
    };
    setBandeau(message);

    if (code === "VALIDATION") {
      for (const { champ } of champsErreur(err)) {
        const m = /^lignes\.(\d+)\.(\w+)$/.exec(champ);
        if (!m) continue;
        const cible = CHAMP_SERVEUR[m[2]];
        if (cible) signaler(Number(m[1]), cible, MESSAGE_CHAMP_SERVEUR[cible]);
      }
    } else if (code === "DATE_PEREMPTION_REQUISE" || code === "DATE_PEREMPTION_PASSEE") {
      // Le serveur ne cite que la fiche (stockId) : toutes les lignes de cette fiche sont signalées.
      const citees = detailsErreur(err).map((d) => d.stockId);
      const envoyees = corpsEnvoye.current?.lignes ?? [];
      envoyees.forEach((l, i) => {
        if (citees.includes(l.stockId)) signaler(i, "peremption", MSG_PEREMPTION_REFUSEE);
      });
    }

    setBandeauLignes(signalees.length > 0);
    if (signalees.length > 0) {
      // Focus sur la première ligne en erreur, puis sur son premier champ dans l'ordre de saisie.
      const premiere = signalees.reduce((a, b) =>
        b.rang < a.rang || (b.rang === a.rang && ORDRE_CHAMPS.indexOf(b.champ) < ORDRE_CHAMPS.indexOf(a.champ)) ? b : a,
      );
      focusAFaire.current = `${premiere.cle}:${premiere.champ}`;
    } else if (code === "JOURNEE_CLOTUREE") {
      setJour(jourConakry(new Date()));
      focusAFaire.current = "envoi";
    } else if (code === "IDENTIFIANT_DEJA_UTILISE") {
      setCleReception(nouvelleCleIdempotence());
      setEssai((n) => n + 1);
    } else if (code === "STOCK_INTROUVABLE" || (err instanceof ApiError && err.status === 404)) {
      setEssai((n) => n + 1);
    }
  };

  const envoyer = (corps: CorpsReception) => {
    if (!structureId || envoiEnCours.current) return;
    envoiEnCours.current = true;
    setEnvoi(true);
    setBandeau(null);
    setBandeauLignes(false);
    setReessayable(false);
    setConfirmationModif(false);
    enregistrerReception(structureId, corps)
      .then((res) => {
        envoiEnCours.current = false;
        setEnvoi(false);
        setSucces({ reception: res.data, message: res.message });
      })
      .catch((err: unknown) => {
        envoiEnCours.current = false;
        gererEchec(err);
      });
  };

  const valider = () => {
    if (verrouille) return;
    const nouvellesErreurs: Record<number, ErreursLigne> = {};
    const demandees: LigneReceptionDemandee[] = [];
    const cles: number[] = [];
    let premier: string | null = null;
    const lignesRemplies = lignes.filter((l) => !estVide(l));
    const aTraiter = lignesRemplies.length > 0 ? lignesRemplies : lignes.slice(0, 1);

    for (const l of aTraiter) {
      const e: ErreursLigne = {};
      const ligne: LigneReceptionDemandee = { stockId: l.stockId ?? "" };
      if (l.stockId === null) e.medicament = "Choisissez un médicament de la liste.";
      const nombre = entier(l.quantite);
      if (nombre === null || nombre < 1) e.quantite = "Indiquez un nombre entier supérieur ou égal à 1.";
      else if (l.enUnites && nombre > UNITES_MAX)
        e.quantite = `Une ligne ne peut pas dépasser 1 000 000 000 ${uniteDe(l.stockId).pluriel} : vérifiez la quantité.`;
      else if (!l.enUnites && nombre > BOITES_MAX)
        e.quantite = "Une ligne ne peut pas dépasser 1 000 000 boîtes : vérifiez la quantité.";
      else if (l.enUnites) ligne.quantiteUnites = nombre;
      else ligne.nombreBoites = nombre;
      if (l.sansDate) {
        ligne.sansPeremption = true;
      } else if (l.peremption.trim() === "") {
        e.peremption = "Indiquez la date de péremption ou cochez « Sans date ».";
      } else {
        const lue = lireDatePeremption(l.peremption);
        if (lue.ok) ligne.dateExpiration = lue.jour;
        else e.peremption = lue.message;
      }
      if (l.lot.trim() !== "") ligne.numeroLot = l.lot.trim();
      if (l.cout.trim() !== "") {
        const cout = entier(l.cout);
        if (cout === null) e.cout = "Le coût doit être un nombre entier de GNF.";
        else ligne.coutAchatBoite = cout;
      }
      if (Object.keys(e).length > 0) {
        nouvellesErreurs[l.cle] = e;
        if (premier === null) {
          const champ = ORDRE_CHAMPS.find((c) => e[c] !== undefined);
          if (champ) premier = `${l.cle}:${champ}`;
        }
      }
      demandees.push(ligne);
      cles.push(l.cle);
    }

    setErreurs(nouvellesErreurs);
    setLignes((prev) => prev.map((l) => ({ ...l, peremptionVue: l.peremptionVue || !estVide(l) })));
    if (premier !== null) {
      setBandeau(MSG_COMPLETER);
      setBandeauLignes(true);
      focaliser(premier);
      return;
    }

    const effectif = jour === "" || jour > aujourdhui ? aujourdhui : jour;
    const corps: CorpsReception = {
      id: cleReception,
      ...(fournisseurId !== "" ? { fournisseurId } : {}),
      ...(reference.trim() !== "" ? { reference: reference.trim() } : {}),
      recueLe: effectif === aujourdhui ? new Date().toISOString() : `${effectif}T12:00:00.000Z`,
      lignes: demandees,
    };
    corpsEnvoye.current = corps;
    clesEnvoyees.current = cles;
    envoyer(corps);
  };

  const modifierLaSaisie = () => {
    setCleReception(nouvelleCleIdempotence());
    setReessayable(false);
    setConfirmationModif(false);
    setBandeau(null);
  };

  const nouvelleReception = () => {
    setSucces(null);
    setCleReception(nouvelleCleIdempotence());
    setFournisseurId("");
    setReference("");
    setJour(jourConakry(new Date()));
    setLignes([ligneVide(prochaineCle.current++)]);
    setErreurs({});
    setBandeau(null);
    setReessayable(false);
    setConfirmationModif(false);
    setEssai((n) => n + 1);
  };

  const enTete = (
    <div>
      <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white" style={POLICE_TITRE}>
        Nouvelle réception
      </h1>
      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
        Recopiez la facture de votre fournisseur, une ligne par médicament.
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

  if (succes) {
    const { reception, message } = succes;
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
            {message}
          </h2>
          {reception.cree === false && (
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Cette réception était déjà enregistrée : rien n&apos;a été ajouté deux fois.
            </p>
          )}
          {(reception.avertissements ?? []).map((a) => (
            <p key={`${a.stockId}`} role="status" className={ALERTE_ATTENTION}>
              <AlertCircle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
              <span>
                {a.message} ({a.nom})
              </span>
            </p>
          ))}
          <div className="flex flex-col sm:flex-row gap-3">
            <Link href={`/dashboard/receptions/${encodeURIComponent(reception.id)}`} className={BOUTON_PRIMAIRE}>
              Voir la réception
            </Link>
            <button type="button" onClick={nouvelleReception} className={BOUTON_SECONDAIRE}>
              Nouvelle réception
            </button>
            <Link href="/dashboard/receptions" className={BOUTON_SECONDAIRE}>
              Retour aux réceptions
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (stock === null) {
    return (
      <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
        {enTete}
        {erreurChargement === null ? (
          <div role="status" className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
            Chargement du stock...
          </div>
        ) : (
          <ErreurAvecReessai message={erreurChargement} onReessayer={reessayerChargement} />
        )}
      </div>
    );
  }

  const lignesChoisies = lignes.filter((l) => l.stockId !== null);
  const totalBoites = lignes.reduce((somme, l) => {
    const n = entier(l.quantite);
    return l.stockId !== null && !l.enUnites && n !== null ? somme + n : somme;
  }, 0);

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      {enTete}

      <section className={`${CARTE} space-y-4`} aria-labelledby="titre-livraison">
        <h2 id="titre-livraison" className="text-lg font-semibold text-slate-900 dark:text-white" style={POLICE_TITRE}>
          Livraison
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="fournisseur" className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">
              Fournisseur
            </label>
            <select
              id="fournisseur"
              value={fournisseurId}
              disabled={verrouille}
              onChange={(e) => setFournisseurId(e.target.value)}
              className={`${CHAMP} disabled:opacity-60`}
            >
              <option value="">Non renseigné</option>
              {fournisseurs.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nom}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setNouveauOuvert((o) => !o)}
              disabled={verrouille}
              aria-expanded={nouveauOuvert}
              className={`${BOUTON_SECONDAIRE} mt-2 disabled:opacity-60`}
            >
              Nouveau fournisseur
            </button>
          </div>
          <div>
            <label htmlFor="reference" className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">
              Numéro du bon de livraison ou de la facture (facultatif)
            </label>
            <input
              id="reference"
              type="text"
              maxLength={100}
              value={reference}
              readOnly={verrouille}
              onChange={(e) => setReference(e.target.value)}
              className={CHAMP}
            />
          </div>
          <div>
            <label htmlFor="date-reception" className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">
              Date de réception
            </label>
            <input
              id="date-reception"
              type="date"
              max={aujourdhui}
              value={jour}
              disabled={verrouille}
              onChange={(e) => setJour(e.target.value)}
              className={CHAMP}
            />
          </div>
        </div>

        {nouveauOuvert && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label htmlFor="nom-fournisseur" className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">
                Nom du fournisseur
              </label>
              <input
                id="nom-fournisseur"
                type="text"
                maxLength={100}
                value={nomFournisseur}
                readOnly={verrouille}
                onChange={(e) => setNomFournisseur(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    enregistrerFournisseur();
                  }
                }}
                className={CHAMP}
              />
            </div>
            <div>
              <label htmlFor="tel-fournisseur" className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">
                Téléphone (facultatif)
              </label>
              <input
                id="tel-fournisseur"
                type="tel"
                inputMode="tel"
                maxLength={30}
                value={telFournisseur}
                readOnly={verrouille}
                onChange={(e) => setTelFournisseur(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    enregistrerFournisseur();
                  }
                }}
                className={CHAMP}
              />
            </div>
            <div>
              <button
                type="button"
                onClick={enregistrerFournisseur}
                disabled={fournisseurEnCours || verrouille}
                className={BOUTON_PRIMAIRE}
              >
                Enregistrer le fournisseur
              </button>
            </div>
            {erreurFournisseur && (
              <p role="alert" className="md:col-span-3 text-sm text-rose-700 dark:text-rose-300">
                {erreurFournisseur}
              </p>
            )}
          </div>
        )}
      </section>

      <section className={`${CARTE} space-y-4`} aria-labelledby="titre-lignes">
        <h2 id="titre-lignes" className="text-lg font-semibold text-slate-900 dark:text-white" style={POLICE_TITRE}>
          Médicaments reçus
        </h2>
        {bandeau && bandeauLignes && (
          <div role="alert" className={`${ALERTE_ERREUR} items-start`}>
            <AlertCircle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
            <p>{bandeau}</p>
          </div>
        )}
        {erreurChargement && (
          <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">
            Les fiches n&apos;ont pas pu être actualisées. Vérifiez votre connexion puis réessayez.
          </p>
        )}
        <div ref={zoneLignes} className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <caption className="sr-only">Une ligne par médicament de la facture</caption>
            <thead>
              <tr className="text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                <th scope="col" className="py-2 pr-3 font-semibold min-w-48">Médicament</th>
                <th scope="col" className="py-2 pr-3 font-semibold min-w-52">Quantité</th>
                <th scope="col" className="py-2 pr-3 font-semibold min-w-32">Péremption</th>
                <th scope="col" className="py-2 pr-3 font-semibold min-w-28">Lot (facultatif)</th>
                <th scope="col" className="py-2 pr-3 font-semibold min-w-32">Coût d&apos;achat d&apos;une boîte (GNF, facultatif)</th>
                <th scope="col" className="py-2 font-semibold"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {lignes.map((l, index) => {
                const n = index + 1;
                const fiche = l.stockId !== null ? fiches.find((s) => s.id === l.stockId) : undefined;
                const coefficient = fiche?.coefficientBoite ?? 1;
                const unite = LIBELLES_UNITE_MINIMALE[fiche?.uniteMinimale ?? "UNITE"];
                const e = erreurs[l.cle] ?? {};
                const liste = ligneActive === l.cle ? suggestionsDe(l) : [];
                const aucun = ligneActive === l.cle && l.stockId === null && l.texte.trim() !== "" && liste.length === 0;
                const lecture =
                  l.peremptionVue && !l.sansDate && l.peremption.trim() !== "" ? lireDatePeremption(l.peremption) : null;
                const messagePeremption = e.peremption ?? (lecture && !lecture.ok ? lecture.message : null);
                const datePeremptionLue = lecture && lecture.ok ? afficherDatePeremption(lecture.jour) : null;
                const idListe = `suggestions-${l.cle}`;
                return (
                  <Fragment key={l.cle}>
                    <tr className="align-top">
                      <td className="py-3 pr-3">
                        <input
                          data-champ={`${l.cle}:medicament`}
                          type="text"
                          role="combobox"
                          aria-label={`Médicament, ligne ${n}`}
                          aria-autocomplete="list"
                          aria-expanded={liste.length > 0}
                          aria-controls={idListe}
                          aria-activedescendant={liste.length > 0 ? `${idListe}-${Math.min(indexSuggestion, liste.length - 1)}` : undefined}
                          aria-invalid={e.medicament ? true : undefined}
                          aria-describedby={e.medicament ? `erreur-${l.cle}-medicament` : undefined}
                          autoComplete="off"
                          placeholder="Nom ou nom générique"
                          value={l.texte}
                          readOnly={verrouille}
                          onChange={(ev) => {
                            modifierLigne(l.cle, { texte: ev.target.value, stockId: null }, "medicament");
                            setLigneActive(l.cle);
                            setIndexSuggestion(0);
                          }}
                          onFocus={() => setLigneActive(l.cle)}
                          onBlur={() => setLigneActive((a) => (a === l.cle ? null : a))}
                          onKeyDown={(ev) => surToucheMedicament(ev, l)}
                          className={e.medicament ? CHAMP_INVALIDE : CHAMP}
                        />
                        {liste.length > 0 && (
                          <ul
                            id={idListe}
                            role="listbox"
                            aria-label={`Médicaments trouvés, ligne ${n}`}
                            className="mt-1 max-h-56 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-800"
                          >
                            {liste.map((s, i) => (
                              <li
                                key={s.id}
                                id={`${idListe}-${i}`}
                                role="option"
                                aria-selected={i === Math.min(indexSuggestion, liste.length - 1)}
                                onMouseDown={(ev) => {
                                  ev.preventDefault();
                                  choisir(l.cle, s);
                                }}
                                className={`px-4 py-2 cursor-pointer text-sm text-slate-900 dark:text-white ${
                                  i === Math.min(indexSuggestion, liste.length - 1)
                                    ? "bg-primary-50 dark:bg-primary-500/15"
                                    : "hover:bg-slate-100 dark:hover:bg-slate-800"
                                }`}
                              >
                                <span className="font-bold">{s.medicament.nom}</span>
                                {s.medicament.nomGenerique && (
                                  <span className="block text-xs text-slate-600 dark:text-slate-400">
                                    {s.medicament.nomGenerique}
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                        {aucun && (
                          <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                            Aucun médicament ne correspond à « {l.texte.trim()} ».
                          </p>
                        )}
                        {e.medicament && (
                          <p id={`erreur-${l.cle}-medicament`} className="mt-1 text-sm text-rose-700 dark:text-rose-300">
                            {e.medicament}
                          </p>
                        )}
                      </td>
                      <td className="py-3 pr-3">
                        <div className="flex items-start gap-2">
                          <input
                            data-champ={`${l.cle}:quantite`}
                            type="text"
                            inputMode="numeric"
                            aria-label={`Quantité, ligne ${n}`}
                            aria-invalid={e.quantite ? true : undefined}
                            aria-describedby={e.quantite ? `erreur-${l.cle}-quantite` : undefined}
                            value={l.quantite}
                            readOnly={verrouille}
                            onChange={(ev) => modifierLigne(l.cle, { quantite: ev.target.value }, "quantite")}
                            onKeyDown={(ev) => surToucheChamp(ev, l, "quantite")}
                            className={e.quantite ? CHAMP_QUANTITE_INVALIDE : CHAMP_QUANTITE}
                          />
                          {coefficient > 1 ? (
                            <select
                              aria-label={`Unité de la quantité, ligne ${n}`}
                              value={l.enUnites ? "UNITE" : "BOITE"}
                              disabled={verrouille}
                              onChange={(ev) => modifierLigne(l.cle, { enUnites: ev.target.value === "UNITE" })}
                              className={SELECT_UNITE}
                            >
                              <option value="BOITE">boîtes</option>
                              <option value="UNITE">{`en ${unite.pluriel}`}</option>
                            </select>
                          ) : (
                            <span className="py-3 text-sm text-slate-700 dark:text-slate-300">boîtes</span>
                          )}
                        </div>
                        {e.quantite && (
                          <p id={`erreur-${l.cle}-quantite`} className="mt-1 text-sm text-rose-700 dark:text-rose-300">
                            {e.quantite}
                          </p>
                        )}
                      </td>
                      <td className="py-3 pr-3">
                        <input
                          data-champ={`${l.cle}:peremption`}
                          type="text"
                          aria-label={`Péremption, ligne ${n}`}
                          aria-invalid={messagePeremption ? true : undefined}
                          aria-describedby={messagePeremption || datePeremptionLue ? `info-${l.cle}-peremption` : undefined}
                          placeholder="06/28"
                          value={l.peremption}
                          readOnly={verrouille}
                          disabled={l.sansDate}
                          onChange={(ev) => modifierLigne(l.cle, { peremption: ev.target.value, peremptionVue: false }, "peremption")}
                          onBlur={() => modifierLigne(l.cle, { peremptionVue: true })}
                          onKeyDown={(ev) => surToucheChamp(ev, l, "peremption")}
                          className={`${messagePeremption ? CHAMP_INVALIDE : CHAMP} disabled:opacity-60`}
                        />
                        {messagePeremption ? (
                          <p id={`info-${l.cle}-peremption`} className="mt-1 text-sm text-rose-700 dark:text-rose-300">
                            {messagePeremption}
                          </p>
                        ) : (
                          datePeremptionLue && (
                            <p id={`info-${l.cle}-peremption`} className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                              {datePeremptionLue}
                            </p>
                          )
                        )}
                        <label className="mt-2 flex items-center gap-2 text-sm text-slate-800 dark:text-slate-200">
                          <input
                            type="checkbox"
                            aria-label={`Sans date, ligne ${n}`}
                            checked={l.sansDate}
                            disabled={verrouille}
                            onChange={(ev) => modifierLigne(l.cle, { sansDate: ev.target.checked }, "peremption")}
                            className={`w-5 h-5 rounded accent-primary-600 ${FOCUS}`}
                          />
                          Sans date
                        </label>
                      </td>
                      <td className="py-3 pr-3">
                        <input
                          data-champ={`${l.cle}:lot`}
                          type="text"
                          maxLength={64}
                          aria-label={`Lot (facultatif), ligne ${n}`}
                          value={l.lot}
                          readOnly={verrouille}
                          onChange={(ev) => modifierLigne(l.cle, { lot: ev.target.value }, "lot")}
                          onKeyDown={(ev) => surToucheChamp(ev, l, "lot")}
                          className={e.lot ? CHAMP_INVALIDE : CHAMP}
                          aria-invalid={e.lot ? true : undefined}
                          aria-describedby={e.lot ? `erreur-${l.cle}-lot` : undefined}
                        />
                        {e.lot && (
                          <p id={`erreur-${l.cle}-lot`} className="mt-1 text-sm text-rose-700 dark:text-rose-300">
                            {e.lot}
                          </p>
                        )}
                      </td>
                      <td className="py-3 pr-3">
                        <input
                          data-champ={`${l.cle}:cout`}
                          type="text"
                          inputMode="numeric"
                          aria-label={`Coût d'achat d'une boîte (GNF, facultatif), ligne ${n}`}
                          aria-describedby={e.cout ? `erreur-${l.cle}-cout aide-cout` : "aide-cout"}
                          aria-invalid={e.cout ? true : undefined}
                          value={l.cout}
                          readOnly={verrouille}
                          onChange={(ev) => modifierLigne(l.cle, { cout: ev.target.value }, "cout")}
                          onKeyDown={(ev) => surToucheDernierChamp(ev, index)}
                          className={e.cout ? CHAMP_INVALIDE : CHAMP}
                        />
                        {e.cout && (
                          <p id={`erreur-${l.cle}-cout`} className="mt-1 text-sm text-rose-700 dark:text-rose-300">
                            {e.cout}
                          </p>
                        )}
                      </td>
                      <td className="py-3">
                        <button
                          type="button"
                          onClick={() => retirerLigne(l.cle)}
                          disabled={verrouille}
                          aria-label={`Retirer la ligne ${n}`}
                          className={BOUTON_ICONE}
                        >
                          <Trash2 className={ICONE} aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                    {fiche && fiche.qualifie === false && !l.enUnites && (
                      <tr>
                        <td colSpan={6} className="pb-3">
                          <div role="status" className={`${ALERTE_ATTENTION} items-start`}>
                            <AlertCircle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                            <div className="flex-1 space-y-2">
                              {coefficient > 1 ? (
                                <p>
                                  Le nombre {deOuD(unite.pluriel)} par boîte de {fiche.medicament.nom} n&apos;est pas encore confirmé :
                                  vérifiez sa fiche avant de compter en boîtes, ou saisissez la quantité en {unite.pluriel}.
                                </p>
                              ) : (
                                // Choix de l'unité absent (1 unité par boîte) : seul conseil réalisable, confirmer la fiche.
                                <p>
                                  Le nombre {deOuD(unite.pluriel)} par boîte de {fiche.medicament.nom} n&apos;est pas encore confirmé.
                                  Si une boîte en contient plusieurs, indiquez-le dans sa fiche avant d&apos;enregistrer
                                  cette réception. Sinon, vous pouvez l&apos;enregistrer telle quelle.
                                </p>
                              )}
                              <div className="flex flex-wrap items-center gap-3">
                                <Link
                                  href="/dashboard/stock"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`font-medium underline rounded ${FOCUS}`}
                                >
                                  Ouvrir le stock dans un nouvel onglet
                                </Link>
                                <button
                                  type="button"
                                  onClick={reessayerChargement}
                                  disabled={verrouille}
                                  className={`px-3 py-1.5 rounded-xl text-sm font-medium hover:bg-amber-100 dark:hover:bg-amber-500/20 disabled:opacity-60 ${FOCUS}`}
                                >
                                  J&apos;ai confirmé la fiche : actualiser
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        <p id="aide-cout" className="text-sm text-slate-600 dark:text-slate-400">
          Sans coût, la marge de ce lot restera inconnue.
        </p>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Un médicament absent de la liste s&apos;ajoute d&apos;abord depuis Stock Médicaments, bouton « Ajouter un médicament ».{" "}
          <Link href="/dashboard/stock" className="font-medium text-primary-700 dark:text-primary-300 underline">
            Aller au stock
          </Link>
        </p>
        <button
          type="button"
          onClick={ajouterLigne}
          disabled={verrouille || lignes.length >= LIGNES_MAX}
          className={`${BOUTON_SECONDAIRE} inline-flex items-center gap-2 disabled:opacity-60`}
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          Ajouter une ligne
        </button>
      </section>

      {bandeau && !bandeauLignes && (
        <div role="alert" className={`${ALERTE_ERREUR} items-start`}>
          <AlertCircle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
          <div className="flex-1 space-y-2">
            <p>{bandeau}</p>
            {reessayable && !confirmationModif && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => corpsEnvoye.current && envoyer(corpsEnvoye.current)}
                  disabled={envoi}
                  className={`px-3 py-1.5 rounded-xl text-sm font-bold bg-rose-700 text-white hover:bg-rose-800 disabled:opacity-60 ${FOCUS}`}
                >
                  Réessayer l&apos;envoi
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmationModif(true)}
                  disabled={envoi}
                  className={`px-3 py-1.5 rounded-xl text-sm font-medium hover:bg-rose-100 dark:hover:bg-rose-500/20 disabled:opacity-60 ${FOCUS}`}
                >
                  Modifier la saisie
                </button>
              </div>
            )}
            {reessayable && confirmationModif && (
              <div className="space-y-2">
                <p>{MSG_CONFIRMER_MODIFICATION}</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={modifierLaSaisie}
                    className={`px-3 py-1.5 rounded-xl text-sm font-bold bg-rose-700 text-white hover:bg-rose-800 ${FOCUS}`}
                  >
                    Modifier
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmationModif(false)}
                    className={`px-3 py-1.5 rounded-xl text-sm font-medium hover:bg-rose-100 dark:hover:bg-rose-500/20 ${FOCUS}`}
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <p aria-live="polite" className="text-sm font-medium text-slate-900 dark:text-white">
          {`${lignesChoisies.length} ${lignesChoisies.length > 1 ? "lignes" : "ligne"}, ${libelleBoites(totalBoites)}`}
        </p>
        <button ref={boutonEnvoi} type="button" onClick={valider} disabled={verrouille} className={BOUTON_PRIMAIRE}>
          {envoi && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
          Enregistrer la réception
        </button>
      </div>
    </div>
  );
}
