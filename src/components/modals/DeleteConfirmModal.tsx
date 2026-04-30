import { useState } from "react";
import { Trash2, Loader2 } from "lucide-react";
import { deleteUser, AdminUser, ApiError } from "@/lib/api_admin";

export function DeleteConfirmModal({
  user,
  onClose,
  onDeleted,
}: {
  user: AdminUser;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteUser(user.id);
      onDeleted();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur lors de la suppression.");
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-[#0f172a]/95 backdrop-blur-2xl border border-emergency-500/20 rounded-3xl shadow-2xl shadow-emergency-500/10 p-6 animate-slide-up">
        <div className="flex flex-col items-center text-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-emergency-500/10 flex items-center justify-center">
            <Trash2 className="w-7 h-7 text-emergency-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Supprimer l&apos;utilisateur</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Êtes-vous sûr de vouloir supprimer{" "}
              <strong className="text-slate-900 dark:text-white">
                {user.prenom} {user.nom}
              </strong>{" "}
              ? Cette action est irréversible.
            </p>
          </div>
          {error && (
            <p className="text-sm text-emergency-400">{error}</p>
          )}
          <div className="flex gap-3 w-full">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm text-slate-500 dark:text-slate-400 border border-slate-700/50 hover:bg-slate-800/50 transition-all"
            >
              Annuler
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-emergency-600 hover:bg-emergency-500 transition-all disabled:opacity-60"
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
