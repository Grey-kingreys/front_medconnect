/**
 * MedConnecte — Stockage objets (Cloudflare R2).
 *
 * Flux d'upload : presign (API) → PUT DIRECT sur R2 → confirm (API).
 * Le PUT vers R2 est le SEUL appel réseau qui ne passe pas par `authFetch`
 * (le fichier ne transite jamais par l'API). Tout le reste passe par `authFetch`
 * (Bearer + refresh auto). Cf. back_medconnect/src/storage/.
 */

import { authFetch } from "./api_auth";

export type FileVisibility = "public" | "private";

export interface PresignResult {
  id: string;
  key: string;
  uploadUrl: string;
  expiresIn: number;
}

export interface StoredFileView {
  id: string;
  key: string;
  bucket: "PUBLIC" | "PRIVATE";
  mimeType: string;
  size: number;
  originalName: string;
  status: "PENDING" | "CONFIRMED";
  /** URL publique pérenne (bucket public) ou null (privé → passer par getReadUrl). */
  url: string | null;
  createdAt: string;
  confirmedAt: string | null;
}

export interface ReadUrlResult {
  url: string;
  /** Secondes de validité (privé) ou null (URL publique pérenne). */
  expiresIn: number | null;
}

// ─── Appels API (via authFetch) ─────────────────────────────────

export function presignUpload(body: {
  filename: string;
  contentType: string;
  visibility: FileVisibility;
  prefix?: string;
  size?: number;
}) {
  return authFetch<PresignResult>("/storage/presign", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function confirmUpload(id: string) {
  return authFetch<StoredFileView>("/storage/confirm", {
    method: "POST",
    body: JSON.stringify({ id }),
  });
}

/** URL de lecture d'un fichier : CDN pérenne (public) ou présignée courte (privé). */
export function getReadUrl(id: string) {
  return authFetch<ReadUrlResult>(`/storage/${id}/read-url`);
}

export function deleteStoredFile(id: string) {
  return authFetch<null>(`/storage/${id}`, { method: "DELETE" });
}

// ─── PUT direct sur R2 (hors API, avec progression) ─────────────

/**
 * Téléverse le fichier directement sur R2 via l'URL présignée. XHR (et non fetch)
 * pour exposer la progression — utile sur connexions instables. Le header
 * Content-Type DOIT correspondre à celui signé lors du presign.
 */
export function putToR2(
  uploadUrl: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Échec du téléversement (HTTP ${xhr.status}).`));
    xhr.onerror = () => reject(new Error("Erreur réseau pendant le téléversement."));
    xhr.send(file);
  });
}

// ─── Orchestration presign → PUT → confirm ──────────────────────

/**
 * Téléverse un fichier de bout en bout et renvoie le StoredFile confirmé
 * (son `id` est celui à rattacher à une entité : avatar, logo, document…).
 */
export async function uploadToR2(
  file: File,
  opts: {
    visibility: FileVisibility;
    prefix?: string;
    onProgress?: (percent: number) => void;
  },
): Promise<StoredFileView> {
  const { data: ticket } = await presignUpload({
    filename: file.name,
    contentType: file.type,
    visibility: opts.visibility,
    prefix: opts.prefix,
    size: file.size,
  });
  await putToR2(ticket.uploadUrl, file, opts.onProgress);
  const { data: confirmed } = await confirmUpload(ticket.id);
  return confirmed;
}

/** Ouvre un document privé (URL présignée courte) dans un nouvel onglet. */
export async function openStoredFile(id: string): Promise<void> {
  const { data } = await getReadUrl(id);
  if (typeof window !== "undefined") window.open(data.url, "_blank", "noopener");
}
