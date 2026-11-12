"use client";

// Page de test du design : montre chaque élément de src/theme/ui.ts avec ses valeurs.
// Couverte par src/app/debug/layout.tsx (404 en production).

import { useSyncExternalStore, type ReactNode } from "react";
import { useTheme } from "next-themes";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  LayoutDashboard,
  Moon,
  Package,
  Pill,
  Settings,
  ShoppingCart,
  Sun,
  Trash2,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { ui } from "@/theme/ui";

function Section({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className={ui.texte.section}>{titre}</h2>
      {children}
    </section>
  );
}

function Etiquette({ nom, valeur }: { nom: string; valeur: string }) {
  return (
    <p className={ui.texte.legende}>
      <span className="font-medium text-slate-700 dark:text-slate-300">{nom}</span> : {valeur}
    </p>
  );
}

const echelle = [
  { nom: "legende", px: "12px / 16px", classe: ui.texte.legende },
  { nom: "petit", px: "13px / 18px", classe: ui.texte.petit },
  { nom: "normal", px: "14px / 20px", classe: ui.texte.normal },
  { nom: "section", px: "16px / 24px", classe: ui.texte.section },
  { nom: "page", px: "22px / 28px", classe: ui.texte.page },
  { nom: "chiffre", px: "24px / 32px", classe: ui.texte.chiffre },
];

const couleurs = [
  { nom: "primary-600", classe: "bg-primary-600" },
  { nom: "secondary-600", classe: "bg-secondary-600" },
  { nom: "accent-600", classe: "bg-accent-600" },
  { nom: "emergency-600", classe: "bg-emergency-600" },
  { nom: "fond (background)", classe: "bg-background border border-slate-300 dark:border-slate-600" },
  { nom: "surface", classe: "bg-[var(--surface)] border border-slate-300 dark:border-slate-600" },
  { nom: "bordure (border)", classe: "bg-[var(--border)] border border-slate-300 dark:border-slate-600" },
];

const produits = [
  { nom: "Paracétamol 500 mg", dci: "Paracétamol", qte: "120 boîtes", prix: 15000 },
  { nom: "Amoxicilline 1 g", dci: "Amoxicilline", qte: "45 boîtes", prix: 32500 },
  { nom: "Coartem 20/120", dci: "Artéméther, luméfantrine", qte: "8 boîtes", prix: 48000 },
  { nom: "Ibuprofène 400 mg", dci: "Ibuprofène", qte: "0 boîte", prix: 21000 },
  { nom: "Sérum oral ORS", dci: "Sels de réhydratation orale", qte: "260 sachets", prix: 3500 },
];

export default function DesignPage() {
  const { resolvedTheme, setTheme } = useTheme();
  const monte = useSyncExternalStore(() => () => {}, () => true, () => false);
  const sombre = monte && resolvedTheme === "dark";

  const liens = [
    { nom: "Tableau de bord", Icone: LayoutDashboard, actif: true },
    { nom: "Stock", Icone: Package, actif: false },
    { nom: "Ventes", Icone: ShoppingCart, actif: false },
    { nom: "Paramètres", Icone: Settings, actif: false },
  ];

  return (
    <main className="mx-auto max-w-mc-contenu space-y-8 p-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className={ui.titrePage}>Design MedConnecte</h1>
          <p className={ui.texte.petit}>Page de test : tous les éléments de src/theme/ui.ts.</p>
        </div>
        <button
          type="button"
          className={ui.bouton.secondaire}
          onClick={() => setTheme(sombre ? "light" : "dark")}
        >
          {sombre ? <Sun size={16} /> : <Moon size={16} />}
          {sombre ? "Mode clair" : "Mode sombre"}
        </button>
      </header>

      <Section titre="Échelle de texte">
        <div className={`${ui.carte} space-y-2`}>
          {echelle.map((e) => (
            <div key={e.nom} className="flex items-baseline gap-4">
              <span className={`${e.classe} w-48 shrink-0`}>Carnet de santé 1 234</span>
              <Etiquette nom={`text-mc-${e.nom}`} valeur={e.px} />
            </div>
          ))}
        </div>
      </Section>

      <Section titre="Rayons et ombre">
        <div className="flex flex-wrap gap-4">
          {[
            ["rounded-mc-petit", "6px", "rounded-mc-petit"],
            ["rounded-mc-moyen", "8px", "rounded-mc-moyen"],
            ["rounded-mc-grand", "12px", "rounded-mc-grand"],
          ].map(([nom, px, cl]) => (
            <div key={nom} className="space-y-1">
              <div className={`h-16 w-24 border border-slate-300 bg-slate-100 dark:border-slate-600 dark:bg-slate-800 ${cl}`} />
              <Etiquette nom={nom} valeur={px} />
            </div>
          ))}
          <div className="space-y-1">
            <div className="h-16 w-24 rounded-mc-moyen border border-slate-200 bg-white shadow-mc dark:border-slate-700 dark:bg-slate-900" />
            <Etiquette nom="shadow-mc" valeur="0 1px 2px + 0 1px 3px, opacité 6 %" />
          </div>
        </div>
      </Section>

      <Section titre="Couleurs">
        <div className="flex flex-wrap gap-4">
          {couleurs.map((c) => (
            <div key={c.nom} className="space-y-1">
              <div className={`h-12 w-24 rounded-mc-moyen ${c.classe}`} />
              <Etiquette nom={c.nom} valeur="" />
            </div>
          ))}
        </div>
      </Section>

      <Section titre="Boutons">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <button type="button" className={ui.bouton.primaire}>Primaire</button>
            <Etiquette nom="bouton.primaire" valeur="40px" />
          </div>
          <div className="space-y-1">
            <button type="button" className={ui.bouton.secondaire}>Secondaire</button>
            <Etiquette nom="bouton.secondaire" valeur="40px" />
          </div>
          <div className="space-y-1">
            <button type="button" className={ui.bouton.danger}>Supprimer</button>
            <Etiquette nom="bouton.danger" valeur="40px" />
          </div>
          <div className="space-y-1">
            <button type="button" aria-label="Supprimer" className={ui.bouton.icone}><Trash2 size={18} /></button>
            <Etiquette nom="bouton.icone" valeur="40 x 40px" />
          </div>
          <div className="space-y-1">
            <button type="button" className={ui.bouton.petit}>Petit</button>
            <Etiquette nom="bouton.petit" valeur="32px" />
          </div>
          <div className="space-y-1">
            <button type="button" disabled className={ui.bouton.primaire}>Désactivé</button>
            <Etiquette nom="disabled" valeur="opacité 50 %" />
          </div>
        </div>
      </Section>

      <Section titre="Champs">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className={ui.label} htmlFor="d-nom">Nom du produit</label>
            <input id="d-nom" className={ui.champ} placeholder="Ex. Paracétamol" />
            <Etiquette nom="champ" valeur="40px, text 14px" />
          </div>
          <div>
            <label className={ui.label} htmlFor="d-sel">Catégorie</label>
            <select id="d-sel" className={ui.select}>
              <option>Antalgique</option>
              <option>Antibiotique</option>
            </select>
            <Etiquette nom="select" valeur="40px" />
          </div>
          <div>
            <label className={ui.label} htmlFor="d-err">Quantité</label>
            <input
              id="d-err"
              aria-invalid="true"
              className={`${ui.champ} border-emergency-500 dark:border-emergency-500`}
              defaultValue="-3"
            />
            <p className="mt-1 text-mc-legende text-emergency-600">La quantité doit être positive.</p>
            <Etiquette nom="état erreur" valeur="bordure emergency-500" />
          </div>
        </div>
      </Section>

      <Section titre="Badges">
        <div className="flex flex-wrap gap-3">
          <span className={ui.badge.neutre}>Neutre</span>
          <span className={ui.badge.succes}>En stock</span>
          <span className={ui.badge.attention}>Stock bas</span>
          <span className={ui.badge.danger}>Rupture</span>
          <span className={ui.badge.info}>Nouveau</span>
          <Etiquette nom="badge.*" valeur="12px, rayon 6px" />
        </div>
      </Section>

      <Section titre="Alertes">
        <div className="grid gap-3 md:grid-cols-2">
          <div className={ui.alerte.erreur}><XCircle size={16} className="mt-0.5 shrink-0" />Impossible d&apos;enregistrer la vente.</div>
          <div className={ui.alerte.attention}><AlertTriangle size={16} className="mt-0.5 shrink-0" />Trois produits arrivent à péremption.</div>
          <div className={ui.alerte.info}><Info size={16} className="mt-0.5 shrink-0" />Le stock est synchronisé.</div>
          <div className={ui.alerte.succes}><CheckCircle2 size={16} className="mt-0.5 shrink-0" />Réception enregistrée.</div>
        </div>
      </Section>

      <Section titre="Cartes">
        <div className={ui.carte}>
          <p className={ui.texte.section}>Carte simple</p>
          <p className={ui.texte.petit}>carte : rayon 12px, marge intérieure 16px, bordure fine, ombre légère.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { t: "Produits", v: "1 248", Icone: Pill },
            { t: "Valeur du stock", v: "84 500 000", Icone: Package },
            { t: "Stock bas", v: "12", Icone: AlertCircle },
            { t: "Ventes du jour", v: "37", Icone: ShoppingCart },
          ].map(({ t, v, Icone }) => (
            <div key={t} className={ui.carteChiffre.conteneur}>
              <div className={ui.carteChiffre.icone}><Icone size={20} /></div>
              <div>
                <p className={ui.carteChiffre.titre}>{t}</p>
                <p className={ui.carteChiffre.valeur}>{v}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section titre="Tableau (produits de pharmacie)">
        <div className={`${ui.carte} overflow-x-auto p-0`}>
          <table className={ui.tableau}>
            <thead className={ui.enteteTableau}>
              <tr>
                <th className={ui.celluleEntete}>Produit</th>
                <th className={ui.celluleEntete}>Quantité</th>
                <th className={`${ui.celluleEntete} text-right`}>Prix (GNF)</th>
              </tr>
            </thead>
            <tbody>
              {produits.map((p) => (
                <tr key={p.nom} className={ui.ligneTableau}>
                  <td className={ui.cellule}>
                    <div className="text-mc-normal font-medium">{p.nom}</div>
                    <div className={ui.texte.legende}>{p.dci}</div>
                  </td>
                  <td className={`${ui.cellule} whitespace-nowrap`}>{p.qte}</td>
                  <td className={`${ui.cellule} text-right tabular-nums`}>
                    {p.prix.toLocaleString("fr-FR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Etiquette nom="ligneTableau" valeur="56px, nom 14px, DCI 12px" />
      </Section>

      <Section titre="Menu latéral">
        <div className="flex flex-wrap items-start gap-6">
          {[false, true].map((replie) => (
            <div key={String(replie)} className="space-y-1">
              <nav className={replie ? ui.menu.conteneurReplie : ui.menu.conteneur}>
                {!replie && <p className={ui.menu.titreGroupe}>Pharmacie</p>}
                {liens.map(({ nom, Icone, actif }) => (
                  <button
                    type="button"
                    key={nom}
                    aria-label={nom}
                    className={`${actif ? ui.menu.lienActif : ui.menu.lien} ${replie ? "justify-center px-0" : ""}`}
                  >
                    <Icone size={18} className="shrink-0" />
                    {!replie && nom}
                  </button>
                ))}
              </nav>
              <Etiquette nom={replie ? "conteneurReplie" : "conteneur"} valeur={replie ? "72px" : "240px"} />
            </div>
          ))}
        </div>
      </Section>
    </main>
  );
}
