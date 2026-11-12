"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { X, Pill, Loader2, Save, Plus, Info, AlertCircle, ChevronDown, CheckCircle2 } from "lucide-react";
import {
  getCatalogue,
  Medicament,
  upsertStock,
  createMedicament,
  modifierFiche,
  StockMedicament,
  UniteMinimale,
  CorpsFiche,
} from "@/lib/api_pharmacie";
import { useDialogA11y } from "@/hooks/useDialogA11y";
import { useAuth } from "@/hooks/useAuth";
import Link from "next/link";
import { ALERTE_ATTENTION, ALERTE_ERREUR, BOUTON_PRIMAIRE, FOCUS } from "@/components/pharmacie/classes";
import { ui } from "@/theme/ui";
import { LIBELLES_UNITE_MINIMALE, aArticle, deOuD, formaterARegulariser, formaterQuantite } from "@/lib/caisse/regles/quantites";
import { manqueVenteAuDetail } from "@/lib/caisse/regles/prix";
import { formaterGNF } from "@/lib/format_gnf";
import { afficherDatePeremption, lireDatePeremption } from "@/lib/date_peremption";
import { codeErreur, estErreurReseau } from "@/lib/erreurs_api";

interface StockModalProps {
  isOpen: boolean;
  onClose: () => void;
  structureId: string;
  onSuccess: () => void;
  editItem?: StockMedicament | null; // Optional item to edit
  /** Fiches actives de la pharmacie : un médicament déjà présent ne se rajoute pas par cette fenêtre. */
  fichesActives?: StockMedicament[];
  /** Bascule sur la fenêtre de modification de la fiche d'un médicament déjà en stock choisi à l'ajout. */
  onModifierFiche?: (fiche: StockMedicament) => void;
}

type Conversion = "" | "MULTIPLIER" | "CONSERVER";

interface FormState {
  prixBoite: string;
  unite: UniteMinimale;
  coefficient: string;
  deconditionnable: boolean;
  prixUnite: string;
  tolerance: string;
  quantiteDepart: string;
  datePeremption: string;
  sansPeremption: boolean;
  notes: string;
  confirme: boolean;
  conversion: Conversion;
  // Fields for new medicament
  categorie: string;
  nomGenerique: string;
  ordonnanceRequise: boolean;
}

const formVide = (): FormState => ({
  prixBoite: "",
  unite: "UNITE",
  coefficient: "1",
  deconditionnable: false,
  prixUnite: "",
  tolerance: "",
  quantiteDepart: "",
  datePeremption: "",
  sansPeremption: false,
  notes: "",
  confirme: false,
  conversion: "",
  categorie: "Générique",
  nomGenerique: "",
  ordonnanceRequise: false,
});

const UNITES: UniteMinimale[] = ["COMPRIME", "GELULE", "ML", "SACHET", "GRAMME", "AMPOULE", "PLAQUETTE", "UNITE"];

/** « Comprimé », « Gélule », « ml »... : singulier avec majuscule, sauf « ml ». */
const libelleUnite = (unite: UniteMinimale) => {
  const singulier = LIBELLES_UNITE_MINIMALE[unite].singulier;
  return unite === "ML" ? singulier : singulier.charAt(0).toUpperCase() + singulier.slice(1);
};

const MESSAGE_DATE_REQUISE = "Indiquez la date de péremption, ou cochez « Sans date de péremption ».";
const MESSAGE_CHOISIR_MEDICAMENT = "Choisissez d'abord le médicament dans la liste, ou créez-le s'il n'y figure pas.";
const MESSAGE_PAS_DE_DROIT_LIVRAISON = "Pour ajouter des boîtes, demandez au titulaire d'enregistrer la livraison.";
// Filet de sécurité : la fiche existe côté serveur sans figurer dans la liste de la page (archivée, liste périmée).
const MESSAGE_FICHE_EXISTANTE = "Ce médicament a déjà une fiche dans votre stock. Rien n'a été modifié.";
const MESSAGE_RESEAU = "L'enregistrement n'a peut-être pas abouti. Vérifiez votre connexion puis appuyez sur Réessayer.";
const MESSAGE_CHOIX_CONVERSION = "Indiquez si le stock actuel compte des boîtes ou des unités.";
const MESSAGE_PAR_DEFAUT = "Une erreur est survenue";

const LABEL = ui.label;
const AIDE = "text-mc-legende text-slate-600 dark:text-slate-400 ml-1";
const SAISIE = ui.champ;
const CASE_A_COCHER = "w-5 h-5 rounded-mc-petit border-slate-300 text-primary-500 focus:ring-primary-500";

type Entier = { etat: "vide" } | { etat: "ok"; valeur: number } | { etat: "invalide" };

/** Lit un entier saisi en chiffres seuls (espaces ignorés), jamais de virgule ni de décimale. */
function lireEntier(saisie: string): Entier {
  const texte = saisie.replace(/[\s  ]/g, "");
  if (texte === "") return { etat: "vide" };
  if (!/^\d{1,10}$/.test(texte)) return { etat: "invalide" };
  const valeur = parseInt(texte, 10);
  return valeur > 2147483647 ? { etat: "invalide" } : { etat: "ok", valeur };
}

const messageChiffres = (champ: string) => `${champ} : écrivez des chiffres seulement, sans virgule.`;

/** « Prix d'une plaquette », « Prix d'un comprimé » : article indéfini accordé à l'unité choisie. */
const libellePrixUnite = (unite: UniteMinimale) =>
  `Prix d'${LIBELLES_UNITE_MINIMALE[unite].unArticle} ${LIBELLES_UNITE_MINIMALE[unite].singulier}`;

/** « Nombre de plaquettes par boîte », « Nombre d'unités par boîte ». */
const libelleNombreParBoite = (unite: UniteMinimale) =>
  `Nombre ${deOuD(LIBELLES_UNITE_MINIMALE[unite].pluriel)} par boîte`;

const MESSAGE_UNITE_AVEC_STOCK =
  "Ce médicament a du stock : pour changer d'unité, comptez-le d'abord à 0 par un inventaire.";

/** Fiche non qualifiée en « Unité » à 1 par boîte : l'unité peut changer, mais le nombre ne se convertira plus ensuite. */
const messageNombreAIndiquer = (unite: UniteMinimale) =>
  `Indiquez aussi combien ${deOuD(LIBELLES_UNITE_MINIMALE[unite].pluriel)} contient la boîte : après l'enregistrement, ce nombre ne pourra plus convertir le stock.`;

interface Valeurs {
  prixBoite: number | null;
  coefficient: number;
  prixUnite: number | null;
  tolerance: number | null;
  boitesDepart: number;
  jourPeremption: string | null;
}

/** Lit et contrôle les champs numériques et la péremption ; renvoie le message à afficher en cas de refus. */
function lireValeurs(form: FormState, ajout: boolean): { erreur: string } | { valeurs: Valeurs } {
  const prixBoite = lireEntier(form.prixBoite);
  if (prixBoite.etat === "invalide") return { erreur: messageChiffres("Prix de la boîte") };

  const coefficient = lireEntier(form.coefficient);
  if (coefficient.etat === "invalide" || (coefficient.etat === "ok" && coefficient.valeur < 1)) {
    return { erreur: `${libelleNombreParBoite(form.unite)} : indiquez un nombre entier d'au moins 1.` };
  }

  const prixUnite = form.deconditionnable ? lireEntier(form.prixUnite) : ({ etat: "vide" } as Entier);
  if (prixUnite.etat === "invalide") return { erreur: messageChiffres(libellePrixUnite(form.unite)) };

  const tolerance = lireEntier(form.tolerance);
  if (tolerance.etat === "invalide") return { erreur: messageChiffres("Écart toléré à l'inventaire") };

  let boitesDepart = 0;
  let jourPeremption: string | null = null;
  if (ajout) {
    const depart = lireEntier(form.quantiteDepart);
    if (depart.etat === "invalide") return { erreur: messageChiffres("Quantité de départ") };
    boitesDepart = depart.etat === "ok" ? depart.valeur : 0;
    if (boitesDepart > 0 && !form.sansPeremption) {
      if (form.datePeremption.trim() === "") return { erreur: MESSAGE_DATE_REQUISE };
      const date = lireDatePeremption(form.datePeremption);
      if (!date.ok) return { erreur: date.message };
      jourPeremption = date.jour;
    }
  }

  return {
    valeurs: {
      prixBoite: prixBoite.etat === "ok" ? prixBoite.valeur : null,
      coefficient: coefficient.etat === "ok" ? coefficient.valeur : 1,
      prixUnite: prixUnite.etat === "ok" ? prixUnite.valeur : null,
      tolerance: tolerance.etat === "ok" ? tolerance.valeur : null,
      boitesDepart,
      jourPeremption,
    },
  };
}

/** Étapes déjà réussies : un « Réessayer » ne les refait pas. */
interface Etapes {
  medicamentId?: string;
  stockId?: string;
  /** Corps de la fiche déjà enregistré à l'ajout (étape c). */
  cleFiche?: string;
  /** Notes déjà enregistrées à l'ajout (étape c bis). */
  notesEnvoyees?: string;
  /** Unités par boîte de la fiche, telle que le serveur la renvoie après l'étape (c). */
  coefficient?: number;
  ficheFaite?: boolean;
  quantiteFaite?: boolean;
  notesFaites?: boolean;
  ecartPct?: number;
}

/** Refus d'ajout d'une fiche que le serveur dit déjà présente (lecture de la réponse). */
class DejaPresentError extends Error {
  constructor() {
    super(MESSAGE_FICHE_EXISTANTE);
  }
}

/** Fiche active de la pharmacie pour ce médicament du catalogue, s'il y en a une. */
const ficheDuMedicament = (fiches: StockMedicament[] | undefined, med: Medicament) =>
  fiches?.find((f) => f.medicamentId === med.id || f.medicament.id === med.id);

export default function StockModal({ isOpen, onClose, structureId, onSuccess, editItem, fichesActives, onModifierFiche }: StockModalProps) {
  const [search, setSearch] = useState("");
  const [catalogue, setCatalogue] = useState<Medicament[]>([]);
  const [loadingCatalogue, setLoadingCatalogue] = useState(false);
  const [selectedMed, setSelectedMed] = useState<Medicament | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const { profile } = useAuth();
  // Livraison et date d'un lot passent par la réception : les liens ne sont montrés qu'à qui peut y accéder.
  const peutEnregistrerReception = profile?.permissions?.includes("reception:write") ?? false;

  const [form, setForm] = useState<FormState>(formVide);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // Échec réseau : l'issue est inconnue, la saisie est verrouillée jusqu'à « Réessayer ».
  const [verrou, setVerrou] = useState(false);
  // Le serveur a demandé le choix de conversion (CONVERSION_REQUISE).
  const [conversionRequise, setConversionRequise] = useState(false);
  const [avertissementEcart, setAvertissementEcart] = useState<number | null>(null);
  const etapes = useRef<Etapes>({});
  const envoiRef = useRef(false);
  const derniereRecherche = useRef(0);
  const { dialogProps, titleId } = useDialogA11y({ isOpen, onClose, closeOnEscape: !saving });

  const maj = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  // Initialize for edit if editItem is provided
  useEffect(() => {
    if (!isOpen) return;
    etapes.current = {};
    envoiRef.current = false;
    if (editItem) {
      // Dette de lint préexistante, hors périmètre de l'accessibilité (point 22) : initialisation conservée telle quelle.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedMed(editItem.medicament);
      setSearch(editItem.medicament.nom);
      setForm({
        ...formVide(),
        prixBoite: editItem.prixUnitaire != null ? String(editItem.prixUnitaire) : "",
        unite: editItem.uniteMinimale ?? "UNITE",
        coefficient: String(editItem.coefficientBoite ?? 1),
        deconditionnable: editItem.deconditionnable ?? false,
        prixUnite: editItem.prixUnite != null ? String(editItem.prixUnite) : "",
        tolerance: editItem.toleranceInventaire != null ? String(editItem.toleranceInventaire) : "",
        notes: editItem.notes || "",
        categorie: editItem.medicament.categorie,
        nomGenerique: editItem.medicament.nomGenerique || "",
        ordonnanceRequise: editItem.medicament.ordonnanceRequise
      });
      setIsCreatingNew(false);
    } else {
      // Dette de lint préexistante (point 22) : reset est déclarée plus bas, appel conservé tel quel.
      // eslint-disable-next-line react-hooks/immutability
      reset();
    }
    setError("");
    setVerrou(false);
    setConversionRequise(false);
    setAvertissementEcart(null);
  }, [editItem, isOpen]);

  const searchCatalogue = useCallback(async (q: string) => {
    const recherche = ++derniereRecherche.current;
    if (q.length < 2) {
      setCatalogue([]);
      return;
    }
    setLoadingCatalogue(true);
    try {
      const res = await getCatalogue(q);
      // Réponse périmée : la fenêtre a été rouverte, ou un médicament a été choisi entre-temps.
      if (recherche !== derniereRecherche.current) return;
      setCatalogue(res.data);
      setShowDropdown(true);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingCatalogue(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (search && !selectedMed && !isCreatingNew && !editItem) searchCatalogue(search);
    }, 500);
    return () => clearTimeout(timer);
  }, [search, searchCatalogue, selectedMed, isCreatingNew, editItem]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectMed = (med: Medicament) => {
    etapes.current = {};
    derniereRecherche.current++;
    setError("");
    setSelectedMed(med);
    setSearch(med.nom);
    setShowDropdown(false);
    setIsCreatingNew(false);
  };

  const handleStartCreate = () => {
    etapes.current = {};
    derniereRecherche.current++;
    setIsCreatingNew(true);
    setShowDropdown(false);
    setSelectedMed(null);
  };

  /** Ajout : médicament, fiche seule, fiche confirmée avec le prix, notes, puis quantité de départ avec sa péremption (D701, D707). */
  const ajouterAuStock = async (v: Valeurs) => {
    const e = etapes.current;

    // (a) médicament du catalogue
    if (!e.medicamentId) {
      if (isCreatingNew) {
        const newMed = await createMedicament({
          nom: search,
          nomGenerique: form.nomGenerique,
          categorie: form.categorie,
          ordonnanceRequise: form.ordonnanceRequise
        });
        e.medicamentId = newMed.data.id;
      } else {
        e.medicamentId = selectedMed?.id;
      }
    }
    const medicamentId = e.medicamentId;
    if (!medicamentId) throw new Error("ID du médicament manquant");

    // (b) fiche seule : `medicamentId` sans prix, notes ni quantité, donc aucune écriture si elle existe déjà (D707)
    if (!e.stockId) {
      const res = await upsertStock(structureId, { medicamentId });
      const existante = res?.data;
      // Une fiche lue à 0 sans lot mais avec une part à régulariser (D713) est déjà dans le stock.
      const avecStock =
        (typeof existante?.quantite === "number" && existante.quantite !== 0) || (existante?.quantiteARegulariser ?? 0) > 0;
      if (existante && (avecStock || !!existante.archiveLe || (existante.lots?.length ?? 0) > 0)) {
        etapes.current = {};
        throw new DejaPresentError();
      }
      e.stockId = existante?.id;
    }
    const stockId = e.stockId;
    if (!stockId) throw new Error("ID de la fiche manquant");

    // (c) fiche confirmée, avec le prix de la boîte et les champs différents des valeurs par défaut
    const corps: CorpsFiche = { qualifie: true };
    if (v.prixBoite !== null) corps.prixUnitaire = v.prixBoite;
    if (form.unite !== "UNITE") corps.uniteMinimale = form.unite;
    if (v.coefficient !== 1) corps.coefficientBoite = v.coefficient;
    if (form.deconditionnable) {
      corps.deconditionnable = true;
      if (v.prixUnite !== null) corps.prixUnite = v.prixUnite;
    }
    if (v.tolerance !== null) corps.toleranceInventaire = v.tolerance;
    const cleFiche = JSON.stringify(corps);
    // Refaite seulement si la saisie a changé depuis (après un refus du serveur, la saisie se corrige)
    if (e.cleFiche !== cleFiche) {
      const res = await modifierFiche(structureId, stockId, corps);
      e.cleFiche = cleFiche;
      e.coefficient = res?.data?.coefficientBoite;
      const ecart = res?.data?.avertissements?.find((a) => a.code === "ECART_PRIX");
      e.ecartPct = ecart ? ecart.ecartPct : undefined;
    }

    // (c bis) notes, par un upsert sans quantité : aucune écriture de stock (D707)
    const notes = form.notes.trim();
    if (notes !== "" && e.notesEnvoyees !== notes) {
      await upsertStock(structureId, { medicamentId, notes });
      e.notesEnvoyees = notes;
    }

    // (d) quantité de départ, en unités minimales, avec sa péremption
    if (v.boitesDepart > 0 && !e.quantiteFaite) {
      await upsertStock(structureId, {
        medicamentId,
        quantite: v.boitesDepart * (e.coefficient ?? v.coefficient),
        ...(form.sansPeremption ? { sansPeremption: true } : { dateExpiration: v.jourPeremption ?? undefined }),
      });
      e.quantiteFaite = true;
    }
  };

  /** Modification : les notes d'abord (la quantité est encore celle de la fiche), puis les seuls champs changés. */
  const modifierLaFiche = async (item: StockMedicament, v: Valeurs): Promise<"refus" | "rien" | "fait"> => {
    const e = etapes.current;
    const coefficientAvant = item.coefficientBoite ?? 1;
    const coefficientChange = v.coefficient !== coefficientAvant;
    const nonQualifie = item.qualifie === false;
    const aDuStock = item.quantite !== 0 || (item.quantiteARegulariser ?? 0) > 0;
    const choixConversion = nonQualifie && coefficientChange && (aDuStock || conversionRequise);
    if (choixConversion && form.conversion === "") {
      setError(MESSAGE_CHOIX_CONVERSION);
      return "refus";
    }

    const corps: CorpsFiche = {};
    if (v.prixBoite !== (item.prixUnitaire ?? null)) corps.prixUnitaire = v.prixBoite;
    if (form.unite !== (item.uniteMinimale ?? "UNITE")) corps.uniteMinimale = form.unite;
    if (coefficientChange) corps.coefficientBoite = v.coefficient;
    const deconditionnableAvant = item.deconditionnable ?? false;
    if (form.deconditionnable !== deconditionnableAvant) {
      corps.deconditionnable = form.deconditionnable;
      // Décocher efface le prix d'une unité.
      if (!form.deconditionnable) corps.prixUnite = null;
    }
    if (form.deconditionnable && v.prixUnite !== (item.prixUnite ?? null)) corps.prixUnite = v.prixUnite;
    if (v.tolerance !== (item.toleranceInventaire ?? null)) corps.toleranceInventaire = v.tolerance;
    if (nonQualifie && (form.confirme || coefficientChange)) corps.qualifie = true;
    if (choixConversion && form.conversion !== "") corps.conversionStock = form.conversion;

    const notes = form.notes.trim();
    const notesChangees = notes !== (item.notes ?? "");
    if (Object.keys(corps).length === 0 && !notesChangees) return "rien";

    if (notesChangees && !e.notesFaites) {
      // Sans `quantite` : les notes seules, aucun mouvement de stock (D707)
      await upsertStock(structureId, { medicamentId: item.medicamentId, notes });
      e.notesFaites = true;
    }
    if (Object.keys(corps).length > 0 && !e.ficheFaite) {
      const res = await modifierFiche(structureId, item.id, corps);
      e.ficheFaite = true;
      const ecart = res?.data?.avertissements?.find((a) => a.code === "ECART_PRIX");
      if (ecart) e.ecartPct = ecart.ecartPct;
    }
    return "fait";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (envoiRef.current) return;
    setError("");

    // Sans bouton d'envoi, Entrée dans la recherche soumet quand même le formulaire : rien à envoyer sans saisie affichée (D731).
    if (!editItem && ((!selectedMed && !isCreatingNew) || (selectedMed && ficheDuMedicament(fichesActives, selectedMed)))) {
      return;
    }

    const lecture = lireValeurs(form, !editItem);
    if ("erreur" in lecture) {
      setError(lecture.erreur);
      return;
    }

    envoiRef.current = true;
    setSaving(true);
    try {
      if (editItem) {
        const issue = await modifierLaFiche(editItem, lecture.valeurs);
        if (issue === "refus") return;
        if (issue === "rien") {
          onClose();
          return;
        }
      } else {
        await ajouterAuStock(lecture.valeurs);
      }

      const ecartPct = etapes.current.ecartPct;
      etapes.current = {};
      setVerrou(false);
      onSuccess();
      if (ecartPct !== undefined) {
        setAvertissementEcart(ecartPct);
      } else {
        onClose();
        // Reset
        reset();
      }
    } catch (err: unknown) {
      if (estErreurReseau(err)) {
        setVerrou(true);
        setError(MESSAGE_RESEAU);
      } else {
        setVerrou(false);
        if (codeErreur(err) === "CONVERSION_REQUISE") setConversionRequise(true);
        setError((err instanceof Error && err.message) || MESSAGE_PAR_DEFAUT);
      }
    } finally {
      envoiRef.current = false;
      setSaving(false);
    }
  };

  const reset = () => {
    derniereRecherche.current++;
    setSelectedMed(null);
    setIsCreatingNew(false);
    setSearch("");
    setCatalogue([]);
    setShowDropdown(false);
    setForm(formVide());
  };

  if (!isOpen) return null;

  // Valeurs lues pour l'affichage (le contrôle complet se fait à l'envoi).
  const coefficientLu = lireEntier(form.coefficient);
  const coefficientCourant = coefficientLu.etat === "ok" && coefficientLu.valeur >= 1 ? coefficientLu.valeur : 1;
  const coefficientAvant = editItem?.coefficientBoite ?? 1;
  const nonQualifie = editItem?.qualifie === false;
  const aDuStock = !!editItem && (editItem.quantite !== 0 || (editItem.quantiteARegulariser ?? 0) > 0);
  const afficherChoix =
    !!editItem && nonQualifie && ((coefficientCourant !== coefficientAvant && aDuStock) || conversionRequise);
  const aRegulariser = editItem
    ? formaterARegulariser(editItem.quantiteARegulariser, coefficientAvant, editItem.uniteMinimale ?? "UNITE")
    : null;
  const departLu = lireEntier(form.quantiteDepart);
  const departPositif = !editItem && departLu.etat === "ok" && departLu.valeur > 0;
  const dateLue = departPositif && !form.sansPeremption && form.datePeremption.trim() !== "" ? lireDatePeremption(form.datePeremption) : null;
  const pluriel = LIBELLES_UNITE_MINIMALE[form.unite].pluriel;
  const singulier = LIBELLES_UNITE_MINIMALE[form.unite].singulier;
  // Changement d'unité sur une fiche qui a du stock (D724) : permis seulement pour une fiche non qualifiée en « Unité » à 1 par boîte.
  const uniteAvant = editItem?.uniteMinimale ?? "UNITE";
  const uniteChangee = !!editItem && form.unite !== uniteAvant;
  const reprisePermise = nonQualifie && uniteAvant === "UNITE" && coefficientAvant === 1;
  const aideUniteAvecStock = uniteChangee && aDuStock && !reprisePermise;
  const aideNombreAIndiquer =
    uniteChangee && aDuStock && reprisePermise && form.unite !== "UNITE" && coefficientCourant === 1;
  const valeurOuNull = (e: Entier) => (e.etat === "ok" ? e.valeur : null);
  const prixBoiteLu = valeurOuNull(lireEntier(form.prixBoite));
  const manqueDetail = form.deconditionnable
    ? manqueVenteAuDetail(prixBoiteLu, valeurOuNull(lireEntier(form.prixUnite)), valeurOuNull(coefficientLu))
    : null;
  const lotsEnStock = (editItem?.lots ?? []).filter((l) => l.quantite > 0);
  const unitesEnPlus = (editItem?.quantite ?? 0) * coefficientCourant;
  // Ajout : médicament choisi qui a déjà une fiche active. Le reste de la fenêtre n'apparaît qu'après un choix valable.
  const ficheExistante = !editItem && selectedMed ? ficheDuMedicament(fichesActives, selectedMed) : undefined;
  const afficherSaisie = !!editItem || ((!!selectedMed || isCreatingNew) && !ficheExistante);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
      <div {...dialogProps} className={ui.dialogue.panneauLarge}>

        {/* Header */}
        <div className="p-8 border-b border-slate-100 dark:border-slate-800/50 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-mc-grand flex items-center justify-center ${editItem ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400' : 'bg-primary-500/10 text-primary-700 dark:text-primary-400'}`}>
              {editItem ? <Save className="w-6 h-6" aria-hidden="true" /> : <Plus className="w-6 h-6" aria-hidden="true" />}
            </div>
            <div>
              <h2 id={titleId} className="text-mc-section font-semibold text-slate-900 dark:text-white">
                {editItem ? "Modifier le stock" : "Ajouter au stock"}
              </h2>
              <p className="text-mc-legende text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-widest">
                {editItem ? `Gestion du stock : ${editItem.medicament.nom}` : "Nouvel arrivage de médicament"}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer la fenêtre" className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors">
            <X className="w-6 h-6 text-slate-600 dark:text-slate-400" aria-hidden="true" />
          </button>
        </div>

        <div className="p-8">
          {avertissementEcart !== null ? (
            <div className="space-y-6">
              <p role="status" className={ALERTE_ATTENTION}>
                <AlertCircle className="w-5 h-5 shrink-0" aria-hidden="true" />
                {`Enregistré. Le ${libellePrixUnite(form.unite).toLowerCase()} s'écarte de ${avertissementEcart} % du prix de la boîte divisé par le nombre ${deOuD(pluriel)} : vérifiez qu'il n'y a pas d'erreur.`}
              </p>
              <button type="button" onClick={onClose} className={`w-full ${BOUTON_PRIMAIRE}`}>
                Fermer
              </button>
            </div>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <fieldset disabled={saving || verrou} className="space-y-6 min-w-0">

            {/* Medicament Selection Field (Disabled in edit mode) */}
            <div className="space-y-2 relative" ref={dropdownRef}>
              <label htmlFor="stock-medicament" className={LABEL}>Médicament</label>
              <div className="relative group">
                <Pill className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors ${selectedMed || isCreatingNew ? 'text-primary-600 dark:text-primary-400' : 'text-slate-600 dark:text-slate-400 group-focus-within:text-primary-600'}`} aria-hidden="true" />
                <input
                  id="stock-medicament"
                  type="text"
                  disabled={!!editItem}
                  placeholder="Tapez le nom du médicament..."
                  value={search}
                  onChange={(e) => {
                    etapes.current = {};
                    setSearch(e.target.value);
                    if (selectedMed) setSelectedMed(null);
                    if (isCreatingNew) setIsCreatingNew(false);
                  }}
                  onFocus={() => search.length >= 2 && !selectedMed && !editItem && setShowDropdown(true)}
                  className={`w-full h-mc-controle pl-12 pr-12 bg-slate-50 dark:bg-slate-900 border rounded-mc-moyen text-mc-normal focus:outline-none transition-all disabled:opacity-70 disabled:cursor-not-allowed ${selectedMed || isCreatingNew ? 'border-primary-500/50 ring-2 ring-primary-500/10' : 'border-slate-200 dark:border-slate-800 focus:border-primary-500'}`}
                />
                {!editItem && (
                  loadingCatalogue ? (
                    <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-primary-600 animate-spin" aria-hidden="true" />
                  ) : (
                    <ChevronDown className={`absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-600 dark:text-slate-400 transition-transform ${showDropdown ? 'rotate-180' : ''}`} aria-hidden="true" />
                  )
                )}
              </div>

              {/* Search Results Dropdown */}
              {showDropdown && !editItem && (
                <div className="absolute z-50 left-0 right-0 top-full mt-2 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-mc-grand shadow-mc max-h-[300px] overflow-y-auto scrollbar-thin animate-slide-down">
                  {catalogue.map((med) => (
                    <button
                      key={med.id}
                      type="button"
                      onClick={() => handleSelectMed(med)}
                      className="w-full p-4 flex items-center gap-4 hover:bg-primary-500/5 border-b border-slate-50 dark:border-slate-800 last:border-0 transition-colors text-left group"
                    >
                      <div className="w-10 h-10 rounded-mc-grand bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 group-hover:bg-primary-500 group-hover:text-white transition-all">
                        <Pill className="w-5 h-5" aria-hidden="true" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-slate-900 dark:text-white group-hover:text-primary-500 transition-colors">{med.nom}</p>
                        <p className="text-mc-legende text-slate-600 dark:text-slate-400 uppercase tracking-widest">{med.nomGenerique || med.categorie}</p>
                      </div>
                      {ficheDuMedicament(fichesActives, med) && (
                        <span className="shrink-0 px-2 py-1 rounded-mc-moyen bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 text-mc-legende font-semibold">
                          Déjà en stock
                        </span>
                      )}
                    </button>
                  ))}

                  {/* Create New Option */}
                  {search.length >= 2 && (
                    <button
                      type="button"
                      onClick={handleStartCreate}
                      className="w-full p-6 flex items-center gap-4 bg-primary-500 text-white hover:bg-primary-600 transition-colors text-left"
                    >
                      <div className="w-10 h-10 rounded-mc-grand bg-white/20 flex items-center justify-center">
                        <Plus className="w-6 h-6" aria-hidden="true" />
                      </div>
                      <div>
                        <p className="font-semibold">&quot;{search}&quot; n&apos;existe pas ?</p>
                        <p className="text-mc-legende uppercase font-semibold opacity-80">Cliquer ici pour le créer dans le catalogue</p>
                      </div>
                    </button>
                  )}
                </div>
              )}
              {!editItem && !selectedMed && !isCreatingNew && (
                <p className={AIDE}>{MESSAGE_CHOISIR_MEDICAMENT}</p>
              )}

              {/* Médicament déjà en stock : pas de saisie, deux issues */}
              {ficheExistante && selectedMed && (
                <div role="status" className={`${ALERTE_ATTENTION} items-start mt-2`}>
                  <Info className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="space-y-2">
                    <p>{`${selectedMed.nom} est déjà dans votre stock.`}</p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                      {peutEnregistrerReception ? (
                        <Link href="/dashboard/receptions/nouvelle" className={`font-semibold underline ${FOCUS}`}>
                          Enregistrer une livraison
                        </Link>
                      ) : (
                        <span>{MESSAGE_PAS_DE_DROIT_LIVRAISON}</span>
                      )}
                      {onModifierFiche && (
                        <button
                          type="button"
                          onClick={() => onModifierFiche(ficheExistante)}
                          className={`font-semibold underline ${FOCUS}`}
                        >
                          Modifier ce médicament
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Fields for New Medicament (Conditional) */}
            {isCreatingNew && !editItem && (
              <div className="p-6 bg-primary-500/5 border border-primary-500/20 rounded-mc-grand space-y-4 animate-fade-in">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-4 h-4 text-primary-600 dark:text-primary-400" aria-hidden="true" />
                  <p className="text-mc-legende font-semibold uppercase tracking-widest text-primary-700 dark:text-primary-400">Nouveau médicament à enregistrer</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label htmlFor="stock-categorie" className={ui.label}>Catégorie</label>
                    <input
                      id="stock-categorie"
                      type="text"
                      placeholder="Ex: Antipaludéen"
                      value={form.categorie}
                      onChange={(e) => setForm({...form, categorie: e.target.value})}
                      className={ui.champ}
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="stock-dci" className={ui.label}>DCI (Générique)</label>
                    <input
                      id="stock-dci"
                      type="text"
                      placeholder="Ex: Paracétamol"
                      value={form.nomGenerique}
                      onChange={(e) => setForm({...form, nomGenerique: e.target.value})}
                      className={ui.champ}
                    />
                  </div>
                </div>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={form.ordonnanceRequise}
                    onChange={(e) => setForm({...form, ordonnanceRequise: e.target.checked})}
                    className={CASE_A_COCHER}
                  />
                  <span className="text-mc-legende font-semibold text-slate-600 dark:text-slate-400 group-hover:text-primary-500 transition-colors">Ordonnance obligatoire ?</span>
                </label>
              </div>
            )}

            {afficherSaisie && (<>
            {/* Stock actuel (modification) : la quantité ne se change plus ici */}
            {editItem && (
              <div className="space-y-1">
                <p className="text-mc-normal font-semibold text-slate-900 dark:text-white">
                  Stock actuel : {formaterQuantite(editItem.quantite, coefficientAvant, editItem.uniteMinimale ?? "UNITE")}
                </p>
                {aRegulariser !== null && (
                  <p className="text-mc-normal text-amber-700 dark:text-amber-300">{aRegulariser}</p>
                )}
                <p className={AIDE}>
                  Pour changer la quantité : « Corriger la quantité » dans la liste, ou faites un inventaire.
                </p>
              </div>
            )}

            {/* Lots en stock (modification) : lecture seule, la date se corrige par lot */}
            {editItem && (
              <div className="space-y-2">
                <h3 className="text-mc-normal font-semibold text-slate-900 dark:text-white">Lots en stock</h3>
                {lotsEnStock.length === 0 ? (
                  <p className={AIDE}>Aucun lot en stock.</p>
                ) : (
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-mc-grand">
                    {lotsEnStock.map((lot) => (
                      <li key={lot.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 text-mc-normal">
                        <span className="font-medium text-slate-900 dark:text-white">{lot.numeroLot ?? "Sans numéro"}</span>
                        <span className="text-slate-600 dark:text-slate-400">
                          {lot.dateExpiration ? afficherDatePeremption(lot.dateExpiration) : "Sans date"}
                        </span>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {formaterQuantite(lot.quantite, lot.coefficientReception ?? coefficientAvant, editItem.uniteMinimale ?? "UNITE")}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {peutEnregistrerReception && (
                  <p className={AIDE}>Pour corriger une date, ouvrez la réception du lot.</p>
                )}
              </div>
            )}

            {/* Vente et prix */}
            <div className="space-y-4">
              <h3 className="text-mc-normal font-semibold text-slate-900 dark:text-white">Vente et prix</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="stock-prix-boite" className={LABEL}>Prix de la boîte (GNF)</label>
                  <input
                    id="stock-prix-boite"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="Ex: 35000"
                    value={form.prixBoite}
                    onChange={(e) => maj({ prixBoite: e.target.value })}
                    className={SAISIE}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="stock-unite" className={LABEL}>Unité de vente au détail</label>
                  <select
                    id="stock-unite"
                    value={form.unite}
                    onChange={(e) => maj({ unite: e.target.value as UniteMinimale })}
                    aria-describedby={aideUniteAvecStock ? "stock-aide-unite" : undefined}
                    className={SAISIE}
                  >
                    {UNITES.map((u) => (
                      <option key={u} value={u}>{libelleUnite(u)}</option>
                    ))}
                  </select>
                  {aideUniteAvecStock && (
                    <p id="stock-aide-unite" className={AIDE}>{MESSAGE_UNITE_AVEC_STOCK}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="stock-coefficient" className={LABEL}>{libelleNombreParBoite(form.unite)}</label>
                  <input
                    id="stock-coefficient"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    value={form.coefficient}
                    onChange={(e) => maj({ coefficient: e.target.value })}
                    aria-describedby={
                      aideNombreAIndiquer ? "stock-aide-nombre" : editItem && !nonQualifie ? "stock-aide-coefficient" : undefined
                    }
                    className={SAISIE}
                  />
                  {editItem && !nonQualifie && (
                    <p id="stock-aide-coefficient" className={AIDE}>
                      S&apos;applique aux prochaines réceptions et aux ventes à la boîte.
                    </p>
                  )}
                  {aideNombreAIndiquer && (
                    <p id="stock-aide-nombre" className="text-mc-legende text-amber-700 dark:text-amber-300 ml-1">
                      {messageNombreAIndiquer(form.unite)}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <label htmlFor="stock-tolerance" className={LABEL}>{`Écart toléré à l'inventaire (en ${pluriel})`}</label>
                  <input
                    id="stock-tolerance"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    value={form.tolerance}
                    onChange={(e) => maj({ tolerance: e.target.value })}
                    aria-describedby="stock-aide-tolerance"
                    className={SAISIE}
                  />
                  <p id="stock-aide-tolerance" className={AIDE}>
                    Au-delà, un écart d&apos;inventaire est signalé au titulaire.
                  </p>
                </div>
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.deconditionnable}
                  onChange={(e) => maj({ deconditionnable: e.target.checked })}
                  className={CASE_A_COCHER}
                />
                <span className="text-mc-normal font-medium text-slate-800 dark:text-slate-200">{`Se vend aussi ${aArticle(LIBELLES_UNITE_MINIMALE[form.unite].article)} (boîte entamée)`}</span>
              </label>

              {form.deconditionnable && (
                <div className="space-y-2">
                  <label htmlFor="stock-prix-unite" className={LABEL}>{`${libellePrixUnite(form.unite)} (GNF)`}</label>
                  <input
                    id="stock-prix-unite"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    value={form.prixUnite}
                    onChange={(e) => maj({ prixUnite: e.target.value })}
                    className={SAISIE}
                  />
                </div>
              )}

              <p className={AIDE}>Les deux prix sont indépendants : changer l&apos;un ne change pas l&apos;autre.</p>

              {manqueDetail && (
                <p role="status" className={ALERTE_ATTENTION}>
                  <AlertCircle className="w-5 h-5 shrink-0" aria-hidden="true" />
                  {`Vendue au détail, cette boîte rapporte ${formaterGNF(manqueDetail.totalDetail)}, soit ${formaterGNF(manqueDetail.manque)} de moins que son prix de ${formaterGNF(prixBoiteLu ?? 0)}. Vérifiez vos prix.`}
                </p>
              )}
            </div>

            {/* Qualification (modification d'une fiche non confirmée) */}
            {editItem && nonQualifie && (
              <div className="space-y-4">
                <div className={ALERTE_ATTENTION}>
                  <Info className="w-5 h-5 shrink-0" aria-hidden="true" />
                  <p>{`Le nombre ${deOuD(pluriel)} par boîte de ce médicament n'est pas encore confirmé. Vérifiez-le, puis cochez la case ci-dessous.`}</p>
                </div>

                {afficherChoix && (
                  <fieldset className="space-y-2">
                    <legend className="text-mc-normal font-medium text-slate-800 dark:text-slate-200 mb-2">
                      {`Le stock actuel de ${formaterQuantite(editItem.quantite, 1, "UNITE")}${aRegulariser === null ? "" : `, avec ${aRegulariser},`} compte :`}
                    </legend>
                    <label className="flex items-start gap-3 text-mc-normal text-slate-800 dark:text-slate-200">
                      <input
                        type="radio"
                        name="stock-conversion"
                        checked={form.conversion === "MULTIPLIER"}
                        onChange={() => maj({ conversion: "MULTIPLIER" })}
                        className="w-5 h-5 mt-0.5 accent-primary-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                      />
                      <span>
                        {`des boîtes : les convertir en unités (${editItem.quantite.toLocaleString("fr-FR")} ${Math.abs(editItem.quantite) > 1 ? "boîtes deviennent" : "boîte devient"} ${unitesEnPlus.toLocaleString("fr-FR")} ${Math.abs(unitesEnPlus) > 1 ? pluriel : singulier})`}
                      </span>
                    </label>
                    <label className="flex items-start gap-3 text-mc-normal text-slate-800 dark:text-slate-200">
                      <input
                        type="radio"
                        name="stock-conversion"
                        checked={form.conversion === "CONSERVER"}
                        onChange={() => maj({ conversion: "CONSERVER" })}
                        className="w-5 h-5 mt-0.5 accent-primary-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                      />
                      <span>déjà des unités : ne rien changer</span>
                    </label>
                    <p className={AIDE}>Ce choix ne se fera qu&apos;une fois.</p>
                  </fieldset>
                )}

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.confirme}
                    onChange={(e) => maj({ confirme: e.target.checked })}
                    className={CASE_A_COCHER}
                  />
                  <span className="text-mc-normal font-medium text-slate-800 dark:text-slate-200">Je confirme ces informations</span>
                </label>
              </div>
            )}

            {/* Quantité de départ et péremption (ajout) */}
            {!editItem && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="stock-quantite-depart" className={LABEL}>Quantité de départ (en boîtes)</label>
                  <input
                    id="stock-quantite-depart"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    value={form.quantiteDepart}
                    onChange={(e) => maj({ quantiteDepart: e.target.value })}
                    className={SAISIE}
                  />
                </div>

                {departPositif && (
                  <div className="space-y-2">
                    <label htmlFor="stock-peremption" className={LABEL}>Date de péremption</label>
                    <input
                      id="stock-peremption"
                      type="text"
                      autoComplete="off"
                      placeholder="06/28"
                      value={form.datePeremption}
                      disabled={form.sansPeremption}
                      onChange={(e) => maj({ datePeremption: e.target.value })}
                      aria-describedby="stock-aide-peremption"
                      className={SAISIE}
                    />
                    <p id="stock-aide-peremption" className={AIDE}>
                      Comme sur la facture : mois/année (06/28) ou date complète.
                    </p>
                    {dateLue && dateLue.ok && (
                      <p aria-live="polite" className="text-mc-normal font-medium text-slate-800 dark:text-slate-200 ml-1">
                        Péremption : {afficherDatePeremption(dateLue.jour)}
                      </p>
                    )}
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.sansPeremption}
                        onChange={(e) => maj({ sansPeremption: e.target.checked })}
                        className={CASE_A_COCHER}
                      />
                      <span className="text-mc-normal font-medium text-slate-800 dark:text-slate-200">Sans date de péremption</span>
                    </label>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="stock-notes" className={LABEL}>Notes</label>
              <input
                id="stock-notes"
                type="text"
                placeholder="Emplacement..."
                value={form.notes}
                onChange={(e) => setForm({...form, notes: e.target.value})}
                className={SAISIE}
              />
            </div>
            </>)}

            </fieldset>

            {error && (
              <div role="alert" className={`${ALERTE_ERREUR} animate-shake`}>
                <AlertCircle className="w-5 h-5 shrink-0" aria-hidden="true" />
                <p>{error}</p>
              </div>
            )}

            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className={`${ui.bouton.secondaire} flex-1`}
              >
                Annuler
              </button>
              {afficherSaisie && (
              <button
                type="submit"
                disabled={saving}
                className={`${ui.bouton.primaire} flex-[2]`}
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> : <Save className="w-5 h-5" aria-hidden="true" />}
                {saving ? "Enregistrement..." : (verrou ? "Réessayer" : (editItem ? "Mettre à jour" : (isCreatingNew ? "Créer et ajouter" : "Ajouter au stock")))}
              </button>
              )}
            </div>
          </form>
          )}
        </div>
      </div>
    </div>
  );
}
