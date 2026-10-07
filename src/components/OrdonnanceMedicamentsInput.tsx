"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import type { LigneMedicament } from "@/lib/api_carnet";
import { getCatalogue, type Medicament } from "@/lib/api_pharmacie";

const MIN_CARACTERES = 2;
const DELAI_MS = 300;
const MAX_SUGGESTIONS = 8;

const LIGNE_VIDE: LigneMedicament = { nom: "", dosage: "", duree: "", instructions: "" };

const CLASSE_CHAMP =
  "w-full p-3 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-primary-500";

type EtatSuggestions = "inactif" | "chargement" | "ok" | "vide" | "erreur";

interface NomMedicamentProps {
  ligne: LigneMedicament;
  onChange: (ligne: LigneMedicament) => void;
}

function NomMedicamentCombobox({ ligne, onChange }: NomMedicamentProps) {
  const baseId = useId();
  const listeId = `${baseId}-liste`;
  const aideId = `${baseId}-aide`;
  const conteneurRef = useRef<HTMLDivElement>(null);
  const minuteurRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dernierAppelRef = useRef(0);

  const [suggestions, setSuggestions] = useState<Medicament[]>([]);
  const [etat, setEtat] = useState<EtatSuggestions>("inactif");
  const [ouvert, setOuvert] = useState(false);
  const [actif, setActif] = useState(-1);

  // Fermeture au clic extérieur et nettoyage du minuteur au démontage
  useEffect(() => {
    const surClic = (e: MouseEvent) => {
      if (conteneurRef.current && !conteneurRef.current.contains(e.target as Node)) {
        setOuvert(false);
      }
    };
    document.addEventListener("mousedown", surClic);
    return () => {
      document.removeEventListener("mousedown", surClic);
      if (minuteurRef.current) clearTimeout(minuteurRef.current);
    };
  }, []);

  const rechercher = (texte: string) => {
    if (minuteurRef.current) clearTimeout(minuteurRef.current);
    const appel = ++dernierAppelRef.current; // toute réponse plus ancienne sera ignorée
    const terme = texte.trim();
    if (terme.length < MIN_CARACTERES) {
      setSuggestions([]);
      setEtat("inactif");
      setOuvert(false);
      return;
    }
    setEtat("chargement");
    minuteurRef.current = setTimeout(async () => {
      try {
        const res = await getCatalogue(terme);
        if (appel !== dernierAppelRef.current) return;
        const liste = (res.data ?? []).slice(0, MAX_SUGGESTIONS);
        setSuggestions(liste);
        setEtat(liste.length > 0 ? "ok" : "vide");
        setActif(-1);
        setOuvert(true);
      } catch {
        if (appel !== dernierAppelRef.current) return;
        setSuggestions([]);
        setEtat("erreur");
        setOuvert(true);
      }
    }, DELAI_MS);
  };

  const surSaisie = (texte: string) => {
    // Une modification manuelle repasse la ligne en saisie libre
    const suivante: LigneMedicament = { ...ligne, nom: texte };
    delete suivante.medicamentId;
    onChange(suivante);
    rechercher(texte);
  };

  const choisir = (m: Medicament) => {
    dernierAppelRef.current++;
    if (minuteurRef.current) clearTimeout(minuteurRef.current);
    onChange({ ...ligne, nom: m.nom, medicamentId: m.id });
    setOuvert(false);
    setActif(-1);
    setEtat("inactif");
  };

  const surTouche = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape" && ouvert) {
      e.preventDefault();
      e.stopPropagation();
      setOuvert(false);
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (suggestions.length === 0) return;
      e.preventDefault();
      setOuvert(true);
      const n = suggestions.length;
      setActif(a => (e.key === "ArrowDown" ? (a + 1) % n : (a - 1 + n) % n));
      return;
    }
    if (e.key === "Enter" && ouvert && actif >= 0 && suggestions[actif]) {
      e.preventDefault();
      choisir(suggestions[actif]);
    }
  };

  const listeVisible = ouvert && (etat === "ok" || etat === "vide" || etat === "erreur");

  return (
    <div ref={conteneurRef} className="relative">
      <input
        required
        role="combobox"
        aria-expanded={listeVisible && suggestions.length > 0}
        aria-controls={listeId}
        aria-autocomplete="list"
        aria-describedby={aideId}
        aria-activedescendant={listeVisible && actif >= 0 ? `${baseId}-option-${actif}` : undefined}
        aria-label="Nom du médicament"
        autoComplete="off"
        className={CLASSE_CHAMP}
        placeholder="Nom du médicament"
        value={ligne.nom}
        onChange={e => surSaisie(e.target.value)}
        onKeyDown={surTouche}
        onFocus={() => { if (suggestions.length > 0 || etat === "vide" || etat === "erreur") setOuvert(true); }}
      />
      <p id={aideId} className="mt-1 ml-1 text-[11px] text-slate-500 dark:text-slate-400">
        {ligne.medicamentId ? (
          <span className="text-emerald-700 dark:text-emerald-400 font-bold">Du catalogue</span>
        ) : (
          "Saisie libre"
        )}
      </p>
      {listeVisible && (
        <div className="absolute z-20 left-0 right-0 mt-1 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
          {suggestions.length > 0 ? (
            <ul id={listeId} role="listbox" aria-label="Médicaments du catalogue" className="max-h-64 overflow-y-auto py-1">
              {suggestions.map((m, i) => (
                <li
                  key={m.id}
                  id={`${baseId}-option-${i}`}
                  role="option"
                  aria-selected={i === actif}
                  // mousedown pour choisir avant que le champ ne perde le focus
                  onMouseDown={e => { e.preventDefault(); choisir(m); }}
                  onMouseEnter={() => setActif(i)}
                  className={`px-3 py-2 cursor-pointer text-sm text-slate-900 dark:text-slate-100 ${i === actif ? "bg-slate-100 dark:bg-slate-800" : ""}`}
                >
                  <span className="font-bold">{m.nom}</span>
                  {(m.nomGenerique || m.categorie) && (
                    <span className="block text-xs text-slate-600 dark:text-slate-400">
                      {[m.nomGenerique, m.categorie].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p id={listeId} role="status" className="px-3 py-2 text-xs text-slate-600 dark:text-slate-400">
              {etat === "erreur"
                ? "Suggestions indisponibles, saisissez le nom librement."
                : "Aucun médicament trouvé dans le catalogue, vous pouvez saisir le nom librement."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

interface Props {
  value: LigneMedicament[];
  onChange: (lignes: LigneMedicament[]) => void;
}

export default function OrdonnanceMedicamentsInput({ value, onChange }: Props) {
  const modifier = (index: number, ligne: LigneMedicament) =>
    onChange(value.map((l, i) => (i === index ? ligne : l)));

  return (
    <div className="space-y-4">
      <label className="block text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Médicaments</label>
      {value.map((m, i) => (
        <div key={i} className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3 relative">
          {value.length > 1 && (
            <button
              type="button"
              aria-label={`Retirer le médicament ${i + 1}`}
              onClick={() => onChange(value.filter((_, idx) => idx !== i))}
              className="absolute top-2 right-2 p-1 text-slate-500 hover:text-rose-500 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <NomMedicamentCombobox ligne={m} onChange={l => modifier(i, l)} />
            <input
              required
              aria-label="Dosage"
              className={`${CLASSE_CHAMP} self-start`}
              placeholder="Dosage (ex: 1 mat, 1 soir)"
              value={m.dosage}
              onChange={e => modifier(i, { ...m, dosage: e.target.value })}
            />
            <input
              required
              aria-label="Durée"
              className={CLASSE_CHAMP}
              placeholder="Durée (ex: 5 jours)"
              value={m.duree}
              onChange={e => modifier(i, { ...m, duree: e.target.value })}
            />
            <input
              aria-label="Instructions"
              className={CLASSE_CHAMP}
              placeholder="Instructions (ex: avant repas)"
              value={m.instructions ?? ""}
              onChange={e => modifier(i, { ...m, instructions: e.target.value })}
            />
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...value, { ...LIGNE_VIDE }])}
        className="w-full py-3 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-slate-500 hover:text-primary-600 hover:border-primary-500 transition-all flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest"
      >
        <Plus className="w-4 h-4" /> Ajouter un médicament
      </button>
    </div>
  );
}
