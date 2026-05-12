"use client";

import { useState } from "react";
import { Trash2, Loader2, AlertTriangle } from "lucide-react";

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  title?: string;
  description: string;
  confirmLabel?: string;
}

export function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirmer la suppression",
  description,
  confirmLabel = "Supprimer",
}: DeleteConfirmModalProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleDelete = async () => {
    setDeleting(true);
    setError("");
    try {
      await onConfirm();
      onClose();
    } catch (err: any) {
      setError(err?.message || "Erreur lors de la suppression.");
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-8 animate-slide-up">
        <div className="flex flex-col items-center text-center gap-5">

          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 flex items-center justify-center">
            <Trash2 className="w-8 h-8 text-rose-500" />
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">{title}</h3>
            <p
              className="text-sm text-slate-500 dark:text-slate-400"
              dangerouslySetInnerHTML={{ __html: description }}
            />
          </div>

          {error && (
            <div className="w-full flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-500 text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <p>{error}</p>
            </div>
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
              className="flex-[2] flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-white bg-rose-600 hover:bg-rose-500 transition-all shadow-lg shadow-rose-500/20 disabled:opacity-60"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {deleting ? "Suppression..." : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
