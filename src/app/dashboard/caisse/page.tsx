"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, CircleCheck, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { messageErreurPour } from "@/hooks/useToast";
import { nouvelleCleIdempotence } from "@/lib/api_carnet";
import {
  assurerPosteWeb,
  getReferentiels,
  getSessionCourante,
  ouvrirSession,
  saisirComptage,
  type LigneComptage,
  type Poste,
  type Referentiels,
  type SessionCaisse,
} from "@/lib/api_caisse";
import { estErreurReseau } from "@/lib/erreurs_api";
import { lireContexteAcces } from "@/lib/acces";
import { formaterGNF } from "@/lib/format_gnf";
import { estRouteAutorisee } from "@/lib/navigation_tableau_de_bord";
import {
  ALERTE_ATTENTION,
  ALERTE_ERREUR,
  ALERTE_INFO,
  ALERTE_SUCCES,
  BOUTON_PRIMAIRE,
  BOUTON_SECONDAIRE,
  CARTE,
  POLICE_TITRE,
} from "@/components/pharmacie/classes";
import { ErreurAvecReessai } from "@/components/pharmacie/ErreurAvecReessai";
import { formaterHeure, formaterJour, jourConakry } from "../ventes/affichage";
import { ComptageCoupures } from "./ComptageCoupures";
import { lignesAEnvoyer, lignesDepuisReferentiel } from "./comptage";

type Action = "ouvrir" | "ouvrirSansCompter" | "enregistrerFond";

const MESSAGE_RESEAU =
  "L'opération n'a peut-être pas été enregistrée. Appuyez sur « Réessayer » : elle ne sera pas comptée deux fois.";

export default function MaCaissePage() {
  const { user, loading, profile } = useAuth();
  const structureId = user?.structureId;
  const userId = user?.id;
  const peutVoirVentes = user ? estRouteAutorisee("/dashboard/ventes", lireContexteAcces(user, profile ?? null)) : false;

  const [referentiels, setReferentiels] = useState<Referentiels | null>(null);
  const [poste, setPoste] = useState<Poste | null>(null);
  const [session, setSession] = useState<SessionCaisse | null>(null);
  const [charge, setCharge] = useState(false);
  const [erreurChargement, setErreurChargement] = useState(false);
  const [essai, setEssai] = useState(0);

  const [lignes, setLignes] = useState<LigneComptage[]>([]);
  const [idOuverture, setIdOuverture] = useState(nouvelleCleIdempotence);
  const [idComptage, setIdComptage] = useState(nouvelleCleIdempotence);
  const [envoi, setEnvoi] = useState(false);
  const [aRejouer, setARejouer] = useState<Action | null>(null);
  const [refus, setRefus] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);

  // Relit l'état de la caisse sans repasser par l'écran de chargement.
  const relire = useCallback(async (structure: string, utilisateur: string) => {
    const p = (await assurerPosteWeb(structure, utilisateur)).data;
    const s = (await getSessionCourante(structure, p.id)).data;
    setPoste(p);
    setSession(s);
  }, []);

  useEffect(() => {
    if (!structureId || !userId) return;
    let actif = true;
    Promise.all([getReferentiels(structureId), assurerPosteWeb(structureId, userId)])
      .then(async ([refs, p]) => {
        const s = (await getSessionCourante(structureId, p.data.id)).data;
        if (!actif) return;
        setReferentiels(refs.data);
        setPoste(p.data);
        setSession(s);
        setLignes(lignesDepuisReferentiel(refs.data.coupures));
        setErreurChargement(false);
        setCharge(true);
      })
      .catch(() => {
        if (actif) setErreurChargement(true);
      });
    return () => {
      actif = false;
    };
  }, [structureId, userId, essai]);

  const reessayerChargement = () => {
    setErreurChargement(false);
    setCharge(false);
    setEssai((n) => n + 1);
  };

  const lancer = async (action: Action) => {
    if (!structureId || !userId || !poste || envoi) return;
    setEnvoi(true);
    setRefus(null);
    setSucces(null);
    setARejouer(null);
    try {
      if (action === "enregistrerFond") {
        if (!session) return;
        await saisirComptage(structureId, session.id, {
          id: idComptage,
          moment: "OUVERTURE",
          coupures: lignesAEnvoyer(lignes),
        });
        setSucces("Le fond de caisse est enregistré.");
      } else {
        const corps =
          action === "ouvrir"
            ? { id: idOuverture, posteId: poste.id, comptage: { coupures: lignesAEnvoyer(lignes) } }
            : { id: idOuverture, posteId: poste.id };
        const res = await ouvrirSession(structureId, corps);
        setSucces(res.message);
      }
      renouveler();
      await relire(structureId, userId).catch(() => undefined);
    } catch (err) {
      if (estErreurReseau(err)) {
        // Issue inconnue : même identifiant, champs en lecture seule (D688).
        setARejouer(action);
      } else {
        // Refus du serveur : message tel quel, état rechargé, aucun réessai.
        setRefus(messageErreurPour(err, "L'opération n'a pas pu être enregistrée. Vérifiez votre caisse puis réessayez."));
        renouveler();
        await relire(structureId, userId).catch(() => undefined);
      }
    } finally {
      setEnvoi(false);
    }
  };

  const renouveler = () => {
    setIdOuverture(nouvelleCleIdempotence());
    setIdComptage(nouvelleCleIdempotence());
    setLignes(lignesDepuisReferentiel(referentiels?.coupures ?? []));
  };

  const enTete = (
    <div>
      <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white" style={POLICE_TITRE}>
        Ma caisse
      </h1>
      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
        Ouvrez votre caisse, comptez le fond, puis fermez-la en fin de service.
      </p>
    </div>
  );

  if (loading || user === null) {
    return (
      <div role="status" className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
        Chargement...
      </div>
    );
  }

  if (!structureId) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
        {enTete}
        <div className={CARTE}>
          <p className="text-sm text-slate-700 dark:text-slate-300">
            Votre compte n&apos;est rattaché à aucune pharmacie. Adressez-vous à l&apos;administrateur de votre pharmacie.
          </p>
          <Link href="/dashboard" className={`${BOUTON_PRIMAIRE} mt-4`}>
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    );
  }

  if (erreurChargement) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
        {enTete}
        <ErreurAvecReessai
          message="Votre caisse n'a pas pu être chargée. Vérifiez votre connexion puis réessayez."
          onReessayer={reessayerChargement}
        />
      </div>
    );
  }

  if (!charge || referentiels === null) {
    return (
      <div role="status" className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
        Chargement de votre caisse...
      </div>
    );
  }

  const verrouille = envoi || aRejouer !== null;
  const autreVendeur = session !== null && session.utilisateurId !== userId;
  const aujourdhui = jourConakry(new Date());
  const jourOuverture = session ? jourConakry(new Date(session.ouverteLe)) : aujourdhui;
  const caisseDUnJourPasse = session !== null && !autreVendeur && session.jourMetier < aujourdhui;
  // La date suit le jour d'ouverture ; le bandeau, lui, suit le jour métier (D730)
  const momentOuverture = session
    ? jourOuverture === aujourdhui
      ? `à ${formaterHeure(session.ouverteLe)}`
      : `le ${formaterJour(jourOuverture)} à ${formaterHeure(session.ouverteLe)}`
    : "";

  const blocReessai = aRejouer !== null && (
    <div className="space-y-3">
      <div role="alert" className={ALERTE_ERREUR}>
        <AlertCircle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
        <span>{MESSAGE_RESEAU}</span>
      </div>
      <button type="button" onClick={() => void lancer(aRejouer)} disabled={envoi} className={BOUTON_PRIMAIRE}>
        {envoi && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
        Réessayer
      </button>
    </div>
  );

  const blocRefus = refus !== null && (
    <div role="alert" className={ALERTE_ERREUR}>
      <AlertCircle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
      <span>{refus}</span>
    </div>
  );

  const blocSucces = succes !== null && (
    <p role="status" className={ALERTE_SUCCES}>
      <CircleCheck className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
      <span>{succes}</span>
    </p>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      {enTete}
      <p className={ALERTE_INFO}>Cette page a besoin d&apos;internet : sans connexion, aucune vente n&apos;est enregistrée.</p>
      {blocSucces}
      {blocRefus}

      {session === null && (
        <div className={`${CARTE} space-y-5`}>
          <p className="text-sm text-slate-700 dark:text-slate-300">
            Votre caisse est fermée. Elle s&apos;ouvre aussi toute seule à votre première vente, sans fond compté.
          </p>
          <ComptageCoupures
            coupures={referentiels.coupures}
            valeur={lignes}
            onChange={setLignes}
            onTermine={() => document.getElementById("ouvrir-avec-fond")?.focus()}
            desactive={verrouille}
            legende="Fond de caisse : billets dans le tiroir"
          />
          {blocReessai}
          {aRejouer === null && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  id="ouvrir-avec-fond"
                  type="button"
                  onClick={() => void lancer("ouvrir")}
                  disabled={verrouille}
                  className={BOUTON_PRIMAIRE}
                >
                  {envoi && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                  Ouvrir la caisse avec ce fond
                </button>
                <button
                  type="button"
                  onClick={() => void lancer("ouvrirSansCompter")}
                  disabled={verrouille}
                  className={BOUTON_SECONDAIRE}
                >
                  Ouvrir sans compter
                </button>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Le fond sera compté à 0 et signalé au titulaire à la fermeture.
              </p>
            </div>
          )}
        </div>
      )}

      {session !== null && autreVendeur && (
        <div className={CARTE}>
          <p className="text-sm text-slate-700 dark:text-slate-300">
            Ce poste est occupé par la caisse de {session.utilisateurNom}, ouverte {momentOuverture}.
          </p>
        </div>
      )}

      {session !== null && !autreVendeur && (
        <div className={`${CARTE} space-y-5`}>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white" style={POLICE_TITRE}>
            Caisse ouverte
          </h2>
          <div className="text-sm text-slate-700 dark:text-slate-300 space-y-1">
            <p>Ouverte {momentOuverture}</p>
            <p>
              Poste : {session.poste.libelle} ({session.poste.code})
            </p>
            {session.jourMetier !== aujourdhui && <p>Ventes comptées pour le {formaterJour(session.jourMetier)}</p>}
            <p className="font-bold text-slate-900 dark:text-white">
              {session.fondCompte
                ? `Fond de caisse : ${formaterGNF(session.fondCaisse)}`
                : "Fond de caisse : pas encore compté"}
            </p>
          </div>

          {caisseDUnJourPasse && (
            <p role="status" className={ALERTE_ATTENTION}>
              <AlertCircle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
              <span>
                Cette caisse est restée ouverte depuis le {formaterJour(jourOuverture)}. Les ventes d&apos;aujourd&apos;hui y
                sont encore comptées pour le {formaterJour(session.jourMetier)}. Fermez-la pour repartir sur la bonne date.
              </span>
            </p>
          )}

          {session.comptageOuverture === null && (
            <div className="space-y-4">
              <ComptageCoupures
                coupures={referentiels.coupures}
                valeur={lignes}
                onChange={setLignes}
                onTermine={() => document.getElementById("enregistrer-fond")?.focus()}
                desactive={verrouille}
                legende="Comptez le fond de caisse"
              />
              {blocReessai}
              {aRejouer === null && (
                <button
                  id="enregistrer-fond"
                  type="button"
                  onClick={() => void lancer("enregistrerFond")}
                  disabled={verrouille}
                  className={BOUTON_PRIMAIRE}
                >
                  {envoi && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                  Enregistrer le fond
                </button>
              )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <Link href="/dashboard/vente" className={BOUTON_SECONDAIRE}>
              Nouvelle vente
            </Link>
            {peutVoirVentes && (
              <Link href="/dashboard/ventes" className={BOUTON_SECONDAIRE}>
                Ventes du jour
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
