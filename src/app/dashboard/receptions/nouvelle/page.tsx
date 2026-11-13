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
  type EnteteFactureDemandee,
  type Fournisseur,
  type LigneReceptionDemandee,
  type Reception,
  type StockMedicament,
} from "@/lib/api_pharmacie";
import { ApiError } from "@/lib/api_auth";
import { LIBELLES_UNITE_MINIMALE, deOuD } from "@/lib/caisse/regles/quantites";
import { controlerLigne, controlerSomme, lireMontant, lireTauxTva } from "@/lib/facture_fournisseur";
import { formaterGNF } from "@/lib/format_gnf";
import { afficherDatePeremption, lireDatePeremption } from "@/lib/date_peremption";
import { champsErreur, codeErreur, detailsErreur, estErreurReseau } from "@/lib/erreurs_api";
import {
  ALERTE_ATTENTION,
  ALERTE_ERREUR,
  BOUTON_PRIMAIRE,
  BOUTON_SECONDAIRE,
  CARTE,
  CHAMP,
  FOCUS,
} from "@/components/pharmacie/classes";
import { ErreurAvecReessai } from "@/components/pharmacie/ErreurAvecReessai";
import { ui } from "@/theme/ui";
import { jourConakry } from "../../ventes/affichage";
import { rechercherDansStock } from "../../vente/panier";

const CHAMP_INVALIDE = CHAMP.replace("border-slate-300", "border-rose-500").replace("dark:border-slate-700", "dark:border-rose-500");
// Quantité : largeur fixe qui ne se réduit jamais (6 chiffres tiennent), chiffres alignés à droite.
// Champs compacts du tableau (une ligne de facture : hauteur réduite, texte petit).
const compact = (classes: string) =>
  classes.replace("h-mc-controle ", "h-mc-controle-petit ").replace("text-mc-normal", "text-mc-petit").replace("px-3", "px-2");
const CHAMP_PETIT = compact(CHAMP);
const CHAMP_PETIT_INVALIDE = compact(CHAMP_INVALIDE);
const CHAMP_QUANTITE = CHAMP_PETIT.replace("w-full ", "w-20 shrink-0 text-right tabular-nums ");
const CHAMP_QUANTITE_INVALIDE = CHAMP_PETIT_INVALIDE.replace("w-full ", "w-20 shrink-0 text-right tabular-nums ");
// Montants : alignés à droite, chiffres de largeur fixe.
const CHAMP_NOMBRE = CHAMP_PETIT.replace("w-full ", "w-full text-right tabular-nums ");
const CHAMP_NOMBRE_INVALIDE = CHAMP_PETIT_INVALIDE.replace("w-full ", "w-full text-right tabular-nums ");
const SELECT_UNITE = `h-mc-controle-petit px-2 rounded-mc-moyen border border-slate-300 bg-white text-mc-petit text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 disabled:opacity-60 ${FOCUS}`;
// En-têtes serrés comme sur la facture papier
const ENTETE = ui.celluleEnteteSerree;
const CELLULE = "px-2 py-1.5";

// Filtres de saisie : les lettres ne peuvent pas entrer dans les champs chiffrés.
// Montant : chiffres et séparateurs de milliers (espace, point, virgule), comme sur la facture.
const filtrerMontant = (v: string) => v.replace(/[^\d\s.,  ]/g, "");
// Quantité : chiffres seulement.
const filtrerEntier = (v: string) => v.replace(/\D/g, "");
// Péremption : chiffres et séparateurs de date.
const filtrerDate = (v: string) => v.replace(/[^\d/.\-\s]/g, "");
const CHAMPS_ENTIERS: readonly string[] = ["qteCommandee", "colisage"];
// Nombre de colonnes du tableau des lignes (pour les rangées qui occupent toute la largeur).
const COLONNES = 13;
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

type Champ =
  | "medicament"
  | "quantite"
  | "peremption"
  | "lot"
  | "cout"
  | "qteCommandee"
  | "prixPublic"
  | "tauxTva"
  | "montantLigne"
  | "colisage";
const ORDRE_CHAMPS: readonly Champ[] = [
  "medicament",
  "quantite",
  "peremption",
  "lot",
  "cout",
  "qteCommandee",
  "prixPublic",
  "tauxTva",
  "montantLigne",
  "colisage",
];
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
  /** Facture fournisseur : tous facultatifs, saisis en texte. */
  codeFournisseur: string;
  codeBarres: string;
  qteCommandee: string;
  prixPublic: string;
  codeTva: string;
  tauxTva: string;
  montantLigne: string;
  colisage: string;
  tableau: string;
  bonPreparation: string;
}

const CHAMPS_TEXTE_DETAILS = [
  "codeFournisseur",
  "codeBarres",
  "qteCommandee",
  "prixPublic",
  "codeTva",
  "tauxTva",
  "montantLigne",
  "colisage",
  "tableau",
  "bonPreparation",
] as const;

interface EnteteSaisie {
  numeroFacture: string;
  referenceCommande: string;
  dateFacture: string;
  montantHT: string;
  totalTva: string;
  montantTTC: string;
  netAPayer: string;
}

const enteteVide: EnteteSaisie = {
  numeroFacture: "",
  referenceCommande: "",
  dateFacture: "",
  montantHT: "",
  totalTva: "",
  montantTTC: "",
  netAPayer: "",
};

const MONTANTS_ENTETE = ["montantHT", "totalTva", "montantTTC", "netAPayer"] as const;
const LIBELLES_ENTETE: Record<keyof EnteteSaisie, string> = {
  numeroFacture: "N° de facture",
  referenceCommande: "Référence de commande",
  dateFacture: "Date de facture",
  montantHT: "Montant HT",
  totalTva: "Total TVA",
  montantTTC: "Montant TTC",
  netAPayer: "Net à payer",
};
// Libellés du pied de facture, comme sur la facture papier.
const LIBELLES_PIED: Record<(typeof MONTANTS_ENTETE)[number], string> = {
  montantHT: "Montant H.T cumulé",
  totalTva: "Total TVA",
  montantTTC: "TTC",
  netAPayer: "Net à payer",
};
const MSG_MONTANT = "Indiquez un montant entier en GNF, par exemple 95 630.";

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
  codeFournisseur: "",
  codeBarres: "",
  qteCommandee: "",
  prixPublic: "",
  codeTva: "",
  tauxTva: "",
  montantLigne: "",
  colisage: "",
  tableau: "",
  bonPreparation: "",
});

const estVide = (l: LigneSaisie) =>
  l.stockId === null &&
  l.texte.trim() === "" &&
  l.quantite.trim() === "" &&
  l.peremption.trim() === "" &&
  !l.sansDate &&
  l.lot.trim() === "" &&
  l.cout.trim() === "" &&
  CHAMPS_TEXTE_DETAILS.every((c) => l[c].trim() === "");

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
  quantiteCommandee: "qteCommandee",
  prixPublicBoite: "prixPublic",
  tauxTvaPourMille: "tauxTva",
  montantHTLigne: "montantLigne",
  colisage: "colisage",
};

// Champs d'en-tête que le serveur peut refuser, vers leur clé de saisie.
const ENTETE_SERVEUR: readonly (keyof EnteteSaisie)[] = [
  "numeroFacture",
  "referenceCommande",
  "dateFacture",
  "montantHT",
  "totalTva",
  "montantTTC",
  "netAPayer",
];

const MESSAGE_CHAMP_SERVEUR: Record<Champ, string> = {
  medicament: "Vérifiez ce médicament.",
  quantite: "Vérifiez cette quantité.",
  peremption: MSG_PEREMPTION_REFUSEE,
  lot: "Vérifiez ce numéro de lot.",
  cout: "Vérifiez ce coût.",
  qteCommandee: "Vérifiez cette quantité commandée.",
  prixPublic: "Vérifiez ce prix public.",
  tauxTva: "Vérifiez ce taux de TVA.",
  montantLigne: "Vérifiez ce montant.",
  colisage: "Vérifiez ce colisage.",
};

interface DetailLigne {
  cle: (typeof CHAMPS_TEXTE_DETAILS)[number];
  libelle: string;
  champ?: Champ;
  numerique?: boolean;
  max?: number;
}

const DETAILS_LIGNE: readonly DetailLigne[] = [
  { cle: "codeFournisseur", libelle: "Code fournisseur", max: 64 },
  { cle: "qteCommandee", libelle: "Qté commandée", champ: "qteCommandee", numerique: true },
  { cle: "prixPublic", libelle: "Prix public", champ: "prixPublic", numerique: true },
  { cle: "tauxTva", libelle: "Taux TVA (%)", champ: "tauxTva", numerique: true },
  { cle: "montantLigne", libelle: "Montant HT", champ: "montantLigne", numerique: true },
  { cle: "colisage", libelle: "Colisage", champ: "colisage", numerique: true },
  { cle: "tableau", libelle: "Tableau (TB)", max: 20 },
];

/** Écarts non bloquants d'une ligne : montant, quantité livrée et quantité commandée (comptées en boîtes). */
function avertissementsDeLigne(l: LigneSaisie, enBoites: boolean): string[] {
  const livree = enBoites && l.quantite.trim() !== "" ? entier(l.quantite) : null;
  const res = controlerLigne({
    quantiteLivree: livree,
    quantiteCommandee: l.qteCommandee.trim() === "" ? null : lireMontant(l.qteCommandee),
    prixUnitaire: l.cout.trim() === "" ? null : lireMontant(l.cout),
    montantHTLigne: l.montantLigne.trim() === "" ? null : lireMontant(l.montantLigne),
  });
  const messages: string[] = [];
  if (res.montant)
    messages.push(
      `Le montant HT saisi (${formaterGNF(res.montant.saisi)}) est différent de la quantité livrée multipliée par le prix unitaire (${formaterGNF(res.montant.attendu)}). Vérifiez votre saisie : l'enregistrement reste possible.`,
    );
  if (res.quantite)
    messages.push(
      `La quantité livrée (${res.quantite.livree}) est différente de la quantité commandée (${res.quantite.commandee}). C'est possible si le fournisseur a livré moins ou plus.`,
    );
  return messages;
}

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
  const [jour, setJour] = useState(() => jourConakry(new Date()));
  const [entete, setEntete] = useState<EnteteSaisie>(enteteVide);
  const [erreursEntete, setErreursEntete] = useState<Partial<Record<keyof EnteteSaisie, string>>>({});
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
  const focaliser = (cle: string) =>
    document.querySelector<HTMLElement>(`[data-champ="${cle}"]`)?.focus();

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

  // Entrée dans Quantité ou Péremption : champ suivant de la ligne (saisie de facture au clavier, aucun envoi).
  const surToucheChamp = (e: KeyboardEvent<HTMLInputElement>, l: LigneSaisie, champ: "quantite" | "peremption") => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (verrouille) return;
    const suivant: Champ = champ === "quantite" ? (l.sansDate ? "cout" : "peremption") : "cout";
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
        const entetePossible = ENTETE_SERVEUR.find((c) => c === champ);
        if (entetePossible) {
          setErreursEntete((prev) => ({ ...prev, [entetePossible]: `Vérifiez ce champ : ${LIBELLES_ENTETE[entetePossible]}.` }));
          continue;
        }
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
        const cout = lireMontant(l.cout);
        if (cout === null) e.cout = "Le coût doit être un nombre entier de GNF.";
        else ligne.coutAchatBoite = cout;
      }
      // Facture fournisseur : champs facultatifs, jamais requis.
      const texte = (v: string) => v.trim();
      if (texte(l.codeFournisseur) !== "") ligne.codeArticleFournisseur = texte(l.codeFournisseur);
      if (texte(l.codeBarres) !== "") ligne.codeBarres = texte(l.codeBarres);
      if (texte(l.codeTva) !== "") ligne.codeTva = texte(l.codeTva);
      if (texte(l.tableau) !== "") ligne.tableau = texte(l.tableau);
      if (texte(l.bonPreparation) !== "") ligne.bonPreparation = texte(l.bonPreparation);
      if (texte(l.qteCommandee) !== "") {
        const v = lireMontant(l.qteCommandee);
        if (v === null || v > BOITES_MAX) e.qteCommandee = "Indiquez un nombre entier de boîtes.";
        else ligne.quantiteCommandee = v;
      }
      if (texte(l.colisage) !== "") {
        const v = lireMontant(l.colisage);
        if (v === null || v > BOITES_MAX) e.colisage = "Indiquez un nombre entier de boîtes par colis.";
        else ligne.colisage = v;
      }
      if (texte(l.prixPublic) !== "") {
        const v = lireMontant(l.prixPublic);
        if (v === null) e.prixPublic = MSG_MONTANT;
        else ligne.prixPublicBoite = v;
      }
      if (texte(l.montantLigne) !== "") {
        const v = lireMontant(l.montantLigne);
        if (v === null) e.montantLigne = MSG_MONTANT;
        else ligne.montantHTLigne = v;
      }
      if (texte(l.tauxTva) !== "") {
        const v = lireTauxTva(l.tauxTva);
        if (v === null) e.tauxTva = "Indiquez un taux entre 0 et 100, par exemple 18.";
        else ligne.tauxTvaPourMille = v;
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

    // En-tête de la facture : montants facultatifs.
    const factureDemandee: EnteteFactureDemandee = {};
    const erreursFact: Partial<Record<keyof EnteteSaisie, string>> = {};
    if (entete.numeroFacture.trim() !== "") factureDemandee.numeroFacture = entete.numeroFacture.trim();
    if (entete.referenceCommande.trim() !== "") factureDemandee.referenceCommande = entete.referenceCommande.trim();
    if (entete.dateFacture !== "") factureDemandee.dateFacture = entete.dateFacture;
    for (const c of MONTANTS_ENTETE) {
      if (entete[c].trim() === "") continue;
      const v = lireMontant(entete[c]);
      if (v === null) erreursFact[c] = MSG_MONTANT;
      else factureDemandee[c] = v;
    }
    setErreursEntete(erreursFact);
    const premiereErreurEntete = ENTETE_SERVEUR.find((c) => erreursFact[c] !== undefined);

    setErreurs(nouvellesErreurs);
    setLignes((prev) =>
      prev.map((l) => ({ ...l, peremptionVue: l.peremptionVue || !estVide(l) })),
    );
    if (premier !== null || premiereErreurEntete) {
      setBandeau(MSG_COMPLETER);
      setBandeauLignes(true);
      if (premiereErreurEntete && premier === null) {
        focusAFaire.current = `entete:${premiereErreurEntete}`;
      } else if (premier !== null) {
        focusAFaire.current = premier;
      }
      return;
    }

    const effectif = jour === "" || jour > aujourdhui ? aujourdhui : jour;
    const corps: CorpsReception = {
      id: cleReception,
      ...(fournisseurId !== "" ? { fournisseurId } : {}),
      ...factureDemandee,
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
    setJour(jourConakry(new Date()));
    setLignes([ligneVide(prochaineCle.current++)]);
    setErreurs({});
    setEntete(enteteVide);
    setErreursEntete({});
    setBandeau(null);
    setReessayable(false);
    setConfirmationModif(false);
    setEssai((n) => n + 1);
  };

  // Champ de l'en-tête de la facture (numéro, date, référence).
  const champEntete = (c: "numeroFacture" | "dateFacture" | "referenceCommande") => {
    const estDate = c === "dateFacture";
    const estTexte = c === "numeroFacture" || c === "referenceCommande";
    const erreur = erreursEntete[c];
    return (
      <div key={c}>
        <label htmlFor={`facture-${c}`} className={ui.label}>
          {LIBELLES_ENTETE[c]}
        </label>
        <input
          id={`facture-${c}`}
          data-champ={`entete:${c}`}
          type={estDate ? "date" : "text"}
          inputMode={estDate || estTexte ? undefined : "numeric"}
          maxLength={estTexte ? 64 : undefined}
          value={entete[c]}
          readOnly={verrouille}
          aria-invalid={erreur ? true : undefined}
          aria-describedby={erreur ? `erreur-facture-${c}` : undefined}
          onChange={(ev) => {
            setEntete((prev) => ({ ...prev, [c]: ev.target.value }));
            if (erreur) setErreursEntete((prev) => ({ ...prev, [c]: undefined }));
          }}
          className={erreur ? CHAMP_INVALIDE : ui.champ}
        />
        {erreur && (
          <p id={`erreur-facture-${c}`} className="mt-1 text-mc-normal text-rose-700 dark:text-rose-300">
            {erreur}
          </p>
        )}
      </div>
    );
  };

  // Cellule de tableau pour un champ de la facture d'une ligne ; `nombre` aligne la saisie à droite.
  const detail = (l: LigneSaisie, n: number, e: ErreursLigne, cle: (typeof CHAMPS_TEXTE_DETAILS)[number], nombre = false) => {
    const d = DETAILS_LIGNE.find((x) => x.cle === cle)!;
    const erreur = d.champ ? e[d.champ] : undefined;
    return (
      <>
        <input
          data-champ={d.champ ? `${l.cle}:${d.champ}` : undefined}
          type="text"
          inputMode={d.numerique ? "numeric" : undefined}
          maxLength={d.numerique ? undefined : d.max}
          aria-label={`${d.libelle}, ligne ${n}`}
          aria-invalid={erreur ? true : undefined}
          aria-describedby={erreur ? `erreur-${l.cle}-${d.cle}` : undefined}
          value={l[d.cle]}
          readOnly={verrouille}
          onChange={(ev) => {
            const brut = ev.target.value;
            const valeur = !d.numerique ? brut : CHAMPS_ENTIERS.includes(d.cle) ? filtrerEntier(brut) : filtrerMontant(brut);
            modifierLigne(l.cle, { [d.cle]: valeur } as Partial<LigneSaisie>, d.champ);
          }}
          className={nombre ? (erreur ? CHAMP_NOMBRE_INVALIDE : CHAMP_NOMBRE) : erreur ? CHAMP_PETIT_INVALIDE : CHAMP_PETIT}
        />
        {erreur && (
          <p id={`erreur-${l.cle}-${d.cle}`} className="mt-1 text-mc-legende text-rose-700 dark:text-rose-300">
            {erreur}
          </p>
        )}
      </>
    );
  };

  const enTete = (
    <div>
      <h1 className={ui.titrePage}>
        Nouvelle réception
      </h1>
      <p className={`${ui.texte.petit} mt-1`}>
        Recopiez la facture de votre fournisseur, une ligne par médicament.
      </p>
    </div>
  );

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
        {enTete}
        <div className={CARTE}>
          <p className="text-mc-normal text-slate-700 dark:text-slate-300">
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
            className={`${ui.texte.section} focus:outline-none`}
          >
            {message}
          </h2>
          {reception.cree === false && (
            <p className="text-mc-normal text-slate-700 dark:text-slate-300">
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
          <div role="status" className="flex items-center gap-3 text-mc-normal text-slate-600 dark:text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
            Chargement du stock...
          </div>
        ) : (
          <ErreurAvecReessai message={erreurChargement} onReessayer={reessayerChargement} />
        )}
      </div>
    );
  }

  const lignesRemplies = lignes.filter((l) => !estVide(l));
  const avertissementSomme = controlerSomme(
    lignesRemplies.map((l) => (l.montantLigne.trim() === "" ? null : lireMontant(l.montantLigne))),
    entete.montantHT.trim() === "" ? null : lireMontant(entete.montantHT),
  );
  const lignesChoisies = lignes.filter((l) => l.stockId !== null);
  const totalBoites = lignes.reduce((somme, l) => {
    const n = entier(l.quantite);
    return l.stockId !== null && !l.enUnites && n !== null ? somme + n : somme;
  }, 0);

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      {enTete}

      <section className={`${ui.carte} space-y-4`} aria-labelledby="titre-livraison">
        <h2 id="titre-livraison" className={ui.texte.section}>
          Facture fournisseur
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label htmlFor="fournisseur" className={ui.label}>
              Fournisseur
            </label>
            <select
              id="fournisseur"
              value={fournisseurId}
              disabled={verrouille}
              onChange={(e) => setFournisseurId(e.target.value)}
              className={`${ui.champ} disabled:opacity-60`}
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
              className={`${ui.bouton.secondaire} mt-2 disabled:opacity-60`}
            >
              Nouveau fournisseur
            </button>
          </div>
          {champEntete("numeroFacture")}
          {champEntete("dateFacture")}
          {champEntete("referenceCommande")}
          <div>
            <label htmlFor="date-reception" className={ui.label}>
              Date de réception
            </label>
            <input
              id="date-reception"
              type="date"
              max={aujourdhui}
              value={jour}
              disabled={verrouille}
              onChange={(e) => setJour(e.target.value)}
              className={ui.champ}
            />
          </div>
        </div>

        {nouveauOuvert && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label htmlFor="nom-fournisseur" className={ui.label}>
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
                className={ui.champ}
              />
            </div>
            <div>
              <label htmlFor="tel-fournisseur" className={ui.label}>
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
                className={ui.champ}
              />
            </div>
            <div>
              <button
                type="button"
                onClick={enregistrerFournisseur}
                disabled={fournisseurEnCours || verrouille}
                className={ui.bouton.primaire}
              >
                Enregistrer le fournisseur
              </button>
            </div>
            {erreurFournisseur && (
              <p role="alert" className="md:col-span-3 text-mc-normal text-rose-700 dark:text-rose-300">
                {erreurFournisseur}
              </p>
            )}
          </div>
        )}
      </section>

      <section className={`${ui.carte} space-y-4`} aria-labelledby="titre-lignes">
        <h2 id="titre-lignes" className={ui.texte.section}>
          Médicaments reçus
        </h2>
        {bandeau && bandeauLignes && (
          <div role="alert" className={`${ui.alerte.erreur} items-start`}>
            <AlertCircle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
            <p>{bandeau}</p>
          </div>
        )}
        {erreurChargement && (
          <p role="alert" className="text-mc-normal text-rose-700 dark:text-rose-300">
            Les fiches n&apos;ont pas pu être actualisées. Vérifiez votre connexion puis réessayez.
          </p>
        )}
        <div ref={zoneLignes} className="overflow-x-auto">
          <table className={`${ui.tableau} table-fixed min-w-324`}>
            <caption className="sr-only">Une ligne par médicament de la facture</caption>
            <thead>
              <tr className={`${ui.enteteTableau} align-bottom`}>
                <th scope="col" className={`${ENTETE} w-10 text-right`}>Ligne</th>
                <th scope="col" className={`${ENTETE} w-24`}>Code</th>
                <th scope="col" className={`${ENTETE} sticky left-0 z-10 w-60 bg-slate-50 dark:bg-slate-800`}>Désignation des produits</th>
                <th scope="col" className={`${ENTETE} w-28`}>Péremption<br />(MM/AA)</th>
                <th scope="col" className={`${ENTETE} w-14`}>TB</th>
                <th scope="col" className={`${ENTETE} w-28 text-right`}>Prix<br />public</th>
                <th scope="col" className={`${ENTETE} w-16 text-right`}>TVA</th>
                <th scope="col" className={`${ENTETE} w-24 text-right`}>Qté<br />commandée</th>
                <th scope="col" className={`${ENTETE} w-28`}>Qté<br />livrée</th>
                <th scope="col" className={`${ENTETE} w-28 text-right`}>Prix<br />unitaire</th>
                <th scope="col" className={`${ENTETE} w-32 text-right`}>Montant<br />HT</th>
                <th scope="col" className={`${ENTETE} w-22 text-right`}>Colisage</th>
                <th scope="col" className={`${ENTETE} w-10`}><span className="sr-only">Actions</span></th>
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
                const avertissements = avertissementsDeLigne(l, !l.enUnites);
                return (
                  <Fragment key={l.cle}>
                    <tr className="align-top">
                      <td className={`${CELLULE} text-right tabular-nums text-slate-600 dark:text-slate-400`}>{n}</td>
                      <td className={CELLULE}>{detail(l, n, e, "codeFournisseur")}</td>
                      <td className={`${CELLULE} sticky left-0 z-10 bg-white dark:bg-slate-900`}>
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
                          className={e.medicament ? CHAMP_PETIT_INVALIDE : CHAMP_PETIT}
                        />
                        {liste.length > 0 && (
                          <ul
                            id={idListe}
                            role="listbox"
                            aria-label={`Médicaments trouvés, ligne ${n}`}
                            className="mt-1 max-h-56 overflow-y-auto rounded-mc-moyen border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-mc divide-y divide-slate-200 dark:divide-slate-800"
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
                                className={`px-3 py-2 cursor-pointer text-mc-petit text-slate-900 dark:text-white ${
                                  i === Math.min(indexSuggestion, liste.length - 1)
                                    ? "bg-primary-50 dark:bg-primary-500/15"
                                    : "hover:bg-slate-100 dark:hover:bg-slate-800"
                                }`}
                              >
                                <span className="font-semibold">{s.medicament.nom}</span>
                                {s.medicament.nomGenerique && (
                                  <span className="block text-mc-legende text-slate-600 dark:text-slate-400">
                                    {s.medicament.nomGenerique}
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                        {aucun && (
                          <p className="mt-1 text-mc-legende text-slate-700 dark:text-slate-300">
                            Aucun médicament ne correspond à « {l.texte.trim()} ».
                          </p>
                        )}
                        {e.medicament && (
                          <p id={`erreur-${l.cle}-medicament`} className="mt-1 text-mc-legende text-rose-700 dark:text-rose-300">
                            {e.medicament}
                          </p>
                        )}
                      </td>
                      <td className={CELLULE}>
                        <div>
                          <input
                            data-champ={`${l.cle}:peremption`}
                            type="text"
                            aria-label={`Péremption, ligne ${n}`}
                            aria-invalid={messagePeremption ? true : undefined}
                            aria-describedby={messagePeremption || datePeremptionLue ? `info-${l.cle}-peremption` : undefined}
                            placeholder="MM/AA"
                            value={l.peremption}
                            readOnly={verrouille}
                            disabled={l.sansDate}
                            onChange={(ev) => modifierLigne(l.cle, { peremption: filtrerDate(ev.target.value), peremptionVue: false }, "peremption")}
                            onBlur={() => modifierLigne(l.cle, { peremptionVue: true })}
                            onKeyDown={(ev) => surToucheChamp(ev, l, "peremption")}
                            className={`${messagePeremption ? CHAMP_PETIT_INVALIDE : CHAMP_PETIT} disabled:opacity-60`}
                          />
                          {messagePeremption ? (
                            <p id={`info-${l.cle}-peremption`} className="mt-1 text-mc-legende text-rose-700 dark:text-rose-300">
                              {messagePeremption}
                            </p>
                          ) : (
                            datePeremptionLue && (
                              <p id={`info-${l.cle}-peremption`} className="mt-1 text-mc-legende text-slate-700 dark:text-slate-300">
                                {datePeremptionLue}
                              </p>
                            )
                          )}
                          <label className="mt-1 flex items-center gap-2 whitespace-nowrap text-mc-legende text-slate-800 dark:text-slate-200">
                            <input
                              type="checkbox"
                              aria-label={`Sans date, ligne ${n}`}
                              checked={l.sansDate}
                              disabled={verrouille}
                              onChange={(ev) => modifierLigne(l.cle, { sansDate: ev.target.checked }, "peremption")}
                              className={`w-4 h-4 rounded-mc-petit accent-primary-600 ${FOCUS}`}
                            />
                            Sans date
                          </label>
                        </div>
                      </td>
                      <td className={CELLULE}>{detail(l, n, e, "tableau")}</td>
                      <td className={CELLULE}>{detail(l, n, e, "prixPublic", true)}</td>
                      <td className={CELLULE}>{detail(l, n, e, "tauxTva", true)}</td>
                      <td className={CELLULE}>{detail(l, n, e, "qteCommandee", true)}</td>
                      <td className={CELLULE}>
                        <div className="flex flex-col items-end gap-1">
                          <input
                            data-champ={`${l.cle}:quantite`}
                            type="text"
                            inputMode="numeric"
                            aria-label={`Quantité, ligne ${n}`}
                            aria-invalid={e.quantite ? true : undefined}
                            aria-describedby={e.quantite ? `erreur-${l.cle}-quantite` : undefined}
                            value={l.quantite}
                            readOnly={verrouille}
                            onChange={(ev) => modifierLigne(l.cle, { quantite: filtrerEntier(ev.target.value) }, "quantite")}
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
                            <span className="py-1.5 text-mc-petit text-slate-700 dark:text-slate-300">boîtes</span>
                          )}
                        </div>
                        {e.quantite && (
                          <p id={`erreur-${l.cle}-quantite`} className="mt-1 text-mc-legende text-rose-700 dark:text-rose-300">
                            {e.quantite}
                          </p>
                        )}
                      </td>
                      <td className={CELLULE}>
                        <input
                          data-champ={`${l.cle}:cout`}
                          type="text"
                          inputMode="numeric"
                          aria-label={`Coût d'achat d'une boîte (GNF, facultatif), ligne ${n}`}
                          aria-describedby={e.cout ? `erreur-${l.cle}-cout aide-cout` : "aide-cout"}
                          aria-invalid={e.cout ? true : undefined}
                          value={l.cout}
                          readOnly={verrouille}
                          onChange={(ev) => modifierLigne(l.cle, { cout: filtrerMontant(ev.target.value) }, "cout")}
                          onKeyDown={(ev) => surToucheDernierChamp(ev, index)}
                          className={e.cout ? CHAMP_NOMBRE_INVALIDE : CHAMP_NOMBRE}
                        />
                        {e.cout && (
                          <p id={`erreur-${l.cle}-cout`} className="mt-1 text-mc-legende text-rose-700 dark:text-rose-300">
                            {e.cout}
                          </p>
                        )}
                      </td>
                      <td className={CELLULE}>{detail(l, n, e, "montantLigne", true)}</td>
                      <td className={CELLULE}>{detail(l, n, e, "colisage", true)}</td>
                      <td className={CELLULE}>
                        <button
                          type="button"
                          onClick={() => retirerLigne(l.cle)}
                          disabled={verrouille}
                          aria-label={`Retirer la ligne ${n}`}
                          className={ui.bouton.iconePetit}
                        >
                          <Trash2 className={ICONE} aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                    {avertissements.length > 0 && (
                      <tr>
                        <td colSpan={COLONNES} className="px-3 pb-3">
                          {avertissements.map((m) => (
                            <p key={m} role="status" className={`${ui.alerte.attention} mt-2 items-start`}>
                              <AlertCircle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                              <span>{m}</span>
                            </p>
                          ))}
                        </td>
                      </tr>
                    )}
                    {fiche && fiche.qualifie === false && !l.enUnites && (
                      <tr>
                        <td colSpan={COLONNES} className="px-3 pb-3">
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
                                  className={`font-medium underline rounded-mc-petit ${FOCUS}`}
                                >
                                  Ouvrir le stock dans un nouvel onglet
                                </Link>
                                <button
                                  type="button"
                                  onClick={reessayerChargement}
                                  disabled={verrouille}
                                  className={`h-mc-controle-petit px-3 rounded-mc-moyen text-mc-petit font-medium hover:bg-amber-100 dark:hover:bg-amber-500/20 disabled:opacity-60 ${FOCUS}`}
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

        <p id="aide-cout" className="text-mc-normal text-slate-600 dark:text-slate-400">
          Sans coût, la marge de ce lot restera inconnue.
        </p>
        <p className="text-mc-normal text-slate-600 dark:text-slate-400">
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

        <div className="flex justify-end">
          <div className="w-full max-w-sm space-y-2 rounded-mc-moyen border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/50">
            {MONTANTS_ENTETE.map((c) => {
              const erreur = erreursEntete[c];
              const fort = c === "netAPayer";
              return (
                <div key={c}>
                  <div className="flex items-center justify-between gap-3">
                    <label
                      htmlFor={`facture-${c}`}
                      className={`text-mc-legende uppercase tracking-wide ${fort ? "font-semibold text-slate-900 dark:text-slate-100" : "font-medium text-slate-600 dark:text-slate-400"}`}
                    >
                      {LIBELLES_PIED[c]}
                    </label>
                    <input
                      id={`facture-${c}`}
                      data-champ={`entete:${c}`}
                      type="text"
                      inputMode="numeric"
                      aria-label={`${LIBELLES_ENTETE[c]} (GNF)`}
                      value={entete[c]}
                      readOnly={verrouille}
                      aria-invalid={erreur ? true : undefined}
                      aria-describedby={erreur ? `erreur-facture-${c}` : undefined}
                      onChange={(ev) => {
                        setEntete((prev) => ({ ...prev, [c]: filtrerMontant(ev.target.value) }));
                        if (erreur) setErreursEntete((prev) => ({ ...prev, [c]: undefined }));
                      }}
                      className={`${erreur ? CHAMP_NOMBRE_INVALIDE : CHAMP_NOMBRE} ${fort ? "font-semibold" : ""}`}
                    />
                  </div>
                  {erreur && (
                    <p id={`erreur-facture-${c}`} className="mt-1 text-right text-mc-legende text-rose-700 dark:text-rose-300">
                      {erreur}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        {avertissementSomme && (
          <p role="status" className={`${ui.alerte.attention} items-start`}>
            <AlertCircle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
            <span>
              La somme des montants des lignes ({formaterGNF(avertissementSomme.somme)}) est différente du montant HT de la facture (
              {formaterGNF(avertissementSomme.montantHT)}). Vérifiez votre saisie : l&apos;enregistrement reste possible.
            </span>
          </p>
        )}
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
                  className={`h-mc-controle-petit px-3 rounded-mc-moyen text-mc-petit font-semibold bg-rose-700 text-white hover:bg-rose-800 disabled:opacity-60 ${FOCUS}`}
                >
                  Réessayer l&apos;envoi
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmationModif(true)}
                  disabled={envoi}
                  className={`h-mc-controle-petit px-3 rounded-mc-moyen text-mc-petit font-medium hover:bg-rose-100 dark:hover:bg-rose-500/20 disabled:opacity-60 ${FOCUS}`}
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
                    className={`h-mc-controle-petit px-3 rounded-mc-moyen text-mc-petit font-semibold bg-rose-700 text-white hover:bg-rose-800 ${FOCUS}`}
                  >
                    Modifier
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmationModif(false)}
                    className={`h-mc-controle-petit px-3 rounded-mc-moyen text-mc-petit font-medium hover:bg-rose-100 dark:hover:bg-rose-500/20 ${FOCUS}`}
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
        <p aria-live="polite" className="text-mc-normal font-medium text-slate-900 dark:text-white">
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
