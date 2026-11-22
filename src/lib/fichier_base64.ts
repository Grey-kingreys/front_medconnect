/** Contenu d'un fichier en base64 (sans préfixe), par morceaux pour ne pas saturer la pile sur un fichier d'un Mo. */
export async function fichierEnBase64(fichier: File): Promise<string> {
  const octets = new Uint8Array(await fichier.arrayBuffer());
  const MORCEAU = 0x8000;
  let binaire = "";
  for (let i = 0; i < octets.length; i += MORCEAU) {
    binaire += String.fromCharCode(...octets.subarray(i, i + MORCEAU));
  }
  return btoa(binaire);
}
