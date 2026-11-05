"use client";

import { useEffect, useState } from "react";
import { notFound } from "next/navigation";
import { AlertCircle, CircleCheck, Loader2, Printer } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  MESSAGE_IMPRESSION_ECHOUEE,
  type FormatTicket,
  type ImprimanteSysteme,
  type InfosPoste,
  type ReglagesPoste,
} from "@/lib/caisse/contrat_desktop";
import { useEtatPoste } from "@/lib/caisse/etat_poste";
import { ALERTE_ERREUR, ALERTE_SUCCES, BOUTON_PRIMAIRE, CARTE, CHAMP, FOCUS, POLICE_TITRE } from "@/components/pharmacie/classes";
import { FORMATS_RECU, formaterDateHeure } from "../ventes/affichage";

const MESSAGE_CHARGEMENT = "Impossible de lire les réglages de ce poste. Redémarrez l'application puis réessayez.";
const SANS_IMPRIMANTE = "";

type Bandeau = { texte: string; ton: "succes" | "erreur" } | null;

export default function PostePage() {
  const { user, loading } = useAuth();
  const { pont, etat } = useEtatPoste();
  const [reglages, setReglages] = useState<ReglagesPoste | null>(null);
  const [imprimantes, setImprimantes] = useState<ImprimanteSysteme[]>([]);
  const [infos, setInfos] = useState<InfosPoste | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [bandeau, setBandeau] = useState<Bandeau>(null);
  const [essaiEnCours, setEssaiEnCours] = useState(false);

  useEffect(() => {
    if (pont === null) return;
    let actif = true;
    Promise.all([pont.impression.lireReglages(), pont.impression.listerImprimantes(), pont.impression.lireInfosPoste()])
      .then(([r, i, p]) => {
        if (!actif) return;
        if (!r.ok) {
          setErreur(r.message);
          return;
        }
        setReglages(r.data);
        setImprimantes(i.ok ? i.data : []);
        if (p.ok) setInfos(p.data);
      })
      .catch(() => {
        if (actif) setErreur(MESSAGE_CHARGEMENT);
      });
    return () => {
      actif = false;
    };
  }, [pont]);

  // Cette page n'existe que dans l'application de caisse.
  if (pont === null) notFound();

  if (loading || user === null) {
    return (
      <div role="status" className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
        Chargement...
      </div>
    );
  }

  const enregistrer = async (modif: Partial<ReglagesPoste>) => {
    setBandeau(null);
    try {
      const rep = await pont.impression.enregistrerReglages(modif);
      if (rep.ok) setReglages(rep.data);
      else setBandeau({ texte: rep.message, ton: "erreur" });
    } catch {
      setBandeau({ texte: MESSAGE_CHARGEMENT, ton: "erreur" });
    }
  };

  const imprimerEssai = async () => {
    if (infos?.derniereVenteId == null) return;
    setBandeau(null);
    setEssaiEnCours(true);
    try {
      const rep = await pont.impression.imprimerVente(infos.derniereVenteId);
      setBandeau(
        rep.ok
          ? { texte: "Le ticket d'essai a été envoyé à l'imprimante.", ton: "succes" }
          : { texte: rep.message, ton: "erreur" },
      );
    } catch {
      setBandeau({ texte: MESSAGE_IMPRESSION_ECHOUEE, ton: "erreur" });
    } finally {
      setEssaiEnCours(false);
    }
  };

  const installerMaintenant = async () => {
    setBandeau(null);
    try {
      const rep = await pont.maj.installer();
      if (!rep.ok) setBandeau({ texte: rep.message, ton: "erreur" });
    } catch {
      setBandeau({ texte: MESSAGE_CHARGEMENT, ton: "erreur" });
    }
  };

  const peutEssayer = reglages?.imprimante != null && infos?.derniereVenteId != null;
  // Une imprimante réglée mais absente de la liste (débranchée) reste choisie : elle est proposée telle quelle.
  const choisieAbsente = reglages?.imprimante != null && !imprimantes.some((p) => p.name === reglages.imprimante);

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white" style={POLICE_TITRE}>
          Réglages de ce poste
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Choisissez l&apos;imprimante de ce comptoir : le ticket sort sans fenêtre de confirmation.
        </p>
      </div>

      {erreur !== null && (
        <div role="alert" className={ALERTE_ERREUR}>
          <AlertCircle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
          <span>{erreur}</span>
        </div>
      )}

      {bandeau !== null && (
        <div role={bandeau.ton === "erreur" ? "alert" : "status"} className={bandeau.ton === "erreur" ? ALERTE_ERREUR : ALERTE_SUCCES}>
          {bandeau.ton === "erreur" ? (
            <AlertCircle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
          ) : (
            <CircleCheck className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
          )}
          <span>{bandeau.texte}</span>
        </div>
      )}

      {reglages === null && erreur === null && (
        <div role="status" className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
          Chargement des réglages...
        </div>
      )}

      {reglages !== null && (
        <section className={`${CARTE} space-y-6`} aria-labelledby="titre-impression">
          <h2 id="titre-impression" className="text-lg font-bold text-slate-900 dark:text-white" style={POLICE_TITRE}>
            Impression
          </h2>

          <div className="space-y-2">
            <label htmlFor="imprimante" className="block text-sm font-medium text-slate-800 dark:text-slate-200">
              Imprimante
            </label>
            <select
              id="imprimante"
              value={reglages.imprimante ?? SANS_IMPRIMANTE}
              onChange={(e) => void enregistrer({ imprimante: e.target.value === SANS_IMPRIMANTE ? null : e.target.value })}
              className={CHAMP}
            >
              <option value={SANS_IMPRIMANTE}>Aucune imprimante choisie</option>
              {choisieAbsente && reglages.imprimante !== null && (
                <option value={reglages.imprimante}>{`${reglages.imprimante} (non détectée)`}</option>
              )}
              {imprimantes.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.isDefault ? `${p.displayName} (par défaut du système)` : p.displayName}
                </option>
              ))}
            </select>
            {imprimantes.length === 0 && (
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Aucune imprimante n&apos;est installée sur cet ordinateur. Installez-la, puis revenez sur cette page.
              </p>
            )}
          </div>

          <fieldset>
            <legend className="text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">Format du ticket</legend>
            <div className="flex flex-wrap gap-3">
              {FORMATS_RECU.map((f) => (
                <label
                  key={f.valeur}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl border text-sm font-medium cursor-pointer has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary-500 ${
                    reglages.formatRecu === f.valeur
                      ? "border-primary-600 text-primary-700 dark:text-primary-300"
                      : "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="format-ticket"
                    value={f.valeur}
                    checked={reglages.formatRecu === f.valeur}
                    onChange={() => void enregistrer({ formatRecu: f.valeur as FormatTicket })}
                    className="accent-primary-600 focus:outline-none"
                  />
                  {f.libelle}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="flex items-center gap-3 text-sm font-medium text-slate-800 dark:text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={reglages.impressionAutomatique}
              onChange={(e) => void enregistrer({ impressionAutomatique: e.target.checked })}
              className={`w-5 h-5 accent-primary-600 ${FOCUS}`}
            />
            Imprimer le ticket après chaque vente
          </label>

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => void imprimerEssai()}
              disabled={!peutEssayer || essaiEnCours}
              className={BOUTON_PRIMAIRE}
            >
              <Printer className="w-4 h-4" aria-hidden="true" />
              Imprimer un ticket d&apos;essai
            </button>
            {infos !== null && infos.derniereVenteId === null && (
              <p className="text-sm text-slate-600 dark:text-slate-400">Faites d&apos;abord une vente.</p>
            )}
            {reglages.imprimante === null && infos?.derniereVenteId != null && (
              <p className="text-sm text-slate-600 dark:text-slate-400">Choisissez d&apos;abord une imprimante.</p>
            )}
          </div>
        </section>
      )}

      <section className={`${CARTE} space-y-3`} aria-labelledby="titre-poste">
        <h2 id="titre-poste" className="text-lg font-bold text-slate-900 dark:text-white" style={POLICE_TITRE}>
          Ce poste
        </h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <dt className="text-slate-600 dark:text-slate-400">Code du poste</dt>
            <dd className="font-medium text-slate-900 dark:text-white">{infos?.posteCode ?? "Pas encore enregistré"}</dd>
          </div>
          <div>
            <dt className="text-slate-600 dark:text-slate-400">Nom du poste</dt>
            <dd className="font-medium text-slate-900 dark:text-white">{infos?.posteLibelle || "Pas encore enregistré"}</dd>
          </div>
          <div>
            <dt className="text-slate-600 dark:text-slate-400">Version de l&apos;application</dt>
            <dd className="font-medium text-slate-900 dark:text-white">{pont.version}</dd>
          </div>
          <div>
            <dt className="text-slate-600 dark:text-slate-400">Dernier échange avec le serveur</dt>
            <dd className="font-medium text-slate-900 dark:text-white">
              {etat?.dernierContactLe ? formaterDateHeure(etat.dernierContactLe) : "Aucun pour le moment"}
            </dd>
          </div>
          {infos?.adresseApi ? (
            <div className="sm:col-span-2">
              <dt className="text-slate-600 dark:text-slate-400">Adresse du serveur</dt>
              <dd className="font-medium text-slate-900 dark:text-white break-all">{infos.adresseApi}</dd>
            </div>
          ) : null}
        </dl>

        <div className="space-y-2 pt-2">
          {etat?.majPrete ? (
            <>
              <p className="text-sm text-slate-800 dark:text-slate-200">{`Mise à jour ${etat.majPrete} prête : elle s'installera à la fermeture.`}</p>
              <button type="button" onClick={() => void installerMaintenant()} disabled={!etat.majInstallable} className={BOUTON_PRIMAIRE}>
                Installer maintenant
              </button>
              {!etat.majInstallable && (
                <p className="text-sm text-slate-600 dark:text-slate-400">Fermez d&apos;abord la caisse et attendez l&apos;envoi des ventes.</p>
              )}
            </>
          ) : infos?.majAutomatique === false ? (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Les mises à jour se font à la main : MedConnecte vous donnera le nouveau programme à installer.
            </p>
          ) : infos?.majAutomatique ? (
            <p className="text-sm text-slate-600 dark:text-slate-400">L&apos;application est à jour. Les mises à jour arrivent toutes seules.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
