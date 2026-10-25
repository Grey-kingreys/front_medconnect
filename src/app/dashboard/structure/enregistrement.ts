import { ApiError } from "@/lib/api_auth";
import type { MyStructure, UpdateStructurePayload } from "@/lib/api_structure";
import { estPermissionRefusee, signalerAccesRefuse } from "@/lib/acces";
import { messageErreurPour } from "@/hooks/useToast";
import { JOURS_SEMAINE, ecrirePlage, type JourSemaine, type PlageHoraire } from "@/lib/horaires_structure";

export type EtatBloc =
  | { statut: "repos" }
  | { statut: "enregistrement" }
  | { statut: "succes" }
  | { statut: "erreur"; message: string };

export type ResultatCorps = { ok: true; corps: UpdateStructurePayload } | { ok: false; message: string };

export interface SaisieInformations {
  nom: string;
  telephone: string;
  ville: string;
  adresse: string;
  description: string;
}

export interface SaisiePosition {
  latitude: string;
  longitude: string;
}

/** Message affiché sous un bloc ou un contrôle quand l'enregistrement échoue. */
export function messageErreurEnregistrement(err: unknown): string {
  if (estPermissionRefusee(err)) {
    signalerAccesRefuse();
    return "Vous n'avez plus l'autorisation de modifier ces informations.";
  }
  if (err instanceof ApiError && err.details?.code === "VALIDATION") {
    return "Certaines informations n'ont pas été acceptées. Vérifiez ce bloc puis réessayez.";
  }
  return messageErreurPour(err, "L'enregistrement n'a pas abouti. Vérifiez votre connexion puis réessayez.");
}

interface ChampFacultatif {
  cle: "telephone" | "ville" | "adresse";
  min: number;
  max: number;
  nomVide: string;
  messageBornes: string;
}

const CHAMPS_FACULTATIFS: ChampFacultatif[] = [
  { cle: "telephone", min: 8, max: 20, nomVide: "téléphone", messageBornes: "Le téléphone doit contenir entre 8 et 20 caractères." },
  { cle: "ville", min: 2, max: 100, nomVide: "ville", messageBornes: "La ville doit contenir entre 2 et 100 caractères." },
  { cle: "adresse", min: 3, max: 200, nomVide: "adresse", messageBornes: "L'adresse doit contenir entre 3 et 200 caractères." },
];

/** Corps envoyé pour le bloc « Informations et contact », ou le message à afficher si la saisie est refusée. */
export function corpsInformations(saisie: SaisieInformations, origine: MyStructure): ResultatCorps {
  const nom = saisie.nom.trim();
  if (nom.length < 2 || nom.length > 150) {
    return { ok: false, message: "Le nom de la pharmacie doit contenir entre 2 et 150 caractères." };
  }
  const corps: UpdateStructurePayload = { nom };

  for (const champ of CHAMPS_FACULTATIFS) {
    const valeur = saisie[champ.cle].trim();
    const avant = origine[champ.cle] ?? "";
    if (valeur === "") {
      if (avant !== "") {
        return {
          ok: false,
          message: `Le champ ${champ.nomVide} ne peut pas être vidé. Saisissez une nouvelle valeur.`,
        };
      }
      continue;
    }
    if (valeur.length < champ.min || valeur.length > champ.max) {
      return { ok: false, message: champ.messageBornes };
    }
    corps[champ.cle] = valeur;
  }

  const description = saisie.description.trim();
  if (description.length > 500) {
    return { ok: false, message: "La description ne doit pas dépasser 500 caractères." };
  }
  corps.description = description;
  return { ok: true, corps };
}

/** Corps envoyé pour le bloc « Horaires d'ouverture ». */
export function corpsHoraires(plages: Record<JourSemaine, PlageHoraire>): ResultatCorps {
  for (const jour of JOURS_SEMAINE) {
    const plage = plages[jour];
    if (plage.ferme) continue;
    const nomJour = jour.toLowerCase();
    if (!plage.ouverture || !plage.fermeture) {
      return { ok: false, message: `Indiquez l'heure d'ouverture et de fermeture du ${nomJour}, ou cochez Fermé.` };
    }
    if (plage.fermeture <= plage.ouverture) {
      return { ok: false, message: `Le ${nomJour}, l'heure de fermeture doit être après l'heure d'ouverture.` };
    }
  }
  const objet = Object.fromEntries(JOURS_SEMAINE.map((jour) => [jour, ecrirePlage(plages[jour])]));
  return { ok: true, corps: { horaires: JSON.stringify(objet) } };
}

/** Corps envoyé pour le bloc « Position sur la carte ». */
export function corpsPosition(saisie: SaisiePosition): ResultatCorps {
  const lat = saisie.latitude.trim();
  const lng = saisie.longitude.trim();
  if (lat === "" && lng === "") {
    return { ok: false, message: "Choisissez la position sur la carte ou saisissez la latitude et la longitude." };
  }
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (lat === "" || lng === "" || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return { ok: false, message: "Indiquez la latitude et la longitude." };
  }
  if (latitude < -90 || latitude > 90) {
    return { ok: false, message: "La latitude doit être comprise entre -90 et 90." };
  }
  if (longitude < -180 || longitude > 180) {
    return { ok: false, message: "La longitude doit être comprise entre -180 et 180." };
  }
  return { ok: true, corps: { latitude, longitude } };
}
