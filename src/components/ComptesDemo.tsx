"use client";

import { useEffect, useMemo, useState } from "react";
import { FlaskConical, Loader2, LogIn } from "lucide-react";
import { ApiError, connexionDemo, getComptesDemo, type CompteDemo } from "@/lib/api_auth";
import { useTerminerConnexion } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";

// Ordre d'affichage des groupes et titre de chaque groupe
const GROUPES: { role: string; titre: string }[] = [
  { role: "PATIENT", titre: "Patients" },
  { role: "MEDECIN", titre: "Médecins" },
  { role: "ACCUEIL", titre: "Agents d'accueil" },
  { role: "PHARMACIEN", titre: "Pharmaciens" },
  { role: "STRUCTURE_ADMIN", titre: "Administrateurs de structure" },
  { role: "ADMIN", titre: "Administrateurs" },
  { role: "SUPER_ADMIN", titre: "Super administrateur" },
];

const MSG_ECHEC = "La connexion à ce compte de démonstration n'a pas abouti. Réessayez dans un instant.";

/** Regroupe les comptes par rôle, dans l'ordre de GROUPES ; un rôle inconnu va en fin de liste. */
export function grouperParRole(comptes: CompteDemo[]) {
  const connus = GROUPES.map(({ role, titre }) => ({
    role,
    titre,
    comptes: comptes.filter((c) => c.role === role),
  }));
  const autres = comptes.filter((c) => !GROUPES.some((g) => g.role === c.role));
  return [...connus, { role: "AUTRE", titre: "Autres profils", comptes: autres }].filter(
    (g) => g.comptes.length > 0
  );
}

/**
 * Encart « Mode démonstration » de la page de connexion : connexion en un clic à un
 * compte fictif. N'affiche rien si le serveur ne propose aucun compte (production).
 */
export default function ComptesDemo() {
  const [comptes, setComptes] = useState<CompteDemo[]>([]);
  const [enCours, setEnCours] = useState<string | null>(null);
  const terminerConnexion = useTerminerConnexion();
  const { notifier } = useToast();

  useEffect(() => {
    let actif = true;
    getComptesDemo().then((liste) => {
      if (actif) setComptes(liste);
    });
    return () => {
      actif = false;
    };
  }, []);

  const groupes = useMemo(() => grouperParRole(comptes), [comptes]);

  if (groupes.length === 0) return null;

  const seConnecter = async (compte: CompteDemo) => {
    setEnCours(compte.id);
    try {
      const res = await connexionDemo(compte.id);
      terminerConnexion(res.data);
    } catch (err) {
      // Hors connexion : le message du service est déjà rédigé pour l'utilisateur
      notifier(err instanceof ApiError && err.status === 0 ? err.message : MSG_ECHEC, "erreur");
      setEnCours(null);
    }
  };

  return (
    <section
      aria-labelledby="titre-mode-demo"
      aria-busy={enCours !== null}
      className="mt-8 pt-8 border-t border-slate-200 dark:border-slate-800"
    >
      <div className="flex items-center gap-2 mb-2">
        <FlaskConical className="w-5 h-5 text-accent-600 dark:text-accent-400" aria-hidden="true" />
        <h2 id="titre-mode-demo" className="text-base font-bold text-slate-900 dark:text-white">
          Mode démonstration
        </h2>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
        Découvrez MedConnecte sans créer de compte : choisissez un profil pour vous connecter en
        un clic. Toutes les informations affichées sont fictives.
      </p>

      <div className="space-y-6">
        {groupes.map((groupe) => (
          <div key={groupe.role}>
            <h3
              id={`groupe-demo-${groupe.role}`}
              className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400 mb-2"
            >
              {groupe.titre}
            </h3>
            <ul aria-labelledby={`groupe-demo-${groupe.role}`} className="space-y-2">
              {groupe.comptes.map((compte) => {
                const charge = enCours === compte.id;
                return (
                  <li key={compte.id}>
                    <button
                      type="button"
                      onClick={() => seConnecter(compte)}
                      disabled={enCours !== null}
                      className="group w-full flex items-start gap-3 p-3 text-left rounded-xl border border-slate-200 dark:border-slate-700 hover:border-primary-500 dark:hover:border-primary-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:border-slate-200 dark:disabled:hover:border-slate-700 disabled:hover:bg-transparent"
                    >
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-semibold text-slate-900 dark:text-white">
                          {compte.prenom} {compte.nom}
                        </span>
                        <span className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                          {compte.roleLibelle}
                          {compte.structureNom ? ` · ${compte.structureNom}` : ""}
                        </span>
                        <span className="block mt-1 text-xs text-slate-600 dark:text-slate-400">
                          {compte.description}
                        </span>
                      </span>
                      <span className="flex-shrink-0 mt-0.5 text-primary-600 dark:text-primary-400">
                        {charge ? (
                          <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                        ) : (
                          <LogIn className="w-5 h-5" aria-hidden="true" />
                        )}
                      </span>
                      {charge && <span className="sr-only">Connexion en cours</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
