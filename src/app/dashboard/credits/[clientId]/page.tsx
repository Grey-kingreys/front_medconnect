"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, HandCoins, Pencil } from "lucide-react";
import { ui } from "@/theme/ui";
import { POLICE_TITRE } from "@/components/pharmacie/classes";
import { ErreurAvecReessai } from "@/components/pharmacie/ErreurAvecReessai";
import { useAuth } from "@/hooks/useAuth";
import { messageErreurPour } from "@/hooks/useToast";
import { lireContexteAcces } from "@/lib/acces";
import {
  getFicheClientCredit,
  modifierClientCredit,
  modifierDateLimitePrise,
  type FicheClientCredit,
  type PriseCredit,
} from "@/lib/api_credit";
import { formaterGNF } from "@/lib/format_gnf";
import { filtrerTelephonePrescripteur, telephonePrescripteurValide } from "../../vente/panier";
import { formaterDateHeure, jourConakry } from "../../ventes/affichage";
import { CLASSE_BADGE_STATUT, formaterJourCourt, libelleStatut } from "../affichage";
import { RemboursementModal } from "../RemboursementModal";

const MSG_CHARGEMENT_ECHOUE = "La fiche du client n'a pas pu être chargée. Vérifiez votre connexion puis réessayez.";

/** Résumé d'une prise : « 2 boîtes de Paracétamol, 6 unités de Amoxicilline ». */
function resumePrise(prise: PriseCredit): string {
  return prise.lignes
    .map((l) => `${l.nombreAffiche.toLocaleString("fr-FR")} ${l.uniteAffichee === "BOITE" ? "boîte(s)" : "unité(s)"} ${l.nomMedicament}`)
    .join(", ");
}

function DateLimitePrise({
  prise,
  peutEcrire,
  structureId,
  onFiche,
}: {
  prise: PriseCredit;
  peutEcrire: boolean;
  structureId: string;
  onFiche: (fiche: FicheClientCredit) => void;
}) {
  const [edition, setEdition] = useState(false);
  const [valeur, setValeur] = useState(prise.dateLimite ?? "");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const modifiable = peutEcrire && !prise.annulee && !prise.soldee;

  const enregistrer = async (dateLimite: string | null) => {
    setEnvoi(true);
    setErreur(null);
    try {
      const res = await modifierDateLimitePrise(structureId, prise.venteId, dateLimite);
      setEdition(false);
      onFiche(res.data);
    } catch (err) {
      setErreur(messageErreurPour(err, "La date limite n'a pas pu être modifiée. Réessayez dans un instant."));
    } finally {
      setEnvoi(false);
    }
  };

  if (!edition) {
    return (
      <p className={ui.texte.normal}>
        Date limite : {prise.dateLimite ? formaterJourCourt(prise.dateLimite) : "aucune"}
        {modifiable && (
          <button type="button" onClick={() => setEdition(true)} className={`${ui.bouton.discret} ml-2`}>
            Modifier la date limite
          </button>
        )}
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor={`date-limite-${prise.venteId}`} className={ui.label}>
            Date limite
          </label>
          <input
            id={`date-limite-${prise.venteId}`}
            type="date"
            min={jourConakry(new Date())}
            value={valeur}
            onChange={(e) => setValeur(e.target.value)}
            className={ui.champ}
          />
        </div>
        <button type="button" disabled={envoi || valeur === ""} onClick={() => void enregistrer(valeur)} className={ui.bouton.primaire}>
          Enregistrer la date
        </button>
        {prise.dateLimite && (
          <button type="button" disabled={envoi} onClick={() => void enregistrer(null)} className={ui.bouton.secondaire}>
            Retirer la date
          </button>
        )}
        <button type="button" disabled={envoi} onClick={() => setEdition(false)} className={ui.bouton.discret}>
          Annuler
        </button>
      </div>
      {erreur && (
        <p role="alert" className={ui.alerte.erreur}>
          {erreur}
        </p>
      )}
    </div>
  );
}

export default function FicheClientCreditPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = use(params);
  const { user, profile } = useAuth();
  const structureId = user?.structureId;
  const peutEcrire = user ? lireContexteAcces(user, profile ?? null).permissions.has("credit:write") : false;

  const [fiche, setFiche] = useState<FicheClientCredit | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [rechargement, setRechargement] = useState(0);
  const [remboursementOuvert, setRemboursementOuvert] = useState(false);
  const [succes, setSucces] = useState<string | null>(null);

  const [edition, setEdition] = useState(false);
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [note, setNote] = useState("");
  const [erreurEdition, setErreurEdition] = useState<string | null>(null);
  const [envoiEdition, setEnvoiEdition] = useState(false);

  const charger = useCallback(() => {
    if (!structureId) return () => undefined;
    let actif = true;
    getFicheClientCredit(structureId, clientId)
      .then((res) => {
        if (!actif) return;
        setFiche(res.data);
        setErreur(null);
      })
      .catch((err: unknown) => {
        if (actif) setErreur(messageErreurPour(err, MSG_CHARGEMENT_ECHOUE));
      });
    return () => {
      actif = false;
    };
  }, [structureId, clientId]);

  useEffect(() => charger(), [charger, rechargement]);

  const ouvrirEdition = () => {
    if (!fiche) return;
    setNom(fiche.nomComplet);
    setTelephone(fiche.telephone ?? "");
    setNote(fiche.note ?? "");
    setErreurEdition(null);
    setEdition(true);
  };

  const enregistrerEdition = async () => {
    if (!structureId) return;
    if (nom.trim().length < 2) {
      setErreurEdition("Le nom doit contenir au moins 2 caractères.");
      return;
    }
    if (!telephonePrescripteurValide(telephone)) {
      setErreurEdition("Ce numéro de téléphone n'est pas valide. Exemple : 620 00 00 00");
      return;
    }
    setEnvoiEdition(true);
    setErreurEdition(null);
    try {
      const res = await modifierClientCredit(structureId, clientId, {
        nomComplet: nom.trim(),
        telephone: telephone.trim() === "" ? null : telephone.trim(),
        note: note.trim() === "" ? null : note.trim(),
      });
      setFiche(res.data);
      setEdition(false);
    } catch (err) {
      setErreurEdition(messageErreurPour(err, "Les informations n'ont pas pu être enregistrées. Réessayez dans un instant."));
    } finally {
      setEnvoiEdition(false);
    }
  };

  const retour = (
    <Link href="/dashboard/credits" className={`${ui.bouton.discret} !px-0`}>
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      Retour au cahier de crédit
    </Link>
  );

  if (erreur) {
    return (
      <div className="mx-auto max-w-mc-contenu space-y-4">
        {retour}
        <ErreurAvecReessai message={erreur} onReessayer={() => setRechargement((n) => n + 1)} />
      </div>
    );
  }
  if (fiche === null || !structureId || !user) {
    return (
      <p role="status" className={`${ui.texte.petit} animate-pulse`}>
        Chargement de la fiche...
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-mc-contenu space-y-6 animate-fade-in">
      {retour}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className={`${ui.titrePage} break-words`} style={POLICE_TITRE}>
            {fiche.nomComplet}
          </h1>
          <p className={ui.texte.normal}>{fiche.telephone ?? "Pas de téléphone"}</p>
        </div>
        <span className={CLASSE_BADGE_STATUT[fiche.statut]}>{libelleStatut(fiche.statut)}</span>
      </div>

      {succes && (
        <div role="status" className={ui.alerte.succes}>
          {succes}
        </div>
      )}

      <section className={`${ui.carte} flex flex-wrap items-center justify-between gap-4`} aria-label="Reste à payer">
        <div>
          <p className={ui.texte.petit}>Reste à payer</p>
          <p className="whitespace-nowrap text-3xl font-semibold tabular-nums text-slate-900 dark:text-white" style={POLICE_TITRE}>
            {formaterGNF(fiche.resteAPayer)}
          </p>
          <p className={ui.texte.legende}>
            Pris : {formaterGNF(fiche.totalPris)}, remboursé : {formaterGNF(fiche.totalRembourse)}
          </p>
        </div>
        {peutEcrire && fiche.resteAPayer > 0 && (
          <button type="button" onClick={() => setRemboursementOuvert(true)} className={ui.bouton.primaire}>
            <HandCoins className="h-4 w-4" aria-hidden="true" />
            Enregistrer un remboursement
          </button>
        )}
      </section>

      <section className={`${ui.carte} space-y-3`} aria-labelledby="titre-infos">
        <div className="flex items-center justify-between gap-3">
          <h2 id="titre-infos" className={ui.texte.section} style={POLICE_TITRE}>
            Informations du client
          </h2>
          {peutEcrire && !edition && (
            <button type="button" onClick={ouvrirEdition} className={ui.bouton.secondaire}>
              <Pencil className="h-4 w-4" aria-hidden="true" />
              Modifier
            </button>
          )}
        </div>
        {edition ? (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void enregistrerEdition();
            }}
          >
            <div>
              <label htmlFor="client-nom" className={ui.label}>
                Nom complet
              </label>
              <input id="client-nom" value={nom} maxLength={100} onChange={(e) => setNom(e.target.value)} className={ui.champ} />
            </div>
            <div>
              <label htmlFor="client-tel" className={ui.label}>
                Téléphone (facultatif)
              </label>
              <input
                id="client-tel"
                inputMode="tel"
                value={telephone}
                onChange={(e) => setTelephone(filtrerTelephonePrescripteur(e.target.value))}
                className={ui.champ}
              />
            </div>
            <div>
              <label htmlFor="client-note" className={ui.label}>
                Note (facultatif)
              </label>
              <textarea id="client-note" value={note} maxLength={500} rows={3} onChange={(e) => setNote(e.target.value)} className={ui.champ} />
            </div>
            {erreurEdition && (
              <p role="alert" className={ui.alerte.erreur}>
                {erreurEdition}
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              <button type="submit" disabled={envoiEdition} className={ui.bouton.primaire}>
                Enregistrer
              </button>
              <button type="button" disabled={envoiEdition} onClick={() => setEdition(false)} className={ui.bouton.secondaire}>
                Annuler
              </button>
            </div>
          </form>
        ) : (
          <dl className="space-y-1 text-mc-normal text-slate-800 dark:text-slate-200">
            <div className="flex gap-2">
              <dt className="font-medium">Téléphone :</dt>
              <dd>{fiche.telephone ?? "non renseigné"}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-medium">Note :</dt>
              <dd className="break-words">{fiche.note ?? "aucune"}</dd>
            </div>
          </dl>
        )}
      </section>

      <section className={`${ui.carte} space-y-3`} aria-labelledby="titre-prises">
        <h2 id="titre-prises" className={ui.texte.section} style={POLICE_TITRE}>
          Ce qu&apos;il a pris
        </h2>
        {fiche.prises.length === 0 ? (
          <p className={ui.texte.petit}>Aucune prise à crédit pour ce client.</p>
        ) : (
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {fiche.prises.map((p) => (
              <li key={p.venteId} className="space-y-1 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-slate-900 dark:text-white">
                    {formaterDateHeure(p.createdAt)} <span className={ui.texte.legende}>({p.numero})</span>
                  </p>
                  <div className="flex items-center gap-2">
                    {p.annulee && <span className={ui.badge.neutre}>Annulée</span>}
                    {p.soldee && !p.annulee && <span className={ui.badge.succes}>Soldée</span>}
                    <span className="whitespace-nowrap font-semibold tabular-nums">{formaterGNF(p.total)}</span>
                  </div>
                </div>
                <p className={ui.texte.normal}>{resumePrise(p)}</p>
                {p.annulee && p.motifAnnulation && <p className={ui.texte.legende}>Motif : {p.motifAnnulation}</p>}
                {!p.annulee && !p.soldee && (
                  <p className={ui.texte.legende}>
                    Reste sur cette prise : <span className="whitespace-nowrap tabular-nums">{formaterGNF(p.resteSurPrise)}</span>
                  </p>
                )}
                {!p.annulee && (
                  <DateLimitePrise
                    prise={p}
                    peutEcrire={peutEcrire}
                    structureId={structureId}
                    onFiche={(f) => setFiche(f)}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={`${ui.carte} space-y-3`} aria-labelledby="titre-remboursements">
        <h2 id="titre-remboursements" className={ui.texte.section} style={POLICE_TITRE}>
          Remboursements
        </h2>
        {fiche.remboursements.length === 0 ? (
          <p className={ui.texte.petit}>Aucun remboursement pour le moment.</p>
        ) : (
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {fiche.remboursements.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start justify-between gap-2 py-3">
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">{formaterDateHeure(r.createdAt)}</p>
                  {r.note && <p className={ui.texte.normal}>{r.note}</p>}
                  <p className={ui.texte.legende}>
                    {r.verseEnCaisse ? "Versé en caisse" : "Non versé en caisse"}, enregistré par {r.auteurNom}
                  </p>
                </div>
                <span className="whitespace-nowrap font-semibold tabular-nums">{formaterGNF(r.montant)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <RemboursementModal
        isOpen={remboursementOuvert}
        structureId={structureId}
        userId={user.id}
        client={{ id: fiche.id, nomComplet: fiche.nomComplet, resteAPayer: fiche.resteAPayer }}
        onClose={() => setRemboursementOuvert(false)}
        onSucces={(_resultat, _client, message) => {
          setRemboursementOuvert(false);
          setSucces(message);
          setRechargement((n) => n + 1);
        }}
      />
    </div>
  );
}
