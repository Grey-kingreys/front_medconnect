"use client";
import { LoadingSpinner } from "@/components/LoadingSpinner";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { 
  Plus, 
  Search, 
  Pill, 
  Edit, 
  Trash2, 
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Package,
  FileSpreadsheet,
} from "lucide-react";
import { 
  getCatalogue, 
  Medicament, 
  createMedicament, 
  updateMedicament, 
  deleteMedicament 
} from "@/lib/api_pharmacie";
import { ui } from "@/theme/ui";
import { DeleteConfirmModal } from "@/components/modals/DeleteConfirmModal";
import { ImportCatalogueModal } from "@/components/modals/ImportStockModal";

export default function CataloguePage() {
  const { profile } = useAuth();
  // Même règle que le serveur : l'import exige la permission d'ajouter au catalogue
  const peutImporter = profile?.permissions?.includes("catalogue:write") ?? false;
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [medicaments, setMedicaments] = useState<Medicament[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedMed, setSelectedMed] = useState<Medicament | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    nom: "",
    nomGenerique: "",
    categorie: "",
    description: "",
    ordonnanceRequise: false,
    formes: [] as string[]
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getCatalogue(search);
      setMedicaments(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => fetchData(), 500);
    return () => clearTimeout(timer);
  }, [fetchData]);

  const openAddModal = () => {
    setSelectedMed(null);
    setForm({ nom: "", nomGenerique: "", categorie: "", description: "", ordonnanceRequise: false, formes: [] });
    setError("");
    setIsModalOpen(true);
  };

  const openEditModal = (med: Medicament) => {
    setSelectedMed(med);
    setForm({
      nom: med.nom,
      nomGenerique: med.nomGenerique || "",
      categorie: med.categorie,
      description: med.description || "",
      ordonnanceRequise: med.ordonnanceRequise,
      formes: med.formes || []
    });
    setError("");
    setIsModalOpen(true);
  };

  const openDeleteModal = (med: Medicament) => {
    setSelectedMed(med);
    setIsDeleteModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (selectedMed) {
        await updateMedicament(selectedMed.id, form);
      } else {
        await createMedicament(form);
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedMed) return;
    await deleteMedicament(selectedMed.id);
    setIsDeleteModalOpen(false);
    fetchData();
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h1 className={ui.titrePage}>
            Catalogue Global
          </h1>
          <p className={`${ui.texte.petit} mt-1`}>Gérez la liste de référence des médicaments pour toutes les pharmacies.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          {peutImporter && (
            <button
              type="button"
              onClick={() => setIsImportOpen(true)}
              className={`${ui.bouton.secondaire} w-full sm:w-auto`}
            >
              <FileSpreadsheet className="w-5 h-5" />
              Importer depuis Excel
            </button>
          )}
          <button
            onClick={openAddModal}
            className={`${ui.bouton.primaire} w-full sm:w-auto group`}
          >
            <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
            Ajouter au catalogue
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input 
          type="text" 
          placeholder="Rechercher un médicament dans le catalogue..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${ui.champ} pl-12`}
        />
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-mc-grand overflow-hidden shadow-mc">
        <div className="overflow-x-auto">
          <table className={ui.tableau}>
            <thead>
              <tr className={ui.enteteTableau}>
                <th className={`${ui.celluleEntete} text-left`}>Médicament</th>
                <th className={`${ui.celluleEntete} text-left`}>Générique (DCI)</th>
                <th className={`${ui.celluleEntete} text-left`}>Catégorie</th>
                <th className={`${ui.celluleEntete} text-center`}>Ordonnance</th>
                <th className={`${ui.celluleEntete} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
              {loading && medicaments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-16 text-center">
                    <LoadingSpinner />
                    <p className={ui.texte.petit}>Chargement du catalogue...</p>
                  </td>
                </tr>
              ) : medicaments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-16 text-center">
                    <Package className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                    <p className={`${ui.texte.petit} font-medium`}>Aucun médicament trouvé.</p>
                  </td>
                </tr>
              ) : (
                medicaments.map((m) => (
                  <tr key={m.id} className={`group ${ui.ligneTableau}`}>
                    <td className={ui.cellule}>
                      <div className="flex items-center gap-4">
                        <div className={ui.carteChiffre.icone}>
                          <Pill className="w-5 h-5" />
                        </div>
                        <p className="font-semibold text-slate-900 dark:text-white">{m.nom}</p>
                      </div>
                    </td>
                    <td className={`${ui.cellule} text-slate-500 italic`}>{m.nomGenerique || "Non renseigné"}</td>
                    <td className={ui.cellule}>
                      <span className={ui.badge.neutre}>
                        {m.categorie}
                      </span>
                    </td>
                    <td className={`${ui.cellule} text-center`}>
                      {m.ordonnanceRequise ? (
                        <span className={ui.badge.attention}>Requis</span>
                      ) : (
                        <span className={ui.badge.succes}>Libre</span>
                      )}
                    </td>
                    <td className={`${ui.cellule} text-right`}>
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => openEditModal(m)}
                          className={`${ui.bouton.icone} hover:text-amber-700 dark:hover:text-amber-300`}
                          title="Modifier"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => openDeleteModal(m)}
                          className={`${ui.bouton.icone} hover:text-rose-700 dark:hover:text-rose-300`}
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/50 animate-fade-in">
          <div className={`${ui.dialogue.panneauLarge} overflow-hidden`}>
            <div className="p-mc-carte border-b border-slate-100 dark:border-slate-800/50 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-mc-grand flex items-center justify-center ${selectedMed ? 'bg-amber-500/10 text-amber-500' : 'bg-primary-500/10 text-primary-500'}`}>
                  <Pill className="w-6 h-6" />
                </div>
                <h2 className="text-mc-section font-semibold text-slate-900 dark:text-white">
                  {selectedMed ? "Modifier le médicament" : "Nouveau Médicament"}
                </h2>
              </div>
              <button onClick={() => setIsModalOpen(false)} className={ui.bouton.icone}>
                <XCircle className="w-6 h-6 text-slate-400" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-mc-carte space-y-4">
              <div className="space-y-2">
                <label className={ui.label}>Nom commercial</label>
                <input 
                  type="text" required
                  placeholder="Ex: Coartem 20/120"
                  value={form.nom}
                  onChange={(e) => setForm({...form, nom: e.target.value})}
                  className={ui.champ}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className={ui.label}>DCI (Générique)</label>
                  <input 
                    type="text" placeholder="Ex: Artémether"
                    value={form.nomGenerique}
                    onChange={(e) => setForm({...form, nomGenerique: e.target.value})}
                    className={ui.champ}
                  />
                </div>
                <div className="space-y-2">
                  <label className={ui.label}>Catégorie</label>
                  <input 
                    type="text" required placeholder="Ex: Antipaludéen"
                    value={form.categorie}
                    onChange={(e) => setForm({...form, categorie: e.target.value})}
                    className={ui.champ}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className={ui.label}>Description</label>
                <textarea 
                  placeholder="Usage, contre-indications..."
                  value={form.description}
                  onChange={(e) => setForm({...form, description: e.target.value})}
                  className={`${ui.zoneTexte} h-24`}
                />
              </div>

              <label className="flex items-center gap-3 cursor-pointer group">
                <input 
                  type="checkbox"
                  checked={form.ordonnanceRequise}
                  onChange={(e) => setForm({...form, ordonnanceRequise: e.target.checked})}
                  className="w-5 h-5 rounded-mc-petit border-slate-300 text-primary-500 focus:ring-primary-500"
                />
                <span className="text-mc-normal font-semibold text-slate-600 dark:text-slate-400 group-hover:text-primary-500 transition-colors">Vendu uniquement sur ordonnance ?</span>
              </label>

              {error && (
                <div className={ui.alerte.erreur}>
                  <AlertCircle className="w-5 h-5" />
                  <p>{error}</p>
                </div>
              )}

              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className={`${ui.bouton.secondaire} flex-1`}>Annuler</button>
                <button type="submit" disabled={saving} className={`${ui.bouton.primaire} flex-[2]`}>
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                  {selectedMed ? "Mettre à jour" : "Enregistrer au catalogue"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Excel du catalogue */}
      {peutImporter && (
        <ImportCatalogueModal
          isOpen={isImportOpen}
          onClose={() => setIsImportOpen(false)}
          onSuccess={fetchData}
        />
      )}

      {/* Delete Modal */}
      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
        title="Supprimer le médicament ?"
        description={
          <>
            Êtes-vous sûr de vouloir supprimer <strong>{selectedMed?.nom}</strong> du catalogue ? Cette action est irréversible et affectera tous les stocks liés.
          </>
        }
      />
    </div>
  );
}
