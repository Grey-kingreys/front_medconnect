/*
 * Source unique des classes d'interface de MedConnecte.
 * Chaque chaîne est construite uniquement avec les jetons de src/theme/theme.css
 * (text-mc-*, rounded-mc-*, shadow-mc, h-mc-*, p-mc-carte, w-mc-menu...) et les
 * couleurs existantes (slate, primary, secondary, emergency), avec variantes dark:.
 * Pour changer une taille ou une couleur partout, on modifie ici ou dans theme.css.
 */

const focus =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-0";

const boutonBase = `inline-flex items-center justify-center gap-2 h-mc-controle px-4 rounded-mc-moyen text-mc-normal font-medium whitespace-nowrap transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${focus}`;

const champBase = `w-full h-mc-controle px-3 rounded-mc-moyen border border-slate-300 bg-white text-mc-normal text-slate-900 placeholder:text-slate-400 transition-colors dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 focus:border-primary-500 ${focus} disabled:opacity-50 disabled:cursor-not-allowed`;

const badgeBase =
  "inline-flex items-center gap-1 rounded-mc-petit px-2 py-0.5 text-mc-legende font-medium";

const alerteBase =
  "flex items-start gap-2 rounded-mc-moyen border px-3 py-2 text-mc-normal";

export const ui = {
  // Échelle de texte
  texte: {
    legende: "text-mc-legende text-slate-500 dark:text-slate-400",
    petit: "text-mc-petit text-slate-600 dark:text-slate-300",
    normal: "text-mc-normal text-slate-900 dark:text-slate-100",
    section: "text-mc-section font-semibold font-heading text-slate-900 dark:text-slate-100",
    page: "text-mc-page font-semibold font-heading text-slate-900 dark:text-slate-100",
    chiffre: "text-mc-chiffre font-semibold tabular-nums text-slate-900 dark:text-slate-100",
  },
  titrePage: "text-mc-page font-semibold font-heading text-slate-900 dark:text-slate-100",

  // Cartes
  carte:
    "rounded-mc-grand border border-slate-200 bg-white p-mc-carte shadow-mc dark:border-slate-800 dark:bg-slate-900",
  carteChiffre: {
    conteneur:
      "flex items-center gap-3 rounded-mc-grand border border-slate-200 bg-white p-mc-carte shadow-mc dark:border-slate-800 dark:bg-slate-900",
    titre: "text-mc-petit text-slate-500 dark:text-slate-400",
    valeur: "text-mc-chiffre font-semibold tabular-nums text-slate-900 dark:text-slate-100",
    icone:
      "flex h-10 w-10 shrink-0 items-center justify-center rounded-mc-moyen bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400",
  },

  // Variantes de cartes de chiffres (alerte, danger, mise en avant)
  carteChiffreVariantes: {
    iconeAttention:
      "flex h-10 w-10 shrink-0 items-center justify-center rounded-mc-moyen bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
    iconeDanger:
      "flex h-10 w-10 shrink-0 items-center justify-center rounded-mc-moyen bg-red-50 text-emergency-600 dark:bg-red-900/30 dark:text-red-400",
    valeurAttention: "text-mc-chiffre font-semibold tabular-nums text-amber-600 dark:text-amber-400",
    valeurDanger: "text-mc-chiffre font-semibold tabular-nums text-emergency-600 dark:text-red-400",
    conteneurAccent:
      "flex items-center gap-3 rounded-mc-grand bg-primary-600 p-mc-carte text-white shadow-mc",
    iconeAccent:
      "flex h-10 w-10 shrink-0 items-center justify-center rounded-mc-moyen bg-white/20 text-white",
    titreAccent: "text-mc-petit text-white/80",
    valeurAccent: "text-mc-chiffre font-semibold tabular-nums text-white",
    noteAccent: "text-mc-legende text-white/90",
  },

  // Filtres en segments (boutons à état)
  filtre: {
    groupe:
      "inline-flex flex-wrap items-center gap-1 rounded-mc-moyen border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900",
    base: "h-mc-controle-petit rounded-mc-petit px-3 text-mc-petit font-medium whitespace-nowrap transition-colors",
    inactif: "text-slate-500 hover:text-primary-600 dark:text-slate-400",
    actif: "bg-slate-100 text-primary-600 dark:bg-slate-800 dark:text-primary-400",
    actifAttention: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    actifDanger: "bg-red-50 text-emergency-600 dark:bg-red-900/30 dark:text-red-300",
  },

  // Fenêtres de dialogue
  dialogue: {
    fond: "absolute inset-0 bg-slate-950/50",
    panneau:
      "relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-mc-grand border border-slate-200 bg-white p-mc-carte shadow-mc animate-slide-up dark:border-slate-800 dark:bg-slate-900",
    iconeAttention:
      "flex h-10 w-10 shrink-0 items-center justify-center rounded-mc-moyen bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    // Icône de confirmation de suppression (grande, rose)
    iconeDanger:
      "flex h-14 w-14 shrink-0 items-center justify-center rounded-mc-moyen bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300",
    // Panneau étroit (max-w-sm) pour les confirmations courtes
    panneauEtroit:
      "relative max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-mc-grand border border-slate-200 bg-white p-mc-carte shadow-mc animate-slide-up dark:border-slate-800 dark:bg-slate-900",
    erreurChamp: "text-mc-normal text-emergency-600 dark:text-red-300",
    // Panneaux sans marge interne (en-tête et corps gérés par la fenêtre) : large (max-w-xl) et très large (max-w-3xl, colonne)
    panneauLarge:
      "relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-mc-grand border border-slate-200 bg-white shadow-mc animate-scale-in dark:border-slate-800 dark:bg-slate-900",
    panneauTresLarge:
      "relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-mc-grand border border-slate-200 bg-white shadow-mc animate-scale-in outline-none dark:border-slate-800 dark:bg-slate-900",
  },

  // Tableaux
  tableau: "w-full border-collapse text-left text-mc-normal",
  enteteTableau: "border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50",
  celluleEntete:
    "px-3 py-2 text-mc-legende font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400",
  // En-tête serré pour les tableaux de saisie denses (réception d'une facture papier)
  celluleEnteteSerree:
    "px-1 py-2 text-[11px] font-semibold uppercase leading-tight text-slate-500 dark:text-slate-400",
  ligneTableau:
    "h-mc-ligne border-b border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40",
  cellule: "px-3 text-mc-normal text-slate-900 dark:text-slate-100",
  // Colonne d'actions collée à droite quand le tableau défile (fond opaque, qui suit le survol de la ligne)
  enteteActions:
    "sticky right-0 border-l border-slate-200 bg-slate-50 shadow-[-4px_0_6px_-4px_rgba(0,0,0,0.08)] dark:border-slate-800 dark:bg-slate-800",
  celluleActions:
    "sticky right-0 border-l border-slate-200 bg-white px-2 shadow-[-4px_0_6px_-4px_rgba(0,0,0,0.08)] group-hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:group-hover:bg-slate-800",

  // Boutons
  bouton: {
    primaire: `${boutonBase} bg-primary-600 text-white hover:bg-primary-700`,
    secondaire: `${boutonBase} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800`,
    danger: `${boutonBase} bg-emergency-600 text-white hover:bg-emergency-500`,
    // Bouton sans bordure ni fond (annuler, pagination)
    discret: `${boutonBase} text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800`,
    icone: `inline-flex h-mc-controle w-mc-controle items-center justify-center rounded-mc-moyen text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800 ${focus}`,
    iconePetit: `inline-flex h-mc-controle-petit w-mc-controle-petit shrink-0 items-center justify-center rounded-mc-moyen text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800 ${focus}`,
    petit: `inline-flex items-center justify-center gap-1.5 h-mc-controle-petit px-3 rounded-mc-moyen text-mc-petit font-medium whitespace-nowrap bg-primary-600 text-white transition-colors hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed ${focus}`,
  },

  // Formulaires
  champ: champBase,
  select: `${champBase} pr-8`,
  // Zone de texte : même aspect que champ, hauteur minimale au lieu d'une hauteur fixe
  zoneTexte:
    "w-full min-h-[var(--spacing-mc-controle)] px-3 py-2 resize-y rounded-mc-moyen border border-slate-300 bg-white text-mc-normal text-slate-900 placeholder:text-slate-400 transition-colors dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 focus:border-primary-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed",
  label: "mb-1 block text-mc-petit font-medium text-slate-700 dark:text-slate-300",

  // Pastilles d'état
  badge: {
    neutre: `${badgeBase} bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300`,
    succes: `${badgeBase} bg-secondary-50 text-secondary-700 dark:bg-secondary-900/30 dark:text-secondary-300`,
    attention: `${badgeBase} bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300`,
    danger: `${badgeBase} bg-red-50 text-emergency-600 dark:bg-red-900/30 dark:text-red-300`,
    info: `${badgeBase} bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300`,
  },

  // Messages
  alerte: {
    erreur: `${alerteBase} border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200`,
    attention: `${alerteBase} border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200`,
    info: `${alerteBase} border-primary-200 bg-primary-50 text-primary-800 dark:border-primary-900 dark:bg-primary-900/40 dark:text-primary-200`,
    succes: `${alerteBase} border-secondary-200 bg-secondary-50 text-secondary-800 dark:border-secondary-900 dark:bg-secondary-900/40 dark:text-secondary-200`,
  },

  // Menu latéral
  menu: {
    conteneur:
      "flex w-mc-menu flex-col gap-1 border-r border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900",
    conteneurReplie:
      "flex w-mc-menu-replie flex-col items-center gap-1 border-r border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900",
    lien: "flex h-mc-controle items-center gap-3 rounded-mc-moyen px-3 text-mc-normal text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
    lienActif:
      "relative flex h-mc-controle items-center gap-3 rounded-mc-moyen bg-primary-50 px-3 text-mc-normal font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-300",
    titreGroupe:
      "px-3 pb-1 pt-3 text-mc-legende font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500",
    // Trait à gauche du lien actif (le lien actif est en position relative)
    indicateurActif:
      "absolute left-0 top-1/2 h-3/5 w-0.75 -translate-y-1/2 rounded-r-full bg-primary-500",
    // Cadre fixe du menu du tableau de bord (la largeur vient de cadreOuvert ou cadreReplie)
    cadre:
      "fixed left-0 top-0 z-50 flex h-full flex-col overflow-visible border-r border-slate-200 bg-white transition-all duration-300 ease-in-out print:hidden dark:border-slate-800 dark:bg-slate-900",
    cadreOuvert: "w-mc-menu",
    cadreReplie: "w-mc-menu-replie",
    // Décalage du contenu principal, identique aux largeurs du cadre
    decalageOuvert: "lg:ml-mc-menu",
    decalageReplie: "lg:ml-mc-menu-replie",
    superposition: "fixed inset-0 z-40 bg-slate-950/50 print:hidden lg:hidden",
    // Logo et en-tête
    enTete: "flex h-14 items-center gap-1 border-b border-slate-200 px-3 dark:border-slate-800",
    logoImage: "rounded-mc-moyen transition-transform duration-300 group-hover:scale-105",
    logoTexte: "text-mc-section font-bold tracking-tight",
    // Bloc profil
    zoneProfil: "border-b border-slate-200 p-2 dark:border-slate-800",
    profil:
      "group flex items-center gap-3 rounded-mc-moyen p-2 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800",
    avatar:
      "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-mc-moyen bg-gradient-to-br",
    avatarInitiales: "text-mc-petit font-bold text-white",
    avatarPastille:
      "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-secondary-500 dark:border-slate-900",
    profilNom:
      "truncate text-mc-normal font-semibold text-slate-900 transition-colors group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-300",
    profilRole: "text-mc-legende font-medium bg-gradient-to-r bg-clip-text text-transparent",
    // Navigation et icônes
    navigation: "flex-1 space-y-1 overflow-y-auto p-2 scrollbar-thin",
    icone: "h-4.5 w-4.5 shrink-0",
    // Bas du menu
    bas: "space-y-1 border-t border-slate-200 p-2 dark:border-slate-800",
    lienDanger:
      "flex h-mc-controle w-full items-center gap-3 rounded-mc-moyen px-3 text-mc-normal text-slate-600 transition-colors hover:bg-red-50 hover:text-emergency-600 dark:text-slate-300 dark:hover:bg-red-900/30 dark:hover:text-red-300",
    ligneTheme: "flex h-mc-controle items-center justify-between px-3",
    ligneThemeTexte: "text-mc-normal text-slate-600 dark:text-slate-300",
  },
} as const;
