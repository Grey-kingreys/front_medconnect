/**
 * Identifiants stables créés par le poste. Un lot créé hors ligne (réception, inventaire) doit connaître son
 * identifiant avant l'envoi, pour qu'une vente ou une sortie locale puisse déjà le viser, et pour que le
 * serveur ne le crée qu'une fois si l'événement est rejoué. L'identifiant est un UUID v5 (SHA-1) dérivé de la
 * pièce qui crée le lot et du rang de la ligne : le même couple donne toujours le même identifiant.
 */
import { createHash } from "node:crypto";

/** Espace de noms fixe des identifiants de lot du poste (UUID tiré une fois, jamais modifié). */
export const ESPACE_LOTS_POSTE = "6f1d4b0e-5a2c-4c7e-9b38-2d1e7a94c5f3";

const MOTIF_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** UUID v5 (RFC 4122) d'un nom dans un espace de noms. */
export function uuidV5(nom: string, espace: string = ESPACE_LOTS_POSTE): string {
  if (!MOTIF_UUID.test(espace)) throw new Error("L'espace de noms doit être un UUID.");
  const hash = createHash("sha1")
    .update(Buffer.from(espace.replace(/-/g, ""), "hex"))
    .update(Buffer.from(nom, "utf8"))
    .digest();
  const o = Buffer.from(hash.subarray(0, 16));
  o[6] = (o[6] & 0x0f) | 0x50;
  o[8] = (o[8] & 0x3f) | 0x80;
  const h = o.toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Identifiant du lot créé par la ligne `index` (à partir de 0) de la pièce `pieceId` : toujours le même pour le même couple. */
export function idLotDeterministe(pieceId: string, index: number): string {
  if (pieceId === "" || !Number.isInteger(index) || index < 0) {
    throw new Error("Identifiant de lot : pièce et rang de ligne valides requis.");
  }
  return uuidV5(`lot:${pieceId}:${index}`);
}

/** Identifiant fourni par l'événement s'il est un UUID valide, sinon identifiant dérivé de la pièce et du rang. */
export function idLotOuDerive(fourni: string | undefined | null, pieceId: string, index: number): string {
  return fourni !== undefined && fourni !== null && MOTIF_UUID.test(fourni)
    ? fourni.toLowerCase()
    : idLotDeterministe(pieceId, index);
}
