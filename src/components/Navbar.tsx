/**
 * MedConnect — Navbar Component
 * Responsive : hamburger menu sur mobile, liens inline sur desktop
 */

import { useState, useEffect } from 'react'
import { siteConfig } from '../config/site.config'

export default function Navbar() {
    const [scrolled, setScrolled] = useState(false)
    const [menuOpen, setMenuOpen] = useState(false)

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 20)
        window.addEventListener('scroll', onScroll, { passive: true })
        return () => window.removeEventListener('scroll', onScroll)
    }, [])

    // Ferme le menu si on resize vers desktop
    useEffect(() => {
        const onResize = () => { if (window.innerWidth >= 768) setMenuOpen(false) }
        window.addEventListener('resize', onResize)
        return () => window.removeEventListener('resize', onResize)
    }, [])

    const navLinks = [
        { label: 'Fonctionnalités', href: '#features' },
        { label: 'Comment ça marche', href: '#how-it-works' },
        { label: 'À propos', href: '#about' },
    ]

    return (
        <>
            <nav
                className="navbar"
                data-scrolled={scrolled}
                role="navigation"
                aria-label="Navigation principale"
            >
                <div className="navbar-inner">

                    {/* Brand */}
                    <a href="/" className="navbar-brand" aria-label="MedConnect — Accueil">
                        <div className="brand-icon" aria-hidden="true">
                            <svg viewBox="0 0 32 32" fill="none" className="brand-cross">
                                <rect x="2" y="2" width="28" height="28" rx="8" fill="currentColor" opacity="0.12" />
                                <path d="M16 8v16M8 16h16" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                            </svg>
                        </div>
                        <span className="brand-name">{siteConfig.app.name}</span>
                    </a>

                    {/* Liens desktop */}
                    <ul className="navbar-links" role="list">
                        {navLinks.map(link => (
                            <li key={link.href}>
                                <a href={link.href} className="navbar-link">{link.label}</a>
                            </li>
                        ))}
                    </ul>

                    {/* CTA desktop */}
                    <div className="navbar-cta">
                        <a href="/login" className="btn-ghost">Se connecter</a>
                        <a href="/register" className="btn-primary">S'inscrire</a>
                    </div>

                    {/* Hamburger mobile */}
                    <button
                        className="hamburger"
                        aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
                        aria-expanded={menuOpen}
                        onClick={() => setMenuOpen(v => !v)}
                    >
                        <span className={`hamburger-line ${menuOpen ? 'open-1' : ''}`} />
                        <span className={`hamburger-line ${menuOpen ? 'open-2' : ''}`} />
                        <span className={`hamburger-line ${menuOpen ? 'open-3' : ''}`} />
                    </button>
                </div>

                {/* Menu mobile */}
                <div className={`mobile-menu ${menuOpen ? 'is-open' : ''}`} aria-hidden={!menuOpen}>
                    <ul role="list">
                        {navLinks.map(link => (
                            <li key={link.href}>
                                <a href={link.href} className="mobile-link" onClick={() => setMenuOpen(false)}>
                                    {link.label}
                                </a>
                            </li>
                        ))}
                    </ul>
                    <div className="mobile-cta">
                        <a href="/login" className="btn-ghost-full">Se connecter</a>
                        <a href="/register" className="btn-primary-full">S'inscrire gratuitement</a>
                    </div>
                </div>
            </nav>

            <style>{`
        .navbar {
          position: fixed;
          top: 0; left: 0; right: 0;
          z-index: 100;
          background: rgba(255,255,255,0);
          border-bottom: 1px solid transparent;
          transition: background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
        }
        .navbar[data-scrolled="true"] {
          background: rgba(255,255,255,0.92);
          border-color: var(--color-border);
          box-shadow: 0 1px 20px rgba(0,0,0,0.06);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }

        .navbar-inner {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 24px;
          height: 68px;
          display: flex;
          align-items: center;
          gap: 32px;
        }

        /* Brand */
        .navbar-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
          flex-shrink: 0;
        }
        .brand-icon {
          width: 36px; height: 36px;
          border-radius: 10px;
          background: var(--color-primary-subtle);
          color: var(--color-primary);
          display: flex; align-items: center; justify-content: center;
          transition: transform 0.2s ease;
        }
        .navbar-brand:hover .brand-icon { transform: scale(1.05); }
        .brand-cross { width: 22px; height: 22px; }
        .brand-name {
          font-family: 'DM Serif Display', serif;
          font-size: 1.25rem;
          color: var(--color-foreground);
          letter-spacing: -0.01em;
        }

        /* Liens desktop */
        .navbar-links {
          display: none;
          list-style: none;
          gap: 4px;
          margin: 0;
          padding: 0;
          flex: 1;
        }
        @media (min-width: 768px) {
          .navbar-links { display: flex; }
        }
        .navbar-link {
          display: block;
          padding: 6px 14px;
          font-size: 0.9rem;
          font-weight: 500;
          color: var(--color-foreground-muted);
          text-decoration: none;
          border-radius: 8px;
          transition: color 0.15s ease, background 0.15s ease;
        }
        .navbar-link:hover {
          color: var(--color-foreground);
          background: var(--color-surface);
        }

        /* CTA desktop */
        .navbar-cta {
          display: none;
          align-items: center;
          gap: 8px;
          margin-left: auto;
        }
        @media (min-width: 768px) { .navbar-cta { display: flex; } }

        .btn-ghost {
          padding: 8px 18px;
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--color-foreground-muted);
          text-decoration: none;
          border-radius: 999px;
          transition: color 0.15s ease, background 0.15s ease;
        }
        .btn-ghost:hover {
          color: var(--color-foreground);
          background: var(--color-surface);
        }
        .btn-primary {
          padding: 8px 20px;
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--color-primary-foreground);
          background: var(--color-primary);
          text-decoration: none;
          border-radius: 999px;
          box-shadow: 0 2px 10px rgba(91,91,214,0.25);
          transition: background 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
        }
        .btn-primary:hover {
          background: var(--color-primary-hover);
          transform: translateY(-1px);
          box-shadow: 0 4px 16px rgba(91,91,214,0.35);
        }

        /* Hamburger */
        .hamburger {
          display: flex;
          flex-direction: column;
          gap: 5px;
          padding: 8px;
          margin-left: auto;
          background: none;
          border: none;
          cursor: pointer;
          border-radius: 8px;
          transition: background 0.15s ease;
        }
        .hamburger:hover { background: var(--color-surface); }
        @media (min-width: 768px) { .hamburger { display: none; } }

        .hamburger-line {
          display: block;
          width: 22px; height: 2px;
          background: var(--color-foreground);
          border-radius: 2px;
          transition: transform 0.25s ease, opacity 0.25s ease;
          transform-origin: center;
        }
        .open-1 { transform: translateY(7px) rotate(45deg); }
        .open-2 { opacity: 0; transform: scaleX(0); }
        .open-3 { transform: translateY(-7px) rotate(-45deg); }

        /* Menu mobile */
        .mobile-menu {
          display: none;
          flex-direction: column;
          padding: 12px 24px 24px;
          background: rgba(255,255,255,0.97);
          border-top: 1px solid var(--color-border);
          backdrop-filter: blur(12px);
        }
        .mobile-menu.is-open { display: flex; }
        @media (min-width: 768px) { .mobile-menu { display: none !important; } }

        .mobile-menu ul { list-style: none; padding: 0; margin: 0 0 16px; }
        .mobile-link {
          display: block;
          padding: 12px 4px;
          font-size: 1rem;
          font-weight: 500;
          color: var(--color-foreground);
          text-decoration: none;
          border-bottom: 1px solid var(--color-border);
          transition: color 0.15s ease;
        }
        .mobile-link:hover { color: var(--color-primary); }

        .mobile-cta {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: 8px;
        }
        .btn-ghost-full {
          display: block;
          text-align: center;
          padding: 12px;
          font-size: 0.9375rem;
          font-weight: 500;
          color: var(--color-foreground);
          text-decoration: none;
          border: 1px solid var(--color-border);
          border-radius: 12px;
          transition: background 0.15s ease;
        }
        .btn-ghost-full:hover { background: var(--color-surface); }
        .btn-primary-full {
          display: block;
          text-align: center;
          padding: 12px;
          font-size: 0.9375rem;
          font-weight: 600;
          color: #fff;
          background: var(--color-primary);
          text-decoration: none;
          border-radius: 12px;
          box-shadow: 0 2px 10px rgba(91,91,214,0.25);
          transition: background 0.15s ease;
        }
        .btn-primary-full:hover { background: var(--color-primary-hover); }
      `}</style>
        </>
    )
}