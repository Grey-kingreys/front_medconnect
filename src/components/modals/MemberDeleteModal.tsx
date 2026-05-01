import { useState } from "react";
import { Trash2, Loader2, AlertTriangle } from "lucide-react";
import { deleteMembre, Membre, ApiError } from "@/lib/api_structure";

interface MemberDeleteModalProps {
  member: Membre;
  structureId: string;
  onClose: () => void;
  onDeleted: () => void;
}

export function MemberDeleteModal({
  member,
  structureId,
  onClose,
  onDeleted,
}: MemberDeleteModalProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const handleDelete = async () => {
    setDeleting(true);
    setError("");
    try {
      await deleteMembre(structureId, member.id);
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
      <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-8 animate-slide-up">
        <div className="flex flex-col items-center text-center gap-6">
          <div className="w-16 h-16 rounded-2xl bg-emergency-500/10 flex items-center justify-center">
            <Trash2 className="w-8 h-8 text-emergency-500" />
          </div>
          
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Supprimer le membre ?</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Êtes-vous sûr de vouloir supprimer <span className="text-slate-900 dark:text-white font-semibold">{member.prenom} {member.nom}</span> ?
              <br /><br />
              Toutes ses données, consultations et accès seront définitivement supprimés.
            </p>
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
              disabled={deleting}
              className="flex-[2] flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-white bg-emergency-600 hover:bg-emergency-500 transition-all shadow-lg shadow-emergency-500/20"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {deleting ? "Suppression..." : "Supprimer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
