/**
 * MedConnect — Tailwind Configuration
 *
 * Ce fichier connecte les CSS variables de index.css
 * aux classes utilitaires Tailwind.
 *
 * Résultat : tu peux écrire dans tes composants :
 *   bg-background         → fond de page (blanc en light, sombre en dark)
 *   bg-surface            → fond de card
 *   text-foreground       → texte principal
 *   text-foreground-muted → texte secondaire
 *   bg-primary            → fond bouton primaire
 *   text-danger           → texte rouge urgence
 *   border-border         → bordure standard
 *   etc.
 *
 * Le dark mode bascule automatiquement sans rien changer dans les composants.
 */

import type { Config } from 'tailwindcss'
import { typography, shape } from './src/styles/theme'

const config: Config = {
    // Active le dark mode via la classe CSS sur <html>
    // Usage : document.documentElement.classList.toggle('dark')
    darkMode: 'class',

    content: [
        './index.html',
        './src/**/*.{ts,tsx}',
    ],

    theme: {
        extend: {

            // ── Couleurs sémantiques (via CSS variables) ────────────────────────────
            // Chaque couleur ici correspond à une --color-* dans index.css
            colors: {
                // Fonds
                background: 'var(--color-background)',
                surface: 'var(--color-surface)',
                'surface-hover': 'var(--color-surface-hover)',
                'surface-elevated': 'var(--color-surface-elevated)',

                // Textes
                foreground: 'var(--color-foreground)',
                'foreground-muted': 'var(--color-foreground-muted)',
                'foreground-faint': 'var(--color-foreground-faint)',

                // Bordures
                border: 'var(--color-border)',
                'border-strong': 'var(--color-border-strong)',

                // Primaire (indigo)
                primary: {
                    DEFAULT: 'var(--color-primary)',
                    hover: 'var(--color-primary-hover)',
                    foreground: 'var(--color-primary-foreground)',
                    subtle: 'var(--color-primary-subtle)',
                },

                // Danger (rouge SOS)
                danger: {
                    DEFAULT: 'var(--color-danger)',
                    hover: 'var(--color-danger-hover)',
                    foreground: 'var(--color-danger-foreground)',
                    subtle: 'var(--color-danger-subtle)',
                },

                // Succès (vert)
                success: {
                    DEFAULT: 'var(--color-success)',
                    foreground: 'var(--color-success-foreground)',
                    subtle: 'var(--color-success-subtle)',
                },

                // Avertissement (rose)
                warning: {
                    DEFAULT: 'var(--color-warning)',
                    foreground: 'var(--color-warning-foreground)',
                    subtle: 'var(--color-warning-subtle)',
                },

                // Navigation
                nav: {
                    background: 'var(--color-nav-background)',
                    border: 'var(--color-nav-border)',
                    icon: 'var(--color-nav-icon)',
                    'icon-active': 'var(--color-nav-icon-active)',
                },
            },

            // ── Typographie ─────────────────────────────────────────────────────────
            fontFamily: {
                display: typography.fontFamily.display,
                sans: typography.fontFamily.sans,
                mono: typography.fontFamily.mono,
            },

            // ── Border Radius ────────────────────────────────────────────────────────
            borderRadius: {
                sm: shape.borderRadius.sm,
                md: shape.borderRadius.md,
                lg: shape.borderRadius.lg,
                xl: shape.borderRadius.xl,
                '2xl': shape.borderRadius['2xl'],
            },

            // ── Box Shadows ──────────────────────────────────────────────────────────
            boxShadow: {
                card: 'var(--shadow-card)',
                sos: 'var(--shadow-sos)',
                button: 'var(--shadow-button)',
            },

        },
    },

    plugins: [],
}

export default config