/**
 * MedConnect — Footer Component
 */

import { siteConfig } from '../config/site.config'

export default function Footer() {
    const year = new Date().getFullYear()

    const columns = [
        {
            title: 'Produit',
            links: [
                { label: 'Fonctionnalités', href: '#features' },
                { label: 'Comment ça marche', href: '#how-it-works' },
                { label: 'Tarifs', href: '#pricing' },
                { label: 'Télécharger l\'app', href: '#download' },
            ],
        },
        {
            title: 'Pour les pros',
            links: [
                { label: 'Hôpitaux & Cliniques', href: '#hospitals' },
                { label: 'Pharmacies', href: '#pharmacies' },
                { label: 'ONG & Santé publique', href: '#ngo' },
            ],
        },
        {
            title: 'Entreprise',
            links: [
                { label: 'À propos', href: '#about' },
                { label: 'Contact', href: `mailto:${siteConfig.app.supportEmail}` },
                { label: 'Presse', href: '#press' },
                { label: 'Partenaires', href: '#partners' },
            ],
        },
        {
            title: 'Légal',
            links: [
                { label: 'Confidentialité', href: '#privacy' },
                { label: 'CGU', href: '#terms' },
                { label: 'Sécurité', href: '#security' },
            ],
        },
    ]

    const emergencyNumbers = [
        { label: 'SAMU', number: siteConfig.emergency.samu },
        { label: 'Police', number: siteConfig.emergency.police },
        { label: 'Pompiers', number: siteConfig.emergency.pompiers },
    ]

    return (
        <footer className="footer" role="contentinfo">

            {/* Bande urgence */}
            <div className="emergency-strip">
                <div className="emergency-inner">
                    <div className="emergency-label">
                        <svg viewBox="0 0 20 20" fill="none" className="emergency-icon" aria-hidden="true">
                            <path d="M10 2L2 17h16L10 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                            <path d="M10 8v4M10 14v1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                        <span>Numéros d'urgence en Guinée</span>
                    </div>
                    <div className="emergency-numbers">
                        {emergencyNumbers.map(e => (
                            <a key={e.number} href={`tel:${e.number}`} className="emergency-number">
                                <span className="emergency-service">{e.label}</span>
                                <span className="emergency-num">{e.number}</span>
                            </a>
                        ))}
                    </div>
                </div>
            </div>

            {/* Corps */}
            <div className="footer-body">
                <div className="footer-inner">

                    {/* Brand + tagline */}
                    <div className="footer-brand-col">
                        <a href="/" className="footer-brand">
                            <div className="footer-brand-icon" aria-hidden="true">
                                <svg viewBox="0 0 32 32" fill="none">
                                    <rect x="2" y="2" width="28" height="28" rx="8" fill="currentColor" opacity="0.12" />
                                    <path d="M16 8v16M8 16h16" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                                </svg>
                            </div>
                            <span className="footer-brand-name">{siteConfig.app.name}</span>
                        </a>
                        <p className="footer-tagline">{siteConfig.app.tagline}</p>
                        <p className="footer-desc">{siteConfig.app.description}</p>

                        {/* Réseaux sociaux */}
                        <div className="social-links" aria-label="Réseaux sociaux">
                            {[
                                { label: 'Facebook', path: 'M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z' },
                                { label: 'Twitter', path: 'M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z' },
                                { label: 'LinkedIn', path: 'M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z M4 6a2 2 0 100-4 2 2 0 000 4z' },
                            ].map(s => (
                                <a key={s.label} href="#" className="social-link" aria-label={s.label}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d={s.path} />
                                    </svg>
                                </a>
                            ))}
                        </div>
                    </div>

                    {/* Colonnes de liens */}
                    <div className="footer-links-grid">
                        {columns.map(col => (
                            <div key={col.title} className="footer-col">
                                <h3 className="footer-col-title">{col.title}</h3>
                                <ul role="list">
                                    {col.links.map(link => (
                                        <li key={link.label}>
                                            <a href={link.href} className="footer-link">{link.label}</a>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Bas de page */}
            <div className="footer-bottom">
                <div className="footer-bottom-inner">
                    <p className="copyright">
                        © {year} {siteConfig.app.name}. Tous droits réservés. Conakry, Guinée.
                    </p>
                    <p className="version">v{siteConfig.app.version}</p>
                </div>
            </div>

            <style>{`
        .footer {
          background: var(--color-foreground);
          color: var(--color-foreground-faint);
          font-family: 'DM Sans', sans-serif;
        }

        /* Bande urgence */
        .emergency-strip {
          background: var(--color-danger-subtle);
          border-top: 1px solid rgba(239,68,68,0.15);
          padding: 12px 0;
        }
        .emergency-inner {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 24px;
          display: flex;
          align-items: center;
          gap: 24px;
          flex-wrap: wrap;
        }
        .emergency-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.8125rem;
          font-weight: 600;
          color: var(--color-danger);
          white-space: nowrap;
        }
        .emergency-icon { width: 16px; height: 16px; }
        .emergency-numbers {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
        }
        .emergency-number {
          display: flex;
          align-items: center;
          gap: 6px;
          text-decoration: none;
          transition: opacity 0.15s ease;
        }
        .emergency-number:hover { opacity: 0.8; }
        .emergency-service {
          font-size: 0.75rem;
          color: #6B7280;
        }
        .emergency-num {
          font-size: 0.9375rem;
          font-weight: 700;
          color: var(--color-danger);
          font-variant-numeric: tabular-nums;
        }

        /* Corps */
        .footer-body {
          padding: 56px 0 40px;
        }
        .footer-inner {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 24px;
          display: grid;
          grid-template-columns: 1fr;
          gap: 48px;
        }
        @media (min-width: 768px) {
          .footer-inner {
            grid-template-columns: 280px 1fr;
          }
        }

        /* Brand col */
        .footer-brand {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
          margin-bottom: 16px;
        }
        .footer-brand-icon {
          width: 36px; height: 36px;
          border-radius: 10px;
          background: rgba(123,127,232,0.15);
          color: #7B7FE8;
          display: flex; align-items: center; justify-content: center;
        }
        .footer-brand-icon svg { width: 22px; height: 22px; }
        .footer-brand-name {
          font-family: 'DM Serif Display', serif;
          font-size: 1.25rem;
          color: #F1F5F9;
        }
        .footer-tagline {
          font-size: 0.875rem;
          font-style: italic;
          color: #94A3B8;
          margin-bottom: 10px;
        }
        .footer-desc {
          font-size: 0.8125rem;
          line-height: 1.6;
          color: #64748B;
          margin-bottom: 24px;
          max-width: 260px;
        }

        .social-links {
          display: flex;
          gap: 10px;
        }
        .social-link {
          width: 36px; height: 36px;
          border-radius: 8px;
          background: rgba(255,255,255,0.06);
          color: #64748B;
          display: flex; align-items: center; justify-content: center;
          text-decoration: none;
          transition: background 0.15s ease, color 0.15s ease;
        }
        .social-link:hover {
          background: rgba(123,127,232,0.15);
          color: #7B7FE8;
        }
        .social-link svg { width: 16px; height: 16px; }

        /* Colonnes liens */
        .footer-links-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 32px 24px;
        }
        @media (min-width: 640px) {
          .footer-links-grid {
            grid-template-columns: repeat(4, 1fr);
          }
        }
        .footer-col ul { list-style: none; padding: 0; margin: 0; }
        .footer-col-title {
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #F1F5F9;
          margin-bottom: 14px;
        }
        .footer-link {
          display: block;
          font-size: 0.875rem;
          color: #64748B;
          text-decoration: none;
          padding: 4px 0;
          transition: color 0.15s ease;
        }
        .footer-link:hover { color: #94A3B8; }

        /* Bottom */
        .footer-bottom {
          border-top: 1px solid rgba(255,255,255,0.07);
          padding: 16px 0;
        }
        .footer-bottom-inner {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 8px;
        }
        .copyright {
          font-size: 0.8125rem;
          color: #475569;
        }
        .version {
          font-size: 0.75rem;
          color: #334155;
          font-family: 'JetBrains Mono', monospace;
        }
      `}</style>
        </footer>
    )
}