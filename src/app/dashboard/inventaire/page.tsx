"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { AlertCircle, CircleCheck, Loader2, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { messageErreurPour } from "@/hooks/useToast";
import { nouvelleCleIdempotence } from "@/lib/api_carnet";
import {
  enregistrerInventaire,
  getMyStock,
  listerLotsFiche,
  type CorpsInventaire,
  type Inventaire,
  type LigneInventaireDemandee,
  type LigneInventaireEcrite,
  type LotEnStock,
  type StockMedicament,
  type UniteMinimale,
} from "@/lib/api_pharmacie";
import { LIBELLES_UNITE_MINIMALE, formaterQuantite } from "@/lib/caisse/regles/quantites";
import { afficherDatePeremption, lireDatePeremption } from "@/lib/date_peremption";
import { champsErreur, codeErreur, detailsErreur, estErreurReseau } from "@/lib/erreurs_api";
import {
  ALERTE_ATTENTION,
  ALERTE_ERREUR,
  ALERTE_INFO,
  BOUTON_ICONE,
  BOUTON_PRIMAIRE,
  BOUTON_SECONDAIRE,
  CARTE,
  CHAMP,
  FOCUS,
  POLICE_TITRE,
} from "@/components/pharmacie/classes";
import { coefficientDuLot } from "@/components/pharmacie/ChoixLot";
import { ErreurAvecReessai } from "@/components/pharmacie/ErreurAvecReessai";
import { formaterDateCourte, jourConakry } from "../ventes/affichage";
import { rechercherDansStock } from "../vente/panier";

const CHAMP_INVALIDE = CHAMP.replace("border-slate-200 dark:border-slate-800", "border-rose-500 dark:border-rose-500");
const ICONE = "w-4 h-4 text-slate-600 dark:text-slate-400";

const SUGGESTIONS_MAX = 8;
const LIGNES_MAX = 500;
// Plafonds du back (`LigneInventaireDto`) : 1 000 000 boîtes, 1 000 000 000 unités en plus.
const BOITES_MAX = 1_000_000;
const UNITES_MAX = 1_000_000_000;
const NOMBRE_ENTIER = /^\d+$/;

const MSG_PROBLEME = "Un problème est survenu, réessayez dans un instant.";
const MSG_CHARGEMENT = "Impossible d'afficher le stock. Vérifiez votre connexion puis réessayez.";
const MSG_LOTS = "Les lots de ce médicament n'ont pas pu être affichés. Vérifiez votre connexion puis réessayez.";
const MSG_COMPTAGE = "Saisissez au moins un comptage, et la date de péremption des lots ajoutés.";
const MSG_RESEAU =
  "L'inventaire n'a peut-être pas été enregistré. Vérifiez votre connexion puis appuyez sur « Réessayer l'envoi » : il ne sera pas enregistré deux fois.";
const MSG_CONFIRMER_MODIFICATION =
  "Avant de modifier, vérifiez sur la page du stock que ces quantités n'ont pas déjà été enregistrées. Continuer ?";
const MSG_PEREMPTION_REFUSEE = "Vérifiez cette date de péremption.";
const AIDE_LOT_VIDE = "Un lot laissé vide n'est pas modifié. Saisissez 0 pour un lot absent du rayon.";
const AIDE_AUTRE_LOT = "Pour un lot qui n'est pas dans la liste : la date de péremption suffit.";

type Genre = "propose" | "stock" | "autre";
type Champ = "boites" | "unites" | "peremption";
type ErreursLigne = Partial<Record<Champ, string>>;

interface LigneCompte {
  cle: number;
  genre: Genre;
  lotId: string | null;
  /** Libellé du lot proposé, sans quantité : le comptage se fait à l'aveugle (D699). */
  libelle: string;
  /** Unités par boîte du lot (D709) : une boîte entamée se saisit en unités seulement au-delà de 1. */
  coefficient: number;
  boites: string;
  unites: string;
  peremption: string;
  /** Vrai une fois le champ quitté : la date lue ou le refus s'affiche alors sous le champ. */
  vue: boolean;
  sansDate: boolean;
}

interface BlocFiche {
  stockId: string;
  statut: "chargement" | "pret" | "erreur";
  lignes: LigneCompte[];
  /**
   * Comptage de la ligne « Stock de ce médicament » retirée après un refus « lot requis »,
   * rappelé en lecture seule au-dessus des lots, jamais réparti automatiquement (D589, D710).
   */
  rappel: string | null;
}

/** Lot cité par un refus « lot requis » (`details[].lots`), sans quantité ni unités par boîte. */
interface LotCite {
  lotId: string;
  numeroLot: string | null;
  dateExpiration: string | null;
}

interface Succes {
  inventaire: Inventaire;
  message: string;
}

const entier = (texte: string): number | null => {
  const net = texte.replace(/\s/g, "");
  if (!NOMBRE_ENTIER.test(net)) return null;
  const n = Number(net);
  return Number.isSafeInteger(n) && n <= 2147483647 ? n : null;
};

const CHAMP_SERVEUR: Record<string, Champ> = {
  quantiteComptee: "boites",
  nombreBoites: "boites",
  unitesEnPlus: "unites",
  lotId: "boites",
  dateExpiration: "peremption",
  sansPeremption: "peremption",
};

const MESSAGE_CHAMP_SERVEUR: Record<Champ, string> = {
  boites: "Vérifiez cette quantité.",
  unites: "Vérifiez cette quantité.",
  peremption: MSG_PEREMPTION_REFUSEE,
};

/** Champs d'une ligne dans l'ordre de saisie (Entrée passe au suivant). */
function champsDe(l: LigneCompte): Champ[] {
  const unites: Champ[] = l.coefficient > 1 ? ["unites"] : [];
  return l.genre === "autre" ? ["peremption", "boites", ...unites] : ["boites", ...unites, ...(l.genre === "stock" ? (["peremption"] as Champ[]) : [])];
}

/** Libellé d'un lot proposé, sans quantité : « Lot DL23K052, expire le 30/06/2028 ». */
function libelleLotAveugle(lot: { numeroLot: string | null; dateExpiration: string | null }, aujourdhui: string): string {
  const numero = lot.numeroLot ? `Lot ${lot.numeroLot}` : "Lot sans numéro";
  let date = "sans date";
  if (lot.dateExpiration) {
    const perime = lot.dateExpiration.slice(0, 10) < aujourdhui;
    date = `${perime ? "périmé le" : "expire le"} ${formaterDateCourte(lot.dateExpiration)}`;
  }
  return `${numero}, ${date}`;
}

/**
 * Rappel du comptage saisi sur « Stock de ce médicament », valeurs telles que saisies :
 * « Vous aviez compté 4 boîtes et 6 comprimés pour ce médicament : ... ». Null si rien n'était compté.
 */
function rappelComptage(l: LigneCompte, unite: UniteMinimale): string | null {
  const boites = l.boites.trim() === "" ? null : (entier(l.boites) ?? null);
  const unites = l.unites.trim() === "" ? null : (entier(l.unites) ?? null);
  if (boites === null && unites === null) return null;
  const libelle = LIBELLES_UNITE_MINIMALE[unite];
  const morceaux: string[] = [];
  if (boites !== null) morceaux.push(`${boites.toLocaleString("fr-FR")} ${boites > 1 ? "boîtes" : "boîte"}`);
  if (unites !== null && unites > 0) morceaux.push(`${unites.toLocaleString("fr-FR")} ${unites > 1 ? libelle.pluriel : libelle.singulier}`);
  if (morceaux.length === 0) morceaux.push(`0 ${libelle.singulier}`);
  return `Vous aviez compté ${morceaux.join(" et ")} pour ce médicament : répartissez ce comptage entre les lots ci-dessous.`;
}

/** Écart signé en unités : « +16 comprimés », « -5 comprimés » ; en boîtes quand la fiche n'a qu'une unité par boîte. */
function ecartLisible(ecart: number, coefficient: number, unite: UniteMinimale): string {
  const absolu = Math.abs(ecart);
  const signe = ecart > 0 ? "+" : ecart < 0 ? "-" : "";
  if (coefficient <= 1) return `${signe}${formaterQuantite(absolu, 1, unite)}`;
  const libelle = LIBELLES_UNITE_MINIMALE[unite];
  return `${signe}${absolu.toLocaleString("fr-FR")} ${absolu > 1 ? libelle.pluriel : libelle.singulier}`;
}

const classeEcart = (l: LigneInventaireEcrite): string => {
  if (l.sousTolerance || l.ecart === 0) return "text-slate-900 dark:text-white";
  return l.ecart < 0 ? "text-rose-700 dark:text-rose-300" : "text-amber-700 dark:text-amber-300";
};

export default function InventairePage() {
  const { user, loading } = useAuth();
  const structureId = user?.structureId;

  const [stock, setStock] = useState<StockMedicament[] | null>(null);
  const [erreurChargement, setErreurChargement] = useState<string | null>(null);
  const [essai, setEssai] = useState(0);

  const [cleInventaire, setCleInventaire] = useState(() => nouvelleCleIdempotence());
  const [blocs, setBlocs] = useState<BlocFiche[]>([]);
  const [commentaire, setCommentaire] = useState("");
  const [erreurs, setErreurs] = useState<Record<number, ErreursLigne>>({});

  const [recherche, setRecherche] = useState("");
  const [rechercheActive, setRechercheActive] = useState(false);
  const [indexSuggestion, setIndexSuggestion] = useState(0);

  const [bandeau, setBandeau] = useState<string | null>(null);
  const [reessayable, setReessayable] = useState(false);
  const [confirmationModif, setConfirmationModif] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [succes, setSucces] = useState<Succes | null>(null);

  const prochaineCle = useRef(1);
  const zoneBlocs = useRef<HTMLDivElement>(null);
  const focusAFaire = useRef<string | null>(null);
  const envoiEnCours = useRef(false);
  const corpsEnvoye = useRef<CorpsInventaire | null>(null);
  const clesEnvoyees = useRef<number[]>([]);
  const boutonEnvoi = useRef<HTMLButtonElement>(null);
  const titreSucces = useRef<HTMLHeadingElement>(null);

  const focaliser = (cle: string) => zoneBlocs.current?.querySelector<HTMLElement>(`[data-champ="${cle}"]`)?.focus();

  // Saisie verrouillée pendant un envoi et tant que son résultat est inconnu (D688).
  const verrouille = envoi || reessayable;

  useEffect(() => {
    if (!structureId) return;
    let actif = true;
    getMyStock(structureId)
      .then((s) => {
        if (!actif) return;
        const fiches = s.data.stocks.filter((x) => !x.archiveLe);
        setStock(fiches);
        setErreurChargement(null);
        // Une fiche disparue depuis le dernier chargement sort de l'inventaire.
        setBlocs((prev) => prev.filter((b) => fiches.some((x) => x.id === b.stockId)));
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

  const fiches = stock ?? [];
  const ficheDe = (stockId: string) => fiches.find((s) => s.id === stockId);
  const aujourdhui = jourConakry(new Date());

  const nouvelleLigne = (genre: Genre, coefficient: number, surcharge: Partial<LigneCompte> = {}): LigneCompte => ({
    cle: prochaineCle.current++,
    genre,
    lotId: null,
    libelle: "",
    coefficient,
    boites: "",
    unites: "",
    peremption: "",
    vue: false,
    sansDate: false,
    ...surcharge,
  });

  /**
   * Charge les lots d'une fiche et les fusionne avec la saisie : un lot déjà affiché garde son
   * comptage, les lignes « Autre lot » sont conservées, la ligne « Stock de ce médicament » ne
   * reste que s'il n'y a aucun lot. Chaque lot porte ses unités par boîte (D709).
   * `cites` : lots d'un refus « lot requis » ; la saisie reste alors affichée pendant le
   * rechargement, et un lot cité absent de la liste (lot épuisé) ou une liste illisible
   * retombe sur les lots cités, avec les unités par boîte de la fiche.
   */
  const chargerLots = (stockId: string, focaliserApres: boolean, cites: LotCite[] = []) => {
    if (!structureId) return;
    const coefFiche = ficheDe(stockId)?.coefficientBoite ?? 1;
    const ligneCitee = (lot: LotCite) =>
      nouvelleLigne("propose", coefFiche, { lotId: lot.lotId, libelle: libelleLotAveugle(lot, aujourdhui) });
    const appliquer = (candidates: LigneCompte[]) => {
      const stockNeuve = nouvelleLigne("stock", coefFiche);
      setBlocs((prev) =>
        prev.map((b) => {
          if (b.stockId !== stockId) return b;
          const parLot = new Map(b.lignes.flatMap((l) => (l.genre === "propose" && l.lotId ? [[l.lotId, l] as const] : [])));
          const proposees = candidates.map((c) => {
            const deja = c.lotId ? parLot.get(c.lotId) : undefined;
            return deja ? { ...deja, coefficient: c.coefficient, libelle: c.libelle } : c;
          });
          // Un lot affiché absent de la nouvelle liste garde sa ligne : son comptage n'est pas perdu.
          const vus = new Set(candidates.map((c) => c.lotId));
          const restantes = b.lignes.filter((l) => l.genre === "propose" && !vus.has(l.lotId));
          const lots = [...proposees, ...restantes];
          const autres = b.lignes.filter((l) => l.genre === "autre");
          const lignes = lots.length > 0 ? [...lots, ...autres] : [b.lignes.find((l) => l.genre === "stock") ?? stockNeuve, ...autres];
          if (focaliserApres) focusAFaire.current = `${lignes[0].cle}:${lignes[0].genre === "autre" ? "peremption" : "boites"}`;
          return { ...b, statut: "pret", lignes };
        }),
      );
    };
    if (cites.length === 0) setBlocs((prev) => prev.map((b) => (b.stockId === stockId ? { ...b, statut: "chargement" } : b)));
    listerLotsFiche(structureId, stockId)
      .then((res) => {
        const recus = res.data.map((lot: LotEnStock) =>
          nouvelleLigne("propose", coefficientDuLot(lot, coefFiche), { lotId: lot.id, libelle: libelleLotAveugle(lot, aujourdhui) }),
        );
        const ids = new Set(res.data.map((lot) => lot.id));
        appliquer([...recus, ...cites.filter((lot) => !ids.has(lot.lotId)).map(ligneCitee)]);
      })
      .catch(() => {
        if (cites.length > 0) appliquer(cites.map(ligneCitee));
        else setBlocs((prev) => prev.map((b) => (b.stockId === stockId ? { ...b, statut: "erreur" } : b)));
      });
  };

  const ajouterFiche = (fiche: StockMedicament) => {
    if (verrouille || blocs.some((b) => b.stockId === fiche.id)) return;
    setBlocs((prev) => [...prev, { stockId: fiche.id, statut: "chargement", lignes: [], rappel: null }]);
    setRecherche("");
    setRechercheActive(false);
    setIndexSuggestion(0);
    chargerLots(fiche.id, true);
  };

  const retirerFiche = (stockId: string) => {
    const bloc = blocs.find((b) => b.stockId === stockId);
    setBlocs((prev) => prev.filter((b) => b.stockId !== stockId));
    if (bloc) {
      setErreurs((prev) => {
        const reste = { ...prev };
        for (const l of bloc.lignes) delete reste[l.cle];
        return reste;
      });
    }
  };

  const modifierLigne = (cle: number, changement: Partial<LigneCompte>, champEfface?: Champ) => {
    setBlocs((prev) => prev.map((b) => ({ ...b, lignes: b.lignes.map((l) => (l.cle === cle ? { ...l, ...changement } : l)) })));
    if (champEfface) {
      setErreurs((prev) => {
        if (!prev[cle]?.[champEfface]) return prev;
        const reste = { ...prev[cle] };
        delete reste[champEfface];
        return { ...prev, [cle]: reste };
      });
    }
  };

  const ajouterAutreLot = (stockId: string) => {
    if (verrouille) return;
    const coefFiche = ficheDe(stockId)?.coefficientBoite ?? 1;
    const ligne = nouvelleLigne("autre", coefFiche);
    setBlocs((prev) => prev.map((b) => (b.stockId === stockId ? { ...b, lignes: [...b.lignes, ligne] } : b)));
    focusAFaire.current = `${ligne.cle}:peremption`;
  };

  const retirerLigne = (stockId: string, cle: number) => {
    if (verrouille) return;
    setBlocs((prev) => prev.map((b) => (b.stockId === stockId ? { ...b, lignes: b.lignes.filter((l) => l.cle !== cle) } : b)));
    setErreurs((prev) => {
      const reste = { ...prev };
      delete reste[cle];
      return reste;
    });
  };

  const suggestions =
    rechercheActive && recherche.trim() !== ""
      ? rechercherDansStock(
          fiches.filter((f) => !blocs.some((b) => b.stockId === f.id)),
          recherche,
        ).slice(0, SUGGESTIONS_MAX)
      : [];
  const aucunResultat = rechercheActive && recherche.trim() !== "" && suggestions.length === 0;

  const surToucheRecherche = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && suggestions.length > 0) {
      e.preventDefault();
      setIndexSuggestion((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp" && suggestions.length > 0) {
      e.preventDefault();
      setIndexSuggestion((i) => Math.max(i - 1, 0));
    } else if (e.key === "Escape") {
      setRechercheActive(false);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (suggestions.length > 0) ajouterFiche(suggestions[Math.min(indexSuggestion, suggestions.length - 1)]);
    }
  };

  // Entrée passe au champ suivant du comptage (rayon), sans jamais envoyer.
  const surToucheChamp = (e: KeyboardEvent<HTMLInputElement>, cle: number, champ: Champ) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (verrouille) return;
    const suite: string[] = [];
    for (const b of blocs) for (const l of b.lignes) for (const c of champsDe(l)) suite.push(`${l.cle}:${c}`);
    const position = suite.indexOf(`${cle}:${champ}`);
    const suivant = position >= 0 ? suite[position + 1] : undefined;
    if (suivant) focaliser(suivant);
    else boutonEnvoi.current?.focus();
  };

  const gererEchec = (err: unknown) => {
    setEnvoi(false);
    if (estErreurReseau(err)) {
      setReessayable(true);
      setBandeau(MSG_RESEAU);
      return;
    }
    setReessayable(false);
    const code = codeErreur(err);
    setBandeau(messageErreurPour(err, MSG_PROBLEME));
    // Lignes signalées, repérées par leur rang dans le corps envoyé (ordre de l'écran).
    const signalees: { rang: number; cle: number; champ: Champ }[] = [];
    const signaler = (rang: number, champ: Champ, texte: string) => {
      const cle = clesEnvoyees.current[rang];
      if (cle === undefined) return;
      signalees.push({ rang, cle, champ });
      setErreurs((prev) => ({ ...prev, [cle]: { ...prev[cle], [champ]: texte } }));
    };

    if (code === "VALIDATION") {
      for (const { champ } of champsErreur(err)) {
        const m = /^lignes\.(\d+)\.(\w+)$/.exec(champ);
        if (!m) continue;
        const cible = CHAMP_SERVEUR[m[2]];
        if (!cible) continue;
        const texte = m[2] === "lotId" ? "Ce lot est compté deux fois : gardez une seule ligne par lot." : MESSAGE_CHAMP_SERVEUR[cible];
        signaler(Number(m[1]), cible, texte);
      }
    } else if (code === "DATE_PEREMPTION_REQUISE") {
      // Le serveur ne cite que la fiche : ses lignes sans lot connu sont signalées.
      const citees = detailsErreur(err).map((d) => d.stockId);
      (corpsEnvoye.current?.lignes ?? []).forEach((l, i) => {
        if (!l.lotId && citees.includes(l.stockId)) signaler(i, "peremption", MSG_PEREMPTION_REFUSEE);
      });
    } else if (code === "LOT_REQUIS") {
      // Les lots de la fiche sont relus (unités par boîte de chaque lot, D709) ; la quantité des
      // lots cités n'est jamais lue (comptage à l'aveugle, D699). Le comptage de la ligne « Stock de
      // ce médicament » est rappelé, sans être réparti entre les lots (D589, D710).
      for (const d of detailsErreur(err)) {
        const stockId = typeof d.stockId === "string" ? d.stockId : null;
        if (stockId === null) continue;
        const cites: LotCite[] = [];
        for (const lot of Array.isArray(d.lots) ? (d.lots as Record<string, unknown>[]) : []) {
          const lotId = typeof lot.lotId === "string" ? lot.lotId : typeof lot.id === "string" ? lot.id : null;
          if (lotId === null) continue;
          cites.push({
            lotId,
            numeroLot: typeof lot.numeroLot === "string" ? lot.numeroLot : null,
            dateExpiration: typeof lot.dateExpiration === "string" ? lot.dateExpiration : null,
          });
        }
        const ligneStock = blocs.find((b) => b.stockId === stockId)?.lignes.find((l) => l.genre === "stock");
        const rappel = ligneStock ? rappelComptage(ligneStock, ficheDe(stockId)?.uniteMinimale ?? "UNITE") : null;
        if (rappel !== null) setBlocs((prev) => prev.map((b) => (b.stockId === stockId ? { ...b, rappel } : b)));
        chargerLots(stockId, true, cites);
      }
    } else if (code === "IDENTIFIANT_DEJA_UTILISE") {
      setCleInventaire(nouvelleCleIdempotence());
    }

    if (signalees.length > 0) {
      const ordre: Champ[] = ["peremption", "boites", "unites"];
      const premiere = signalees.reduce((a, b) =>
        b.rang < a.rang || (b.rang === a.rang && ordre.indexOf(b.champ) < ordre.indexOf(a.champ)) ? b : a,
      );
      focusAFaire.current = `${premiere.cle}:${premiere.champ}`;
    }
  };

  const envoyer = (corps: CorpsInventaire) => {
    if (!structureId || envoiEnCours.current) return;
    envoiEnCours.current = true;
    setEnvoi(true);
    setBandeau(null);
    setReessayable(false);
    setConfirmationModif(false);
    enregistrerInventaire(structureId, corps)
      .then((res) => {
        envoiEnCours.current = false;
        setEnvoi(false);
        setSucces({ inventaire: res.data, message: res.message });
      })
      .catch((err: unknown) => {
        envoiEnCours.current = false;
        gererEchec(err);
      });
  };

  const valider = () => {
    if (verrouille) return;
    const nouvellesErreurs: Record<number, ErreursLigne> = {};
    const demandees: LigneInventaireDemandee[] = [];
    const cles: number[] = [];
    let premier: string | null = null;

    for (const bloc of blocs) {
      for (const l of bloc.lignes) {
        const comptee = l.boites.trim() !== "" || l.unites.trim() !== "";
        const touchee = comptee || (l.genre === "autre" && (l.peremption.trim() !== "" || l.sansDate));
        if (!touchee) continue;
        const e: ErreursLigne = {};
        const ligne: LigneInventaireDemandee = { stockId: bloc.stockId };
        if (l.genre === "propose" && l.lotId) ligne.lotId = l.lotId;

        let boites = 0;
        if (l.boites.trim() === "") {
          if (l.genre === "autre" && l.unites.trim() === "") e.boites = "Indiquez le nombre de boîtes.";
        } else {
          const n = entier(l.boites);
          if (n === null || n > BOITES_MAX) e.boites = "Indiquez un nombre entier de boîtes, 0 ou plus.";
          else boites = n;
        }
        let unitesEnPlus = 0;
        if (l.unites.trim() !== "") {
          const n = entier(l.unites);
          if (n === null || n > UNITES_MAX) e.unites = "Indiquez un nombre entier, 0 ou plus.";
          else unitesEnPlus = n;
        }

        if (l.genre === "autre" && l.sansDate) {
          ligne.sansPeremption = true;
        } else if (l.peremption.trim() === "") {
          if (l.genre === "autre") e.peremption = "Indiquez la date de péremption ou cochez « Sans date ».";
        } else if (l.genre !== "propose") {
          const lue = lireDatePeremption(l.peremption);
          if (lue.ok) ligne.dateExpiration = lue.jour;
          else e.peremption = lue.message;
        }

        if (Object.keys(e).length > 0) {
          nouvellesErreurs[l.cle] = e;
          if (premier === null) {
            const champ = champsDe(l).find((c) => e[c] !== undefined);
            if (champ) premier = `${l.cle}:${champ}`;
          }
        }
        ligne.nombreBoites = boites;
        if (unitesEnPlus > 0) ligne.unitesEnPlus = unitesEnPlus;
        demandees.push(ligne);
        cles.push(l.cle);
      }
    }

    setErreurs(nouvellesErreurs);
    setBlocs((prev) => prev.map((b) => ({ ...b, lignes: b.lignes.map((l) => ({ ...l, vue: true })) })));
    if (premier !== null || demandees.length === 0) {
      setBandeau(MSG_COMPTAGE);
      if (premier !== null) focaliser(premier);
      return;
    }
    if (demandees.length > LIGNES_MAX) {
      setBandeau("Un inventaire ne peut pas dépasser 500 lignes : enregistrez-le en plusieurs fois.");
      return;
    }

    const corps: CorpsInventaire = {
      id: cleInventaire,
      ...(commentaire.trim() !== "" ? { commentaire: commentaire.trim() } : {}),
      lignes: demandees,
    };
    corpsEnvoye.current = corps;
    clesEnvoyees.current = cles;
    envoyer(corps);
  };

  const modifierLaSaisie = () => {
    setCleInventaire(nouvelleCleIdempotence());
    setReessayable(false);
    setConfirmationModif(false);
    setBandeau(null);
  };

  const nouvelInventaire = () => {
    setSucces(null);
    setCleInventaire(nouvelleCleIdempotence());
    setBlocs([]);
    setCommentaire("");
    setErreurs({});
    setRecherche("");
    setBandeau(null);
    setReessayable(false);
    setConfirmationModif(false);
    setEssai((n) => n + 1);
  };

  const enTete = (
    <div>
      <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white" style={POLICE_TITRE}>
        Inventaire
      </h1>
      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
        Comptez vos boîtes lot par lot. Les quantités saisies remplacent celles enregistrées.
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
    const { inventaire, message } = succes;
    // Unités par boîte de chaque lot compté : celles du lot proposé, sinon celles de la fiche (D709).
    const coefficientParLot = new Map<string, number>();
    for (const b of blocs) for (const l of b.lignes) if (l.lotId) coefficientParLot.set(l.lotId, l.coefficient);
    return (
      <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
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
          {inventaire.cree === false && (
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Cet inventaire était déjà enregistré : rien n&apos;a été compté deux fois.
            </p>
          )}
          {(inventaire.avertissements ?? []).map((a) => (
            <p key={a.stockId} role="status" className={ALERTE_ATTENTION}>
              <AlertCircle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
              <span>
                {a.message} ({a.nom})
              </span>
            </p>
          ))}
          <div className="w-full overflow-x-auto">
            <table className="w-full text-sm text-left">
              <caption className="sr-only">Résultat du comptage, une ligne par lot</caption>
              <thead>
                <tr className="text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                  <th scope="col" className="py-2 pr-3 font-semibold">Médicament</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">Lot</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">Attendu</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">Compté</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">Écart</th>
                  <th scope="col" className="py-2 font-semibold">Signalé au titulaire</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {inventaire.lignes.map((l) => {
                  const fiche = ficheDe(l.stockId);
                  const unite = fiche?.uniteMinimale ?? "UNITE";
                  const coefficient = coefficientParLot.get(l.lotId) ?? fiche?.coefficientBoite ?? 1;
                  const lot = `${l.numeroLot ? l.numeroLot : "Lot sans numéro"}, ${
                    l.dateExpiration ? afficherDatePeremption(l.dateExpiration) : "sans date"
                  }`;
                  return (
                    <tr key={l.id} className="align-top">
                      <th scope="row" className="py-3 pr-3 font-medium text-slate-900 dark:text-white">{l.nom}</th>
                      <td className="py-3 pr-3 text-slate-800 dark:text-slate-200">{lot}</td>
                      <td className="py-3 pr-3 text-slate-800 dark:text-slate-200">
                        {formaterQuantite(l.quantiteTheorique, coefficient, unite)}
                      </td>
                      <td className="py-3 pr-3 text-slate-800 dark:text-slate-200">
                        {formaterQuantite(l.quantiteComptee, coefficient, unite)}
                      </td>
                      <td className={`py-3 pr-3 font-semibold ${classeEcart(l)}`}>{ecartLisible(l.ecart, coefficient, unite)}</td>
                      <td className="py-3 text-slate-800 dark:text-slate-200">{l.anomalieId ? "Oui" : "Non"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button type="button" onClick={nouvelInventaire} className={BOUTON_PRIMAIRE}>
              Nouvel inventaire
            </button>
            <Link href="/dashboard/stock" className={BOUTON_SECONDAIRE}>
              Voir le stock
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (stock === null) {
    return (
      <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
        {enTete}
        {erreurChargement === null ? (
          <div role="status" className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
            Chargement du stock...
          </div>
        ) : (
          <ErreurAvecReessai
            message={erreurChargement}
            onReessayer={() => {
              setErreurChargement(null);
              setEssai((n) => n + 1);
            }}
          />
        )}
      </div>
    );
  }

  const ligneEn = (l: LigneCompte, stockId: string, nom: string, unite: UniteMinimale) => {
    const e = erreurs[l.cle] ?? {};
    const lecture = l.vue && !l.sansDate && l.peremption.trim() !== "" ? lireDatePeremption(l.peremption) : null;
    const messagePeremption = e.peremption ?? (lecture && !lecture.ok ? lecture.message : null);
    const dateLue = lecture && lecture.ok ? afficherDatePeremption(lecture.jour) : null;
    const libelleUnites = LIBELLES_UNITE_MINIMALE[unite].pluriel;
    const titre = l.genre === "propose" ? l.libelle : l.genre === "stock" ? "Stock de ce médicament" : "Autre lot trouvé en rayon";
    const champPeremption = l.genre !== "propose" && (
      <div className="w-44">
        <label htmlFor={`peremption-${l.cle}`} className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">
          {l.genre === "stock" ? "Péremption (si nouveau lot)" : "Péremption"}
        </label>
        <input
          id={`peremption-${l.cle}`}
          data-champ={`${l.cle}:peremption`}
          type="text"
          placeholder="06/28"
          aria-invalid={messagePeremption ? true : undefined}
          aria-describedby={messagePeremption || dateLue ? `info-${l.cle}-peremption` : undefined}
          value={l.peremption}
          readOnly={verrouille}
          disabled={l.sansDate}
          onChange={(ev) => modifierLigne(l.cle, { peremption: ev.target.value, vue: false }, "peremption")}
          onBlur={() => modifierLigne(l.cle, { vue: true })}
          onKeyDown={(ev) => surToucheChamp(ev, l.cle, "peremption")}
          className={`${messagePeremption ? CHAMP_INVALIDE : CHAMP} disabled:opacity-60`}
        />
        {messagePeremption ? (
          <p id={`info-${l.cle}-peremption`} className="mt-1 text-sm text-rose-700 dark:text-rose-300">
            {messagePeremption}
          </p>
        ) : (
          dateLue && (
            <p id={`info-${l.cle}-peremption`} className="mt-1 text-sm text-slate-700 dark:text-slate-300">
              {dateLue}
            </p>
          )
        )}
        {l.genre === "autre" && (
          <label className="mt-2 flex items-center gap-2 text-sm text-slate-800 dark:text-slate-200">
            <input
              type="checkbox"
              checked={l.sansDate}
              disabled={verrouille}
              onChange={(ev) => modifierLigne(l.cle, { sansDate: ev.target.checked }, "peremption")}
              className={`w-5 h-5 rounded accent-primary-600 ${FOCUS}`}
            />
            Sans date
          </label>
        )}
      </div>
    );
    const champBoites = (
      <div className="w-28">
        <label htmlFor={`boites-${l.cle}`} className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">
          Boîtes
        </label>
        <input
          id={`boites-${l.cle}`}
          data-champ={`${l.cle}:boites`}
          type="text"
          inputMode="numeric"
          aria-invalid={e.boites ? true : undefined}
          aria-describedby={e.boites ? `erreur-${l.cle}-boites` : undefined}
          value={l.boites}
          readOnly={verrouille}
          onChange={(ev) => modifierLigne(l.cle, { boites: ev.target.value }, "boites")}
          onKeyDown={(ev) => surToucheChamp(ev, l.cle, "boites")}
          className={e.boites ? CHAMP_INVALIDE : CHAMP}
        />
      </div>
    );
    const champUnites = l.coefficient > 1 && (
      <div className="w-36">
        <label htmlFor={`unites-${l.cle}`} className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">
          {libelleUnites} en plus
        </label>
        <input
          id={`unites-${l.cle}`}
          data-champ={`${l.cle}:unites`}
          type="text"
          inputMode="numeric"
          aria-invalid={e.unites ? true : undefined}
          aria-describedby={e.unites ? `erreur-${l.cle}-unites` : undefined}
          value={l.unites}
          readOnly={verrouille}
          onChange={(ev) => modifierLigne(l.cle, { unites: ev.target.value }, "unites")}
          onKeyDown={(ev) => surToucheChamp(ev, l.cle, "unites")}
          className={e.unites ? CHAMP_INVALIDE : CHAMP}
        />
      </div>
    );
    return (
      <fieldset key={l.cle} className="min-w-0 border-0 m-0 p-0 py-4">
        <legend className="text-sm font-semibold text-slate-900 dark:text-white mb-3 float-left w-full">{titre}</legend>
        <div className="clear-both flex flex-wrap items-start gap-3">
          {l.genre === "autre" ? (
            <>
              {champPeremption}
              {champBoites}
              {champUnites}
            </>
          ) : (
            <>
              {champBoites}
              {champUnites}
              {champPeremption}
            </>
          )}
          {l.genre === "autre" && (
            <button
              type="button"
              onClick={() => retirerLigne(stockId, l.cle)}
              disabled={verrouille}
              aria-label={`Retirer ce lot trouvé en rayon, ${nom}`}
              className={`${BOUTON_ICONE} mt-9`}
            >
              <Trash2 className={ICONE} aria-hidden="true" />
            </button>
          )}
        </div>
        {e.boites && (
          <p id={`erreur-${l.cle}-boites`} className="mt-1 text-sm text-rose-700 dark:text-rose-300">
            {e.boites}
          </p>
        )}
        {e.unites && (
          <p id={`erreur-${l.cle}-unites`} className="mt-1 text-sm text-rose-700 dark:text-rose-300">
            {e.unites}
          </p>
        )}
      </fieldset>
    );
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      {enTete}

      <section className={`${CARTE} space-y-3`} aria-labelledby="titre-ajout">
        <h2 id="titre-ajout" className="text-lg font-semibold text-slate-900 dark:text-white" style={POLICE_TITRE}>
          Ajouter un médicament à compter
        </h2>
        <div>
          <label htmlFor="recherche-inventaire" className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">
            Nom ou nom générique
          </label>
          <input
            id="recherche-inventaire"
            type="text"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={suggestions.length > 0}
            aria-controls="suggestions-inventaire"
            aria-activedescendant={suggestions.length > 0 ? `suggestions-inventaire-${Math.min(indexSuggestion, suggestions.length - 1)}` : undefined}
            autoComplete="off"
            value={recherche}
            readOnly={verrouille}
            onChange={(ev) => {
              setRecherche(ev.target.value);
              setRechercheActive(true);
              setIndexSuggestion(0);
            }}
            onFocus={() => setRechercheActive(true)}
            onBlur={() => setRechercheActive(false)}
            onKeyDown={surToucheRecherche}
            className={CHAMP}
          />
          {suggestions.length > 0 && (
            <ul
              id="suggestions-inventaire"
              role="listbox"
              aria-label="Médicaments trouvés"
              className="mt-1 max-h-56 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-800"
            >
              {suggestions.map((s, i) => (
                <li
                  key={s.id}
                  id={`suggestions-inventaire-${i}`}
                  role="option"
                  aria-selected={i === Math.min(indexSuggestion, suggestions.length - 1)}
                  onMouseDown={(ev) => {
                    ev.preventDefault();
                    ajouterFiche(s);
                  }}
                  className={`px-4 py-2 cursor-pointer text-sm text-slate-900 dark:text-white ${
                    i === Math.min(indexSuggestion, suggestions.length - 1)
                      ? "bg-primary-50 dark:bg-primary-500/15"
                      : "hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <span className="font-bold">{s.medicament.nom}</span>
                  {s.medicament.nomGenerique && (
                    <span className="block text-xs text-slate-600 dark:text-slate-400">{s.medicament.nomGenerique}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {aucunResultat && (
            <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
              Aucun médicament à ajouter ne correspond à « {recherche.trim()} ».
            </p>
          )}
        </div>
        {erreurChargement && (
          <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">
            La liste des médicaments n&apos;a pas pu être actualisée. Vérifiez votre connexion puis réessayez.
          </p>
        )}
      </section>

      <div ref={zoneBlocs} className="space-y-6">
        {blocs.length === 0 && (
          <p className="text-sm text-slate-700 dark:text-slate-300">
            Ajoutez les médicaments que vous comptez : leurs lots s&apos;affichent ici, prêts à être comptés.
          </p>
        )}
        {blocs.map((bloc) => {
          const fiche = ficheDe(bloc.stockId);
          const nom = fiche?.medicament.nom ?? "Médicament";
          const unite = fiche?.uniteMinimale ?? "UNITE";
          const aDesLots = bloc.lignes.some((l) => l.genre === "propose");
          return (
            <section key={bloc.stockId} className={CARTE} aria-labelledby={`titre-${bloc.stockId}`}>
              <div className="flex items-start justify-between gap-3">
                <h2 id={`titre-${bloc.stockId}`} className="text-lg font-semibold text-slate-900 dark:text-white" style={POLICE_TITRE}>
                  {nom}
                </h2>
                <button
                  type="button"
                  onClick={() => retirerFiche(bloc.stockId)}
                  disabled={verrouille}
                  aria-label={`Retirer ${nom} de l'inventaire`}
                  className={BOUTON_ICONE}
                >
                  <Trash2 className={ICONE} aria-hidden="true" />
                </button>
              </div>
              {bloc.statut === "chargement" && (
                <div role="status" className="mt-3 flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                  Chargement des lots...
                </div>
              )}
              {bloc.statut === "erreur" && (
                <div className="mt-3">
                  <ErreurAvecReessai message={MSG_LOTS} onReessayer={() => chargerLots(bloc.stockId, false)} />
                </div>
              )}
              {bloc.statut === "pret" && (
                <>
                  {bloc.rappel && (
                    <p className={`${ALERTE_INFO} mt-3 items-start`}>
                      <AlertCircle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                      <span>{bloc.rappel}</span>
                    </p>
                  )}
                  <div className="mt-2 divide-y divide-slate-200 dark:divide-slate-800">
                    {bloc.lignes.map((l) => ligneEn(l, bloc.stockId, nom, unite))}
                  </div>
                  {aDesLots && <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{AIDE_LOT_VIDE}</p>}
                  <div className="mt-4 space-y-2">
                    <button
                      type="button"
                      onClick={() => ajouterAutreLot(bloc.stockId)}
                      disabled={verrouille}
                      className={`${BOUTON_SECONDAIRE} inline-flex items-center gap-2 disabled:opacity-60`}
                    >
                      <Plus className="w-4 h-4" aria-hidden="true" />
                      Autre lot trouvé en rayon
                    </button>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{AIDE_AUTRE_LOT}</p>
                  </div>
                </>
              )}
            </section>
          );
        })}
      </div>

      <section className={`${CARTE} space-y-2`} aria-labelledby="titre-commentaire">
        <h2 id="titre-commentaire" className="sr-only">
          Commentaire
        </h2>
        <label htmlFor="commentaire-inventaire" className="block text-sm font-medium text-slate-800 dark:text-slate-200">
          Commentaire (facultatif)
        </label>
        <textarea
          id="commentaire-inventaire"
          rows={2}
          maxLength={500}
          value={commentaire}
          readOnly={verrouille}
          onChange={(e) => setCommentaire(e.target.value)}
          className={CHAMP}
        />
      </section>

      {bandeau && (
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

      <div className="flex justify-end">
        <button ref={boutonEnvoi} type="button" onClick={valider} disabled={verrouille} className={BOUTON_PRIMAIRE}>
          {envoi && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
          Enregistrer l&apos;inventaire
        </button>
      </div>
    </div>
  );
}
