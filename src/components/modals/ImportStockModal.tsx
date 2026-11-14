"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { X, FileSpreadsheet, Download, Loader2, Upload, CheckCircle2, ArrowLeft } from "lucide-react";
import {
  apercuImportCatalogue,
  apercuImportStock,
  importerCatalogue,
  importerStock,
  telechargerModeleImportCatalogue,
  telechargerModeleImportStock,
  type LigneImportCatalogue,
  type ColonnesLuesImport,
  type LigneImportStock,
  type ModeImportStock,
  type RapportImport,
  type RapportImportStock,
} from "@/lib/api_pharmacie";
import { messageErreurPour, useToast } from "@/hooks/useToast";
import Link from "next/link";
import { ui } from "@/theme/ui";
import { afficherDatePeremption } from "@/lib/date_peremption";
import { formaterGNF } from "@/lib/format_gnf";

type Etape = "preparer" | "verifier" | "termine";
type Chargement = "modele" | "apercu" | "import" | null;

// Limites du serveur (D08)
const TAILLE_MAX_OCTETS = 2 * 1024 * 1024;

const pluriel = (n: number, singulier: string, plurielTexte: string) => `${n} ${n > 1 ? plurielTexte : singulier}`;

/** « avant → après » pour une ligne du stock ; rien si le serveur ne fournit pas ces quantités (D04, D07). */
const renduEvolutionStock = (l: LigneImportStock) => {
  if (typeof l.quantiteApres !== "number") return null;
  // Jamais de signe moins (D713) : un avant négatif d'un ancien serveur se lit 0.
  const avant = typeof l.quantiteAvant === "number" ? Math.max(l.quantiteAvant, 0) : 0;
  const aRegulariser = typeof l.quantiteARegulariserAvant === "number" ? l.quantiteARegulariserAvant : 0;
  return (
    <span className="whitespace-nowrap">
      {avant} <span aria-hidden="true">→</span> <span className="sr-only">devient</span> {Math.max(l.quantiteApres, 0)}
      {aRegulariser > 0 && (
        <span className="block text-mc-legende text-amber-700 dark:text-amber-300">
          {aRegulariser} à régulariser avant cette livraison
        </span>
      )}
    </span>
  );
};

// ─── Paramétrage d'un import Excel ──────────────────────────────

/** Champs communs à toutes les lignes analysées par le serveur. */
export interface LigneImportBase {
  ligne: number;
  nom: string;
  statut: "acceptee" | "rejetee";
  raison?: string;
}

/** Colonne de l'aperçu affichée pour une ligne acceptée, après « Ligne » et « Nom saisi ». */
export interface ColonneApercu<L> {
  titre: string;
  rendu: (ligne: L) => ReactNode;
  /** Texte secondaire (couleur atténuée). */
  secondaire?: boolean;
}

/** Une option du choix du mode d'import (bouton radio). */
export interface OptionModeImport<M extends string> {
  valeur: M;
  /** « Inventaire : remplacer les quantités » */
  libelle: string;
  /** Phrase courte affichée sous le libellé. */
  explication: string;
}

/** Ce qui distingue un import d'un autre : textes, colonnes de l'aperçu et appels au serveur. */
export interface ConfigImportExcel<L extends LigneImportBase, M extends string = string> {
  titre: string;
  /** Nom de la feuille à remplir, cité dans les messages d'erreur. */
  nomFeuille: string;
  /** Consignes de l'étape 1, une par ligne. */
  consignes: ReactNode[];
  /** Colonnes fixes, ou calculées d'après le rapport et le mode de l'aperçu affiché (PF07d). */
  colonnes: ColonneApercu<L>[] | ((rapport: RapportImport<L>, mode?: M) => ColonneApercu<L>[]);
  /** Choix du mode d'import, la première option est celle par défaut ; absent : pas de choix. */
  modes?: OptionModeImport<M>[];
  textes: {
    /** « 3 médicaments prêts à être importés » */
    prets: (n: number) => string;
    /** « 2 lignes à corriger » */
    rejetees: (n: number) => string;
    filtreRejetees: string;
    boutonImporter: (n: number) => string;
    confirmation: (n: number, mode?: M) => string;
    boutonConfirmer: string;
    termine: (n: number) => string;
    termineRejetees: (n: number) => string;
  };
  telechargerModele: (mode?: M) => Promise<{ blob: Blob; filename: string }>;
  apercu: (fichier: File, mode?: M) => Promise<{ data: RapportImport<L> }>;
  importer: (fichier: File, mode?: M) => Promise<{ data: RapportImport<L>; message?: string }>;
  /** Complément affiché à l'étape « terminé » : message du serveur, lien vers la pièce créée. */
  renduResultat?: (rapport: RapportImport<L>, message: string | undefined) => ReactNode;
  /** Si présent, une notification de succès est affichée après l'import. */
  notifierSucces?: boolean;
}

interface ImportExcelModalProps<L extends LigneImportBase, M extends string = string> {
  isOpen: boolean;
  onClose: () => void;
  /** Recharge la liste après un import réussi */
  onSuccess: () => void;
  config: ConfigImportExcel<L, M>;
}

/** Choix du mode d'import en boutons radio (le choix se voit par la bordure). */
function ChoixModeImport<M extends string>({
  options,
  valeur,
  onChange,
  desactive,
}: {
  options: OptionModeImport<M>[];
  valeur: M | undefined;
  onChange: (mode: M) => void;
  desactive: boolean;
}) {
  const groupeId = useId();
  return (
    <fieldset className="space-y-2" disabled={desactive}>
      <legend className="block text-mc-legende font-semibold uppercase tracking-widest text-slate-600 dark:text-slate-400 ml-1 mb-2">
        Que contient votre fichier ?
      </legend>
      {options.map((option) => {
        const choisi = option.valeur === valeur;
        const libelleId = `${groupeId}-${option.valeur}-libelle`;
        const explicationId = `${groupeId}-${option.valeur}-explication`;
        return (
          <label
            key={option.valeur}
            className={`flex items-start gap-3 p-4 rounded-mc-grand border-2 transition-colors ${
              choisi ? "border-primary-600 dark:border-primary-400" : "border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600"
            } ${desactive ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
          >
            <input
              type="radio"
              name={groupeId}
              value={option.valeur}
              checked={choisi}
              onChange={() => onChange(option.valeur)}
              aria-labelledby={libelleId}
              aria-describedby={explicationId}
              className="mt-0.5 w-4 h-4 shrink-0 accent-primary-600"
            />
            <span>
              <span id={libelleId} className="block text-mc-normal font-semibold text-slate-900 dark:text-white">{option.libelle}</span>
              <span id={explicationId} className="block text-mc-normal text-slate-700 dark:text-slate-300">{option.explication}</span>
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}

/** Import depuis un fichier Excel en trois étapes : préparer, vérifier, terminé (F1). */
export function ImportExcelModal<L extends LigneImportBase, M extends string = string>({ isOpen, onClose, onSuccess, config }: ImportExcelModalProps<L, M>) {
  const titreId = useId();
  const champFichierId = useId();
  const dialogueRef = useRef<HTMLDivElement>(null);
  const elementPrecedent = useRef<HTMLElement | null>(null);
  const { notifier } = useToast();

  const [etape, setEtape] = useState<Etape>("preparer");
  const [fichier, setFichier] = useState<File | null>(null);
  const [rapport, setRapport] = useState<RapportImport<L> | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState<Chargement>(null);
  const [seulementACorriger, setSeulementACorriger] = useState(false);
  const [confirmation, setConfirmation] = useState(false);
  const [modeChoisi, setMode] = useState<M | undefined>(config.modes?.[0]?.valeur);
  // Mode de l'aperçu affiché : les colonnes et la confirmation suivent l'aperçu, pas un choix en cours de vérification
  const [modeApercu, setModeApercu] = useState<M | undefined>(undefined);
  const [messageServeur, setMessageServeur] = useState<string | undefined>(undefined);

  // Un mode qui n'est plus proposé (droits changés) retombe sur le premier mode permis
  const mode = config.modes?.some((o) => o.valeur === modeChoisi) ? modeChoisi : config.modes?.[0]?.valeur;
  const plusieursModes = (config.modes?.length ?? 0) > 1;
  const modeUnique = config.modes?.length === 1 ? config.modes[0] : undefined;

  const { textes } = config;
  const colonnes = typeof config.colonnes === "function" ? (rapport ? config.colonnes(rapport, modeApercu) : []) : config.colonnes;

  const recommencer = () => {
    setEtape("preparer");
    setFichier(null);
    setRapport(null);
    setMessageServeur(undefined);
    setErreur(null);
    setSeulementACorriger(false);
    setConfirmation(false);
  };

  const fermer = () => {
    if (chargement) return;
    if (etape === "termine") onSuccess();
    recommencer();
    setMode(config.modes?.[0]?.valeur);
    onClose();
  };

  // Focus placé dans la modale à l'ouverture, rendu à l'élément d'origine à la fermeture
  useEffect(() => {
    if (!isOpen) return;
    elementPrecedent.current = document.activeElement as HTMLElement | null;
    dialogueRef.current?.focus();
    return () => elementPrecedent.current?.focus();
  }, [isOpen]);

  if (!isOpen) return null;

  const telechargerModele = async () => {
    setErreur(null);
    setChargement("modele");
    try {
      const { blob, filename } = await config.telechargerModele(mode);
      const url = URL.createObjectURL(blob);
      const lien = document.createElement("a");
      lien.href = url;
      lien.download = filename;
      document.body.appendChild(lien);
      lien.click();
      lien.remove();
      // Lien temporaire révoqué après usage
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (err) {
      setErreur(messageErreurPour(err, "Le modèle Excel n'a pas pu être téléchargé. Vérifiez votre connexion puis réessayez."));
    } finally {
      setChargement(null);
    }
  };

  const choisirFichier = (choisi: File | null) => {
    setErreur(null);
    setFichier(null);
    if (!choisi) return;
    if (!/\.xlsx$/i.test(choisi.name)) {
      setErreur("Le fichier doit être un classeur Excel (.xlsx). Téléchargez le modèle pour partir d'un fichier valide.");
      return;
    }
    if (choisi.size > TAILLE_MAX_OCTETS) {
      setErreur(`Le fichier dépasse 2 Mo. Gardez seulement vos médicaments dans la feuille « ${config.nomFeuille} », puis réessayez.`);
      return;
    }
    setFichier(choisi);
  };

  const verifier = async (modeVoulu: M | undefined = mode, modeSiEchec?: M) => {
    if (!fichier) return;
    setErreur(null);
    setConfirmation(false);
    setChargement("apercu");
    try {
      const res = await config.apercu(fichier, modeVoulu);
      setRapport(res.data);
      setModeApercu(modeVoulu);
      setSeulementACorriger(false);
      setConfirmation(false);
      setEtape("verifier");
    } catch (err) {
      if (modeSiEchec !== undefined) setMode(modeSiEchec);
      setErreur(messageErreurPour(err, "Le fichier n'a pas pu être vérifié. Vérifiez votre connexion puis réessayez."));
    } finally {
      setChargement(null);
    }
  };

  const changerMode = (nouveau: M) => {
    if (nouveau === mode) return;
    const precedent = mode;
    setMode(nouveau);
    // À l'étape 2, l'aperçu affiché doit toujours correspondre au mode choisi (D02)
    if (etape === "verifier") void verifier(nouveau, precedent);
  };

  const importer = async () => {
    if (!fichier) return;
    setErreur(null);
    setChargement("import");
    try {
      const res = await config.importer(fichier, mode);
      setRapport(res.data);
      setMessageServeur(res.message);
      setEtape("termine");
      if (config.notifierSucces) {
        notifier(res.message || textes.termine(res.data.importees ?? res.data.acceptees), "succes");
      }
    } catch (err) {
      setErreur(messageErreurPour(err, "L'import n'a pas pu être enregistré. Vérifiez votre connexion puis réessayez."));
      setConfirmation(false);
    } finally {
      setChargement(null);
    }
  };

  const lignesAffichees = rapport
    ? rapport.lignes.filter((l) => !seulementACorriger || l.statut === "rejetee")
    : [];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
      <div
        ref={dialogueRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titreId}
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            fermer();
          }
        }}
        className={ui.dialogue.panneauTresLarge}
      >
        {/* En-tête */}
        <div className="p-6 sm:p-8 border-b border-slate-100 dark:border-slate-800/50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-mc-grand flex items-center justify-center bg-primary-500/10 text-primary-600 dark:text-primary-400">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h2 id={titreId} className="text-mc-section font-semibold text-slate-900 dark:text-white">
                {config.titre}
              </h2>
              <p className="text-mc-legende text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-widest">
                {etape === "preparer" ? "Étape 1 sur 3 : préparer le fichier" : etape === "verifier" ? "Étape 2 sur 3 : vérifier" : "Étape 3 sur 3 : terminé"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={fermer}
            disabled={!!chargement}
            aria-label="Fermer"
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors disabled:opacity-50"
          >
            <X className="w-6 h-6 text-slate-500" />
          </button>
        </div>

        <div className="p-6 sm:p-8 overflow-y-auto space-y-6">
          {erreur && (
            <p role="alert" className="text-mc-normal font-semibold text-emergency-600 dark:text-emergency-500">
              {erreur}
            </p>
          )}

          {/* Étape 1 : préparer le fichier */}
          {etape === "preparer" && (
            <>
              {modeUnique && (
                <p className="text-mc-normal text-slate-700 dark:text-slate-300">
                  Cet import sert à : <strong className="text-slate-900 dark:text-white">« {modeUnique.libelle} »</strong>. {modeUnique.explication}
                </p>
              )}
              <ol className="space-y-2 text-mc-normal text-slate-700 dark:text-slate-300 list-decimal list-inside">
                {config.consignes.map((consigne, i) => (
                  <li key={i}>{consigne}</li>
                ))}
              </ol>

              <button
                type="button"
                onClick={telechargerModele}
                disabled={!!chargement}
                className="inline-flex items-center gap-2 text-mc-normal font-semibold text-primary-600 dark:text-primary-400 hover:underline disabled:opacity-50"
              >
                {chargement === "modele" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Télécharger le modèle Excel
              </button>

              <div className="space-y-2">
                <label htmlFor={champFichierId} className={ui.label}>
                  Votre fichier Excel (.xlsx, 2 Mo maximum)
                </label>
                <input
                  id={champFichierId}
                  type="file"
                  accept=".xlsx"
                  onChange={(e) => choisirFichier(e.target.files?.[0] ?? null)}
                  className="block w-full text-mc-normal text-slate-700 dark:text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-mc-moyen file:border-0 file:bg-slate-100 dark:file:bg-slate-800 file:text-mc-normal file:font-semibold file:text-slate-900 dark:file:text-white"
                />
              </div>

              {config.modes && plusieursModes && (
                <ChoixModeImport options={config.modes} valeur={mode} onChange={changerMode} desactive={!!chargement} />
              )}

              <button
                type="button"
                onClick={() => verifier()}
                disabled={!fichier || !!chargement}
                className={`${ui.bouton.primaire} w-full`}
              >
                {chargement === "apercu" ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                Vérifier le fichier
              </button>
            </>
          )}

          {/* Étape 2 : vérifier */}
          {etape === "verifier" && rapport && (
            <>
              {config.modes && plusieursModes && (
                <>
                  <ChoixModeImport options={config.modes} valeur={mode} onChange={changerMode} desactive={!!chargement} />
                  {chargement === "apercu" && (
                    <p role="status" className="inline-flex items-center gap-2 text-mc-normal text-slate-700 dark:text-slate-300">
                      <Loader2 className="w-4 h-4 animate-spin" /> Nouvelle vérification du fichier avec ce choix...
                    </p>
                  )}
                </>
              )}

              <p className="text-mc-section font-semibold text-slate-900 dark:text-white" aria-live="polite">
                {textes.prets(rapport.acceptees)}
                {rapport.rejetees > 0 && `, ${textes.rejetees(rapport.rejetees)}`}
              </p>

              {rapport.colonnes && <ColonnesComprises colonnes={rapport.colonnes} />}

              {rapport.acceptees === 0 ? (
                <div className="space-y-3">
                  <p className="text-mc-normal text-slate-700 dark:text-slate-300">
                    Aucune ligne ne peut être importée. Corrigez le fichier puis choisissez-le à nouveau.
                  </p>
                  <button
                    type="button"
                    onClick={recommencer}
                    disabled={!!chargement}
                    className={ui.bouton.secondaire}
                  >
                    <ArrowLeft className="w-4 h-4" /> Choisir un autre fichier
                  </button>
                </div>
              ) : null}

              {rapport.rejetees > 0 && (
                <label className="flex items-center gap-2 text-mc-normal text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={seulementACorriger}
                    onChange={(e) => setSeulementACorriger(e.target.checked)}
                    className="w-4 h-4"
                  />
                  {textes.filtreRejetees}
                </label>
              )}

              {(() => {
                const optionChoisie = config.modes?.find((o) => o.valeur === mode);
                return optionChoisie ? (
                  <p className="text-mc-normal text-slate-700 dark:text-slate-300">
                    Mode choisi : <strong className="text-slate-900 dark:text-white">« {optionChoisie.libelle} »</strong>. {optionChoisie.explication}
                  </p>
                ) : null;
              })()}

              <div className="overflow-x-auto">
                <table className="w-full text-mc-normal">
                  <thead>
                    <tr className="text-left text-mc-legende font-semibold uppercase tracking-widest text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                      <th className="py-2 pr-3">Ligne</th>
                      <th className="py-2 pr-3">Nom saisi</th>
                      {colonnes.map((c, i) => (
                        <th key={c.titre} className={i === colonnes.length - 1 ? "py-2" : "py-2 pr-3"}>
                          {c.titre}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lignesAffichees.map((l) => (
                      <tr
                        key={l.ligne}
                        className={`border-b border-slate-100 dark:border-slate-800/60 align-top ${l.statut === "rejetee" ? "border-l-4 border-l-emergency-600" : ""}`}
                      >
                        <td className="py-2 pl-2 pr-3 text-slate-600 dark:text-slate-400">{l.ligne}</td>
                        <td className="py-2 pr-3 text-slate-900 dark:text-white">{l.nom || "-"}</td>
                        {l.statut === "rejetee" ? (
                          <td colSpan={colonnes.length} className="py-2 font-semibold text-emergency-600 dark:text-emergency-500">
                            {l.raison}
                          </td>
                        ) : (
                          colonnes.map((c, i) => (
                            <td
                              key={c.titre}
                              className={`${i === colonnes.length - 1 ? "py-2" : "py-2 pr-3"} ${c.secondaire ? "text-slate-700 dark:text-slate-300" : "text-slate-900 dark:text-white"}`}
                            >
                              {c.rendu(l)}
                            </td>
                          ))
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {rapport.acceptees > 0 && (
                <div className="space-y-3">
                  {confirmation ? (
                    <div className="space-y-3">
                      <p className="text-mc-normal font-semibold text-slate-900 dark:text-white">
                        {textes.confirmation(rapport.acceptees, modeApercu)}
                      </p>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <button
                          type="button"
                          onClick={importer}
                          disabled={!!chargement}
                          className={`${ui.bouton.primaire} flex-1`}
                        >
                          {chargement === "import" && <Loader2 className="w-5 h-5 animate-spin" />}
                          {textes.boutonConfirmer}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmation(false)}
                          disabled={!!chargement}
                          className={`${ui.bouton.discret} flex-1`}
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        type="button"
                        onClick={() => setConfirmation(true)}
                        disabled={!!chargement}
                        className={`${ui.bouton.primaire} flex-1`}
                      >
                        {textes.boutonImporter(rapport.acceptees)}
                      </button>
                      <button
                        type="button"
                        onClick={recommencer}
                        disabled={!!chargement}
                        className={`${ui.bouton.discret} flex-1`}
                      >
                        Choisir un autre fichier
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Étape 3 : terminé */}
          {etape === "termine" && rapport && (
            <div className="flex flex-col items-center text-center gap-4 py-6" aria-live="polite">
              <CheckCircle2 className="w-14 h-14 text-secondary-600 dark:text-secondary-400" />
              <p className="text-mc-section font-semibold text-slate-900 dark:text-white">
                {textes.termine(rapport.importees ?? rapport.acceptees)}
              </p>
              {rapport.rejetees > 0 && (
                <p className="text-mc-normal text-slate-700 dark:text-slate-300">
                  {textes.termineRejetees(rapport.rejetees)}
                </p>
              )}
              {config.renduResultat?.(rapport, messageServeur)}
              <button
                type="button"
                onClick={fermer}
                className={ui.bouton.primaire}
              >
                Fermer
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Import du stock d'une pharmacie ────────────────────────────

/** Paramétrage de l'import du stock : la quantité du fichier remplace celle en stock (inventaire) ou s'y ajoute (livraison). */
export function configImportStock(
  structureId: string,
  modesPermis: ModeImportStock[] = ["livraison", "inventaire"],
): ConfigImportExcel<LigneImportStock, ModeImportStock> {
  const toutes: OptionModeImport<ModeImportStock>[] = [
    {
      valeur: "livraison",
      libelle: "Livraison : ajouter les boîtes reçues",
      explication:
        "Chaque ligne du fichier crée un lot. Quantités en boîtes ; date de péremption obligatoire (ou « sans péremption ») ; numéro de lot et coût d'achat facultatifs.",
    },
    {
      valeur: "inventaire",
      libelle: "Inventaire : remplacer par les quantités comptées",
      explication:
        "Une ligne par lot compté, quantités en boîtes (et unités en plus d'une boîte entamée). Les quantités du fichier remplacent celles enregistrées.",
    },
  ];
  const options = toutes.filter((o) => modesPermis.includes(o.valeur));
  const modeParDefaut: ModeImportStock = options[0]?.valeur ?? "livraison";

  return {
    titre: "Importer depuis Excel",
    nomFeuille: "Stock",
    consignes: [
      "Téléchargez le modèle du mode choisi.",
      "Remplissez une ligne par produit et par lot : les quantités sont en boîtes.",
      "Pour une livraison, indiquez la date de péremption de chaque ligne (par exemple 30/06/2028), ou écrivez « sans péremption ».",
      "Envoyez le fichier : rien n'est enregistré avant votre confirmation.",
    ],
    modes: options,
    colonnes: (rapport, mode) => colonnesImportStock(rapport, mode),
    textes: {
      prets: (n) => `${pluriel(n, "médicament prêt", "médicaments prêts")} à être importé${n > 1 ? "s" : ""}`,
      rejetees: (n) => `${pluriel(n, "ligne", "lignes")} à corriger`,
      filtreRejetees: "Afficher seulement les lignes à corriger",
      boutonImporter: (n) => `Importer ${pluriel(n, "médicament", "médicaments")}`,
      confirmation: (n, mode) =>
        mode === "livraison"
          ? `Ajouter ${pluriel(n, "lot", "lots")} au stock ?`
          : `Remplacer le stock de ${pluriel(n, "lot", "lots")} par les quantités comptées ?`,
      boutonConfirmer: "Confirmer l'import",
      termine: (n) => `${pluriel(n, "ligne enregistrée", "lignes enregistrées")} dans votre stock`,
      termineRejetees: (n) =>
        `${pluriel(n, "ligne n'a pas été importée", "lignes n'ont pas été importées")} : corrigez-les dans le fichier puis importez-le à nouveau.`,
    },
    telechargerModele: (mode) => telechargerModeleImportStock(structureId, mode ?? modeParDefaut),
    apercu: (fichier, mode) => apercuImportStock(structureId, fichier, mode ?? modeParDefaut),
    importer: (fichier, mode) => importerStock(structureId, fichier, mode ?? modeParDefaut),
    renduResultat: (rapport, message) => {
      const { receptionId, inventaireId } = rapport as RapportImportStock;
      return (
        <>
          {message && <p className="text-mc-normal text-slate-700 dark:text-slate-300">{message}</p>}
          {receptionId && (
            <Link href={`/dashboard/receptions/${receptionId}`} className="text-mc-normal font-semibold text-primary-600 dark:text-primary-400 hover:underline">
              Voir la réception
            </Link>
          )}
          {inventaireId && (
            <>
              <p className="text-mc-normal text-slate-700 dark:text-slate-300">Les écarts au-delà de la tolérance sont signalés au titulaire.</p>
              <EcartsInventaire lignes={rapport.lignes} />
            </>
          )}
        </>
      );
    },
  };
}

const entierSigne = (n: number) => (n > 0 ? `+${n}` : String(n));

/** Lot d'une ligne d'inventaire : numéro du fichier, sinon « Sans péremption », sinon date. */
const libelleLot = (l: LigneImportStock) =>
  l.numeroLot || (l.sansPeremption ? "Sans péremption" : l.dateExpiration ? afficherDatePeremption(l.dateExpiration) : "-");

/** Résultat d'un inventaire : attendu et écart ne se montrent qu'après l'enregistrement (D729), jamais de signe moins sur l'attendu (D717). */
function EcartsInventaire({ lignes }: { lignes: LigneImportStock[] }) {
  const acceptees = lignes.filter((l) => l.statut === "acceptee");
  if (acceptees.length === 0) return null;
  return (
    <div className="w-full overflow-x-auto text-left">
      <table className="w-full text-mc-normal">
        <thead>
          <tr className="text-left text-mc-legende font-semibold uppercase tracking-widest text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
            <th className="py-2 pr-3">Médicament</th>
            <th className="py-2 pr-3">Lot</th>
            <th className="py-2 pr-3">Attendu (en unités)</th>
            <th className="py-2 pr-3">Compté (en unités)</th>
            <th className="py-2">Écart (en unités)</th>
          </tr>
        </thead>
        <tbody>
          {acceptees.map((l) => (
            <tr key={l.ligne} className="border-b border-slate-100 dark:border-slate-800/60 align-top">
              <td className="py-2 pr-3 text-slate-900 dark:text-white">{l.medicamentNom ?? l.nom}</td>
              <td className="py-2 pr-3 text-slate-700 dark:text-slate-300">
                {libelleLot(l)}
                {l.nouveauLot && <span className="block text-mc-legende">nouveau lot</span>}
              </td>
              <td className="py-2 pr-3 text-slate-900 dark:text-white">
                {Math.max(l.quantiteTheorique ?? 0, 0)}
                {(l.quantiteARegulariser ?? 0) > 0 && (
                  <span className="block text-mc-legende text-amber-700 dark:text-amber-300">{l.quantiteARegulariser} à régulariser</span>
                )}
              </td>
              <td className="py-2 pr-3 text-slate-900 dark:text-white">{l.quantiteComptee ?? l.quantite}</td>
              <td className="py-2 text-slate-900 dark:text-white">
                {typeof l.ecart === "number" ? entierSigne(l.ecart) : "-"}
                {l.sousTolerance && <span className="block text-mc-legende text-slate-700 dark:text-slate-300">dans la tolérance</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Colonnes de l'aperçu du stock : celles de la livraison ou celles de l'inventaire (PF07d). */
function colonnesImportStock(rapport: RapportImport<LigneImportStock>, mode?: ModeImportStock): ColonneApercu<LigneImportStock>[] {
  const medicament: ColonneApercu<LigneImportStock> = { titre: "Médicament reconnu", rendu: (l) => l.medicamentNom };

  if (mode === "inventaire") {
    return [
      medicament,
      {
        titre: "Lot",
        rendu: (l) => libelleLot(l),
        secondaire: true,
      },
      // Inventaire à l'aveugle (D729) : l'aperçu ne montre que ce que dit le fichier, jamais l'attendu ni l'écart
      // Le fichier compte des boîtes, le serveur renvoie des unités : le titre le dit
      { titre: "Compté (en unités)", rendu: (l) => l.quantiteComptee ?? "-" },
    ];
  }

  // Le coût d'une boîte n'est transmis qu'à qui a le droit de le voir (D698) : pas de colonne sans la clé
  const avecCout = rapport.lignes.some((l) => "coutAchatBoite" in l);
  return [
    medicament,
    { titre: "Boîtes", rendu: (l) => l.quantite },
    { titre: "Unités reçues", rendu: (l) => l.unitesRecues ?? "-" },
    {
      titre: "Péremption",
      rendu: (l) => (l.sansPeremption ? "Sans péremption" : l.dateExpiration ? afficherDatePeremption(l.dateExpiration) : "-"),
      secondaire: true,
    },
    { titre: "Lot", rendu: (l) => l.numeroLot || "-", secondaire: true },
    ...(avecCout
      ? [{ titre: "Coût d'une boîte", rendu: (l: LigneImportStock) => (typeof l.coutAchatBoite === "number" ? formaterGNF(l.coutAchatBoite) : "Inconnu"), secondaire: true }]
      : []),
    { titre: "Stock avant → après", rendu: renduEvolutionStock },
  ];
}

interface ImportStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  structureId: string;
  /** Recharge la liste du stock après un import réussi */
  onSuccess: () => void;
  /** Modes que l'utilisateur a le droit d'utiliser (D695) ; livraison puis inventaire par défaut. */
  modesPermis?: ModeImportStock[];
}

/** Import du stock depuis un fichier Excel : préparer, vérifier, terminé (F1). */
export default function ImportStockModal({ isOpen, onClose, structureId, onSuccess, modesPermis }: ImportStockModalProps) {
  return <ImportExcelModal isOpen={isOpen} onClose={onClose} onSuccess={onSuccess} config={configImportStock(structureId, modesPermis)} />;
}

// ─── Import du catalogue des médicaments ────────────────────────

/** Paramétrage de l'import du catalogue : ajoute des médicaments, ne modifie jamais un existant. */
export const CONFIG_IMPORT_CATALOGUE: ConfigImportExcel<LigneImportCatalogue> = {
  titre: "Importer le catalogue depuis Excel",
  nomFeuille: "Catalogue",
  consignes: [
    "Une ligne par médicament, avec au moins son nom et sa catégorie.",
    "Ordonnance requise : écrivez oui ou non (une case vide compte comme non).",
    "Formes : séparez-les par des virgules, par exemple : comprimé, sirop.",
    "Un médicament déjà présent dans le catalogue est ignoré, il n'est jamais modifié.",
  ],
  colonnes: [
    { titre: "Catégorie", rendu: (l) => l.categorie },
    { titre: "Nom générique", rendu: (l) => l.nomGenerique || "-", secondaire: true },
    { titre: "Ordonnance", rendu: (l) => (l.ordonnanceRequise ? "Oui" : "Non"), secondaire: true },
    { titre: "Formes", rendu: (l) => (l.formes && l.formes.length > 0 ? l.formes.join(", ") : "-"), secondaire: true },
  ],
  textes: {
    prets: (n) => `${pluriel(n, "médicament prêt", "médicaments prêts")} à être ajouté${n > 1 ? "s" : ""} au catalogue`,
    rejetees: (n) => pluriel(n, "ligne écartée", "lignes écartées"),
    filtreRejetees: "Afficher seulement les lignes écartées",
    boutonImporter: (n) => `Ajouter ${pluriel(n, "médicament", "médicaments")} au catalogue`,
    confirmation: (n) =>
      n > 1
        ? `${n} médicaments seront ajoutés au catalogue, visible par toutes les pharmacies. Confirmer ?`
        : "1 médicament sera ajouté au catalogue, visible par toutes les pharmacies. Confirmer ?",
    boutonConfirmer: "Confirmer l'ajout",
    termine: (n) => `${pluriel(n, "médicament ajouté", "médicaments ajoutés")} au catalogue`,
    termineRejetees: (n) =>
      `${pluriel(n, "ligne n'a pas été ajoutée", "lignes n'ont pas été ajoutées")}. Les médicaments déjà au catalogue n'ont rien à faire ; corrigez les autres lignes dans le fichier puis importez-le à nouveau.`,
  },
  telechargerModele: telechargerModeleImportCatalogue,
  apercu: apercuImportCatalogue,
  importer: importerCatalogue,
  notifierSucces: true,
};

interface ImportCatalogueModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Recharge la liste du catalogue après un import réussi */
  onSuccess: () => void;
}

/** Import du catalogue des médicaments depuis un fichier Excel. */
export function ImportCatalogueModal({ isOpen, onClose, onSuccess }: ImportCatalogueModalProps) {
  return <ImportExcelModal isOpen={isOpen} onClose={onClose} onSuccess={onSuccess} config={CONFIG_IMPORT_CATALOGUE} />;
}

/** Colonnes comprises par le serveur : une colonne ignorée n'est pas importée, il faut le voir avant de valider. */
function ColonnesComprises({ colonnes }: { colonnes: ColonnesLuesImport }) {
  return (
    <div className="space-y-2 text-mc-normal text-slate-700 dark:text-slate-300">
      <p>
        <span className="font-semibold text-slate-900 dark:text-white">Colonnes lues : </span>
        {colonnes.reconnues.map((c, i) => (
          <span key={`${c.titre}-${i}`}>
            {i > 0 && ", "}
            {normaliser(c.titre) === normaliser(c.colonne) ? (
              c.colonne
            ) : (
              <>
                « {c.titre} » comme <strong className="text-slate-900 dark:text-white">{c.colonne}</strong>
              </>
            )}
          </span>
        ))}
        {colonnes.ligneTitres > 1 && ` (titres trouvés en ligne ${colonnes.ligneTitres})`}.
      </p>
      {colonnes.ignorees.length > 0 && (
        <p className="px-3 py-2 rounded-mc-moyen border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200">
          {colonnes.ignorees.length === 1 ? "Colonne non importée : " : "Colonnes non importées : "}
          {colonnes.ignorees.map((t) => `« ${t} »`).join(", ")}. Si l&apos;une d&apos;elles doit l&apos;être, donnez-lui le titre utilisé dans le modèle, puis choisissez le fichier à nouveau.
        </p>
      )}
    </div>
  );
}

/** Comparaison de titres sans casse, accents ni ponctuation (« Quantité » et « QUANTITE »). */
const normaliser = (texte: string) =>
  texte.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
