"use client";

import { useEtatPoste } from "@/lib/caisse/etat_poste";
import type { EtatPosteDesktop } from "@/lib/caisse/contrat_desktop";
import { ALERTE_ATTENTION, ALERTE_ERREUR, ALERTE_INFO } from "@/components/pharmacie/classes";

const ventes = (n: number) => (n === 1 ? "1 vente" : `${n} ventes`);
const operations = (n: number) => (n === 1 ? "1 opération refusée" : `${n} opérations refusées`);

interface Ligne {
  texte: string;
  classe: string;
}

/** État du poste en une phrase : une seule parmi les six cas, par ordre de gravité. */
function ligneEtat(e: EtatPosteDesktop): Ligne | null {
  if (e.autrePharmacie) return { texte: "Ce poste est rattaché à une autre pharmacie.", classe: ALERTE_ERREUR };
  if (!e.catalogueDisponible) {
    return { texte: "Connectez ce poste à internet une première fois pour charger le catalogue.", classe: ALERTE_ATTENTION };
  }
  if (e.connexionARefaire) {
    return {
      texte: `Reconnectez-vous pour envoyer les ventes de ce poste. Elles restent enregistrées (${e.fileEnAttente} en attente).`,
      classe: ALERTE_ATTENTION,
    };
  }
  if (e.horsLigne) {
    return {
      texte: `Hors connexion : les ventes sont enregistrées sur ce poste (${e.fileEnAttente} en attente d'envoi).`,
      classe: ALERTE_ATTENTION,
    };
  }
  // Démarrage : aucun contact n'a encore échoué ni réussi, ce n'est pas une coupure.
  if (!e.enLigne) return { texte: "Connexion au serveur en cours...", classe: ALERTE_INFO };
  if (e.fileEnAttente > 0) {
    return { texte: `En ligne : ${ventes(e.fileEnAttente)} en cours d'envoi.`, classe: ALERTE_INFO };
  }
  return null;
}

/** Alertes à ne jamais masquer, l'envoi bloqué d'abord (D754). */
function pastilles(e: EtatPosteDesktop): string[] {
  const liste: string[] = [];
  if (e.messageEnvoi) liste.push(e.messageEnvoi);
  if (e.plageEpuisee) liste.push("Numéros de tickets épuisés : les ventes continuent, avec un numéro de secours.");
  if (e.rejetes > 0) {
    liste.push(`${operations(e.rejetes)} par le serveur : le titulaire les voit dans ses anomalies.`);
  }
  if (e.heureFausse) liste.push("L'heure de cet ordinateur semble fausse : vérifiez-la, elle sert aux péremptions.");
  if (e.posteDesactive) {
    liste.push(
      "Ce poste a été désactivé : les ventes sont encore envoyées, mais le catalogue n'est plus mis à jour. Contactez le titulaire.",
    );
  }
  return liste;
}

/** Bandeau d'état du poste desktop, en haut du tableau de bord. N'affiche rien sur le web. */
export function BandeauPoste() {
  const { pont, etat } = useEtatPoste();
  if (pont === null || etat === null) return null;

  const ligne = ligneEtat(etat);
  const alertes = pastilles(etat);

  return (
    <div className="mb-4 space-y-2 print:hidden">
      {ligne === null ? (
        <p role="status" className="text-xs font-medium text-slate-600 dark:text-slate-400">
          En ligne
        </p>
      ) : (
        <p role="status" className={ligne.classe}>
          {ligne.texte}
        </p>
      )}
      {alertes.map((texte) => (
        <p key={texte} role="alert" className={ALERTE_ATTENTION}>
          {texte}
        </p>
      ))}
    </div>
  );
}
