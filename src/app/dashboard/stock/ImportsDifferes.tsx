"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileSpreadsheet } from "lucide-react";
import type { ImportDiffere } from "@/lib/api_pharmacie";
import { sourcePharmacie } from "@/lib/caisse/source_pharmacie_active";

const LIBELLES_MODE = { livraison: "Livraison", inventaire: "Inventaire" } as const;

const pluriel = (n: number, singulier: string, plurielTexte: string) => `${n} ${n > 1 ? plurielTexte : singulier}`;

/** Phrase de situation d'un import mis de côté : en attente, envoyé, traité ou refusé. */
function situation(i: ImportDiffere): string {
  switch (i.statut) {
    case "EN_ATTENTE":
      return "En attente du retour du réseau";
    case "ENVOYE":
      return "Envoyé au serveur, résultat bientôt ici";
    case "REFUSE":
      return i.message ?? "Fichier refusé : rien n'a été importé.";
    default: {
      const r = i.resultat;
      if (!r) return "Importé";
      return r.rejetees > 0
        ? `${pluriel(r.importees, "ligne importée", "lignes importées")} sur ${r.totalLignes}, ${pluriel(r.rejetees, "ligne refusée", "lignes refusées")}`
        : `${pluriel(r.importees, "ligne importée", "lignes importées")}`;
    }
  }
}

/**
 * Imports Excel mis de côté sur ce poste hors ligne, avec leur résultat une fois traités par le serveur.
 * Rien ne s'affiche sur le web ni tant qu'aucun fichier n'a été mis de côté. `rafraichir` change quand l'état du poste
 * change (retour du réseau, nouvelle photographie) pour relire la liste.
 */
export function ImportsDifferes({ structureId, rafraichir }: { structureId: string; rafraichir: unknown }) {
  const [imports, setImports] = useState<ImportDiffere[]>([]);

  useEffect(() => {
    let actif = true;
    sourcePharmacie()
      .listerImportsDifferes(structureId)
      .then((liste) => {
        if (actif) setImports(liste);
      })
      .catch(() => undefined);
    return () => {
      actif = false;
    };
  }, [structureId, rafraichir]);

  if (imports.length === 0) return null;

  return (
    <section aria-labelledby="imports-differes-titre" className="space-y-2">
      <h2 id="imports-differes-titre" className="inline-flex items-center gap-2 text-mc-normal font-semibold text-slate-900 dark:text-white">
        <FileSpreadsheet size={16} className="text-primary-600 dark:text-primary-400" />
        Fichiers Excel mis de côté
      </h2>
      <ul className="divide-y divide-slate-100 dark:divide-slate-800/60 text-mc-normal">
        {imports.map((i) => (
          <li key={i.id} className="py-2">
            <p className="text-slate-900 dark:text-white">
              {i.nomFichier || "Fichier"}
              {i.mode && <span className="text-slate-600 dark:text-slate-400"> ({LIBELLES_MODE[i.mode]})</span>}
            </p>
            <p className={i.statut === "REFUSE" ? "font-semibold text-emergency-600 dark:text-emergency-500" : "text-slate-700 dark:text-slate-300"}>{situation(i)}</p>
            {i.statut === "TRAITE" && i.resultat && i.resultat.rejetees > 0 && (
              <details className="text-slate-700 dark:text-slate-300">
                <summary className="cursor-pointer">Voir les lignes refusées</summary>
                <ul className="list-disc list-inside">
                  {i.resultat.lignesRejetees.map((l) => (
                    <li key={l.ligne}>
                      Ligne {l.ligne}
                      {l.nom ? ` (${l.nom})` : ""} : {l.raison}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {i.statut === "TRAITE" && i.resultat?.receptionId && (
              <Link href={`/dashboard/receptions/${i.resultat.receptionId}`} className="font-semibold text-primary-600 dark:text-primary-400 hover:underline">
                Voir la réception
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
