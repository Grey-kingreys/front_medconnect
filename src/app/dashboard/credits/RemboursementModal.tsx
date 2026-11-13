"use client";

import { useEffect, useRef, useState } from "react";
import { HandCoins, Loader2, Search } from "lucide-react";
import { ui } from "@/theme/ui";
import { FOCUS } from "@/components/pharmacie/classes";
import { useDialogA11y } from "@/hooks/useDialogA11y";
import { messageErreurPour } from "@/hooks/useToast";
import {
  enregistrerRemboursement,
  listerCredits,
  type ClientCreditResume,
  type ResultatRemboursement,
} from "@/lib/api_credit";
import { sourceCaisse } from "@/lib/caisse/source_active";
import { formaterGNF } from "@/lib/format_gnf";
import { filtrerMontant, lireMontant } from "./affichage";

export interface ClientARembourser {
  id: string;
  nomComplet: string;
  resteAPayer: number;
}

interface Props {
  isOpen: boolean;
  structureId: string;
  userId: string;
  /** Client déjà choisi (depuis la fiche) ; absent : la fenêtre propose de le chercher. */
  client?: ClientARembourser | null;
  onClose: () => void;
  /** Reçoit le résultat (nouveau reste, statut), le client concerné et le message du serveur. */
  onSucces: (resultat: ResultatRemboursement, client: ClientARembourser, message: string) => void;
}

const MSG_ECHEC = "Le remboursement n'a pas pu être enregistré. Vérifiez votre connexion puis réessayez.";
const MSG_RECHERCHE_ECHEC = "La recherche a échoué. Vérifiez votre connexion puis réessayez.";

function Contenu({ structureId, userId, client: clientFixe, onClose, onSucces }: Omit<Props, "isOpen">) {
  const { dialogProps, titleId } = useDialogA11y({ isOpen: true, onClose });
  const [client, setClient] = useState<ClientARembourser | null>(clientFixe ?? null);
  const [recherche, setRecherche] = useState("");
  const [resultats, setResultats] = useState<ClientCreditResume[] | null>(null);
  const [erreurRecherche, setErreurRecherche] = useState<string | null>(null);
  const [montant, setMontant] = useState("");
  const [note, setNote] = useState("");
  const [caisseOuverte, setCaisseOuverte] = useState(false);
  const [verseEnCaisse, setVerseEnCaisse] = useState(false);
  const [refus, setRefus] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const envoiRef = useRef(false);

  // La case « Mettre cet argent dans ma caisse » n'existe que si une caisse est ouverte à mon nom.
  useEffect(() => {
    let actif = true;
    sourceCaisse()
      .etatCaisse(structureId, userId)
      .then((etat) => {
        if (actif) setCaisseOuverte(etat.session !== null);
      })
      .catch(() => {
        if (actif) setCaisseOuverte(false);
      });
    return () => {
      actif = false;
    };
  }, [structureId, userId]);

  // Choix du client (bouton rapide) : recherche parmi les clients qui doivent encore de l'argent.
  useEffect(() => {
    if (clientFixe) return;
    let actif = true;
    const delai = setTimeout(() => {
      listerCredits(structureId, { q: recherche, parPage: 20 })
        .then((res) => {
          if (!actif) return;
          setResultats(res.data.clients.filter((c) => c.statut !== "SOLDE"));
          setErreurRecherche(null);
        })
        .catch((err: unknown) => {
          if (actif) setErreurRecherche(messageErreurPour(err, MSG_RECHERCHE_ECHEC));
        });
    }, 250);
    return () => {
      actif = false;
      clearTimeout(delai);
    };
  }, [structureId, recherche, clientFixe]);

  const valeur = lireMontant(montant);
  const reste = client?.resteAPayer ?? 0;
  const depasse = valeur !== null && valeur > reste;
  const valide = client !== null && valeur !== null && !depasse;

  const valider = async () => {
    if (envoiRef.current) return;
    if (!client || !valide || valeur === null) {
      setRefus(true);
      return;
    }
    envoiRef.current = true;
    setEnvoi(true);
    setErreur(null);
    try {
      const res = await enregistrerRemboursement(structureId, client.id, {
        montant: valeur,
        ...(note.trim() !== "" ? { note: note.trim() } : {}),
        verseEnCaisse: caisseOuverte && verseEnCaisse,
      });
      onSucces(res.data, client, res.message);
    } catch (err) {
      setErreur(messageErreurPour(err, MSG_ECHEC));
      envoiRef.current = false;
      setEnvoi(false);
    }
  };

  const messageMontant = depasse
    ? `Le montant dépasse ce que le client doit : il reste ${formaterGNF(reste)} à payer.`
    : refus && valeur === null
      ? "Saisissez un montant en chiffres, par exemple 25000."
      : null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className={ui.dialogue.fond} onClick={envoi ? undefined : onClose} aria-hidden="true" />
      <div {...dialogProps} className={ui.dialogue.panneau}>
        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            void valider();
          }}
        >
          <div className="flex items-center gap-3">
            <div className={ui.dialogue.iconeAttention}>
              <HandCoins size={20} aria-hidden="true" />
            </div>
            <h3 id={titleId} className={ui.texte.section}>
              Enregistrer un remboursement
            </h3>
          </div>

          {client === null ? (
            <div className="space-y-3">
              <div>
                <label htmlFor="rembours-recherche" className={ui.label}>
                  Qui rembourse ?
                </label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                  <input
                    id="rembours-recherche"
                    type="search"
                    value={recherche}
                    onChange={(e) => setRecherche(e.target.value)}
                    placeholder="Nom ou téléphone"
                    className={`${ui.champ} pl-9`}
                  />
                </div>
              </div>
              {erreurRecherche && (
                <p role="alert" className={ui.alerte.erreur}>
                  {erreurRecherche}
                </p>
              )}
              {resultats === null ? (
                <p role="status" className={ui.texte.petit}>
                  Chargement...
                </p>
              ) : resultats.length === 0 ? (
                <p className={ui.texte.petit}>Aucun client ne doit d&apos;argent pour cette recherche.</p>
              ) : (
                <ul className="max-h-60 divide-y divide-slate-200 overflow-y-auto dark:divide-slate-800">
                  {resultats.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => setClient({ id: c.id, nomComplet: c.nomComplet, resteAPayer: c.resteAPayer })}
                        className={`flex w-full items-center justify-between gap-3 px-1 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 ${FOCUS}`}
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-slate-900 dark:text-white">{c.nomComplet}</span>
                          {c.telephone && <span className={`block ${ui.texte.legende}`}>{c.telephone}</span>}
                        </span>
                        <span className="whitespace-nowrap tabular-nums text-mc-normal font-semibold">{formaterGNF(c.resteAPayer)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <p className="font-semibold text-slate-900 dark:text-white">{client.nomComplet}</p>
                <p className={ui.texte.normal}>
                  Reste à payer : <span className="whitespace-nowrap font-semibold tabular-nums">{formaterGNF(reste)}</span>
                </p>
                {!clientFixe && (
                  <button type="button" onClick={() => setClient(null)} className={`${ui.bouton.discret} !px-0`}>
                    Changer de client
                  </button>
                )}
              </div>

              <div>
                <label htmlFor="rembours-montant" className={ui.label}>
                  Montant remboursé (GNF)
                </label>
                <input
                  id="rembours-montant"
                  inputMode="numeric"
                  autoComplete="off"
                  value={montant}
                  onChange={(e) => setMontant(filtrerMontant(e.target.value))}
                  aria-invalid={messageMontant !== null}
                  aria-describedby={messageMontant ? "rembours-montant-erreur" : undefined}
                  className={`${ui.champ} tabular-nums`}
                />
                {messageMontant && (
                  <p id="rembours-montant-erreur" role="alert" className={`mt-1 ${ui.dialogue.erreurChamp}`}>
                    {messageMontant}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="rembours-note" className={ui.label}>
                  Note (facultatif)
                </label>
                <input
                  id="rembours-note"
                  value={note}
                  maxLength={300}
                  onChange={(e) => setNote(e.target.value)}
                  className={ui.champ}
                />
              </div>

              {caisseOuverte && (
                <label className="flex items-start gap-3 text-mc-normal text-slate-800 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={verseEnCaisse}
                    onChange={(e) => setVerseEnCaisse(e.target.checked)}
                    className={`mt-0.5 h-4 w-4 accent-primary-600 ${FOCUS}`}
                  />
                  Mettre cet argent dans ma caisse
                </label>
              )}
            </>
          )}

          {erreur && (
            <p role="alert" className={ui.alerte.erreur}>
              {erreur}
            </p>
          )}

          <div className="flex flex-wrap justify-end gap-3">
            <button type="button" onClick={onClose} disabled={envoi} className={ui.bouton.secondaire}>
              Annuler
            </button>
            {client !== null && (
              <button type="submit" disabled={envoi || !valide} className={ui.bouton.primaire}>
                {envoi && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                Valider le remboursement
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

/** Fenêtre de remboursement : montée à chaque ouverture, donc tous les champs repartent à neuf. */
export function RemboursementModal({ isOpen, ...reste }: Props) {
  if (!isOpen) return null;
  return <Contenu {...reste} />;
}
