"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, PackageMinus } from "lucide-react";
import { ChoixLot, coefficientDuLot } from "@/components/pharmacie/ChoixLot";
import { FOCUS } from "@/components/pharmacie/classes";
import { ui } from "@/theme/ui";
import { ErreurAvecReessai } from "@/components/pharmacie/ErreurAvecReessai";
import { useDialogA11y } from "@/hooks/useDialogA11y";
import { messageErreurPour } from "@/hooks/useToast";
import { nouvelleCleIdempotence } from "@/lib/api_carnet";
import {
  LIBELLES_RAISON_SORTIE,
  listerLotsFiche,
  sortirDuStock,
  type CorpsSortieStock,
  type LotEnStock,
  type RaisonSortie,
  type StockMedicament,
  type UniteMinimale,
} from "@/lib/api_pharmacie";
import { LIBELLES_UNITE_MINIMALE, formaterARegulariser, formaterQuantite } from "@/lib/caisse/regles/quantites";
import { estErreurReseau } from "@/lib/erreurs_api";

interface SortieStockProps {
  isOpen: boolean;
  stock: StockMedicament | null;
  structureId: string;
  /** `rechargerStock` est vrai quand l'issue de l'envoi est inconnue (échec réseau) : la page relit le stock. */
  onClose: (rechargerStock?: boolean) => void;
  /** Reçoit le message du serveur suivi du reste du lot, que la page affiche puis recharge le stock. */
  onSucces: (message: string) => void;
}

const MESSAGE_REFUS_LOCAL = "Choisissez le lot, la raison et la quantité (et précisez pour « Autre raison »).";
const MESSAGE_ISSUE_INCONNUE =
  "La sortie n'a peut-être pas été enregistrée. Appuyez sur « Réessayer l'envoi » : elle ne sera pas comptée deux fois.";
const MESSAGE_ECHEC_PAR_DEFAUT = "La sortie n'a pas pu être enregistrée. Vérifiez votre connexion puis réessayez.";
const MESSAGE_LOTS_ECHEC = "Les lots n'ont pas pu être chargés. Vérifiez votre connexion puis réessayez.";
const LONGUEUR_MAX_COMMENTAIRE = 300;

const RAISONS: RaisonSortie[] = ["PERIME", "CASSE", "PERDU", "RETOUR_FOURNISSEUR", "AUTRE"];

type UniteSaisie = "boites" | "unites";

type EtatLots =
  | { statut: "chargement" }
  | { statut: "pret"; lots: LotEnStock[] }
  | { statut: "erreur"; message: string };

interface ContenuProps {
  stock: StockMedicament;
  structureId: string;
  onClose: (rechargerStock?: boolean) => void;
  onSucces: (message: string) => void;
}

/** Contenu du dialogue : monté à chaque ouverture, donc tous les champs et l'identifiant d'envoi repartent à neuf. */
function ContenuSortie({ stock, structureId, onClose, onSucces }: ContenuProps) {
  const unite = stock.uniteMinimale ?? "UNITE";
  const libelleUnite = LIBELLES_UNITE_MINIMALE[unite];
  const coefficientFiche = stock.coefficientBoite ?? 1;

  const [etatLots, setEtatLots] = useState<EtatLots>({ statut: "chargement" });
  const [essai, setEssai] = useState(0);

  const [lotChoisi, setLotChoisi] = useState<string | null>(null);
  const [raisonChoisie, setRaisonChoisie] = useState<RaisonSortie | null>(null);
  const [quantite, setQuantite] = useState("");
  const [uniteSaisie, setUniteSaisie] = useState<UniteSaisie>("boites");
  const [commentaire, setCommentaire] = useState("");
  const [refusLocal, setRefusLocal] = useState(false);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  // Échec réseau : l'issue est inconnue, la saisie est en lecture seule et l'envoi se rejoue avec le même identifiant (D688).
  const [issueInconnue, setIssueInconnue] = useState(false);
  const [idSortie] = useState(() => nouvelleCleIdempotence());
  const envoiRef = useRef(false);
  const corpsEnvoye = useRef<CorpsSortieStock | null>(null);

  const fermer = () => onClose(issueInconnue);
  const { dialogProps, titleId } = useDialogA11y({ isOpen: true, onClose: fermer, closeOnEscape: !envoiEnCours });

  useEffect(() => {
    let actif = true;
    listerLotsFiche(structureId, stock.id)
      .then((res) => {
        if (!actif) return;
        // Les périmés en tête, sans changer l'ordre de sortie à l'intérieur de chaque groupe.
        const lots = [...res.data.filter((l) => l.perime), ...res.data.filter((l) => !l.perime)];
        setEtatLots({ statut: "pret", lots });
      })
      .catch((err: unknown) => {
        if (actif) setEtatLots({ statut: "erreur", message: messageErreurPour(err, MESSAGE_LOTS_ECHEC) });
      });
    return () => {
      actif = false;
    };
  }, [structureId, stock.id, essai]);

  const reessayerLots = () => {
    setEtatLots({ statut: "chargement" });
    setEssai((n) => n + 1);
  };

  const lots = etatLots.statut === "pret" ? etatLots.lots : [];
  // Un seul lot : présélectionné ; lot périmé : « Périmé » présélectionné tant qu'aucune raison n'est choisie.
  const lotId = lotChoisi ?? (lots.length === 1 ? lots[0].id : null);
  const lot = lots.find((l) => l.id === lotId) ?? null;
  const raison = raisonChoisie ?? (lot?.perime ? "PERIME" : null);
  // Une quantité de lot se lit toujours avec le coefficient du lot (D709) : liste, résumé, saisie en boîtes et reste.
  const coefficientLot = lot ? coefficientDuLot(lot, coefficientFiche) : coefficientFiche;
  const verrouille = envoiEnCours || issueInconnue;

  const nombre = /^\d+$/.test(quantite.trim()) ? Number(quantite.trim()) : 0;
  const quantiteValide = Number.isSafeInteger(nombre) && nombre >= 1;
  const formulaireValide =
    lot !== null && raison !== null && quantiteValide && (raison !== "AUTRE" || commentaire.trim() !== "");

  const envoyer = async (corps: CorpsSortieStock) => {
    if (envoiRef.current) return;
    envoiRef.current = true;
    setEnvoiEnCours(true);
    setErreur(null);
    try {
      const res = await sortirDuStock(structureId, corps);
      const reste = formaterQuantite(res.data.soldeLot, Math.max(1, coefficientLot), unite);
      const aRegulariser = formaterARegulariser(res.data.quantiteARegulariser, coefficientFiche, unite);
      onSucces(
        `${res.message} Reste dans ce lot : ${reste}.${aRegulariser === null ? "" : ` Sur ce médicament : ${aRegulariser}.`}`,
      );
      onClose(false);
    } catch (err) {
      if (estErreurReseau(err)) {
        setIssueInconnue(true);
        setErreur(MESSAGE_ISSUE_INCONNUE);
      } else {
        setErreur(messageErreurPour(err, MESSAGE_ECHEC_PAR_DEFAUT));
      }
      envoiRef.current = false;
      setEnvoiEnCours(false);
    }
  };

  const enregistrer = () => {
    if (envoiRef.current) return;
    if (!formulaireValide || lot === null || raison === null) {
      setRefusLocal(true);
      return;
    }
    const corps: CorpsSortieStock = {
      id: idSortie,
      stockId: stock.id,
      lotId: lot.id,
      unite: uniteSaisie === "unites" ? "UNITE" : "BOITE",
      quantite: nombre,
      raison,
    };
    if (commentaire.trim() !== "") corps.commentaire = commentaire.trim();
    corpsEnvoye.current = corps;
    void envoyer(corps);
  };

  const toutLeLot = () => {
    if (!lot) return;
    setQuantite(String(lot.quantite));
    setUniteSaisie("unites");
    setRefusLocal(false);
  };

  const classeRadio = `h-4 w-4 accent-primary-600 ${FOCUS}`;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className={ui.dialogue.fond} onClick={envoiEnCours ? undefined : fermer} aria-hidden="true" />
      <div
        {...dialogProps}
        className={ui.dialogue.panneau}
      >
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <div className={ui.dialogue.iconeAttention}>
              <PackageMinus size={20} aria-hidden="true" />
            </div>
            <h3 id={titleId} className={ui.texte.section}>
              Sortir {stock.medicament.nom} du stock
            </h3>
          </div>

          {etatLots.statut === "chargement" && (
            <div role="status" className={`flex items-center gap-3 ${ui.texte.petit}`}>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Chargement des lots...
            </div>
          )}

          {etatLots.statut === "erreur" && (
            <>
              <ErreurAvecReessai message={etatLots.message} onReessayer={reessayerLots} />
              <button type="button" onClick={fermer} className={ui.bouton.secondaire}>
                Annuler
              </button>
            </>
          )}

          {etatLots.statut === "pret" && lots.length === 0 && (
            <>
              <p className={ui.texte.petit}>Aucun lot en stock pour ce médicament.</p>
              <button type="button" onClick={fermer} className={ui.bouton.primaire}>
                Fermer
              </button>
            </>
          )}

          {etatLots.statut === "pret" && lots.length > 0 && (
            <>
              <div className="flex flex-col gap-5 min-w-0">
                {verrouille ? (
                  <ResumeLot lots={lots} lotId={lotId} coefficient={coefficientFiche} unite={unite} />
                ) : (
                  <ChoixLot
                    lots={lots}
                    valeur={lotId}
                    onChange={(id) => {
                      setLotChoisi(id);
                      setRefusLocal(false);
                    }}
                    legende="Lot à sortir"
                    coefficient={coefficientFiche}
                    unite={unite}
                  />
                )}

                <fieldset className="space-y-2" disabled={verrouille}>
                  <legend className={`${ui.label} mb-2`}>Raison</legend>
                  {RAISONS.map((valeur) => (
                    <label key={valeur} className={`flex items-center gap-3 ${ui.texte.normal}`}>
                      <input
                        type="radio"
                        name="raison-sortie"
                        checked={raison === valeur}
                        onChange={() => {
                          setRaisonChoisie(valeur);
                          setRefusLocal(false);
                        }}
                        className={classeRadio}
                      />
                      {LIBELLES_RAISON_SORTIE[valeur]}
                    </label>
                  ))}
                </fieldset>

                <div>
                  <label htmlFor="quantite-sortie" className={`${ui.label} mb-2`}>
                    Quantité
                  </label>
                  <div className="flex items-start gap-3">
                    <input
                      id="quantite-sortie"
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      value={quantite}
                      readOnly={verrouille}
                      onChange={(e) => {
                        setQuantite(e.target.value);
                        setRefusLocal(false);
                      }}
                      className={ui.champ}
                    />
                    <button
                      type="button"
                      onClick={toutLeLot}
                      disabled={verrouille || lot === null}
                      className={`${ui.bouton.secondaire}`}
                    >
                      Tout le lot
                    </button>
                  </div>
                  {coefficientLot > 1 ? (
                    <fieldset className="mt-3 flex flex-wrap gap-x-6 gap-y-2" disabled={verrouille}>
                      <legend className="sr-only">Unité de la quantité</legend>
                      {(
                        [
                          ["boites", "en boîtes"],
                          ["unites", `en ${libelleUnite.pluriel}`],
                        ] as const
                      ).map(([valeur, libelle]) => (
                        <label key={valeur} className={`flex items-center gap-3 ${ui.texte.normal}`}>
                          <input
                            type="radio"
                            name="unite-sortie"
                            checked={uniteSaisie === valeur}
                            onChange={() => setUniteSaisie(valeur)}
                            className={classeRadio}
                          />
                          {libelle}
                        </label>
                      ))}
                    </fieldset>
                  ) : (
                    <p className={`mt-2 ${ui.texte.petit}`}>en boîtes</p>
                  )}
                </div>

                <div>
                  <label htmlFor="commentaire-sortie" className={`${ui.label} mb-2`}>
                    Précisez
                  </label>
                  <input
                    id="commentaire-sortie"
                    type="text"
                    maxLength={LONGUEUR_MAX_COMMENTAIRE}
                    autoComplete="off"
                    value={commentaire}
                    readOnly={verrouille}
                    onChange={(e) => {
                      setCommentaire(e.target.value);
                      setRefusLocal(false);
                    }}
                    aria-describedby="aide-commentaire-sortie"
                    className={ui.champ}
                  />
                  <p id="aide-commentaire-sortie" className={`mt-1 ${ui.texte.legende}`}>
                    Obligatoire pour « Autre raison », facultatif sinon.
                  </p>
                </div>
              </div>

              {refusLocal && (
                <p role="alert" className={ui.dialogue.erreurChamp}>
                  {MESSAGE_REFUS_LOCAL}
                </p>
              )}

              {erreur && (
                <div role="alert" className={ui.alerte.erreur}>
                  {erreur}
                </div>
              )}

              <div className="flex flex-col-reverse sm:flex-row gap-3 w-full">
                <button
                  type="button"
                  onClick={fermer}
                  disabled={envoiEnCours}
                  className={`flex-1 ${ui.bouton.secondaire}`}
                >
                  {issueInconnue ? "Fermer" : "Annuler"}
                </button>
                {issueInconnue ? (
                  <button
                    type="button"
                    onClick={() => corpsEnvoye.current && void envoyer(corpsEnvoye.current)}
                    className={`flex-[2] ${ui.bouton.primaire}`}
                  >
                    Réessayer l&apos;envoi
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={enregistrer}
                    disabled={envoiEnCours}
                    className={`flex-[2] ${ui.bouton.primaire}`}
                  >
                    {envoiEnCours && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                    {envoiEnCours ? "Enregistrement..." : "Enregistrer la sortie"}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Lot choisi, en lecture seule quand la saisie est verrouillée (la liste des boutons radio ne peut pas l'être). */
function ResumeLot({
  lots,
  lotId,
  coefficient,
  unite,
}: {
  lots: LotEnStock[];
  lotId: string | null;
  coefficient: number;
  unite: UniteMinimale;
}) {
  const lot = lots.find((l) => l.id === lotId);
  if (!lot) return null;
  const numero = lot.numeroLot ? `Lot ${lot.numeroLot}` : "Lot sans numéro";
  return (
    <p className={ui.texte.normal}>
      <span className="block text-mc-petit font-medium mb-1">Lot à sortir</span>
      {numero}, {formaterQuantite(lot.quantite, coefficientDuLot(lot, coefficient), unite)}
    </p>
  );
}

/** Dialogue de sortie d'un lot du stock avec une raison obligatoire (cassé, périmé, perdu, retour, autre). */
export function SortieStock({ isOpen, stock, structureId, onClose, onSucces }: SortieStockProps) {
  if (!isOpen || !stock) return null;
  return <ContenuSortie stock={stock} structureId={structureId} onClose={onClose} onSucces={onSucces} />;
}
