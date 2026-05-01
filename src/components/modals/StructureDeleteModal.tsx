import { useState } from "react";
import { Trash2, Loader2, AlertTriangle } from "lucide-react";
import { deleteStructure, Structure, ApiError } from "@/lib/api_admin";

interface StructureDeleteModalProps {
  structure: Structure;
  onClose: () => void;
  onDeleted: () => void;
}

export function StructureDeleteModal({
  structure,
  onClose,
  onDeleted,
}: StructureDeleteModalProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [confirmName, setConfirmName] = useState("");

  const handleDelete = async () => {
    if (confirmName !== structure.nom) return;
    
    setDeleting(true);
    setError("");
    try {
      await deleteStructure(structure.id);
      onDeleted();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur lors de la suppression.");
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-8 animate-slide-up">
        <div className="flex flex-col items-center text-center gap-6">
          <div className="w-16 h-16 rounded-2xl bg-emergency-500/10 flex items-center justify-center">
            <Trash2 className="w-8 h-8 text-emergency-500" />
          </div>
          
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Supprimer la structure ?</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Cette action est <span className="text-emergency-500 font-bold uppercase tracking-tighter">irréversible</span>. 
              Tous les membres, médecins et données associés à <span className="text-slate-900 dark:text-white font-semibold">{structure.nom}</span> seront définitivement supprimés.
            </p>
          </div>

          <div className="w-full p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex gap-3 text-left">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <p className="text-xs text-amber-600 dark:text-amber-400 leading-relaxed">
              Pour confirmer, veuillez saisir le nom exact de la structure ci-dessous.
            </p>
          </div>

          <div className="w-full space-y-2">
            <input
              type="text"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={structure.nom}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-emergency-500/50 text-center font-medium transition-all"
            />
          </div>

          {error && (
            <p className="text-sm text-emergency-500 bg-emergency-500/10 px-4 py-2 rounded-lg w-full">{error}</p>
          )}

          <div className="flex gap-3 w-full pt-2">
            <button
              onClick={onClose}
              disabled={deleting}
              className="flex-1 px-4 py-3 rounded-xl text-sm font-medium text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting || confirmName !== structure.nom}
              className="flex-[2] flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-white bg-emergency-600 hover:bg-emergency-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-emergency-500/20"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {deleting ? "Suppression..." : "Confirmer la suppression"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
