/**
 * MedConnect — Landing Page
 *
 * Sections :
 *   1. Hero
 *   2. Stats
 *   3. Features — 4 fonctionnalités (dossier, géo, pharmacie, SOS)
 *   4. How It Works (3 étapes)
 *   5. Public cible / Témoignages
 *   6. CTA final
 *
 * Thème : Light médical — blanc pur, touches indigo, typographie DM Serif Display
 */

import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { siteConfig } from '../config/site.config'
import { palette } from '../styles/theme'

// ─── DONNÉES ──────────────────────────────────────────────────────────────────

const stats = [
    { value: '10 000', unit: 'hab', label: 'pour 1 médecin en Guinée', color: palette.red[500] },
    { value: '40%', unit: '', label: 'de réduction du temps d\'accès aux soins', color: palette.indigo[500] },
    { value: '5M', unit: '+', label: 'd\'utilisateurs de smartphones ciblés', color: palette.green[600] },
    { value: '4,5Md$', unit: '', label: 'marché africain de la e-santé d\'ici 2030', color: palette.indigo[400] },
]

const features = [
    {
        id: 'dossier',
        eyebrow: '01 — Carnet de santé',
        title: 'Votre dossier médical, sécurisé et accessible.',
        description:
            'Ordonnances, résultats d\'analyses, antécédents médicaux, vaccins, allergies — centralisés en un seul endroit. Partageable avec n\'importe quel professionnel de santé en quelques secondes.',
        items: ['Historique des consultations', 'Rappels de traitement', 'Résultats d\'analyses', 'Gestion des ordonnances'],
        accent: palette.indigo[500],
        bg: palette.indigo[50],
        icon: (
            <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="feature-svg">
                <rect x="10" y="6" width="38" height="52" rx="5" stroke="#5B5BD6" strokeWidth="2.5" />
                <path d="M18 22h28M18 30h28M18 38h18" stroke="#5B5BD6" strokeWidth="2.5" strokeLinecap="round" />
                <circle cx="48" cy="48" r="12" fill="#5B5BD6" opacity="0.1" stroke="#5B5BD6" strokeWidth="2" />
                <path d="M44 48h8M48 44v8" stroke="#5B5BD6" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
        ),
    },
    {
        id: 'geo',
        eyebrow: '02 — Géolocalisation',
        title: 'Trouvez un médecin ou une pharmacie près de vous.',
        description:
            'Hôpitaux, cliniques, pharmacies de garde — localisez les professionnels de santé disponibles autour de vous. Filtrage par spécialité, distance et horaires d\'ouverture.',
        items: ['Carte interactive en temps réel', 'Pharmacies de garde', 'Filtrage par spécialité', 'Itinéraire direct'],
        accent: palette.green[600],
        bg: palette.green[50],
        icon: (
            <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="feature-svg">
                <circle cx="32" cy="26" r="12" stroke="#16A34A" strokeWidth="2.5" />
                <circle cx="32" cy="26" r="5" fill="#16A34A" opacity="0.8" />
                <path d="M16 54c0-8.837 7.163-16 16-16s16 7.163 16 16" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" opacity="0.4" />
                <path d="M32 14v-6M32 46v6M20 26H14M50 26h-6" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" opacity="0.3" />
                <circle cx="46" cy="46" r="8" fill="#16A34A" opacity="0.1" stroke="#16A34A" strokeWidth="1.5" />
                <path d="M43 46h6M46 43v6" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" />
            </svg>
        ),
    },
    {
        id: 'pharmacie',
        eyebrow: '03 — Pharmacie en ligne',
        title: 'Trouvez votre médicament, vérifiez le stock en temps réel.',
        description:
            'Recherchez un médicament par nom, consultez sa disponibilité dans les pharmacies proches, comparez les prix et réservez directement depuis l\'application. Fini les allers-retours inutiles.',
        items: ['Recherche par nom de médicament', 'Stock en temps réel', 'Réservation à distance', 'Comparaison des prix'],
        accent: palette.indigo[400],
        bg: '#F0F4FF',
        icon: (
            <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="feature-svg">
                <rect x="8" y="18" width="48" height="34" rx="6" stroke="#6B5EDE" strokeWidth="2.5" />
                <path d="M8 28h48" stroke="#6B5EDE" strokeWidth="2.5" />
                <rect x="16" y="8" width="10" height="12" rx="3" stroke="#6B5EDE" strokeWidth="2" />
                <rect x="38" y="8" width="10" height="12" rx="3" stroke="#6B5EDE" strokeWidth="2" />
                {/* Pilule */}
                <rect x="18" y="36" width="18" height="8" rx="4" stroke="#6B5EDE" strokeWidth="2" />
                <path d="M27 36v8" stroke="#6B5EDE" strokeWidth="2" strokeLinecap="round" />
                <rect x="17" y="36" width="9" height="8" rx="4" fill="#6B5EDE" opacity="0.15" />
                {/* Badge stock */}
                <circle cx="46" cy="40" r="8" fill="#6B5EDE" opacity="0.12" stroke="#6B5EDE" strokeWidth="1.5" />
                <path d="M43 40l2 2 4-3" stroke="#6B5EDE" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        ),
    },
    {
        id: 'sos',
        eyebrow: '04 — Assistance d\'urgence',
        title: 'Une aide immédiate quand chaque seconde compte.',
        description:
            'Bouton SOS d\'urgence, assistance IA pour les premiers soins, contact rapide des secours et notification de vos proches. Parce qu\'en Guinée, l\'accès aux soins d\'urgence peut faire la différence.',
        items: ['Bouton SOS géolocalisé', 'Assistant IA de diagnostic', 'Contact automatique des secours', 'Numéros d\'urgence locaux'],
        accent: palette.red[500],
        bg: palette.red[50],
        icon: (
            <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="feature-svg">
                <circle cx="32" cy="32" r="24" stroke="#EF4444" strokeWidth="2.5" opacity="0.25" />
                <circle cx="32" cy="32" r="17" stroke="#EF4444" strokeWidth="2.5" opacity="0.5" />
                <circle cx="32" cy="32" r="10" fill="#EF4444" opacity="0.1" />
                <circle cx="32" cy="32" r="4" fill="#EF4444" />
                <path d="M32 8v6M32 50v6M8 32h6M50 32h6" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
            </svg>
        ),
    },
]

const howItWorks = [
    {
        step: '01',
        title: 'Créez votre compte',
        description: 'Inscrivez-vous en tant que patient, hôpital ou pharmacie. Votre profil est sécurisé et vos données médicales protégées.',
    },
    {
        step: '02',
        title: 'Renseignez votre dossier',
        description: 'Ajoutez vos antécédents, ordonnances et résultats d\'analyses. Votre carnet de santé numérique est prêt en quelques minutes.',
    },
    {
        step: '03',
        title: 'Accédez aux soins',
        description: 'Localisez les professionnels de santé autour de vous, obtenez une assistance IA et activez le SOS en cas d\'urgence.',
    },
]

const audiences = [
    {
        icon: '🏥',
        title: 'Citoyens',
        desc: 'Zones urbaines et rurales — accédez aux soins, gérez votre santé et réagissez en urgence.',
    },
    {
        icon: '👴',
        title: 'Patients chroniques',
        desc: 'Patients âgés ou atteints de maladies chroniques — suivi médical renforcé, rappels de traitement.',
    },
    {
        icon: '🤰',
        title: 'Femmes & familles',
        desc: 'Femmes enceintes et parents d\'enfants — accès rapide aux maternités et pédiatres.',
    },
    {
        icon: '💊',
        title: 'Pharmacies',
        desc: 'Gérez vos stocks, gagnez en visibilité et facilitez la réservation de médicaments.',
    },
]

// ─── COMPOSANT PRINCIPAL ──────────────────────────────────────────────────────

export default function LandingPage() {
    return (
        <div className="landing-root">
            <Navbar />

            <main>
                {/* ── 1. HERO ────────────────────────────────────────────────────────── */}
                <section className="hero" aria-label="Présentation de MedConnect">
                    <div className="hero-bg" aria-hidden="true">
                        <div className="hero-orb hero-orb--1" />
                        <div className="hero-orb hero-orb--2" />
                        <div className="hero-grid" />
                    </div>

                    <div className="container hero-inner">
                        <div className="hero-content">
                            <div className="hero-badge">
                                <span className="hero-badge-dot" />
                                Disponible en Guinée · Conakry, Labé, Kankan
                            </div>

                            <h1 className="hero-title">
                                Votre médecin,<br />
                                votre pharmacie,<br />
                                <span className="hero-title-accent">dans votre poche.</span>
                            </h1>

                            <p className="hero-desc">
                                {siteConfig.app.description}
                            </p>

                            <div className="hero-cta">
                                <a href="/register" className="cta-primary">
                                    Commencer gratuitement
                                    <svg viewBox="0 0 20 20" fill="none" className="cta-arrow">
                                        <path d="M4 10h12M12 5l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </a>
                                <a href="/login" className="cta-secondary">
                                    Se connecter
                                </a>
                            </div>

                            <p className="hero-hint">Gratuit pour les patients · Aucune carte requise</p>
                        </div>

                        {/* Mockup hero */}
                        <div className="hero-visual" aria-hidden="true">
                            <div className="mockup-phone">
                                <div className="mockup-screen">
                                    {/* Mini dashboard simulé */}
                                    <div className="mock-header">
                                        <span className="mock-title">Mon Tableau de Bord</span>
                                        <div className="mock-avatar" />
                                    </div>
                                    <div className="mock-alert">
                                        <svg viewBox="0 0 16 16" fill="none" style={{ width: 14, height: 14, flexShrink: 0 }}>
                                            <path d="M8 1L1 14h14L8 1z" stroke="#B91C1C" strokeWidth="1.5" strokeLinejoin="round" />
                                            <path d="M8 6v4M8 11v1" stroke="#B91C1C" strokeWidth="1.5" strokeLinecap="round" />
                                        </svg>
                                        <span>Alerte Urgence Santé</span>
                                    </div>
                                    <div className="mock-grid">
                                        {['Carnet de santé', 'Pharmacie proche', 'Diagnostic IA', 'SOS Urgence'].map((item, i) => (
                                            <div key={item} className="mock-card" style={{ animationDelay: `${i * 0.1}s` }}>
                                                <div className="mock-card-icon" style={{ background: i === 3 ? 'rgba(239,68,68,0.1)' : 'rgba(91,91,214,0.1)' }}>
                                                    {i === 3
                                                        ? <svg viewBox="0 0 16 16" fill="none" style={{ width: 12, height: 12 }}><circle cx="8" cy="8" r="6" stroke="#EF4444" strokeWidth="1.5" opacity="0.6" /><circle cx="8" cy="8" r="2" fill="#EF4444" /></svg>
                                                        : <svg viewBox="0 0 16 16" fill="none" style={{ width: 12, height: 12 }}><path d="M8 3v10M3 8h10" stroke="#5B5BD6" strokeWidth="1.5" strokeLinecap="round" /></svg>
                                                    }
                                                </div>
                                                <span className="mock-card-label">{item}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mock-section-title">Prochains rendez-vous</div>
                                    {[
                                        { name: 'Consultation Générale', date: '15 mai · 10h00', status: 'Confirmé', color: '#16A34A' },
                                        { name: 'Vaccination Annuelle', date: '22 juin · 14h30', status: 'Prévu', color: '#E11D48' },
                                    ].map(appt => (
                                        <div key={appt.name} className="mock-appt">
                                            <div className="mock-appt-icon">
                                                <svg viewBox="0 0 14 14" fill="none" style={{ width: 10, height: 10 }}>
                                                    <rect x="1" y="2" width="12" height="11" rx="2" stroke="#5B5BD6" strokeWidth="1.2" />
                                                    <path d="M1 6h12M5 1v2M9 1v2" stroke="#5B5BD6" strokeWidth="1.2" strokeLinecap="round" />
                                                </svg>
                                            </div>
                                            <div className="mock-appt-info">
                                                <span className="mock-appt-name">{appt.name}</span>
                                                <span className="mock-appt-date">{appt.date}</span>
                                            </div>
                                            <span className="mock-appt-badge" style={{ background: `${appt.color}18`, color: appt.color }}>
                                                {appt.status}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                                {/* Reflet */}
                                <div className="mockup-shine" />
                            </div>

                            {/* Badges flottants */}
                            <div className="float-badge float-badge--1">
                                <span className="float-icon">✅</span>
                                <div>
                                    <span className="float-title">Dossier sécurisé</span>
                                    <span className="float-sub">Chiffrement AES-256</span>
                                </div>
                            </div>
                            <div className="float-badge float-badge--2">
                                <span className="float-icon">📍</span>
                                <div>
                                    <span className="float-title">3 pharmacies</span>
                                    <span className="float-sub">dans un rayon de 2km</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ── 2. STATS ──────────────────────────────────────────────────────── */}
                <section className="stats-section" id="about" aria-label="Chiffres clés">
                    <div className="container">
                        <div className="stats-grid">
                            {stats.map((s) => (
                                <div key={s.label} className="stat-card">
                                    <div className="stat-value" style={{ color: s.color }}>
                                        {s.value}<span className="stat-unit">{s.unit}</span>
                                    </div>
                                    <p className="stat-label">{s.label}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── 3. FEATURES ───────────────────────────────────────────────────── */}
                <section className="features-section" id="features" aria-label="Fonctionnalités">
                    <div className="container">
                        <div className="section-header">
                            <span className="section-eyebrow">Fonctionnalités</span>
                            <h2 className="section-title">Tout ce dont vous avez besoin,<br /><em>en un seul endroit.</em></h2>
                            <p className="section-desc">
                                MedConnect regroupe dossier médical, géolocalisation et assistance d'urgence dans une seule application pensée pour la réalité africaine.
                            </p>
                        </div>

                        <div className="features-list">
                            {features.map((f, idx) => (
                                <div
                                    key={f.id}
                                    className={`feature-row ${idx % 2 === 1 ? 'feature-row--reverse' : ''}`}
                                >
                                    {/* Visuel */}
                                    <div className="feature-visual" style={{ background: f.bg }}>
                                        {f.icon}
                                    </div>

                                    {/* Texte */}
                                    <div className="feature-content">
                                        <span className="feature-eyebrow" style={{ color: f.accent }}>{f.eyebrow}</span>
                                        <h3 className="feature-title">{f.title}</h3>
                                        <p className="feature-desc">{f.description}</p>
                                        <ul className="feature-items" role="list">
                                            {f.items.map(item => (
                                                <li key={item} className="feature-item">
                                                    <svg viewBox="0 0 16 16" fill="none" className="feature-check" aria-hidden="true">
                                                        <circle cx="8" cy="8" r="7" fill={f.accent} opacity="0.12" />
                                                        <path d="M5 8l2 2 4-4" stroke={f.accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                                    </svg>
                                                    {item}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── 4. HOW IT WORKS ───────────────────────────────────────────────── */}
                <section className="how-section" id="how-it-works" aria-label="Comment ça marche">
                    <div className="container">
                        <div className="section-header">
                            <span className="section-eyebrow">Comment ça marche</span>
                            <h2 className="section-title">Démarrez en<br /><em>3 étapes simples.</em></h2>
                        </div>

                        <div className="steps-grid">
                            {howItWorks.map((step, idx) => (
                                <div key={step.step} className="step-card">
                                    <div className="step-number">{step.step}</div>
                                    {idx < howItWorks.length - 1 && (
                                        <div className="step-connector" aria-hidden="true" />
                                    )}
                                    <h3 className="step-title">{step.title}</h3>
                                    <p className="step-desc">{step.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── 5. PUBLIC CIBLE ───────────────────────────────────────────────── */}
                <section className="audience-section" aria-label="Public cible">
                    <div className="container">
                        <div className="section-header">
                            <span className="section-eyebrow">Pour qui ?</span>
                            <h2 className="section-title">Une solution pour<br /><em>chaque guinéen.</em></h2>
                            <p className="section-desc">
                                Des zones rurales aux grandes villes, MedConnect s'adapte à tous les profils et besoins de santé.
                            </p>
                        </div>

                        <div className="audience-grid">
                            {audiences.map(a => (
                                <div key={a.title} className="audience-card">
                                    <span className="audience-icon" role="img" aria-label={a.title}>{a.icon}</span>
                                    <h3 className="audience-title">{a.title}</h3>
                                    <p className="audience-desc">{a.desc}</p>
                                </div>
                            ))}
                        </div>

                        {/* Citation forte */}
                        <blockquote className="impact-quote">
                            <p>
                                "Imaginez une femme enceinte en zone rurale qui peut, grâce à MedConnect, trouver immédiatement le centre de santé le plus proche et recevoir des conseils médicaux adaptés."
                            </p>
                        </blockquote>
                    </div>
                </section>

                {/* ── 6. CTA FINAL ──────────────────────────────────────────────────── */}
                <section className="final-cta-section" aria-label="Appel à l'action">
                    <div className="container">
                        <div className="final-cta-card">
                            <div className="final-cta-bg" aria-hidden="true" />
                            <span className="section-eyebrow" style={{ color: 'rgba(255,255,255,0.6)' }}>Rejoignez-nous</span>
                            <h2 className="final-cta-title">
                                Votre santé mérite<br />mieux qu'un médecin<br />à 10 000 habitants.
                            </h2>
                            <p className="final-cta-desc">
                                MedConnect est gratuit pour tous les patients. Inscrivez-vous maintenant et accédez à votre dossier médical numérique, à la géolocalisation médicale et à l'assistance d'urgence.
                            </p>
                            <div className="final-cta-buttons">
                                <a href="/register" className="final-btn-primary">
                                    S'inscrire gratuitement
                                    <svg viewBox="0 0 20 20" fill="none" style={{ width: 18, height: 18 }}>
                                        <path d="M4 10h12M12 5l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </a>
                                <a href="/login" className="final-btn-ghost">
                                    Se connecter
                                </a>
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            <Footer />

            {/* ── STYLES ────────────────────────────────────────────────────────────── */}
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

        /* CSS Variables light */
        :root {
          --color-background:        #FFFFFF;
          --color-surface:           #F9FAFB;
          --color-surface-hover:     #F3F4F6;
          --color-foreground:        #111827;
          --color-foreground-muted:  #6B7280;
          --color-foreground-faint:  #9CA3AF;
          --color-border:            #E5E7EB;
          --color-primary:           #5B5BD6;
          --color-primary-hover:     #4A48C4;
          --color-primary-foreground:#FFFFFF;
          --color-primary-subtle:    #EEECFB;
          --color-danger:            #EF4444;
          --color-danger-subtle:     #FEE2E2;
          --color-success:           #22C55E;
          --color-success-subtle:    #DCFCE7;
          --color-warning-subtle:    #FFE4E6;
        }

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .landing-root {
          font-family: 'DM Sans', sans-serif;
          background: var(--color-background);
          color: var(--color-foreground);
          -webkit-font-smoothing: antialiased;
        }

        /* Container */
        .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 24px;
        }

        /* Section header réutilisable */
        .section-header {
          text-align: center;
          max-width: 640px;
          margin: 0 auto 64px;
        }
        .section-eyebrow {
          display: inline-block;
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--color-primary);
          background: var(--color-primary-subtle);
          border-radius: 999px;
          padding: 4px 14px;
          margin-bottom: 16px;
        }
        .section-title {
          font-family: 'DM Serif Display', serif;
          font-size: clamp(2rem, 4vw, 2.75rem);
          line-height: 1.15;
          letter-spacing: -0.025em;
          color: var(--color-foreground);
          margin-bottom: 16px;
        }
        .section-title em {
          font-style: italic;
          color: var(--color-primary);
        }
        .section-desc {
          font-size: 1.0625rem;
          line-height: 1.7;
          color: var(--color-foreground-muted);
        }

        /* ── HERO ──────────────────────────────────────────────────────────── */
        .hero {
          position: relative;
          min-height: 100vh;
          display: flex;
          align-items: center;
          padding: 120px 0 80px;
          overflow: hidden;
        }
        .hero-bg {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 0;
        }
        .hero-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(100px);
        }
        .hero-orb--1 {
          width: 600px; height: 600px;
          background: radial-gradient(circle, rgba(91,91,214,0.08), transparent 70%);
          top: -200px; right: -100px;
        }
        .hero-orb--2 {
          width: 400px; height: 400px;
          background: radial-gradient(circle, rgba(34,197,94,0.06), transparent 70%);
          bottom: -100px; left: 100px;
        }
        .hero-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(91,91,214,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(91,91,214,0.03) 1px, transparent 1px);
          background-size: 48px 48px;
        }

        .hero-inner {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: 1fr;
          gap: 64px;
          align-items: center;
        }
        @media (min-width: 1024px) {
          .hero-inner { grid-template-columns: 1fr 1fr; }
        }

        /* Hero content */
        .hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 0.8125rem;
          font-weight: 500;
          color: var(--color-foreground-muted);
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 999px;
          padding: 6px 14px;
          margin-bottom: 28px;
        }
        .hero-badge-dot {
          width: 7px; height: 7px;
          border-radius: 50%;
          background: var(--color-success);
          box-shadow: 0 0 0 2px rgba(34,197,94,0.2);
          animation: pulse 2s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 2px rgba(34,197,94,0.2); }
          50%       { box-shadow: 0 0 0 5px rgba(34,197,94,0.1); }
        }

        .hero-title {
          font-family: 'DM Serif Display', serif;
          font-size: clamp(2.5rem, 5vw, 4rem);
          line-height: 1.1;
          letter-spacing: -0.03em;
          color: var(--color-foreground);
          margin-bottom: 20px;
        }
        .hero-title-accent {
          color: var(--color-primary);
          font-style: italic;
        }

        .hero-desc {
          font-size: 1.125rem;
          line-height: 1.7;
          color: var(--color-foreground-muted);
          max-width: 500px;
          margin-bottom: 36px;
        }

        .hero-cta {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 16px;
        }
        .cta-primary {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 14px 28px;
          background: var(--color-primary);
          color: #fff;
          font-weight: 600;
          font-size: 1rem;
          text-decoration: none;
          border-radius: 14px;
          box-shadow: 0 4px 20px rgba(91,91,214,0.30);
          transition: background 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
        }
        .cta-primary:hover {
          background: var(--color-primary-hover);
          transform: translateY(-2px);
          box-shadow: 0 6px 28px rgba(91,91,214,0.40);
        }
        .cta-arrow { width: 18px; height: 18px; }
        .cta-secondary {
          padding: 14px 24px;
          color: var(--color-foreground-muted);
          font-weight: 500;
          font-size: 0.9375rem;
          text-decoration: none;
          border: 1px solid var(--color-border);
          border-radius: 14px;
          transition: all 0.15s ease;
        }
        .cta-secondary:hover {
          border-color: var(--color-primary);
          color: var(--color-primary);
          background: var(--color-primary-subtle);
        }
        .hero-hint {
          font-size: 0.8125rem;
          color: var(--color-foreground-faint);
        }

        /* Mockup phone */
        .hero-visual {
          position: relative;
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .mockup-phone {
          position: relative;
          width: 280px;
          background: #fff;
          border-radius: 36px;
          border: 1.5px solid #E5E7EB;
          box-shadow:
            0 0 0 1px rgba(0,0,0,0.04),
            0 24px 80px rgba(0,0,0,0.12),
            0 8px 24px rgba(91,91,214,0.08);
          overflow: hidden;
          padding: 20px 16px 24px;
        }
        .mockup-shine {
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 50%;
          background: linear-gradient(180deg, rgba(255,255,255,0.06) 0%, transparent 100%);
          pointer-events: none;
          border-radius: 36px 36px 0 0;
        }
        .mock-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 14px;
        }
        .mock-title {
          font-size: 0.8125rem;
          font-weight: 600;
          color: #111827;
        }
        .mock-avatar {
          width: 28px; height: 28px;
          border-radius: 50%;
          background: linear-gradient(135deg, #5B5BD6, #7B7FE8);
        }
        .mock-alert {
          display: flex;
          align-items: center;
          gap: 6px;
          background: #FEE2E2;
          border: 1px solid #FECACA;
          border-radius: 8px;
          padding: 8px 10px;
          font-size: 0.6875rem;
          font-weight: 600;
          color: #B91C1C;
          margin-bottom: 14px;
        }
        .mock-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-bottom: 16px;
        }
        .mock-card {
          background: #F9FAFB;
          border: 1px solid #E5E7EB;
          border-radius: 10px;
          padding: 10px 8px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
        }
        .mock-card-icon {
          width: 28px; height: 28px;
          border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
        }
        .mock-card-label {
          font-size: 0.625rem;
          font-weight: 500;
          color: #374151;
          text-align: center;
          line-height: 1.3;
        }
        .mock-section-title {
          font-size: 0.6875rem;
          font-weight: 600;
          color: #374151;
          margin-bottom: 8px;
        }
        .mock-appt {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 7px 0;
          border-bottom: 1px solid #F3F4F6;
        }
        .mock-appt:last-child { border-bottom: none; }
        .mock-appt-icon {
          width: 24px; height: 24px;
          border-radius: 7px;
          background: rgba(91,91,214,0.08);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .mock-appt-info { flex: 1; }
        .mock-appt-name {
          display: block;
          font-size: 0.625rem;
          font-weight: 600;
          color: #111827;
        }
        .mock-appt-date {
          display: block;
          font-size: 0.5625rem;
          color: #9CA3AF;
          margin-top: 2px;
        }
        .mock-appt-badge {
          font-size: 0.5625rem;
          font-weight: 600;
          border-radius: 999px;
          padding: 2px 7px;
          white-space: nowrap;
        }

        /* Badges flottants */
        .float-badge {
          position: absolute;
          display: flex;
          align-items: center;
          gap: 10px;
          background: #fff;
          border: 1px solid var(--color-border);
          border-radius: 14px;
          padding: 10px 14px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.08);
          animation: floatBadge 4s ease-in-out infinite alternate;
        }
        .float-badge--1 { top: 20px; right: -20px; animation-delay: 0s; }
        .float-badge--2 { bottom: 30px; left: -30px; animation-delay: 1.5s; }
        @keyframes floatBadge {
          from { transform: translateY(0); }
          to   { transform: translateY(-8px); }
        }
        .float-icon { font-size: 1.25rem; }
        .float-title {
          display: block;
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--color-foreground);
        }
        .float-sub {
          display: block;
          font-size: 0.6875rem;
          color: var(--color-foreground-muted);
        }

        /* ── STATS ──────────────────────────────────────────────────────────── */
        .stats-section {
          padding: 56px 0;
          background: var(--color-surface);
          border-top: 1px solid var(--color-border);
          border-bottom: 1px solid var(--color-border);
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 2px;
          background: var(--color-border);
          border-radius: 16px;
          overflow: hidden;
        }
        @media (min-width: 768px) {
          .stats-grid { grid-template-columns: repeat(4, 1fr); }
        }
        .stat-card {
          background: var(--color-background);
          padding: 32px 28px;
          text-align: center;
        }
        .stat-value {
          font-family: 'DM Serif Display', serif;
          font-size: clamp(2rem, 4vw, 2.75rem);
          line-height: 1;
          margin-bottom: 8px;
        }
        .stat-unit { font-size: 1.25rem; }
        .stat-label {
          font-size: 0.875rem;
          color: var(--color-foreground-muted);
          line-height: 1.4;
        }

        /* ── FEATURES ───────────────────────────────────────────────────────── */
        .features-section {
          padding: 100px 0;
        }
        .features-list {
          display: flex;
          flex-direction: column;
          gap: 80px;
        }
        .feature-row {
          display: grid;
          grid-template-columns: 1fr;
          gap: 48px;
          align-items: center;
        }
        @media (min-width: 768px) {
          .feature-row { grid-template-columns: 1fr 1fr; }
          .feature-row--reverse .feature-visual { order: 2; }
          .feature-row--reverse .feature-content { order: 1; }
        }
        .feature-visual {
          border-radius: 24px;
          padding: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 280px;
          transition: transform 0.3s ease;
        }
        .feature-visual:hover { transform: scale(1.01); }
        .feature-svg { width: 120px; height: 120px; }

        .feature-eyebrow {
          display: block;
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin-bottom: 12px;
        }
        .feature-title {
          font-family: 'DM Serif Display', serif;
          font-size: clamp(1.5rem, 3vw, 2rem);
          line-height: 1.2;
          letter-spacing: -0.02em;
          color: var(--color-foreground);
          margin-bottom: 14px;
        }
        .feature-desc {
          font-size: 1rem;
          line-height: 1.7;
          color: var(--color-foreground-muted);
          margin-bottom: 24px;
        }
        .feature-items {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .feature-item {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 0.9375rem;
          color: var(--color-foreground);
          font-weight: 500;
        }
        .feature-check { width: 18px; height: 18px; flex-shrink: 0; }

        /* ── HOW IT WORKS ───────────────────────────────────────────────────── */
        .how-section {
          padding: 100px 0;
          background: var(--color-surface);
        }
        .steps-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 32px;
          position: relative;
        }
        @media (min-width: 768px) {
          .steps-grid { grid-template-columns: repeat(3, 1fr); }
        }
        .step-card {
          position: relative;
          text-align: center;
          padding: 40px 24px;
          background: var(--color-background);
          border: 1px solid var(--color-border);
          border-radius: 20px;
          transition: box-shadow 0.2s ease, transform 0.2s ease;
        }
        .step-card:hover {
          box-shadow: 0 4px 24px rgba(91,91,214,0.08);
          transform: translateY(-3px);
        }
        .step-number {
          font-family: 'DM Serif Display', serif;
          font-size: 3rem;
          color: var(--color-primary);
          opacity: 0.15;
          line-height: 1;
          margin-bottom: 20px;
        }
        .step-connector {
          display: none;
          position: absolute;
          top: 50%;
          right: -16px;
          width: 32px;
          height: 2px;
          background: var(--color-border);
          z-index: 1;
        }
        @media (min-width: 768px) { .step-connector { display: block; } }
        .step-title {
          font-family: 'DM Serif Display', serif;
          font-size: 1.25rem;
          color: var(--color-foreground);
          margin-bottom: 10px;
          letter-spacing: -0.01em;
        }
        .step-desc {
          font-size: 0.9375rem;
          line-height: 1.65;
          color: var(--color-foreground-muted);
        }

        /* ── AUDIENCE ───────────────────────────────────────────────────────── */
        .audience-section {
          padding: 100px 0;
        }
        .audience-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
          margin-bottom: 56px;
        }
        @media (min-width: 768px) {
          .audience-grid { grid-template-columns: repeat(4, 1fr); }
        }
        .audience-card {
          padding: 28px 20px;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 16px;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .audience-card:hover {
          border-color: var(--color-primary);
          box-shadow: 0 2px 16px rgba(91,91,214,0.08);
        }
        .audience-icon {
          display: block;
          font-size: 2rem;
          margin-bottom: 14px;
        }
        .audience-title {
          font-family: 'DM Serif Display', serif;
          font-size: 1.125rem;
          color: var(--color-foreground);
          margin-bottom: 8px;
        }
        .audience-desc {
          font-size: 0.875rem;
          line-height: 1.6;
          color: var(--color-foreground-muted);
        }

        /* Citation */
        .impact-quote {
          background: var(--color-primary-subtle);
          border-left: 4px solid var(--color-primary);
          border-radius: 0 16px 16px 0;
          padding: 28px 32px;
          max-width: 720px;
          margin: 0 auto;
        }
        .impact-quote p {
          font-family: 'DM Serif Display', serif;
          font-size: clamp(1.125rem, 2vw, 1.375rem);
          font-style: italic;
          line-height: 1.5;
          color: var(--color-foreground);
          margin-bottom: 12px;
        }
        .impact-quote footer {
          font-size: 0.8125rem;
          color: var(--color-primary);
          font-weight: 600;
        }

        /* ── CTA FINAL ──────────────────────────────────────────────────────── */
        .final-cta-section {
          padding: 80px 0;
        }
        .final-cta-card {
          position: relative;
          background: linear-gradient(135deg, #2B2880 0%, #5B5BD6 50%, #7B7FE8 100%);
          border-radius: 28px;
          padding: 72px 48px;
          text-align: center;
          overflow: hidden;
        }
        .final-cta-bg {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px);
          background-size: 40px 40px;
        }
        .final-cta-title {
          position: relative;
          font-family: 'DM Serif Display', serif;
          font-size: clamp(2rem, 5vw, 3.25rem);
          line-height: 1.15;
          letter-spacing: -0.025em;
          color: #FFFFFF;
          margin: 16px 0 20px;
        }
        .final-cta-desc {
          position: relative;
          font-size: 1.0625rem;
          line-height: 1.7;
          color: rgba(255,255,255,0.7);
          max-width: 520px;
          margin: 0 auto 36px;
        }
        .final-cta-buttons {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .final-btn-primary {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 14px 28px;
          background: #fff;
          color: var(--color-primary);
          font-weight: 700;
          font-size: 1rem;
          text-decoration: none;
          border-radius: 14px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.2);
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .final-btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 28px rgba(0,0,0,0.25);
        }
        .final-btn-ghost {
          padding: 14px 24px;
          color: rgba(255,255,255,0.8);
          font-weight: 500;
          font-size: 0.9375rem;
          text-decoration: none;
          border: 1px solid rgba(255,255,255,0.25);
          border-radius: 14px;
          transition: all 0.15s ease;
        }
        .final-btn-ghost:hover {
          border-color: rgba(255,255,255,0.6);
          color: #fff;
          background: rgba(255,255,255,0.08);
        }
      `}</style>
        </div>
    )
}