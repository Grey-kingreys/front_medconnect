import { Check } from "lucide-react";
import { REGLES_MOT_DE_PASSE, motDePasseValide } from "@/lib/regles_mot_de_passe";

interface ReglesMotDePasseProps {
  /** Valeur actuelle du champ. */
  motDePasse: string;
  /** `id` du champ : la liste prend `${idChamp}-regles`, le message `${idChamp}-erreur`. */
  idChamp: string;
  /** Message affiché sous le champ (règles non remplies à l'envoi, refus du serveur). */
  erreur?: string;
}

/** Valeur d'`aria-describedby` du champ : le message d'erreur (s'il existe) puis la liste des règles. */
export function descriptionMotDePasse(idChamp: string, erreur?: string): string {
  return erreur ? `${idChamp}-erreur ${idChamp}-regles` : `${idChamp}-regles`;
}

/**
 * Message d'erreur du champ et liste des règles du mot de passe, avec une coche
 * pour chaque règle remplie. La liste est toujours affichée, même champ vide.
 */
export default function ReglesMotDePasse({ motDePasse, idChamp, erreur }: ReglesMotDePasseProps) {
  return (
    <>
      {erreur && (
        <p id={`${idChamp}-erreur`} role="alert" className="mt-1.5 text-xs text-emergency-500">
          {erreur}
        </p>
      )}
      <ul id={`${idChamp}-regles`} aria-label="Règles à respecter" className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {REGLES_MOT_DE_PASSE.map((regle) => {
          const faite = regle.test(motDePasse);
          return (
            <li
              key={regle.id}
              className={`flex items-center gap-1.5 text-xs transition-colors duration-200 ${
                faite ? "text-secondary-600 dark:text-secondary-400" : "text-slate-500 dark:text-slate-400"
              }`}
            >
              <Check aria-hidden="true" className={`w-3.5 h-3.5 flex-shrink-0 ${faite ? "opacity-100" : "opacity-30"}`} />
              {regle.libelle}
              <span className="sr-only">{faite ? " (fait)" : " (à faire)"}</span>
            </li>
          );
        })}
      </ul>
      <p className="sr-only" aria-live="polite">
        {motDePasseValide(motDePasse) ? "Le mot de passe respecte toutes les règles." : ""}
      </p>
    </>
  );
}
