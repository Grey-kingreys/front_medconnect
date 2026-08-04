"use client";

import { useId, useRef, useState } from "react";
import { useR2Upload } from "@/hooks/useR2Upload";
import type { FileVisibility, StoredFileView } from "@/lib/api_storage";

interface FileUploadProps {
  /** Bucket cible : "public" (avatar/logo) ou "private" (document médical). */
  visibility: FileVisibility;
  /** Dossier logique = préfixe de clé (ex. "avatars", "analyses"). */
  prefix?: string;
  /** Types MIME acceptés côté navigateur (ex. "image/png,image/jpeg"). */
  accept?: string;
  /** Taille max indicative côté client (Mo) — la limite réelle est appliquée par le serveur. */
  maxSizeMb?: number;
  /** Libellé du bouton. */
  label?: string;
  /** Appelé avec le StoredFile confirmé une fois l'upload terminé. */
  onUploaded: (file: StoredFileView) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Bouton d'upload R2 réutilisable (presign → PUT direct → confirm), avec
 * progression et gestion d'erreur. Ne rattache PAS le fichier à une entité :
 * l'appelant reçoit le StoredFile et décide quoi en faire (avatar, logo, document…).
 */
export default function FileUpload({
  visibility,
  prefix,
  accept,
  maxSizeMb,
  label = "Téléverser un fichier",
  onUploaded,
  disabled,
  className = "",
}: FileUploadProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const { upload, uploading, progress, error } = useR2Upload();
  const [localError, setLocalError] = useState<string | null>(null);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLocalError(null);

    if (maxSizeMb && file.size > maxSizeMb * 1024 * 1024) {
      setLocalError(`Fichier trop volumineux (max ${maxSizeMb} Mo).`);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    const result = await upload(file, { visibility, prefix });
    if (result) onUploaded(result);
    if (inputRef.current) inputRef.current.value = "";
  };

  const shownError = localError || error;

  return (
    <div className={className}>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={accept}
        onChange={handleChange}
        disabled={disabled || uploading}
        className="hidden"
      />
      <label
        htmlFor={inputId}
        aria-disabled={disabled || uploading}
        className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border border-blue-600 px-4 py-2 text-sm font-medium text-blue-600 transition hover:bg-blue-50 ${
          disabled || uploading ? "cursor-not-allowed opacity-60" : ""
        }`}
      >
        {uploading ? `Téléversement… ${progress}%` : label}
      </label>

      {uploading && (
        <div
          className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-200"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full bg-blue-600 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {shownError && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {shownError}
        </p>
      )}
    </div>
  );
}
