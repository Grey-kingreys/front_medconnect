"use client";

import { useCallback, useState } from "react";
import {
  uploadToR2,
  type FileVisibility,
  type StoredFileView,
} from "@/lib/api_storage";

/**
 * Hook d'upload R2 réutilisable : gère l'état (en cours, progression, erreur)
 * du flux presign → PUT → confirm. Renvoie le StoredFile confirmé, ou null en cas
 * d'échec (l'erreur est exposée via `error`).
 */
export function useR2Upload() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(
    async (
      file: File,
      opts: { visibility: FileVisibility; prefix?: string },
    ): Promise<StoredFileView | null> => {
      setUploading(true);
      setProgress(0);
      setError(null);
      try {
        return await uploadToR2(file, { ...opts, onProgress: setProgress });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Téléversement échoué.");
        return null;
      } finally {
        setUploading(false);
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setUploading(false);
    setProgress(0);
    setError(null);
  }, []);

  return { upload, uploading, progress, error, reset };
}
