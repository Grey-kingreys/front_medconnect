// Préchargement en bac à sable. Le pont n'expose que des méthodes nommées : jamais `ipcRenderer`
// (ni ses méthodes génériques), jamais l'objet d'événement. La validation se fait dans le processus principal.
import { contextBridge, ipcRenderer } from "electron";

const argument = process.argv.find((a) => a.startsWith("--mc-version="));
const version = argument ? argument.slice("--mc-version=".length) : "inconnue";

const appeler = (canal: string, ...args: unknown[]) => ipcRenderer.invoke(canal, ...args);

/** Abonnement à un événement du processus principal ; seule la donnée traverse, jamais l'événement. */
function abonner<T>(canal: string, rappel: (donnee: T) => void): () => void {
  const ecouteur = (_evenement: unknown, donnee: T) => rappel(donnee);
  ipcRenderer.on(canal, ecouteur);
  return () => {
    ipcRenderer.removeListener(canal, ecouteur);
  };
}

contextBridge.exposeInMainWorld("medconnecteDesktop", {
  version,
  definirJeton: (jeton: string | null) => appeler("jeton", jeton),
  deconnexion: () => appeler("deconnexion"),
  surDemandeJeton: (rappel: () => void) => abonner<void>("demande-jeton", () => rappel()),
  profil: { lire: () => appeler("profil:lire") },
  etat: () => appeler("etat"),
  surEtat: (rappel: (etat: unknown) => void) => abonner<unknown>("etat", rappel),
  caisse: {
    chargerStock: (s: string) => appeler("caisse:chargerStock", s),
    chargerReferentiels: (s: string) => appeler("caisse:chargerReferentiels", s),
    etatCaisse: (s: string, u: string) => appeler("caisse:etatCaisse", s, u),
    creerVente: (s: string, corps: unknown, cle: string) => appeler("caisse:creerVente", s, corps, cle),
    ouvrirSession: (s: string, corps: unknown) => appeler("caisse:ouvrirSession", s, corps),
    saisirComptage: (s: string, sessionId: string, corps: unknown) => appeler("caisse:saisirComptage", s, sessionId, corps),
    enregistrerMouvement: (s: string, sessionId: string, corps: unknown) =>
      appeler("caisse:enregistrerMouvement", s, sessionId, corps),
    getBilan: (s: string, sessionId: string) => appeler("caisse:getBilan", s, sessionId),
    fermerSession: (s: string, sessionId: string, corps: unknown) => appeler("caisse:fermerSession", s, sessionId, corps),
    listerVentes: (s: string, options: unknown) => appeler("caisse:listerVentes", s, options),
    getVente: (s: string, venteId: string) => appeler("caisse:getVente", s, venteId),
    enregistrerAnnulationServeur: (reponse: unknown) => appeler("caisse:enregistrerAnnulationServeur", reponse),
  },
  // Domaines pharmacie à venir : chacun recevra ses fonctions sur le modèle de `caisse` (canal `<domaine>:<fonction>`).
  stock: {
    sortir: (s: string, corps: unknown) => appeler("stock:sortir", s, corps),
    corriger: (s: string, stockId: string, corps: unknown) => appeler("stock:corriger", s, stockId, corps),
    exporter: (s: string, options: unknown) => appeler("stock:exporter", s, options),
  },
  reception: {
    enregistrer: (s: string, corps: unknown) => appeler("reception:enregistrer", s, corps),
    lister: (s: string, options: unknown) => appeler("reception:lister", s, options),
    lire: (s: string, receptionId: string) => appeler("reception:lire", s, receptionId),
  },
  fournisseur: {
    lister: (s: string) => appeler("fournisseur:lister", s),
    creer: (s: string, corps: unknown) => appeler("fournisseur:creer", s, corps),
  },
  inventaire: {
    enregistrer: (s: string, corps: unknown) => appeler("inventaire:enregistrer", s, corps),
    lister: (s: string, options: unknown) => appeler("inventaire:lister", s, options),
    lire: (s: string, inventaireId: string) => appeler("inventaire:lire", s, inventaireId),
  },
  credit: {
    lister: (s: string, options: unknown) => appeler("credit:lister", s, options),
    lire: (s: string, clientId: string) => appeler("credit:lire", s, clientId),
    creerClient: (s: string, corps: unknown) => appeler("credit:creerClient", s, corps),
    modifierClient: (s: string, clientId: string, corps: unknown) => appeler("credit:modifierClient", s, clientId, corps),
    modifierDateLimite: (s: string, venteId: string, corps: unknown) => appeler("credit:modifierDateLimite", s, venteId, corps),
    enregistrerRemboursement: (s: string, clientId: string, corps: unknown) => appeler("credit:enregistrerRemboursement", s, clientId, corps),
  },
  anomalie: {
    lister: (s: string, options: unknown) => appeler("anomalie:lister", s, options),
    traiter: (s: string, anomalieId: string, corps: unknown) => appeler("anomalie:traiter", s, anomalieId, corps),
  },
  fiche: {
    modifier: (s: string, stockId: string, champs: unknown) => appeler("fiche:modifier", s, stockId, champs),
    creer: (s: string, corps: unknown) => appeler("fiche:creer", s, corps),
  },
  catalogue: {
    rechercher: (s: string, recherche: string) => appeler("catalogue:rechercher", s, recherche),
  },
  maj: { installer: () => appeler("maj:installer") },
  impression: {
    listerImprimantes: () => appeler("impression:listerImprimantes"),
    lireReglages: () => appeler("impression:lireReglages"),
    enregistrerReglages: (modif: unknown) => appeler("impression:enregistrerReglages", modif),
    lireInfosPoste: () => appeler("impression:lireInfosPoste"),
    ouvrirDossierDonnees: () => appeler("impression:ouvrirDossierDonnees"),
    imprimerVente: (venteId: string) => appeler("impression:imprimerVente", venteId),
    signalerPret: () => appeler("impression:signalerPret"),
  },
});
