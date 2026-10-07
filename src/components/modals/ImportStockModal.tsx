"use client";

import { useEffect, useId, useRef, useState } from "react";
import { X, FileSpreadsheet, Download, Loader2, Upload, CheckCircle2, ArrowLeft } from "lucide-react";
import {
  apercuImportStock,
  importerStock,
  telechargerModeleImportStock,
  type RapportImportStock,
} from "@/lib/api_pharmacie";
import { messageErreurPour } from "@/hooks/useToast";

interface ImportStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  structureId: string;
  /** Recharge la liste du stock après un import réussi */
  onSuccess: () => void;
}

type Etape = "preparer" | "verifier" | "termine";
type Chargement = "modele" | "apercu" | "import" | null;

// Limites du serveur (D08)
const TAILLE_MAX_OCTETS = 2 * 1024 * 1024;

const pluriel = (n: number, singulier: string, plurielTexte: string) => `${n} ${n > 1 ? plurielTexte : singulier}`;

const formatPrix = (prix?: number) =>
  prix === undefined ? "-" : `${prix.toLocaleString("fr-GN")} GNF`;
const formatDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString("fr-FR", { timeZone: "UTC" }) : "-";

/** Import du stock depuis un fichier Excel : préparer, vérifier, terminé (F1). */
export default function ImportStockModal({ isOpen, onClose, structureId, onSuccess }: ImportStockModalProps) {
  const titreId = useId();
  const champFichierId = useId();
  const dialogueRef = useRef<HTMLDivElement>(null);
  const elementPrecedent = useRef<HTMLElement | null>(null);

  const [etape, setEtape] = useState<Etape>("preparer");
  const [fichier, setFichier] = useState<File | null>(null);
  const [rapport, setRapport] = useState<RapportImportStock | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState<Chargement>(null);
  const [seulementACorriger, setSeulementACorriger] = useState(false);
  const [confirmation, setConfirmation] = useState(false);

  const recommencer = () => {
    setEtape("preparer");
    setFichier(null);
    setRapport(null);
    setErreur(null);
    setSeulementACorriger(false);
    setConfirmation(false);
  };

  const fermer = () => {
    if (chargement) return;
    if (etape === "termine") onSuccess();
    recommencer();
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
      const { blob, filename } = await telechargerModeleImportStock(structureId);
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
      setErreur("Le fichier dépasse 2 Mo. Gardez seulement vos médicaments dans la feuille « Stock », puis réessayez.");
      return;
    }
    setFichier(choisi);
  };

  const verifier = async () => {
    if (!fichier) return;
    setErreur(null);
    setChargement("apercu");
    try {
      const res = await apercuImportStock(structureId, fichier);
      setRapport(res.data);
      setSeulementACorriger(false);
      setConfirmation(false);
      setEtape("verifier");
    } catch (err) {
      setErreur(messageErreurPour(err, "Le fichier n'a pas pu être vérifié. Vérifiez votre connexion puis réessayez."));
    } finally {
      setChargement(null);
    }
  };

  const importer = async () => {
    if (!fichier) return;
    setErreur(null);
    setChargement("import");
    try {
      const res = await importerStock(structureId, fichier);
      setRapport(res.data);
      setEtape("termine");
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
        className="bg-white dark:bg-[#0f172a] w-full max-w-3xl max-h-[90vh] flex flex-col rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-scale-in outline-none"
      >
        {/* En-tête */}
        <div className="p-6 sm:p-8 border-b border-slate-100 dark:border-slate-800/50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-primary-500/10 text-primary-600 dark:text-primary-400">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h2 id={titreId} className="text-xl font-black text-slate-900 dark:text-white">
                Importer depuis Excel
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-bold uppercase tracking-widest">
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
            <p role="alert" className="text-sm font-bold text-emergency-600 dark:text-emergency-500">
              {erreur}
            </p>
          )}

          {/* Étape 1 : préparer le fichier */}
          {etape === "preparer" && (
            <>
              <ol className="space-y-2 text-sm text-slate-700 dark:text-slate-300 list-decimal list-inside">
                <li>Une ligne par médicament.</li>
                <li>Le nom du médicament tel qu&apos;il apparaît dans le catalogue.</li>
                <li>La quantité indiquée remplace celle actuellement en stock.</li>
              </ol>

              <button
                type="button"
                onClick={telechargerModele}
                disabled={!!chargement}
                className="inline-flex items-center gap-2 text-sm font-bold text-primary-600 dark:text-primary-400 hover:underline disabled:opacity-50"
              >
                {chargement === "modele" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Télécharger le modèle Excel
              </button>

              <div className="space-y-2">
                <label htmlFor={champFichierId} className="block text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 ml-1">
                  Votre fichier Excel (.xlsx, 2 Mo maximum)
                </label>
                <input
                  id={champFichierId}
                  type="file"
                  accept=".xlsx"
                  onChange={(e) => choisirFichier(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-slate-700 dark:text-slate-300 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:bg-slate-100 dark:file:bg-slate-800 file:text-sm file:font-bold file:text-slate-900 dark:file:text-white"
                />
              </div>

              <button
                type="button"
                onClick={verifier}
                disabled={!fichier || !!chargement}
                className="w-full py-4 bg-primary-600 text-white rounded-2xl font-bold text-sm hover:bg-primary-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {chargement === "apercu" ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                Vérifier le fichier
              </button>
            </>
          )}

          {/* Étape 2 : vérifier */}
          {etape === "verifier" && rapport && (
            <>
              <p className="text-base font-bold text-slate-900 dark:text-white" aria-live="polite">
                {pluriel(rapport.acceptees, "médicament prêt", "médicaments prêts")} à être importé{rapport.acceptees > 1 ? "s" : ""}
                {rapport.rejetees > 0 && `, ${pluriel(rapport.rejetees, "ligne", "lignes")} à corriger`}
              </p>

              {rapport.acceptees === 0 ? (
                <div className="space-y-3">
                  <p className="text-sm text-slate-700 dark:text-slate-300">
                    Aucune ligne ne peut être importée. Corrigez le fichier puis choisissez-le à nouveau.
                  </p>
                  <button
                    type="button"
                    onClick={recommencer}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:opacity-90"
                  >
                    <ArrowLeft className="w-4 h-4" /> Choisir un autre fichier
                  </button>
                </div>
              ) : null}

              {rapport.rejetees > 0 && (
                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={seulementACorriger}
                    onChange={(e) => setSeulementACorriger(e.target.checked)}
                    className="w-4 h-4"
                  />
                  Afficher seulement les lignes à corriger
                </label>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                      <th className="py-2 pr-3">Ligne</th>
                      <th className="py-2 pr-3">Nom saisi</th>
                      <th className="py-2 pr-3">Médicament reconnu</th>
                      <th className="py-2 pr-3">Quantité</th>
                      <th className="py-2 pr-3">Prix</th>
                      <th className="py-2">Expiration</th>
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
                          <td colSpan={4} className="py-2 font-bold text-emergency-600 dark:text-emergency-500">
                            {l.raison}
                          </td>
                        ) : (
                          <>
                            <td className="py-2 pr-3 text-slate-900 dark:text-white">{l.medicamentNom}</td>
                            <td className="py-2 pr-3 text-slate-900 dark:text-white">{l.quantite}</td>
                            <td className="py-2 pr-3 text-slate-700 dark:text-slate-300">{formatPrix(l.prixUnitaire)}</td>
                            <td className="py-2 text-slate-700 dark:text-slate-300">{formatDate(l.dateExpiration)}</td>
                          </>
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
                      <p className="text-sm font-bold text-slate-900 dark:text-white">
                        Pour {pluriel(rapport.acceptees, "médicament", "médicaments")}, la quantité en stock sera remplacée par celle du fichier. Confirmer ?
                      </p>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <button
                          type="button"
                          onClick={importer}
                          disabled={!!chargement}
                          className="flex-1 py-3.5 bg-primary-600 text-white rounded-2xl font-bold text-sm hover:bg-primary-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {chargement === "import" && <Loader2 className="w-5 h-5 animate-spin" />}
                          Confirmer l&apos;import
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmation(false)}
                          disabled={!!chargement}
                          className="flex-1 py-3.5 rounded-2xl font-bold text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
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
                        className="flex-1 py-3.5 bg-primary-600 text-white rounded-2xl font-bold text-sm hover:bg-primary-700 transition-colors"
                      >
                        Importer {pluriel(rapport.acceptees, "médicament", "médicaments")}
                      </button>
                      <button
                        type="button"
                        onClick={recommencer}
                        className="flex-1 py-3.5 rounded-2xl font-bold text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
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
              <p className="text-lg font-black text-slate-900 dark:text-white">
                {pluriel(rapport.importees ?? rapport.acceptees, "médicament mis à jour", "médicaments mis à jour")} dans votre stock
              </p>
              {rapport.rejetees > 0 && (
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  {pluriel(rapport.rejetees, "ligne n'a pas été importée", "lignes n'ont pas été importées")} : corrigez-les dans le fichier puis importez-le à nouveau.
                </p>
              )}
              <button
                type="button"
                onClick={fermer}
                className="px-6 py-3 bg-primary-600 text-white rounded-2xl font-bold text-sm hover:bg-primary-700 transition-colors"
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
