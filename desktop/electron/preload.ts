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
  maj: { installer: () => appeler("maj:installer") },
  impression: {
    listerImprimantes: () => appeler("impression:listerImprimantes"),
    lireReglages: () => appeler("impression:lireReglages"),
    enregistrerReglages: (modif: unknown) => appeler("impression:enregistrerReglages", modif),
    lireInfosPoste: () => appeler("impression:lireInfosPoste"),
    imprimerVente: (venteId: string) => appeler("impression:imprimerVente", venteId),
    signalerPret: () => appeler("impression:signalerPret"),
  },
});
