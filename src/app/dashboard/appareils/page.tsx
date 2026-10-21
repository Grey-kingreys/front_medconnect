"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Loader2, LogOut, Monitor, Smartphone } from "lucide-react";
import { DeleteConfirmModal } from "@/components/modals/DeleteConfirmModal";
import { useToast, messageErreurPour } from "@/hooks/useToast";
import {
  deconnecterAppareil,
  deconnecterAutresAppareils,
  getAppareilsConnectes,
  type AppareilConnecte,
} from "@/lib/api_appareils";
import { formaterDerniereActivite, libellePlateforme } from "./affichage";

type EtatListe =
  | { statut: "chargement" }
  | { statut: "erreur"; message: string }
  | { statut: "pret"; appareils: AppareilConnecte[] };

const CLASSES_BOUTON_PRIMAIRE =
  "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-primary-400 bg-primary-500/10 border border-primary-500/20 hover:bg-primary-500/20 transition-all duration-200";

const CLASSES_BOUTON_DECONNECTER =
  "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-emergency-500 bg-emergency-500/10 border border-emergency-500/20 hover:bg-emergency-500/20 transition-all duration-200";

export default function MesAppareilsPage() {
  const [etat, setEtat] = useState<EtatListe>({ statut: "chargement" });
  const [essai, setEssai] = useState(0);
  const [aDeconnecter, setADeconnecter] = useState<AppareilConnecte | null>(null);
  const [confirmerTous, setConfirmerTous] = useState(false);
  const { notifier } = useToast();

  useEffect(() => {
    let actif = true;
    getAppareilsConnectes()
      .then((res) => {
        if (actif) setEtat({ statut: "pret", appareils: res.data });
      })
      .catch((err: unknown) => {
        if (actif) {
          setEtat({
            statut: "erreur",
            message: messageErreurPour(err, "Impossible d'afficher vos appareils. Vérifiez votre connexion puis réessayez."),
          });
        }
      });
    return () => {
      actif = false;
    };
  }, [essai]);

  const reessayer = () => {
    setEtat({ statut: "chargement" });
    setEssai((n) => n + 1);
  };

  const appareils = etat.statut === "pret" ? etat.appareils : [];
  const ilYADAutres = appareils.some((a) => !a.appareilCourant);

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
      <div>
        <Link
          href="/dashboard/profil"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          Retour à mon profil
        </Link>
        <h1
          className="mt-3 text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white"
          style={{ fontFamily: "var(--font-outfit, var(--font-inter))" }}
        >
          Mes appareils connectés
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Retrouvez les téléphones et ordinateurs où votre compte est ouvert. Si vous avez perdu un téléphone, déconnectez-le ici.
        </p>
      </div>

      <div className="bg-white dark:bg-[#0f172a]/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800/50 rounded-3xl p-6 sm:p-8">
        <h2
          className="text-lg font-semibold text-slate-900 dark:text-white mb-6"
          style={{ fontFamily: "var(--font-outfit, var(--font-inter))" }}
        >
          Appareils connectés
        </h2>

        {etat.statut === "chargement" && (
          <div role="status" className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
            Chargement de vos appareils...
          </div>
        )}

        {etat.statut === "erreur" && (
          <div>
            <div
              role="alert"
              className="flex items-center gap-3 p-4 rounded-2xl bg-emergency-500/10 border border-emergency-500/20 text-emergency-500 text-sm"
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
              <span>{etat.message}</span>
            </div>
            <button type="button" onClick={reessayer} className={`${CLASSES_BOUTON_PRIMAIRE} mt-4`}>
              Réessayer
            </button>
          </div>
        )}

        {etat.statut === "pret" && appareils.length === 0 && (
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">Aucun appareil à afficher pour le moment.</p>
            <button type="button" onClick={reessayer} className={`${CLASSES_BOUTON_PRIMAIRE} mt-4`}>
              Actualiser
            </button>
          </div>
        )}

        {etat.statut === "pret" && appareils.length > 0 && (
          <>
            <ul aria-label="Appareils connectés" className="space-y-4">
              {appareils.map((appareil) => {
                const Icone = appareil.type === "web" ? Monitor : Smartphone;
                const plateforme = libellePlateforme(appareil);
                return (
                  <li
                    key={appareil.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-slate-800/50 text-slate-500 dark:text-slate-400">
                        <Icone className="w-5 h-5" aria-hidden="true" />
                      </div>
                      <div>
                        <div className="flex items-center">
                          <p className="text-sm font-medium text-slate-900 dark:text-white">{appareil.nom}</p>
                          {appareil.appareilCourant && (
                            <span className="ml-2 inline-flex items-center px-2.5 py-0.5 text-xs font-semibold rounded-full bg-primary-600 text-white">
                              Cet appareil
                            </span>
                          )}
                        </div>
                        {plateforme !== appareil.nom && <p className="text-xs text-slate-500">{plateforme}</p>}
                        <p className="text-xs text-slate-500">
                          Dernière activité : {formaterDerniereActivite(appareil.derniereActivite)}
                        </p>
                      </div>
                    </div>
                    {!appareil.appareilCourant && (
                      <button
                        type="button"
                        aria-label={`Déconnecter ${appareil.nom}`}
                        onClick={() => setADeconnecter(appareil)}
                        className={`self-start sm:self-auto ${CLASSES_BOUTON_DECONNECTER}`}
                      >
                        <LogOut className="w-4 h-4" aria-hidden="true" />
                        Déconnecter
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>

            {ilYADAutres ? (
              <button type="button" onClick={() => setConfirmerTous(true)} className={`${CLASSES_BOUTON_DECONNECTER} mt-6`}>
                <LogOut className="w-4 h-4" aria-hidden="true" />
                Déconnecter tous mes autres appareils
              </button>
            ) : (
              <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">Vous n&apos;êtes connecté sur aucun autre appareil.</p>
            )}
          </>
        )}
      </div>

      <DeleteConfirmModal
        isOpen={aDeconnecter !== null}
        onClose={() => setADeconnecter(null)}
        title="Déconnecter cet appareil ?"
        confirmLabel="Déconnecter"
        icone={LogOut}
        libelleEnCours="Déconnexion..."
        description={
          <>
            « <strong>{aDeconnecter?.nom}</strong> » sera déconnecté de votre compte. Pour l&apos;utiliser à nouveau, il faudra se reconnecter avec votre mot de passe.
          </>
        }
        onConfirm={async () => {
          if (!aDeconnecter) return;
          const cible = aDeconnecter.id;
          const res = await deconnecterAppareil(cible);
          setEtat((prec) =>
            prec.statut === "pret" ? { statut: "pret", appareils: prec.appareils.filter((a) => a.id !== cible) } : prec,
          );
          notifier(res.message || "Appareil déconnecté.", "succes");
        }}
      />

      <DeleteConfirmModal
        isOpen={confirmerTous}
        onClose={() => setConfirmerTous(false)}
        title="Déconnecter tous vos autres appareils ?"
        confirmLabel="Tout déconnecter"
        icone={LogOut}
        libelleEnCours="Déconnexion..."
        description="Tous vos appareils, sauf celui-ci, seront déconnectés. Il faudra se reconnecter avec votre mot de passe sur chacun d'eux."
        onConfirm={async () => {
          const res = await deconnecterAutresAppareils();
          setEtat((prec) =>
            prec.statut === "pret" ? { statut: "pret", appareils: prec.appareils.filter((a) => a.appareilCourant) } : prec,
          );
          notifier(res.message || "Vos autres appareils ont été déconnectés.", "succes");
        }}
      />
    </div>
  );
}
