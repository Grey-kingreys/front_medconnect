// Contrôle de NEXT_PUBLIC_API_URL pour les scripts de construction : `https://`, ou `http://` seulement
// pour 127.0.0.1 ou localhost (développement). Toute autre adresse arrête la construction (code 1).
export function exigerAdresseApi() {
  const adresse = process.env.NEXT_PUBLIC_API_URL ?? "";
  let valide = false;
  try {
    const url = new URL(adresse);
    valide =
      url.protocol === "https:" ||
      (url.protocol === "http:" && (url.hostname === "127.0.0.1" || url.hostname === "localhost"));
  } catch {
    valide = false;
  }
  if (!valide) {
    console.error(
      "Indiquez NEXT_PUBLIC_API_URL : l'adresse de l'API que cette caisse doit appeler (https://, ou http:// seulement pour 127.0.0.1 ou localhost).",
    );
    process.exit(1);
  }
  return adresse;
}
