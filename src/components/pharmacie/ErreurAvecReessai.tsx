import { AlertCircle } from "lucide-react";
import { ALERTE_ERREUR, BOUTON_PRIMAIRE, CARTE } from "./classes";

/** Bloc d'erreur de la page de vente, avec un bouton de réessai facultatif. */
export function ErreurAvecReessai({
  message,
  onReessayer,
  libelleBouton = "Réessayer",
}: {
  message: string;
  onReessayer?: () => void;
  libelleBouton?: string;
}) {
  return (
    <div className={CARTE}>
      <div role="alert" className={ALERTE_ERREUR}>
        <AlertCircle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
        <span>{message}</span>
      </div>
      {onReessayer && (
        <button type="button" onClick={onReessayer} className={`${BOUTON_PRIMAIRE} mt-4`}>
          {libelleBouton}
        </button>
      )}
    </div>
  );
}
