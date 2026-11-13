/**
 * Corps de la vente à crédit : celui d'une vente ordinaire (corpsVente, sans `paiements`, donc réglée à crédit)
 * auquel s'ajoutent le client et la date limite. Logique pure.
 */
import type { CorpsCreationVente } from "@/lib/api_ventes";
import { corpsVente, type PanierVente } from "../../vente/panier";

export type ClientChoisi =
  | { genre: "existant"; id: string }
  | { genre: "nouveau"; nomComplet: string; telephone: string };

export function corpsCredit(
  panier: PanierVente,
  surOrdonnance: boolean,
  client: ClientChoisi,
  dateLimite: string,
): CorpsCreationVente {
  // Le client du crédit remplace le nom et le téléphone d'un client ordinaire : le panier du crédit n'en porte pas.
  const corps = corpsVente({ ...panier, clientNom: "", clientTelephone: "" }, surOrdonnance);
  if (client.genre === "existant") {
    corps.clientCreditId = client.id;
  } else {
    const telephone = client.telephone.trim();
    corps.nouveauClientCredit = {
      nomComplet: client.nomComplet.trim(),
      ...(telephone !== "" ? { telephone } : {}),
    };
  }
  if (dateLimite !== "") corps.dateLimiteCredit = dateLimite;
  return corps;
}
