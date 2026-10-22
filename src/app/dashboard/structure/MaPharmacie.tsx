"use client";

import { useId, useState } from "react";
import Link from "next/link";
import {
  Activity, AlertCircle, Building2, CheckCircle2, Loader2, MapPin, Navigation, Pill, Users,
} from "lucide-react";
import { StatCard } from "@/components/charts/StatCard";
import FileUpload from "@/components/FileUpload";
import ImageWithFallback from "@/components/ImageWithFallback";
import { MapModal } from "@/components/modals/MapModal";
import type { StoredFileView } from "@/lib/api_storage";
import { updateMyStructure, type MyStructure } from "@/lib/api_structure";
import {
  JOURS_SEMAINE,
  ecrirePlage,
  lireHoraires,
  lirePlage,
  type JourSemaine,
  type PlageHoraire,
} from "@/lib/horaires_structure";
import { BlocModifiable } from "./BlocModifiable";
import {
  corpsHoraires,
  corpsInformations,
  corpsPosition,
  messageErreurEnregistrement,
  type EtatBloc,
  type ResultatCorps,
} from "./enregistrement";

const POLICE_TITRE = { fontFamily: "var(--font-outfit, var(--font-inter))" } as const;
const CARTE = "bg-white dark:bg-[#0f172a]/80 border border-slate-200 dark:border-slate-800/50 rounded-3xl p-6";
const CHAMP =
  "w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm text-slate-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 transition-all";
const FOCUS = "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500";
const LABEL = "block mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300";
const BOUTON_SECONDAIRE = `inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors ${FOCUS}`;
const TITRE_H2 = "text-lg font-bold text-slate-900 dark:text-white";
const TEXTE_AIDE = "text-sm text-slate-500 dark:text-slate-400";
const NON_RENSEIGNE = "Non renseigné";

interface MaPharmacieProps {
  structure: MyStructure;
  peutModifier: boolean;
  peutGererEquipe: boolean;
  peutVoirEquipe: boolean;
  onStructureModifiee: (maj: Partial<MyStructure>) => void;
  logo: { occupe: boolean; erreur: string; onEnvoye: (f: StoredFileView) => void; onSupprimer: () => void };
}

type DefinirEtat = (etat: EtatBloc) => void;
type Enregistrer = (resultat: ResultatCorps, definirEtat: DefinirEtat) => Promise<void>;

/** Après un succès ou une erreur, une nouvelle saisie remet le message à zéro. */
const etatApresSaisie = (etat: EtatBloc): EtatBloc =>
  etat.statut === "succes" || etat.statut === "erreur" ? { statut: "repos" } : etat;

/** Compare deux textes de latitude ou de longitude : par valeur si ce sont des nombres, sinon tels quels. */
const memeNombre = (saisie: string, enregistre: number | null | undefined): boolean => {
  const texte = saisie.trim();
  if (enregistre == null) return texte === "";
  return texte !== "" && Number.isFinite(Number(texte)) && Number(texte) === enregistre;
};

export function MaPharmacie({
  structure,
  peutModifier,
  peutGererEquipe,
  peutVoirEquipe,
  onStructureModifiee,
  logo,
}: MaPharmacieProps) {
  // Envoi d'un corps partiel, puis fusion de la réponse dans la page
  const enregistrer: Enregistrer = async (resultat, definirEtat) => {
    if (!resultat.ok) {
      definirEtat({ statut: "erreur", message: resultat.message });
      return;
    }
    definirEtat({ statut: "enregistrement" });
    try {
      const reponse = await updateMyStructure(resultat.corps);
      onStructureModifiee(reponse.data);
      definirEtat({ statut: "succes" });
    } catch (err) {
      definirEtat({ statut: "erreur", message: messageErreurEnregistrement(err) });
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">
      <EnTete structure={structure} peutModifier={peutModifier} logo={logo} />
      <BandeauOuverture structure={structure} peutModifier={peutModifier} enregistrer={enregistrer} />
      {!peutModifier && (
        <p role="note" className={TEXTE_AIDE}>
          Pour modifier ces informations, contactez l&apos;administrateur de votre pharmacie.
        </p>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BlocInformations structure={structure} peutModifier={peutModifier} enregistrer={enregistrer} />
        <BlocHoraires structure={structure} peutModifier={peutModifier} enregistrer={enregistrer} />
        <BlocPosition structure={structure} peutModifier={peutModifier} enregistrer={enregistrer} />
      </div>
      <Equipe structure={structure} peutGererEquipe={peutGererEquipe} peutVoirEquipe={peutVoirEquipe} />
    </div>
  );
}

// ─── En-tête ────────────────────────────────────────────────────

function EnTete({
  structure,
  peutModifier,
  logo,
}: Pick<MaPharmacieProps, "structure" | "peutModifier" | "logo">) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-slate-100 dark:bg-gradient-to-br dark:from-[#0f172a] dark:to-[#1e1b4b] border border-slate-200 dark:border-slate-800/50 p-6 sm:p-8">
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/8 rounded-full blur-3xl pointer-events-none" />
      <div className="relative flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center shadow-lg flex-shrink-0 overflow-hidden">
            <ImageWithFallback
              src={structure.logoUrl}
              alt={`Logo de ${structure.nom}`}
              className="w-full h-full object-cover"
              fallback={<Building2 className="w-7 h-7 text-slate-900 dark:text-white" />}
            />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/10 text-slate-600 dark:text-slate-300">Pharmacie</span>
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full ${structure.isActive ? "bg-secondary-500/10 text-secondary-600 dark:text-secondary-400" : "bg-slate-200 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400"}`}
              >
                {structure.isActive ? "Active" : "Inactive"}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white" style={POLICE_TITRE}>
              {structure.nom}
            </h1>
            {(structure.ville || structure.adresse) && (
              <div className="flex items-center gap-1.5 mt-1 text-sm text-slate-500 dark:text-slate-400">
                <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                {[structure.ville, structure.adresse].filter(Boolean).join(" · ")}
              </div>
            )}
          </div>
        </div>
        {peutModifier && (
          <div className="flex flex-col items-start sm:items-end gap-1">
            <FileUpload
              visibility="public"
              prefix="logos"
              accept="image/jpeg,image/png,image/webp"
              maxSizeMb={5}
              label={structure.logoUrl ? "Changer le logo" : "Ajouter un logo"}
              onUploaded={logo.onEnvoye}
              disabled={logo.occupe}
            />
            {structure.logoUrl && (
              <button
                type="button"
                onClick={logo.onSupprimer}
                disabled={logo.occupe}
                className={`text-xs text-red-500 hover:underline disabled:opacity-50 ${FOCUS}`}
              >
                Supprimer le logo
              </button>
            )}
            {logo.occupe && <span className="text-xs text-slate-400">Mise à jour…</span>}
            {logo.erreur && (
              <span role="alert" className="text-xs text-red-500">
                {logo.erreur}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Ouverture et garde ─────────────────────────────────────────

const OPTIONS_OUVERTURE: { valeur: boolean | null; libelle: string }[] = [
  { valeur: null, libelle: "Selon les horaires" },
  { valeur: true, libelle: "Ouverte maintenant" },
  { valeur: false, libelle: "Fermée maintenant" },
];

const AIDE_OUVERTURE = (valeur: boolean | null): string =>
  valeur === null
    ? "La pharmacie s'ouvre et se ferme selon vos horaires."
    : valeur
      ? "Affichée ouverte jusqu'à ce que vous reveniez aux horaires."
      : "Affichée fermée jusqu'à ce que vous reveniez aux horaires.";

const AIDE_GARDE = "La pharmacie apparaît ouverte aux patients, même en dehors des horaires.";

function MessageEtat({ etat }: { etat: EtatBloc }) {
  if (etat.statut === "enregistrement") {
    return (
      <p className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
        Enregistrement…
      </p>
    );
  }
  if (etat.statut === "succes") {
    return (
      <p role="status" className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
        <CheckCircle2 className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
        Enregistré.
      </p>
    );
  }
  if (etat.statut === "erreur") {
    return (
      <p role="alert" className="flex items-start gap-2 text-sm font-medium text-emergency-600 dark:text-emergency-400">
        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
        {etat.message}
      </p>
    );
  }
  return null;
}

function BandeauOuverture({
  structure,
  peutModifier,
  enregistrer,
}: {
  structure: MyStructure;
  peutModifier: boolean;
  enregistrer: Enregistrer;
}) {
  const idTitre = useId();
  const idGarde = useId();
  const idAideGarde = useId();
  const nomGroupe = useId();
  const [etatGarde, setEtatGarde] = useState<EtatBloc>({ statut: "repos" });
  const [etatOuverture, setEtatOuverture] = useState<EtatBloc>({ statut: "repos" });

  const estDeGarde = structure.estDeGarde ?? false;
  const ouverture = structure.estOuvertManuel ?? null;
  const libelleOuverture = OPTIONS_OUVERTURE.find((o) => o.valeur === ouverture)?.libelle ?? "Selon les horaires";

  return (
    <section aria-labelledby={idTitre} className={CARTE}>
      <h2 id={idTitre} className={TITRE_H2} style={POLICE_TITRE}>
        Ouverture et garde
      </h2>
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
        {peutModifier ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-4">
              <span id={idGarde} className="text-sm font-medium text-slate-900 dark:text-white">
                De garde
              </span>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-600 dark:text-slate-300">{estDeGarde ? "Oui" : "Non"}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={estDeGarde}
                  aria-labelledby={idGarde}
                  aria-describedby={idAideGarde}
                  disabled={etatGarde.statut === "enregistrement"}
                  onClick={() => enregistrer({ ok: true, corps: { estDeGarde: !estDeGarde } }, setEtatGarde)}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors disabled:opacity-60 ${FOCUS} ${estDeGarde ? "bg-primary-600" : "bg-slate-300 dark:bg-slate-700"}`}
                >
                  <span
                    aria-hidden="true"
                    className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${estDeGarde ? "translate-x-6" : "translate-x-1"}`}
                  />
                </button>
              </div>
            </div>
            <p id={idAideGarde} className={TEXTE_AIDE}>
              {AIDE_GARDE}
            </p>
            <MessageEtat etat={etatGarde} />
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-sm font-medium text-slate-900 dark:text-white">De garde : {estDeGarde ? "Oui" : "Non"}</p>
            <p className={TEXTE_AIDE}>{AIDE_GARDE}</p>
          </div>
        )}

        {peutModifier ? (
          <fieldset disabled={etatOuverture.statut === "enregistrement"} className="space-y-2 min-w-0">
            <legend className="mb-2 text-sm font-medium text-slate-900 dark:text-white">Ouverture</legend>
            <div className="flex flex-wrap gap-2">
              {OPTIONS_OUVERTURE.map((option) => (
                <label key={option.libelle} className="cursor-pointer">
                  <input
                    type="radio"
                    name={nomGroupe}
                    className="peer sr-only"
                    checked={ouverture === option.valeur}
                    onChange={() => enregistrer({ ok: true, corps: { estOuvertManuel: option.valeur } }, setEtatOuverture)}
                  />
                  <span className="inline-block px-4 py-2.5 rounded-2xl text-sm font-medium border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors peer-checked:bg-primary-600 peer-checked:border-primary-600 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-primary-500 peer-disabled:opacity-60">
                    {option.libelle}
                  </span>
                </label>
              ))}
            </div>
            <p className={TEXTE_AIDE}>{AIDE_OUVERTURE(ouverture)}</p>
            <MessageEtat etat={etatOuverture} />
          </fieldset>
        ) : (
          <div className="space-y-1">
            <p className="text-sm font-medium text-slate-900 dark:text-white">Ouverture : {libelleOuverture}</p>
            <p className={TEXTE_AIDE}>{AIDE_OUVERTURE(ouverture)}</p>
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Informations et contact ────────────────────────────────────

function BlocInformations({
  structure,
  peutModifier,
  enregistrer,
}: {
  structure: MyStructure;
  peutModifier: boolean;
  enregistrer: Enregistrer;
}) {
  const id = useId();
  const [saisie, setSaisie] = useState({
    nom: structure.nom ?? "",
    telephone: structure.telephone ?? "",
    ville: structure.ville ?? "",
    adresse: structure.adresse ?? "",
    description: structure.description ?? "",
  });
  const [etat, setEtat] = useState<EtatBloc>({ statut: "repos" });

  const modifie =
    saisie.nom.trim() !== (structure.nom ?? "") ||
    saisie.telephone.trim() !== (structure.telephone ?? "") ||
    saisie.ville.trim() !== (structure.ville ?? "") ||
    saisie.adresse.trim() !== (structure.adresse ?? "") ||
    saisie.description.trim() !== (structure.description ?? "");

  const changer = (champ: keyof typeof saisie, valeur: string) => {
    setSaisie((prev) => ({ ...prev, [champ]: valeur }));
    setEtat(etatApresSaisie);
  };

  const champ = (cle: keyof typeof saisie, libelle: string, extra: { type?: string; autoComplete?: string } = {}) => (
    <div>
      <label htmlFor={`${id}-${cle}`} className={LABEL}>
        {libelle}
      </label>
      <input
        id={`${id}-${cle}`}
        type={extra.type ?? "text"}
        autoComplete={extra.autoComplete}
        value={saisie[cle]}
        onChange={(e) => changer(cle, e.target.value)}
        className={CHAMP}
      />
    </div>
  );

  return (
    <BlocModifiable
      titre="Informations et contact"
      description="Ces informations sont visibles par les patients qui cherchent une pharmacie."
      modifiable={peutModifier}
      etat={etat}
      modifie={modifie}
      onEnregistrer={() => enregistrer(corpsInformations(saisie, structure), setEtat)}
    >
      {peutModifier ? (
        <div className="space-y-4">
          {champ("nom", "Nom de la pharmacie")}
          {champ("telephone", "Téléphone", { type: "tel", autoComplete: "tel" })}
          {champ("ville", "Ville")}
          {champ("adresse", "Adresse")}
          <div>
            <label htmlFor={`${id}-description`} className={LABEL}>
              Description
            </label>
            <textarea
              id={`${id}-description`}
              rows={3}
              value={saisie.description}
              onChange={(e) => changer("description", e.target.value)}
              className={`${CHAMP} resize-y`}
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{saisie.description.length} / 500</p>
          </div>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="font-medium text-slate-700 dark:text-slate-300">Email</dt>
              <dd className="text-slate-900 dark:text-white break-all">{structure.email || NON_RENSEIGNE}</dd>
              <dd className="text-xs text-slate-500 dark:text-slate-400">
                L&apos;email sert à la connexion de l&apos;administrateur, il ne se modifie pas ici.
              </dd>
            </div>
            <div>
              <dt className="font-medium text-slate-700 dark:text-slate-300">Type</dt>
              <dd className="text-slate-900 dark:text-white">Pharmacie</dd>
            </div>
          </dl>
        </div>
      ) : (
        <dl className="space-y-3 text-sm">
          {[
            ["Nom", structure.nom],
            ["Téléphone", structure.telephone],
            ["Ville", structure.ville],
            ["Adresse", structure.adresse],
            ["Description", structure.description],
            ["Email", structure.email],
          ].map(([libelle, valeur]) => (
            <div key={libelle}>
              <dt className="font-medium text-slate-700 dark:text-slate-300">{libelle}</dt>
              <dd className="text-slate-900 dark:text-white break-words">{valeur || NON_RENSEIGNE}</dd>
            </div>
          ))}
        </dl>
      )}
    </BlocModifiable>
  );
}

// ─── Horaires d'ouverture ───────────────────────────────────────

const lirePlages = (horaires: string | null | undefined): Record<JourSemaine, PlageHoraire> => {
  const lus = lireHoraires(horaires);
  return Object.fromEntries(JOURS_SEMAINE.map((jour) => [jour, lirePlage(lus[jour])])) as Record<JourSemaine, PlageHoraire>;
};

const afficherPlage = (valeur: string): string => {
  const plage = lirePlage(valeur);
  if (plage.ferme) return "Fermé";
  return plage.ouverture && plage.fermeture ? `${plage.ouverture} à ${plage.fermeture}` : valeur;
};

function BlocHoraires({
  structure,
  peutModifier,
  enregistrer,
}: {
  structure: MyStructure;
  peutModifier: boolean;
  enregistrer: Enregistrer;
}) {
  const id = useId();
  const [plages, setPlages] = useState(() => lirePlages(structure.horaires));
  const [etat, setEtat] = useState<EtatBloc>({ statut: "repos" });

  const enregistres = lirePlages(structure.horaires);
  const modifie = JOURS_SEMAINE.some((jour) => ecrirePlage(plages[jour]) !== ecrirePlage(enregistres[jour]));

  const changer = (jour: JourSemaine, maj: Partial<PlageHoraire>) => {
    setPlages((prev) => ({ ...prev, [jour]: { ...prev[jour], ...maj } }));
    setEtat(etatApresSaisie);
  };

  return (
    <BlocModifiable
      titre="Horaires d'ouverture"
      description="Les patients voient la pharmacie ouverte ou fermée selon ces horaires, sauf si vous choisissez autre chose dans Ouverture."
      modifiable={peutModifier}
      etat={etat}
      modifie={modifie}
      onEnregistrer={() => enregistrer(corpsHoraires(plages), setEtat)}
    >
      {peutModifier ? (
        <div className="space-y-4">
          <ul className="space-y-3">
            {JOURS_SEMAINE.map((jour) => {
              const nomJour = jour.toLowerCase();
              const plage = plages[jour];
              return (
                <li key={jour} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                  <span className="sm:w-24 text-sm font-medium text-slate-900 dark:text-white">{jour}</span>
                  <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      aria-label={`Fermé le ${nomJour}`}
                      checked={plage.ferme}
                      onChange={(e) => changer(jour, { ferme: e.target.checked })}
                      className={`h-4 w-4 rounded border-slate-300 dark:border-slate-700 ${FOCUS}`}
                    />
                    Fermé
                  </label>
                  <div className="flex items-center gap-2">
                    <label htmlFor={`${id}-${jour}-o`} className="text-xs text-slate-500 dark:text-slate-400">
                      Ouverture
                    </label>
                    <input
                      id={`${id}-${jour}-o`}
                      type="time"
                      aria-label={`Heure d'ouverture le ${nomJour}`}
                      value={plage.ouverture}
                      disabled={plage.ferme}
                      onChange={(e) => changer(jour, { ouverture: e.target.value })}
                      className={`${CHAMP} sm:w-32 disabled:opacity-50`}
                    />
                    <label htmlFor={`${id}-${jour}-f`} className="text-xs text-slate-500 dark:text-slate-400">
                      Fermeture
                    </label>
                    <input
                      id={`${id}-${jour}-f`}
                      type="time"
                      aria-label={`Heure de fermeture le ${nomJour}`}
                      value={plage.fermeture}
                      disabled={plage.ferme}
                      onChange={(e) => changer(jour, { fermeture: e.target.value })}
                      className={`${CHAMP} sm:w-32 disabled:opacity-50`}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
          <p className={TEXTE_AIDE}>Pour une ouverture jour et nuit, utilisez plutôt « De garde ».</p>
        </div>
      ) : (
        <table className="w-full text-sm">
          <tbody>
            {JOURS_SEMAINE.map((jour) => (
              <tr key={jour} className="border-b border-slate-100 dark:border-slate-800/50 last:border-0">
                <th scope="row" className="py-2 text-left font-medium text-slate-700 dark:text-slate-300">
                  {jour}
                </th>
                <td className="py-2 text-right text-slate-900 dark:text-white">
                  {afficherPlage(lireHoraires(structure.horaires)[jour])}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </BlocModifiable>
  );
}

// ─── Position sur la carte ──────────────────────────────────────

const nombreValide = (texte: string): number | undefined => {
  const t = texte.trim();
  return t !== "" && Number.isFinite(Number(t)) ? Number(t) : undefined;
};

function BlocPosition({
  structure,
  peutModifier,
  enregistrer,
}: {
  structure: MyStructure;
  peutModifier: boolean;
  enregistrer: Enregistrer;
}) {
  const id = useId();
  const [saisie, setSaisie] = useState({
    latitude: structure.latitude != null ? String(structure.latitude) : "",
    longitude: structure.longitude != null ? String(structure.longitude) : "",
  });
  const [etat, setEtat] = useState<EtatBloc>({ statut: "repos" });
  const [carteOuverte, setCarteOuverte] = useState(false);

  const modifie = !memeNombre(saisie.latitude, structure.latitude) || !memeNombre(saisie.longitude, structure.longitude);

  const changer = (maj: Partial<typeof saisie>) => {
    setSaisie((prev) => ({ ...prev, ...maj }));
    setEtat(etatApresSaisie);
  };

  const positionConnue = structure.latitude != null && structure.longitude != null;

  return (
    <BlocModifiable
      titre="Position sur la carte"
      description="Elle permet aux patients de trouver la pharmacie sur la carte."
      modifiable={peutModifier}
      etat={etat}
      modifie={modifie}
      onEnregistrer={() => enregistrer(corpsPosition(saisie), setEtat)}
    >
      {peutModifier ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor={`${id}-lat`} className={LABEL}>
                Latitude
              </label>
              <input
                id={`${id}-lat`}
                type="number"
                step="any"
                inputMode="decimal"
                value={saisie.latitude}
                onChange={(e) => changer({ latitude: e.target.value })}
                className={CHAMP}
              />
            </div>
            <div>
              <label htmlFor={`${id}-lng`} className={LABEL}>
                Longitude
              </label>
              <input
                id={`${id}-lng`}
                type="number"
                step="any"
                inputMode="decimal"
                value={saisie.longitude}
                onChange={(e) => changer({ longitude: e.target.value })}
                className={CHAMP}
              />
            </div>
          </div>
          <button type="button" onClick={() => setCarteOuverte(true)} className={BOUTON_SECONDAIRE}>
            <Navigation className="w-4 h-4" aria-hidden="true" />
            Choisir sur la carte
          </button>
          <MapModal
            isOpen={carteOuverte}
            onClose={() => setCarteOuverte(false)}
            mode="picker"
            initialLat={nombreValide(saisie.latitude)}
            initialLng={nombreValide(saisie.longitude)}
            onLocationSelect={(lat, lng) => changer({ latitude: lat.toFixed(6), longitude: lng.toFixed(6) })}
          />
        </div>
      ) : positionConnue ? (
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="font-medium text-slate-700 dark:text-slate-300">Latitude</dt>
            <dd className="text-slate-900 dark:text-white">{Number(structure.latitude).toFixed(6)}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-700 dark:text-slate-300">Longitude</dt>
            <dd className="text-slate-900 dark:text-white">{Number(structure.longitude).toFixed(6)}</dd>
          </div>
        </dl>
      ) : (
        <p className="text-sm text-slate-500 dark:text-slate-400">Position non renseignée.</p>
      )}
    </BlocModifiable>
  );
}

// ─── Équipe ─────────────────────────────────────────────────────

function Equipe({
  structure,
  peutGererEquipe,
  peutVoirEquipe,
}: Pick<MaPharmacieProps, "structure" | "peutGererEquipe" | "peutVoirEquipe">) {
  const idTitre = useId();
  const pharmaciens = structure.membres.filter((m) => m.role === "PHARMACIEN");
  const actifs = structure.membres.filter((m) => m.isActive);

  const lien = peutVoirEquipe && (
    <Link
      href="/dashboard/membres"
      className={`group flex items-center gap-3 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-primary-500/30 transition-all ${FOCUS}`}
    >
      <Users className="w-5 h-5 text-primary-500" aria-hidden="true" />
      <div>
        <p className="text-sm font-medium text-slate-900 dark:text-white">
          {peutGererEquipe ? "Gérer l'équipe" : "Voir l'équipe"}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {peutGererEquipe ? "Ajouter ou désactiver des pharmaciens" : "Consulter la liste des membres"}
        </p>
      </div>
    </Link>
  );

  return (
    <section aria-labelledby={idTitre} className="space-y-4">
      <h2 id={idTitre} className={TITRE_H2} style={POLICE_TITRE}>
        Équipe
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Membres de l'équipe" value={structure.membres.length} icon={<Users className="w-5 h-5" />} iconColor="text-primary-400" iconBg="bg-primary-500/10" accentColor="#3b82f6" gradient />
        <StatCard label="Pharmaciens" value={pharmaciens.length} icon={<Pill className="w-5 h-5" />} iconColor="text-emerald-400" iconBg="bg-emerald-500/10" accentColor="#10b981" gradient />
        <StatCard label="Membres actifs" value={actifs.length} icon={<Activity className="w-5 h-5" />} iconColor="text-secondary-400" iconBg="bg-secondary-500/10" accentColor="#10b981" gradient />
      </div>
      <div className={CARTE}>
        {structure.membres.length === 0 && <p className={`mb-4 ${TEXTE_AIDE}`}>Aucun membre pour l&apos;instant.</p>}
        {lien}
        {structure.admin && (
          <div className={peutVoirEquipe ? "mt-6 pt-4 border-t border-slate-200 dark:border-slate-800/50" : ""}>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Administrateur</p>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  {structure.admin.prenom[0]}
                  {structure.admin.nom[0]}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  {structure.admin.prenom} {structure.admin.nom}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400">{structure.admin.email}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
