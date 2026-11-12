"use client";

import { useState, ReactNode } from "react";
import { Trash2, Loader2, AlertTriangle, type LucideIcon } from "lucide-react";
import { useDialogA11y } from "@/hooks/useDialogA11y";
import { ui } from "@/theme/ui";

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  title?: string;
  description: ReactNode;
  confirmLabel?: string;
  /** Icône de la modale (corbeille par défaut) */
  icone?: LucideIcon;
  /** Texte du bouton pendant l'action ("Suppression..." par défaut) */
  libelleEnCours?: string;
  /** Texte du bouton qui ferme la modale sans agir ("Annuler" par défaut) */
  libelleAnnuler?: string;
}

export function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirmer la suppression",
  description,
  confirmLabel = "Supprimer",
  icone: Icone = Trash2,
  libelleEnCours = "Suppression...",
  libelleAnnuler = "Annuler",
}: DeleteConfirmModalProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const { dialogProps, titleId } = useDialogA11y({ isOpen, onClose, closeOnEscape: !deleting });

  if (!isOpen) return null;

  const handleDelete = async () => {
    setDeleting(true);
    setError("");
    try {
      await onConfirm();
      onClose();
    } catch (err: unknown) {
      setError((err instanceof Error && err.message) || "Erreur lors de la suppression.");
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className={`${ui.dialogue.fond} backdrop-blur-sm`} onClick={onClose} aria-hidden="true" />
      <div {...dialogProps} className={ui.dialogue.panneauEtroit}>
        <div className="flex flex-col items-center text-center gap-5">

          <div className={ui.dialogue.iconeDanger}>
            <Icone className="w-7 h-7" />
          </div>

          <div className="space-y-2">
            <h3 id={titleId} className={ui.texte.section}>{title}</h3>
            <div className={ui.texte.petit}>
              {description}
            </div>
          </div>

          {error && (
            <div className={`${ui.alerte.erreur} w-full`}>
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <div className="flex gap-3 w-full pt-2">
            <button
              onClick={onClose}
              disabled={deleting}
              className={`${ui.bouton.secondaire} flex-1`}
            >
              {libelleAnnuler}
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className={`${ui.bouton.danger} flex-[2]`}
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icone className="w-4 h-4" />}
              {deleting ? libelleEnCours : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
