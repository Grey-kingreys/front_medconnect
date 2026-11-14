"use client";

import { ui } from "@/theme/ui";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, CircleCheck, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { messageErreurPour } from "@/hooks/useToast";
import { nouvelleCleIdempotence } from "@/lib/api_carnet";
import { sourceCaisse } from "@/lib/caisse/source_active";
import {
  type BilanCaisse,
  type TypeMouvementCaisse,
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
import { formaterDateHeure, formaterHeure, formaterJour, jourConakry } from "../ventes/affichage";
import { ChampEspeces } from "./ChampEspeces";
import { CaisseFermee, FermetureCaisse } from "./FermetureCaisse";
import { MouvementCaisse } from "./MouvementCaisse";
import { montantDepuisChiffres } from "./comptage";

type Action = "ouvrir" | "enregistrerFond";

const LIBELLES_MOUVEMENT: Record<TypeMouvementCaisse, string> = {
  PRELEVEMENT: "Prélèvement",
  APPORT: "Apport",
  REMBOURSEMENT: "Remboursement",
};

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

  const [fond, setFond] = useState("");
  const [fondManquant, setFondManquant] = useState(false);
  const [idOuverture, setIdOuverture] = useState(nouvelleCleIdempotence);
  const [idComptage, setIdComptage] = useState(nouvelleCleIdempotence);
  const [envoi, setEnvoi] = useState(false);
  const [aRejouer, setARejouer] = useState<Action | null>(null);
  const [refus, setRefus] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);

  const [bilanCharge, setBilanCharge] = useState<{ id: string; bilan: BilanCaisse } | null>(null);
  const [erreurBilanId, setErreurBilanId] = useState<string | null>(null);
  const [versionBilan, setVersionBilan] = useState(0);
  const [mouvementOuvert, setMouvementOuvert] = useState(false);
  const [fermetureOuverte, setFermetureOuverte] = useState(false);
  const [fermee, setFermee] = useState<{ bilan: BilanCaisse; jourPasse: string | null } | null>(null);

  // Relit l'état de la caisse sans repasser par l'écran de chargement.
  const relire = useCallback(async (structure: string, utilisateur: string) => {
    const etat = await sourceCaisse().etatCaisse(structure, utilisateur);
    setPoste(etat.poste);
    setSession(etat.session);
    return etat.session;
  }, []);

  // Le bilan se charge pour la caisse ouverte de l'utilisateur, quel que soit son jour métier.
  const sessionId = session?.id;
  const sessionEstLaMienne = session !== null && session.utilisateurId === userId;
  useEffect(() => {
    if (!structureId || !sessionId || !sessionEstLaMienne) return;
    let actif = true;
    sourceCaisse()
      .getBilan(structureId, sessionId)
      .then((res) => {
        if (!actif) return;
        setBilanCharge({ id: sessionId, bilan: res.data });
        setErreurBilanId(null);
      })
      .catch(() => {
        if (actif) setErreurBilanId(sessionId);
      });
    return () => {
      actif = false;
    };
  }, [structureId, sessionId, sessionEstLaMienne, versionBilan]);
  const bilan = bilanCharge !== null && bilanCharge.id === sessionId ? bilanCharge.bilan : null;
  const erreurBilan = erreurBilanId !== null && erreurBilanId === sessionId;

  const reessayerBilan = () => {
    setErreurBilanId(null);
    setVersionBilan((n) => n + 1);
  };

  // La caisse a refusé un mouvement ou la fermeture : message du serveur tel quel, état relu.
  const apresRefus = async (message: string) => {
    if (!structureId || !userId) return;
    setMouvementOuvert(false);
    setSucces(null);
    setRefus(message);
    const s = await relire(structureId, userId).catch(() => undefined);
    if (!s) setFermetureOuverte(false);
    setVersionBilan((n) => n + 1);
  };

  const apresMouvement = (message: string) => {
    setMouvementOuvert(false);
    setRefus(null);
    setSucces(message);
    setVersionBilan((n) => n + 1);
  };

  const ouvrirFermeture = () => {
    if (fermetureOuverte) document.getElementById("fermeture-caisse")?.scrollIntoView?.({ block: "start" });
    setFermetureOuverte(true);
  };

  useEffect(() => {
    if (!structureId || !userId) return;
    let actif = true;
    Promise.all([sourceCaisse().chargerReferentiels(structureId), sourceCaisse().etatCaisse(structureId, userId)])
      .then(([refs, etat]) => {
        if (!actif) return;
        setReferentiels(refs);
        setPoste(etat.poste);
        setSession(etat.session);
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
    setFermee(null);
    setFermetureOuverte(false);
    setSucces(null);
    setRefus(null);
    setErreurChargement(false);
    setCharge(false);
    setEssai((n) => n + 1);
  };

  const lancer = async (action: Action) => {
    if (!structureId || !userId || !poste || envoi) return;
    const montantFond = montantDepuisChiffres(fond);
    if (montantFond === null) {
      setFondManquant(true);
      document.getElementById("fond-ouverture")?.focus();
      return;
    }
    setEnvoi(true);
    setRefus(null);
    setSucces(null);
    setARejouer(null);
    try {
      if (action === "enregistrerFond") {
        if (!session) return;
        await sourceCaisse().saisirComptage(structureId, session.id, {
          id: idComptage,
          moment: "OUVERTURE",
          montantEspeces: montantFond,
        });
        setSucces("Le fond de caisse est enregistré.");
      } else {
        const corps = { id: idOuverture, posteId: poste.id, comptage: { montantEspeces: montantFond } };
        const res = await sourceCaisse().ouvrirSession(structureId, corps);
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
    setFond("");
    setFondManquant(false);
  };

  const enTete = (
    <div>
      <h1 className={ui.titrePage} style={POLICE_TITRE}>
        Ma caisse
      </h1>
      <p className="text-mc-normal text-slate-600 dark:text-slate-400 mt-1">
        Ouvrez votre caisse, comptez le fond, puis fermez-la en fin de service.
      </p>
    </div>
  );

  if (loading || user === null) {
    return (
      <div role="status" className="flex items-center gap-3 text-mc-normal text-slate-600 dark:text-slate-400">
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
          <p className="text-mc-normal text-slate-700 dark:text-slate-300">
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
      <div role="status" className="flex items-center gap-3 text-mc-normal text-slate-600 dark:text-slate-400">
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

  if (fermee !== null) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
        {enTete}
        <CaisseFermee bilan={fermee.bilan} jourPasse={fermee.jourPasse} onNouvelleCaisse={reessayerChargement} />
      </div>
    );
  }

  const momentMouvement = (iso: string) =>
    jourConakry(new Date(iso)) === aujourdhui ? `à ${formaterHeure(iso)}` : `le ${formaterDateHeure(iso)}`;

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      {enTete}
      {sourceCaisse().enLigneSeulement !== false && (
        <p className={ALERTE_INFO}>Cette page a besoin d&apos;internet : sans connexion, aucune vente n&apos;est enregistrée.</p>
      )}
      {blocSucces}
      {blocRefus}

      {session === null && (
        <div className={`${CARTE} space-y-5`}>
          <p className="text-mc-normal text-slate-700 dark:text-slate-300">
            Votre caisse est fermée. Indiquez la monnaie du tiroir pour l&apos;ouvrir. Si vous vendez avant, elle s&apos;ouvrira toute seule et vous devrez saisir la monnaie ici.
          </p>
          <ChampEspeces
            id="fond-ouverture"
            legende="Monnaie dans le tiroir à l'ouverture (GNF)"
            aide="Le liquide mis dans la caisse avant la première vente, pour rendre la monnaie. Mettez 0 si le tiroir est vide."
            erreur={fondManquant ? "Indiquez la monnaie du tiroir (0 si le tiroir est vide)." : null}
            valeur={fond}
            onChange={(v) => {
              setFond(v);
              setFondManquant(false);
            }}
            onTermine={() => document.getElementById("ouvrir-avec-fond")?.focus()}
            desactive={verrouille}
            autoFocus
          />
          {blocReessai}
          {aRejouer === null && (
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
          )}
        </div>
      )}

      {session !== null && autreVendeur && (
        <div className={CARTE}>
          <p className="text-mc-normal text-slate-700 dark:text-slate-300">
            Ce poste est occupé par la caisse de {session.utilisateurNom}, ouverte {momentOuverture}.
          </p>
        </div>
      )}

      {session !== null && !autreVendeur && (
        <div className={`${CARTE} space-y-5`}>
          <h2 className={ui.texte.section} style={POLICE_TITRE}>
            Caisse ouverte
          </h2>
          <div className="text-mc-normal text-slate-700 dark:text-slate-300 space-y-1">
            <p>Ouverte {momentOuverture}</p>
            <p>
              Poste : {session.poste.libelle} ({session.poste.code})
            </p>
            {session.jourMetier !== aujourdhui && <p>Ventes comptées pour le {formaterJour(session.jourMetier)}</p>}
            <p className="font-semibold text-slate-900 dark:text-white">
              {session.fondCompte
                ? `Fond de caisse : ${formaterGNF(session.fondCaisse)}`
                : "Fond de caisse : pas encore compté"}
            </p>
          </div>

          {caisseDUnJourPasse && (
            <div role="status" className={`${ALERTE_ATTENTION} flex-wrap`}>
              <AlertCircle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
              <span className="flex-1 min-w-48">
                Cette caisse est restée ouverte depuis le {formaterJour(jourOuverture)}. Les ventes d&apos;aujourd&apos;hui y
                sont encore comptées pour le {formaterJour(session.jourMetier)}. Fermez-la pour repartir sur la bonne date.
              </span>
              <button
                type="button"
                onClick={ouvrirFermeture}
                disabled={verrouille || bilan === null}
                className={BOUTON_PRIMAIRE}
              >
                Fermer cette caisse
              </button>
            </div>
          )}

          {session.comptageOuverture === null && !fermetureOuverte && (
            <div className="space-y-4">
              <ChampEspeces
                id="fond-ouverture"
                legende="Monnaie dans le tiroir à l'ouverture (GNF)"
            aide="Le liquide mis dans la caisse avant la première vente, pour rendre la monnaie. Mettez 0 si le tiroir est vide."
            erreur={fondManquant ? "Indiquez la monnaie du tiroir (0 si le tiroir est vide)." : null}
                valeur={fond}
                onChange={(v) => {
              setFond(v);
              setFondManquant(false);
            }}
                onTermine={() => document.getElementById("enregistrer-fond")?.focus()}
                desactive={verrouille}
                autoFocus
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
            <button
              type="button"
              onClick={() => setMouvementOuvert(true)}
              disabled={verrouille}
              className={BOUTON_SECONDAIRE}
            >
              Mouvement de caisse
            </button>
            <button
              type="button"
              onClick={ouvrirFermeture}
              disabled={verrouille || bilan === null}
              className={BOUTON_PRIMAIRE}
            >
              Fermer la caisse
            </button>
          </div>
        </div>
      )}

      {session !== null && !autreVendeur && erreurBilan && (
        <ErreurAvecReessai
          message="Le bilan de votre caisse n'a pas pu être chargé. Vérifiez votre connexion puis réessayez."
          onReessayer={reessayerBilan}
        />
      )}

      {session !== null && !autreVendeur && bilan === null && !erreurBilan && (
        <div role="status" className="flex items-center gap-3 text-mc-normal text-slate-600 dark:text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
          Chargement du bilan...
        </div>
      )}

      {session !== null && !autreVendeur && bilan !== null && (
        <>
          <div className={`${CARTE} space-y-2`}>
            <h2 className={ui.texte.section} style={POLICE_TITRE}>
              Votre activité
            </h2>
            <div className="text-mc-normal text-slate-700 dark:text-slate-300 space-y-1">
              <p>Ventes : {bilan.activite.nombreVentes}</p>
              <p>Annulations : {bilan.activite.nombreAnnulations}</p>
              <p className="font-semibold text-slate-900 dark:text-white">Encaissé : {formaterGNF(bilan.activite.montantEncaisse)}</p>
              {bilan.activite.parMode.map((m) => (
                <p key={m.mode}>
                  {m.libelle} : {formaterGNF(m.montant)} ({m.nombrePaiements} {m.nombrePaiements > 1 ? "paiements" : "paiement"})
                </p>
              ))}
            </div>
          </div>

          <div className={`${CARTE} space-y-2`}>
            <h2 className={ui.texte.section} style={POLICE_TITRE}>
              Mouvements de caisse
            </h2>
            {bilan.mouvements.length === 0 ? (
              <p className="text-mc-normal text-slate-700 dark:text-slate-300">Aucun mouvement de caisse.</p>
            ) : (
              <ul className="text-mc-normal text-slate-700 dark:text-slate-300 space-y-1">
                {bilan.mouvements.map((m) => (
                  <li key={m.id}>
                    {LIBELLES_MOUVEMENT[m.type]} de {formaterGNF(m.montant)}, {m.motif}, {momentMouvement(m.horodatageServeur)}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className={`${CARTE} space-y-2`}>
            <h2 className={ui.texte.section} style={POLICE_TITRE}>
              Attendu dans la caisse
            </h2>
            <div className="text-mc-normal text-slate-700 dark:text-slate-300 space-y-1">
              {bilan.theorique.map((t) => (
                <p key={t.mode}>
                  {t.libelle} : {formaterGNF(t.montant)}
                </p>
              ))}
            </div>
          </div>

          {fermetureOuverte && (
            <FermetureCaisse
              key={session.id}
              structureId={structureId}
              sessionId={session.id}
              bilan={bilan}
              modes={referentiels.modesPaiement}
              jourPasse={session.jourMetier < aujourdhui ? session.jourMetier : null}
              onFermee={(figee) => {
                setFermee({ bilan: figee, jourPasse: session.jourMetier < aujourdhui ? session.jourMetier : null });
                setFermetureOuverte(false);
              }}
              onRefus={(message) => void apresRefus(message)}
            />
          )}
        </>
      )}

      {session !== null && !autreVendeur && (
        <MouvementCaisse
          isOpen={mouvementOuvert}
          onClose={() => setMouvementOuvert(false)}
          structureId={structureId}
          sessionId={session.id}
          modes={referentiels.modesPaiement}
          onEnregistre={apresMouvement}
          onRefus={(message) => void apresRefus(message)}
          onVerifier={() => {
            setMouvementOuvert(false);
            setSucces(null);
            setRefus("Vérifiez la liste des mouvements avant d'en saisir un autre : le précédent a peut-être été enregistré.");
            setVersionBilan((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}
