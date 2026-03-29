/**
 * MedConnect — useTheme Hook
 *
 * Gère le dark/light mode :
 * - Persiste le choix de l'utilisateur dans localStorage
 * - Applique la classe 'dark' sur <html>
 * - Respecte la préférence système au premier chargement
 *
 * Usage :
 *   const { theme, toggleTheme, setTheme } = useTheme()
 *
 *   // Affichage conditionnel
 *   {theme === 'dark' ? <MoonIcon /> : <SunIcon />}
 *
 *   // Bouton toggle
 *   <button onClick={toggleTheme}>Changer le mode</button>
 */

import { useEffect, useState } from 'react'

type ThemeMode = 'light' | 'dark'

const STORAGE_KEY = 'medconnect_theme'

export function useTheme() {
    const [theme, setThemeState] = useState<ThemeMode>(() => {
        // 1. Vérifier le localStorage (choix précédent de l'utilisateur)
        const stored = localStorage.getItem(STORAGE_KEY) as ThemeMode | null
        if (stored === 'light' || stored === 'dark') return stored

        // 2. Sinon, respecter la préférence système
        return window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light'
    })

    useEffect(() => {
        const root = document.documentElement

        if (theme === 'dark') {
            root.classList.add('dark')
            root.classList.remove('light')
        } else {
            root.classList.remove('dark')
            root.classList.add('light')
        }

        localStorage.setItem(STORAGE_KEY, theme)
    }, [theme])

    // Écouter les changements de préférence système (si pas de choix manuel)
    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
        const handleChange = (e: MediaQueryListEvent) => {
            // Ne changer que si l'utilisateur n'a pas fait de choix manuel
            const stored = localStorage.getItem(STORAGE_KEY)
            if (!stored) {
                setThemeState(e.matches ? 'dark' : 'light')
            }
        }

        mediaQuery.addEventListener('change', handleChange)
        return () => mediaQuery.removeEventListener('change', handleChange)
    }, [])

    const setTheme = (mode: ThemeMode) => setThemeState(mode)

    const toggleTheme = () =>
        setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'))

    return {
        theme,         // 'light' | 'dark'
        isDark: theme === 'dark',
        isLight: theme === 'light',
        toggleTheme,   // bascule entre les deux
        setTheme,      // set direct : setTheme('dark')
    }
}