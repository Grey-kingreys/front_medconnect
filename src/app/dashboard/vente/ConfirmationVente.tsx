"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { Loader2, ShoppingCart } from "lucide-react";
import { useDialogA11y } from "@/hooks/useDialogA11y";
import type { ModePaiement } from "@/lib/api_caisse";
import type { PaiementDemande } from "@/lib/api_ventes";
import { formaterGNF } from "@/lib/format_gnf";
import { CHAMP, FOCUS } from "@/components/pharmacie/classes";

export interface LigneConfirmation {
  cle: string;
  nom: string;
  nombre: number;
  unite: "BOITE" | "UNITE";
  /** Libellé singulier de l'unité (« comprimé »), utilisé pour une vente à l'unité. */
  libelleUnite: string;
  montant: number;
}

interface ConfirmationVenteProps {
  isOpen: boolean;
  onClose: () => void;
  /** null : espèces pour le total, sans montant reçu (le serveur l'applique de lui-même). */
  onConfirmer: (paiements: PaiementDemande[] | null) => void;
  envoiEnCours: boolean;
  lignes: LigneConfirmation[];
  total: number;
  client: string;
  ordonnanceVue: boolean;
  modes: ModePaiement[];
}

const CODE_ESPECES = "ESPECES";
const PARTAGE = "PARTAGE";
const LONGUEUR_MAX_REFERENCE = 60;
const MODE_ESPECES_SEUL: ModePaiement = {
  code: CODE_ESPECES,
  libelle: "Espèces",
  comptagePhysique: true,
  referenceAutorisee: false,
  ordre: 0,
};

const chiffres = (valeur: string) => valeur.replace(/\D/g, "").slice(0, 10);
const entier = (valeur: string) => (valeur === "" ? 0 : Number(valeur));

const CLASSE_MODE = (actif: boolean) =>
  `px-4 py-2 rounded-2xl border text-sm font-medium transition-colors ${FOCUS} ${
    actif
      ? "border-primary-600 bg-primary-50 dark:bg-primary-500/15 text-primary-700 dark:text-primary-300"
      : "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
  }`;

interface SaisieMode {
  montant: string;
  recu: string;
  reference: string;
}
const SAISIE_VIDE: SaisieMode = { montant: "", recu: "", reference: "" };

interface ContenuProps extends Omit<ConfirmationVenteProps, "isOpen"> {
  dialogProps: ReturnType<typeof useDialogA11y>["dialogProps"];
  titleId: string;
  refConfirmer: RefObject<HTMLButtonElement | null>;
}

function ChampMontant({
  id,
  libelle,
  valeur,
  onChange,
  aide,
}: {
  id: string;
  libelle: string;
  valeur: string;
  onChange: (v: string) => void;
  aide?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm text-slate-700 dark:text-slate-300 mb-1">
        {libelle}
      </label>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={valeur}
        onChange={(e) => onChange(chiffres(e.target.value))}
        className={CHAMP}
      />
      {aide && <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">{aide}</p>}
    </div>
  );
}

function ChampReference({ id, valeur, onChange }: { id: string; valeur: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm text-slate-700 dark:text-slate-300 mb-1">
        Référence de la transaction (facultatif)
      </label>
      <input
        id={id}
        type="text"
        maxLength={LONGUEUR_MAX_REFERENCE}
        value={valeur}
        onChange={(e) => onChange(e.target.value)}
        className={CHAMP}
      />
    </div>
  );
}

/** Contenu du dialogue : monté à chaque ouverture, donc le paiement repart toujours de « Espèces ». */
function ContenuConfirmation({
  onClose,
  onConfirmer,
  envoiEnCours,
  lignes,
  total,
  client,
  ordonnanceVue,
  modes,
  dialogProps,
  titleId,
  refConfirmer,
}: ContenuProps) {
  const modesTries = modes.length > 0 ? [...modes].sort((a, b) => a.ordre - b.ordre) : [MODE_ESPECES_SEUL];
  const modeParDefaut = modesTries.find((m) => m.code === CODE_ESPECES) ?? modesTries[0];
  const [choix, setChoix] = useState<string>(modeParDefaut.code);
  const [saisies, setSaisies] = useState<Record<string, SaisieMode>>({});
  const saisie = (code: string): SaisieMode => saisies[code] ?? SAISIE_VIDE;
  const modifier = (code: string, partie: Partial<SaisieMode>) =>
    setSaisies((s) => ({ ...s, [code]: { ...(s[code] ?? SAISIE_VIDE), ...partie } }));

  const partagePossible = modesTries.length > 1;
  const choixCourant = choix === PARTAGE ? null : (modesTries.find((m) => m.code === choix) ?? modeParDefaut);

  // Contrôles du paiement : message d'erreur, reste, et corps du paiement.
  let erreurPaiement: string | null = null;
  let reste = 0;
  let paiements: PaiementDemande[] | null = null;
  let monnaie: number | null = null;

  if (choixCourant !== null) {
    const { recu, reference } = saisie(choixCourant.code);
    if (choixCourant.code === CODE_ESPECES) {
      if (recu !== "") {
        const montantRecu = entier(recu);
        if (montantRecu < total) erreurPaiement = "Le montant reçu est inférieur au total.";
        else {
          monnaie = montantRecu - total;
          paiements = [{ mode: CODE_ESPECES, montant: total, montantRecu }];
        }
      }
    } else {
      const paiement: PaiementDemande = { mode: choixCourant.code, montant: total };
      if (choixCourant.referenceAutorisee && reference.trim() !== "") paiement.reference = reference.trim();
      paiements = [paiement];
    }
  } else {
    const liste: PaiementDemande[] = [];
    let somme = 0;
    for (const mode of modesTries) {
      const s = saisie(mode.code);
      const montant = entier(s.montant);
      if (montant <= 0) continue;
      somme += montant;
      const paiement: PaiementDemande = { mode: mode.code, montant };
      if (mode.code === CODE_ESPECES && s.recu !== "") {
        if (entier(s.recu) < montant) erreurPaiement = "Le montant reçu est inférieur au montant en espèces.";
        else paiement.montantRecu = entier(s.recu);
      }
      if (mode.referenceAutorisee && s.reference.trim() !== "") paiement.reference = s.reference.trim();
      liste.push(paiement);
    }
    reste = total - somme;
    if (reste !== 0) erreurPaiement = "La somme des montants doit être égale au total.";
    paiements = liste;
  }

  const confirmer = () => {
    if (erreurPaiement !== null) return;
    onConfirmer(paiements);
  };

  const surFleche = (e: KeyboardEvent<HTMLDivElement>) => {
    const sens = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (sens === 0) return;
    e.preventDefault();
    const boutons = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
    const courant = boutons.findIndex((b) => b === document.activeElement);
    const suivant = boutons[(Math.max(courant, 0) + sens + boutons.length) % boutons.length];
    suivant.focus();
    suivant.click();
  };

  const options = [
    ...modesTries.map((m) => ({ code: m.code, libelle: m.libelle })),
    ...(partagePossible ? [{ code: PARTAGE, libelle: "Paiement partagé" }] : []),
  ];

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={envoiEnCours ? undefined : onClose} aria-hidden="true" />
      <div
        {...dialogProps}
        className="relative w-full max-w-md max-h-[90dvh] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 animate-slide-up"
      >
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary-50 dark:bg-primary-500/15 flex items-center justify-center shrink-0">
              <ShoppingCart className="w-6 h-6 text-primary-700 dark:text-primary-300" aria-hidden="true" />
            </div>
            <h3 id={titleId} className="text-xl font-bold text-slate-900 dark:text-white">
              Valider la vente ?
            </h3>
          </div>

          <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-200">
            {lignes.map((ligne) => (
              <li key={ligne.cle} className="flex items-start justify-between gap-4">
                <span>
                  {ligne.unite === "BOITE"
                    ? `${ligne.nombre} × Boîte de ${ligne.nom}`
                    : `${ligne.nombre} × ${ligne.libelleUnite} de ${ligne.nom}`}
                </span>
                <span className="whitespace-nowrap">{formaterGNF(ligne.montant)}</span>
              </li>
            ))}
          </ul>

          <div className="space-y-1 border-t border-slate-200 dark:border-slate-800 pt-4 text-sm text-slate-700 dark:text-slate-200">
            <p className="font-bold text-slate-900 dark:text-white">Total : {formaterGNF(total)}</p>
            {client !== "" && <p>Client : {client}</p>}
            {ordonnanceVue && <p>Ordonnance vue</p>}
          </div>

          <div className="space-y-3">
            <p id="libelle-mode-paiement" className="text-sm font-medium text-slate-800 dark:text-slate-200">
              Mode de paiement
            </p>
            <div
              role="radiogroup"
              aria-labelledby="libelle-mode-paiement"
              onKeyDown={surFleche}
              className="flex flex-wrap gap-2"
            >
              {options.map((o) => (
                <button
                  key={o.code}
                  type="button"
                  role="radio"
                  aria-checked={choix === o.code}
                  tabIndex={choix === o.code ? 0 : -1}
                  onClick={() => setChoix(o.code)}
                  disabled={envoiEnCours}
                  className={CLASSE_MODE(choix === o.code)}
                >
                  {o.libelle}
                </button>
              ))}
            </div>

            {choixCourant?.code === CODE_ESPECES && (
              <ChampMontant
                id="montant-recu"
                libelle="Montant reçu (facultatif)"
                valeur={saisie(CODE_ESPECES).recu}
                onChange={(v) => modifier(CODE_ESPECES, { recu: v })}
                aide={monnaie !== null ? `Monnaie à rendre : ${formaterGNF(monnaie)}` : undefined}
              />
            )}
            {choixCourant !== null && choixCourant.code !== CODE_ESPECES && choixCourant.referenceAutorisee && (
              <ChampReference
                id="reference-paiement"
                valeur={saisie(choixCourant.code).reference}
                onChange={(v) => modifier(choixCourant.code, { reference: v })}
              />
            )}

            {choixCourant === null && (
              <div className="space-y-4">
                {modesTries.map((mode) => (
                  <fieldset key={mode.code} className="space-y-2">
                    <legend className="text-sm font-medium text-slate-800 dark:text-slate-200 mb-1">{mode.libelle}</legend>
                    <ChampMontant
                      id={`partage-montant-${mode.code}`}
                      libelle={`Montant en ${mode.libelle}`}
                      valeur={saisie(mode.code).montant}
                      onChange={(v) => modifier(mode.code, { montant: v })}
                    />
                    {mode.code === CODE_ESPECES && entier(saisie(mode.code).montant) > 0 && (
                      <ChampMontant
                        id="partage-recu"
                        libelle="Montant reçu (facultatif)"
                        valeur={saisie(mode.code).recu}
                        onChange={(v) => modifier(mode.code, { recu: v })}
                      />
                    )}
                    {mode.referenceAutorisee && entier(saisie(mode.code).montant) > 0 && (
                      <ChampReference
                        id={`partage-reference-${mode.code}`}
                        valeur={saisie(mode.code).reference}
                        onChange={(v) => modifier(mode.code, { reference: v })}
                      />
                    )}
                  </fieldset>
                ))}
                <p aria-live="polite" className="text-sm font-bold text-slate-900 dark:text-white">
                  Reste à répartir : {formaterGNF(reste)}
                </p>
              </div>
            )}

            {erreurPaiement !== null && (
              <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">
                {erreurPaiement}
              </p>
            )}
          </div>

          <p className="text-sm text-slate-600 dark:text-slate-300">Les quantités seront retirées de votre stock.</p>

          <div className="flex flex-col-reverse sm:flex-row gap-3 w-full">
            <button
              type="button"
              onClick={onClose}
              disabled={envoiEnCours}
              className="flex-1 px-4 py-3 rounded-2xl text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              Revenir au panier
            </button>
            <button
              ref={refConfirmer}
              type="button"
              onClick={confirmer}
              disabled={envoiEnCours || erreurPaiement !== null}
              className="flex-[2] flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 transition-colors disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
            >
              {envoiEnCours && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              {envoiEnCours ? "Enregistrement..." : "Confirmer la vente"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Récapitulatif demandé avant d'enregistrer une vente, avec le choix du paiement : la vente retire les quantités du stock. */
export function ConfirmationVente({ isOpen, onClose, envoiEnCours, ...reste }: ConfirmationVenteProps) {
  const { dialogProps, titleId } = useDialogA11y({ isOpen, onClose, closeOnEscape: !envoiEnCours });
  const refConfirmer = useRef<HTMLButtonElement>(null);

  // Déclaré après le hook : le focus va au bouton de confirmation, pas au premier élément.
  useEffect(() => {
    if (isOpen) refConfirmer.current?.focus();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <ContenuConfirmation
      {...reste}
      onClose={onClose}
      envoiEnCours={envoiEnCours}
      dialogProps={dialogProps}
      titleId={titleId}
      refConfirmer={refConfirmer}
    />
  );
}
