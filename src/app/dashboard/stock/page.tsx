"use client";
// Dette préexistante, backlog points 21 et 22
/* eslint-disable react-hooks/preserve-manual-memoization, react-hooks/set-state-in-effect */
import { LoadingSpinner } from "@/components/LoadingSpinner";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { messageErreurPour } from "@/hooks/useToast";
import { lireContexteAcces } from "@/lib/acces";
import {
  Package,
  Plus,
  Search,
  AlertTriangle,
  Archive,
  Edit,
  PackageMinus,
  ShoppingBag,
  SlidersHorizontal,
  XCircle,
  FileSpreadsheet,
  Download
} from "lucide-react";
import {
  getMyStock,
  StockMedicament,
  StockInfo,
  removeStockItem,
  exporterStock,
  type FiltreExportStock,
  type ModeImportStock
} from "@/lib/api_pharmacie";
import { calculerApercuStock } from "@/lib/apercu_pharmacie";
import { LIBELLES_UNITE_MINIMALE, formaterARegulariser, formaterQuantite } from "@/lib/caisse/regles/quantites";
import { formaterGNF } from "@/lib/format_gnf";
import { afficherDatePeremption } from "@/lib/date_peremption";
import { estErreurReseau } from "@/lib/erreurs_api";
import { MESSAGE_ACTION_EN_LIGNE } from "@/lib/caisse/source_desktop";
import { jourConakry } from "../ventes/affichage";
import StockModal from "@/components/modals/StockModal";
import ImportStockModal from "@/components/modals/ImportStockModal";
import { DeleteConfirmModal } from "@/components/modals/DeleteConfirmModal";
import { ui } from "@/theme/ui";
import { ErreurAvecReessai } from "@/components/pharmacie/ErreurAvecReessai";
import { CorrectionQuantite } from "./CorrectionQuantite";
import { SortieStock } from "./SortieStock";

type Filtre = "all" | "low" | "rupture" | "qualifier";

const MSG_EXPORT_ECHOUE = "Le stock n'a pas pu être exporté. Vérifiez votre connexion puis réessayez.";
const FILTRE_VERS_API: Record<Filtre, FiltreExportStock> = { all: "tous", low: "alertes", rupture: "rupture", qualifier: "qualifier" };

const MSG_CHARGEMENT_ECHOUE = "Le stock n'a pas pu être chargé. Vérifiez votre connexion puis réessayez.";

export default function StockPage() {
  const { user, profile } = useAuth();
  // Modes d'import permis par les droits : livraison (réception) et inventaire (D695)
  const permissions = user ? lireContexteAcces(user, profile ?? null).permissions : null;
  const modesPermis: ModeImportStock[] = [
    ...(permissions?.has("reception:write") ? (["livraison"] as const) : []),
    ...(permissions?.has("inventaire:write") ? (["inventaire"] as const) : []),
  ];
  const peutImporter = modesPermis.length > 0;
  const [stockInfo, setStockInfo] = useState<StockInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [erreurChargement, setErreurChargement] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filtre>("all");
  const [exportEnCours, setExportEnCours] = useState(false);
  const [choixExportOuvert, setChoixExportOuvert] = useState(false);
  const [erreurExport, setErreurExport] = useState<string | null>(null);
  const zoneExportRef = useRef<HTMLDivElement>(null);
  const boutonExportRef = useRef<HTMLButtonElement>(null);

  // Le menu d'export se ferme sur un clic extérieur ou Échap (le focus revient au bouton)
  useEffect(() => {
    if (!choixExportOuvert) return;
    const surClic = (e: MouseEvent) => {
      if (!zoneExportRef.current?.contains(e.target as Node)) setChoixExportOuvert(false);
    };
    const surTouche = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setChoixExportOuvert(false);
      boutonExportRef.current?.focus();
    };
    document.addEventListener("mousedown", surClic);
    document.addEventListener("keydown", surTouche);
    return () => {
      document.removeEventListener("mousedown", surClic);
      document.removeEventListener("keydown", surTouche);
    };
  }, [choixExportOuvert]);

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedStock, setSelectedStock] = useState<StockMedicament | null>(null);
  const [stockACorriger, setStockACorriger] = useState<StockMedicament | null>(null);
  const [stockASortir, setStockASortir] = useState<StockMedicament | null>(null);

  const fetchData = useCallback(async () => {
    if (!user?.structureId) return;
    setLoading(true);
    setSucces(null);
    setErreurChargement(null);
    try {
      const res = await getMyStock(user.structureId);
      setStockInfo(res.data);
    } catch (err) {
      setErreurChargement(messageErreurPour(err, MSG_CHARGEMENT_ECHOUE));
    } finally {
      setLoading(false);
    }
  }, [user?.structureId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Accès rapide « Importer le stock » du tableau de bord : ouvre directement la fenêtre d'import
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("importer") !== "1" || !peutImporter) return;
    setIsImportOpen(true);
    params.delete("importer");
    const reste = params.toString();
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${reste ? `?${reste}` : ""}`);
  }, [peutImporter]);

  // Statuts lus des alertes du serveur (seuil des paramètres, quantité négative comprise)
  const idsStockBas = new Set(stockInfo?.alertes.stockBas.map((a) => a.id) ?? []);
  const idsRupture = new Set(stockInfo?.alertes.rupture.map((a) => a.id) ?? []);
  const nombreAQualifier = stockInfo?.stocks.filter((s) => s.qualifie === false).length ?? 0;

  // Recherche sans espaces de début ni de fin, comme l'export côté serveur
  const rechercheNettoyee = search.trim().toLowerCase();
  const filteredStocks = stockInfo?.stocks.filter(s => {
    const matchesSearch = s.medicament.nom.toLowerCase().includes(rechercheNettoyee) ||
                          s.medicament.nomGenerique?.toLowerCase().includes(rechercheNettoyee);
    if (filter === "low") return matchesSearch && idsStockBas.has(s.id);
    if (filter === "rupture") return matchesSearch && idsRupture.has(s.id);
    if (filter === "qualifier") return matchesSearch && s.qualifie === false;
    return matchesSearch;
  }) || [];

  // Exporte tout le stock ou seulement l'affichage actuel (onglet et recherche)
  const exporter = async (seulementAffichage: boolean) => {
    if (!user?.structureId) return;
    setChoixExportOuvert(false);
    setErreurExport(null);
    setExportEnCours(true);
    try {
      const { blob, filename } = await exporterStock(
        user.structureId,
        seulementAffichage ? { filtre: FILTRE_VERS_API[filter], q: search.trim() } : {},
      );
      const url = URL.createObjectURL(blob);
      const lien = document.createElement("a");
      lien.href = url;
      lien.download = filename;
      document.body.appendChild(lien);
      lien.click();
      lien.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (err) {
      setErreurExport(estErreurReseau(err) ? MESSAGE_ACTION_EN_LIGNE : messageErreurPour(err, MSG_EXPORT_ECHOUE));
    } finally {
      setExportEnCours(false);
    }
  };

  const affichageFiltre = filter !== "all" || search.trim() !== "";

  const openAddModal = () => {
    setSelectedStock(null);
    setIsModalOpen(true);
  };

  const openEditModal = (item: StockMedicament) => {
    setSelectedStock(item);
    setIsModalOpen(true);
  };

  const openDeleteModal = (item: StockMedicament) => {
    setSelectedStock(item);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!user?.structureId || !selectedStock) return;
    await removeStockItem(user.structureId, selectedStock.id);
    fetchData();
  };

  // Le message du serveur s'affiche après le rechargement, qui efface l'ancien message.
  const handleCorrectionReussie = (message: string) => {
    fetchData();
    setSucces(message);
  };

  const fermerCorrection = (rechargerStock?: boolean) => {
    setStockACorriger(null);
    if (rechargerStock) fetchData();
  };

  const fermerSortie = (rechargerStock?: boolean) => {
    setStockASortir(null);
    if (rechargerStock) fetchData();
  };

  if (loading && !stockInfo) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <LoadingSpinner />
        <p className={`${ui.texte.petit} animate-pulse`}>Chargement de l&apos;inventaire...</p>
      </div>
    );
  }

  if (!stockInfo) {
    return (
      <div className="max-w-mc-contenu mx-auto pb-20">
        <ErreurAvecReessai message={erreurChargement ?? MSG_CHARGEMENT_ECHOUE} onReessayer={fetchData} />
      </div>
    );
  }

  const valeurStock = calculerApercuStock(stockInfo.stocks, new Date()).valeur;
  const aujourdhui = jourConakry(new Date());
  const v = ui.carteChiffreVariantes;

  return (
    <div className="max-w-mc-contenu mx-auto space-y-6 animate-fade-in pb-20">
      {erreurChargement && <ErreurAvecReessai message={erreurChargement} onReessayer={fetchData} />}
      {erreurExport && (
        <div role="alert" className={ui.alerte.erreur}>
          {erreurExport}
        </div>
      )}
      {succes && (
        <div role="status" className={ui.alerte.succes}>
          {succes}
        </div>
      )}

      {/* Header Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 xl:grid-cols-[1fr_1fr_1fr_2fr] gap-4">
        <div className={ui.carteChiffre.conteneur}>
          <div className={ui.carteChiffre.icone}><Package size={20} /></div>
          <div>
            <p className={ui.carteChiffre.titre}>Total Produits</p>
            <p className={ui.carteChiffre.valeur}>{stockInfo?.stocks.length || 0}</p>
          </div>
        </div>
        <div className={ui.carteChiffre.conteneur}>
          <div className={v.iconeAttention}><AlertTriangle size={20} /></div>
          <div>
            <p className={ui.carteChiffre.titre}>Stock Bas</p>
            <p className={v.valeurAttention}>{stockInfo.alertes.stockBas.length}</p>
          </div>
        </div>
        <div className={ui.carteChiffre.conteneur}>
          <div className={v.iconeDanger}><XCircle size={20} /></div>
          <div>
            <p className={ui.carteChiffre.titre}>Rupture</p>
            <p className={v.valeurDanger}>{stockInfo.alertes.rupture.length}</p>
          </div>
        </div>
        <div className={`${v.conteneurAccent} sm:col-span-3 xl:col-span-1`}>
          <div className={v.iconeAccent}><ShoppingBag size={20} /></div>
          <div className="min-w-0">
            <p className={v.titreAccent}>Valeur Stock</p>
            <p className={v.valeurAccent}>
              <span className="sr-only">{formaterGNF(valeurStock)}</span>
              <span aria-hidden="true">
                {formaterGNF(valeurStock).replace(/\s*GNF$/, "")}{" "}
                <span className="text-mc-petit font-medium">GNF</span>
              </span>
            </p>
            <p className={v.noteAccent}>au prix de vente, hors périmés</p>
          </div>
        </div>
      </div>

      {/* Main Controls */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-0 flex-1 basis-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher un médicament..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${ui.champ} pl-9`}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {peutImporter && (
              <button
                onClick={() => setIsImportOpen(true)}
                className={ui.bouton.secondaire}
              >
                <FileSpreadsheet size={16} className="text-primary-600 dark:text-primary-400" />
                Importer depuis Excel
              </button>
            )}
            <div className="relative" ref={zoneExportRef}>
              <button
                type="button"
                ref={boutonExportRef}
                onClick={() => (affichageFiltre ? setChoixExportOuvert((o) => !o) : exporter(false))}
                disabled={exportEnCours}
                aria-haspopup={affichageFiltre ? "menu" : undefined}
                aria-expanded={affichageFiltre ? choixExportOuvert : undefined}
                className={ui.bouton.secondaire}
              >
                <Download size={16} className="text-primary-600 dark:text-primary-400" />
                {exportEnCours ? "Export en cours..." : "Exporter le stock"}
              </button>
              {choixExportOuvert && (
                <div
                  role="menu"
                  className="absolute right-0 z-20 mt-2 flex w-64 flex-col gap-1 rounded-lg border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-900"
                >
                  <button type="button" role="menuitem" onClick={() => exporter(false)} className={ui.bouton.secondaire}>
                    Tout le stock
                  </button>
                  <button type="button" role="menuitem" onClick={() => exporter(true)} className={ui.bouton.secondaire}>
                    Seulement l&apos;affichage actuel
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={openAddModal}
              className={ui.bouton.primaire}
            >
              <Plus size={16} />
              Ajouter un médicament
            </button>
          </div>
        </div>
        <div className={ui.filtre.groupe}>
          <button onClick={() => setFilter("all")} aria-pressed={filter === "all"} className={`${ui.filtre.base} ${filter === "all" ? ui.filtre.actif : ui.filtre.inactif}`}>Tous</button>
          <button onClick={() => setFilter("low")} aria-pressed={filter === "low"} className={`${ui.filtre.base} ${filter === "low" ? ui.filtre.actifAttention : ui.filtre.inactif}`}>Alertes</button>
          <button onClick={() => setFilter("rupture")} aria-pressed={filter === "rupture"} className={`${ui.filtre.base} ${filter === "rupture" ? ui.filtre.actifDanger : ui.filtre.inactif}`}>Rupture</button>
          <button onClick={() => setFilter("qualifier")} aria-pressed={filter === "qualifier"} className={`${ui.filtre.base} ${filter === "qualifier" ? ui.filtre.actif : ui.filtre.inactif}`}>À qualifier ({nombreAQualifier})</button>
        </div>
      </div>

      {filter === "qualifier" && (
        <p className={ui.alerte.info}>
          Confirmez le nombre d&apos;unités par boîte de ces médicaments : ouvrez la fiche avec le bouton Modifier.
        </p>
      )}

      {/* Stock Table */}
      <div className={`${ui.carte} overflow-hidden p-0`}>
        <div className="overflow-x-auto">
          <table className={`${ui.tableau} table-fixed min-w-224`}>
            <colgroup>
              <col className="w-[22%] 2xl:w-[20%]" />
              <col className="hidden 2xl:table-column 2xl:w-[12%]" />
              <col className="w-[24%] 2xl:w-[18%]" />
              <col className="w-[11%] 2xl:w-[10%]" />
              <col className="w-[16%] 2xl:w-[14%]" />
              <col className="w-[9%] 2xl:w-[8%]" />
              <col className="w-[18%]" />
            </colgroup>
            <thead className={ui.enteteTableau}>
              <tr>
                <th className={`${ui.celluleEntete}`}>Produit</th>
                <th className={`${ui.celluleEntete} hidden 2xl:table-cell`}>Catégorie</th>
                <th className={`${ui.celluleEntete} whitespace-nowrap`}>Quantité</th>
                <th className={`${ui.celluleEntete} text-center`}>Péremption</th>
                <th className={`${ui.celluleEntete} text-right`}>Prix (GNF)</th>
                <th className={`${ui.celluleEntete} text-center`}>Statut</th>
                <th className={`${ui.celluleEntete} ${ui.enteteActions} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStocks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-12 text-center">
                    <Package className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                    <p className={ui.texte.petit}>
                      {stockInfo.stocks.length === 0
                        ? peutImporter
                          ? "Votre stock est vide. Ajoutez un médicament ou importez votre fichier Excel."
                          : "Votre stock est vide. Ajoutez un médicament."
                        : "Aucun médicament dans ce filtre."}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredStocks.map((s) => {
                  const enRupture = idsRupture.has(s.id);
                  const stockBas = !enRupture && idsStockBas.has(s.id);
                  const coefficient = s.coefficientBoite ?? 1;
                  const unite = s.uniteMinimale ?? "UNITE";
                  const nom = s.medicament.nom;
                  const jourPeremption = s.dateExpiration ? s.dateExpiration.slice(0, 10) : null;
                  // Le jour même reste vendable : périmé seulement après le jour de péremption.
                  const perime = jourPeremption !== null && jourPeremption < aujourdhui;
                  const lotsEnStock = (s.lots ?? []).filter((l) => l.quantite > 0).length;
                  return (
                  <tr key={s.id} className={`${ui.ligneTableau} group`}>
                    <td className={`${ui.cellule} max-w-0`}>
                      <p title={nom} className="truncate whitespace-nowrap text-mc-normal font-medium text-slate-900 dark:text-slate-100 group-hover:text-primary-600 transition-colors">{nom}</p>
                      <p title={s.medicament.nomGenerique || "Non renseigné"} className={`${ui.texte.legende} whitespace-nowrap`}>{s.medicament.nomGenerique || "Non renseigné"}</p>
                    </td>
                    <td className={`${ui.cellule} hidden 2xl:table-cell`}>
                      <span title={s.medicament.categorie} className={`${ui.badge.neutre} max-w-full`}>
                        <span className="truncate whitespace-nowrap">{s.medicament.categorie}</span>
                      </span>
                    </td>
                    <td className={ui.cellule}>
                      <div className="flex flex-col items-start gap-0.5">
                        <span className={`text-mc-normal font-medium ${enRupture ? 'text-rose-700 dark:text-rose-300' : stockBas ? 'text-amber-700 dark:text-amber-300' : 'text-slate-900 dark:text-slate-100'}`}>
                          {formaterQuantite(s.quantite, coefficient, unite)}
                        </span>
                        {s.reliquat && s.reliquat.length > 0 && (
                          <span className={ui.texte.legende}>boîte entamée</span>
                        )}
                        {formaterARegulariser(s.quantiteARegulariser, coefficient, unite) !== null && (
                          <span className="text-mc-legende text-amber-700 dark:text-amber-300">
                            {formaterARegulariser(s.quantiteARegulariser, coefficient, unite)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={ui.cellule}>
                      <div className="flex flex-col items-center gap-1">
                        {jourPeremption === null ? (
                          <span className={ui.texte.petit}>Sans date</span>
                        ) : (
                          <span className={`text-mc-normal whitespace-nowrap ${perime ? "text-rose-700 dark:text-rose-300" : "text-slate-900 dark:text-slate-100"}`}>
                            {afficherDatePeremption(jourPeremption)}
                            {perime && " Périmé"}
                          </span>
                        )}
                        {lotsEnStock > 1 && (
                          <span className={`${ui.texte.legende} whitespace-nowrap`}>
                            {`+${lotsEnStock - 1} autre${lotsEnStock - 1 > 1 ? "s" : ""} lot${lotsEnStock - 1 > 1 ? "s" : ""}`}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={`${ui.cellule} text-right tabular-nums whitespace-nowrap`}>
                      <div>{typeof s.prixUnitaire === "number" ? formaterGNF(s.prixUnitaire) : "Non renseigné"}</div>
                      {typeof s.prixUnite === "number" && (
                        <div className={`${ui.texte.legende} whitespace-nowrap`} title={`${formaterGNF(s.prixUnite)} ${LIBELLES_UNITE_MINIMALE[unite].article}`}>
                          {formaterGNF(s.prixUnite)} {LIBELLES_UNITE_MINIMALE[unite].article}
                        </div>
                      )}
                    </td>
                    <td className={`${ui.cellule} px-1 text-center`}>
                      <div className="flex flex-col items-center gap-1 whitespace-nowrap">
                        {enRupture ? (
                          <span className={ui.badge.danger}>Rupture</span>
                        ) : stockBas ? (
                          <span className={ui.badge.attention}>Stock bas</span>
                        ) : (
                          <span className={ui.badge.succes}>OK</span>
                        )}
                        {s.qualifie === false && (
                          <span className={ui.badge.attention}>À qualifier</span>
                        )}
                      </div>
                    </td>
                    <td className={`${ui.cellule} ${ui.celluleActions} text-right`}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEditModal(s)}
                          title="Modifier"
                          aria-label={`Modifier ${nom}`}
                          className={`${ui.bouton.iconePetit} hover:text-amber-700 dark:hover:text-amber-300`}
                        >
                          <Edit size={16} aria-hidden="true" />
                        </button>
                        <button
                          onClick={() => setStockACorriger(s)}
                          title="Corriger la quantité"
                          aria-label={`Corriger la quantité de ${nom}`}
                          className={`${ui.bouton.iconePetit} hover:text-amber-700 dark:hover:text-amber-300`}
                        >
                          <SlidersHorizontal size={16} aria-hidden="true" />
                        </button>
                        {s.quantite > 0 && (
                          <button
                            onClick={() => setStockASortir(s)}
                            title="Sortir du stock"
                            aria-label={`Sortir ${nom} du stock`}
                            className={`${ui.bouton.iconePetit} hover:text-amber-700 dark:hover:text-amber-300`}
                          >
                            <PackageMinus size={16} aria-hidden="true" />
                          </button>
                        )}
                        <button
                          onClick={() => openDeleteModal(s)}
                          title={`Archiver ${nom}`}
                          aria-label={`Archiver ${nom}`}
                          className={`${ui.bouton.iconePetit} hover:text-rose-700 dark:hover:text-rose-300`}
                        >
                          <Archive size={16} aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stock Add/Edit Modal */}
      {user?.structureId && (
        <StockModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          structureId={user.structureId}
          onSuccess={fetchData}
          editItem={selectedStock}
          fichesActives={stockInfo?.stocks}
          onModifierFiche={setSelectedStock}
        />
      )}

      {/* Import Excel du stock (F1) */}
      {user?.structureId && peutImporter && (
        <ImportStockModal
          modesPermis={modesPermis}
          isOpen={isImportOpen}
          onClose={() => setIsImportOpen(false)}
          structureId={user.structureId}
          onSuccess={fetchData}
        />
      )}

      {/* Correction de la quantité avec motif (D700) */}
      {user?.structureId && (
        <CorrectionQuantite
          isOpen={stockACorriger !== null}
          stock={stockACorriger}
          structureId={user.structureId}
          onClose={fermerCorrection}
          onSucces={handleCorrectionReussie}
        />
      )}

      {/* Sortie d'un lot avec une raison */}
      {user?.structureId && (
        <SortieStock
          isOpen={stockASortir !== null}
          stock={stockASortir}
          structureId={user.structureId}
          onClose={fermerSortie}
          onSucces={handleCorrectionReussie}
        />
      )}

      {/* Archive Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Archiver ce médicament ?"
        confirmLabel="Archiver"
        libelleEnCours="Archivage..."
        icone={Archive}
        description={
          <>
            <strong>{selectedStock?.medicament.nom}</strong> disparaîtra de la liste du stock et de la vente. Son historique (ventes, mouvements) est conservé. Vous pourrez le remettre en stock en l&apos;ajoutant de nouveau.
          </>
        }
      />
    </div>
  );
}
