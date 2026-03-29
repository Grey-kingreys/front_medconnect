/**
 * MedConnect — Design Theme
 *
 * Approche dark/light mode :
 * Ce fichier définit les valeurs "raw" (primitives) et les tokens sémantiques.
 * Les tokens sémantiques sont mappés sur des CSS variables déclarées dans index.css.
 * Tailwind lit ces CSS variables via tailwind.config.ts.
 *
 * Flux :
 *   theme.ts (valeurs raw)
 *     → index.css (CSS variables :root et .dark)
 *       → tailwind.config.ts (classes Tailwind ex: bg-background, text-primary)
 *
 * Pour activer le dark mode :
 *   document.documentElement.classList.add('dark')
 * Pour revenir au light :
 *   document.documentElement.classList.remove('dark')
 */

// ─── PALETTE RAW ─────────────────────────────────────────────────────────────
// Valeurs primitives — ne changent pas entre les modes.
// S'utilisent dans index.css pour construire les variables.

export const palette = {

    // Violet indigo — couleur primaire de confiance
    indigo: {
        50: '#EEECFB',
        100: '#D5D1F6',
        200: '#ABA3ED',
        300: '#8175E4',
        400: '#6B5EDE',
        500: '#5B5BD6', // ← primaire principal
        600: '#4A48C4',
        700: '#3A37A8',
        800: '#2B2880',
        900: '#1C1A58',
    },

    // Rouge — urgence, SOS, danger
    red: {
        50: '#FEF2F2',
        100: '#FEE2E2',
        200: '#FECACA',
        300: '#FCA5A5',
        400: '#F87171',
        500: '#EF4444', // ← rouge SOS
        600: '#DC2626',
        700: '#B91C1C',
        800: '#991B1B',
        900: '#7F1D1D',
    },

    // Vert — succès, confirmé, en stock
    green: {
        50: '#F0FDF4',
        100: '#DCFCE7',
        200: '#BBF7D0',
        300: '#86EFAC',
        400: '#4ADE80',
        500: '#22C55E', // ← vert succès
        600: '#16A34A',
        700: '#15803D',
        800: '#166534',
        900: '#14532D',
    },

    // Rose — avertissement doux, badges "Prévu"
    rose: {
        50: '#FFF1F2',
        100: '#FFE4E6',
        200: '#FECDD3',
        300: '#FDA4AF',
        400: '#FB7185',
        500: '#F43F5E',
        600: '#E11D48',
        700: '#BE123C',
    },

    // Gris — neutres, surfaces, textes
    gray: {
        0: '#FFFFFF',
        50: '#F9FAFB',
        100: '#F3F4F6',
        200: '#E5E7EB',
        300: '#D1D5DB',
        400: '#9CA3AF',
        500: '#6B7280',
        600: '#4B5563',
        700: '#374151',
        800: '#1F2937',
        850: '#18212f',
        900: '#111827',
        950: '#0a0f1a',
    },

} as const

// ─── TOKENS SÉMANTIQUES ───────────────────────────────────────────────────────
// Chaque token pointe vers une CSS variable définie dans index.css.
// C'est ce qu'on enregistre dans tailwind.config.ts via `var(--token)`.
//
// Classes Tailwind générées (exemples) :
//   bg-background      → fond de page
//   bg-surface         → fond de card
//   text-foreground    → texte principal
//   text-foreground-muted → texte secondaire
//   border-border      → bordure standard
//   bg-primary         → fond bouton primaire
//   text-primary       → texte couleur primaire

export const tokens = {

    // ── Couleurs de fond ────────────────────────────────────────────────────────
    background: 'var(--color-background)',
    surface: 'var(--color-surface)',
    'surface-hover': 'var(--color-surface-hover)',
    'surface-elevated': 'var(--color-surface-elevated)',

    // ── Couleurs de texte ───────────────────────────────────────────────────────
    foreground: 'var(--color-foreground)',
    'foreground-muted': 'var(--color-foreground-muted)',
    'foreground-faint': 'var(--color-foreground-faint)',

    // ── Bordures ────────────────────────────────────────────────────────────────
    border: 'var(--color-border)',
    'border-strong': 'var(--color-border-strong)',

    // ── Primaire (indigo) ───────────────────────────────────────────────────────
    primary: 'var(--color-primary)',
    'primary-hover': 'var(--color-primary-hover)',
    'primary-foreground': 'var(--color-primary-foreground)',
    'primary-subtle': 'var(--color-primary-subtle)',

    // ── Danger / Urgence (rouge) ────────────────────────────────────────────────
    danger: 'var(--color-danger)',
    'danger-hover': 'var(--color-danger-hover)',
    'danger-foreground': 'var(--color-danger-foreground)',
    'danger-subtle': 'var(--color-danger-subtle)',

    // ── Succès (vert) ───────────────────────────────────────────────────────────
    success: 'var(--color-success)',
    'success-foreground': 'var(--color-success-foreground)',
    'success-subtle': 'var(--color-success-subtle)',

    // ── Avertissement (rose) ────────────────────────────────────────────────────
    warning: 'var(--color-warning)',
    'warning-foreground': 'var(--color-warning-foreground)',
    'warning-subtle': 'var(--color-warning-subtle)',

    // ── Navigation bottom bar ───────────────────────────────────────────────────
    'nav-background': 'var(--color-nav-background)',
    'nav-border': 'var(--color-nav-border)',
    'nav-icon': 'var(--color-nav-icon)',
    'nav-icon-active': 'var(--color-nav-icon-active)',

} as const

// ─── TYPOGRAPHIE ─────────────────────────────────────────────────────────────

export const typography = {
    /**
     * DM Serif Display → titres, nom de l'app
     * DM Sans          → corps, labels, navigation
     * JetBrains Mono   → données médicales, coordonnées GPS
     *
     * À ajouter dans index.html :
     * <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
     */
    fontFamily: {
        display: ['"DM Serif Display"', 'Georgia', 'serif'],
        sans: ['"DM Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
    },
} as const

export const shape = {
    borderRadius: {
        sm: '6px',
        md: '10px',
        lg: '14px',
        xl: '18px',
        '2xl': '24px',
        full: '9999px',
    },
} as const

export const theme = { palette, tokens, typography, shape } as const
export type Theme = typeof theme