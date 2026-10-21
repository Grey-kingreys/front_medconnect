import {
  Mail,
  Phone,
  MapPin,
} from "lucide-react";
import Image from "next/image";

/* Custom SVG icons for social media (removed from lucide-react) */
function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}

function TwitterIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

function LinkedinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect x="2" y="9" width="4" height="12" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}

/**
 * Seuls les liens ayant une destination réelle sont listés : un `href="#"` en
 * pied de page se comporte comme un lien mort (remonte en haut sans rien faire)
 * et dégrade autant la confiance que le référencement. Les entrées retirées
 * (Mises à jour, À propos, Blog, Carrières, Partenariats, Documentation, Centre
 * d'aide, Communauté, API) seront rétablies quand les pages existeront.
 */
const footerLinks = {
  Produit: [
    { label: "Fonctionnalités", href: "#features" },
    { label: "Tarifs", href: "#pricing" },
    { label: "Télécharger", href: "#cta" },
  ],
  Légal: [
    { label: "Confidentialité", href: "/confidentialite" },
    { label: "CGU", href: "/cgu" },
    { label: "Mentions légales", href: "/mentions-legales" },
    { label: "RGPD", href: "/rgpd" },
  ],
};

// TODO(#24) — en attente du porteur : comptes officiels MedConnecte (le lien
// Facebook pointait vers un profil personnel) et adresse contact@medconnecte.com.
// Tant qu'ils n'existent pas, aucune icône n'est affichée plutôt que des liens morts.
const socialLinks: { icon: typeof FacebookIcon; href: string; label: string }[] = [];

export default function Footer() {
  return (
    <footer className="relative border-t border-[var(--border)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main footer */}
        <div className="py-16 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 lg:gap-12">
          {/* Brand */}
          <div className="col-span-2">
            <a href="/" className="flex items-center gap-2.5 mb-4 group">
              <Image
                src="/images/logo.png"
                alt="MedConnecte Logo"
                width={40}
                height={40}
                className="rounded-xl shadow-lg shadow-primary-500/25 transition-transform duration-300 group-hover:scale-105"
              />
              <span
                className="text-xl font-bold tracking-tight"
                style={{ fontFamily: "var(--font-outfit, var(--font-inter))" }}
              >
                <span className="text-[var(--foreground)]">Med</span>
                <span className="gradient-text">Connecte</span>
              </span>
            </a>
            <p className="text-sm text-[var(--muted)] leading-relaxed max-w-sm mb-6">
              La plateforme de santé connectée qui améliore l&apos;accès aux soins
              en Afrique de l&apos;Ouest. Votre santé mérite le meilleur de la
              technologie.
            </p>

            {/* Contact info */}
            <div className="space-y-2">
              <a
                href="mailto:contact@medconnecte.com"
                className="flex items-center gap-2 text-sm text-[var(--muted)] hover:text-primary-500 transition-colors"
              >
                <Mail className="w-4 h-4" />
                contact@medconnecte.com
              </a>
              <a
                href="tel:+224624815998"
                className="flex items-center gap-2 text-sm text-[var(--muted)] hover:text-primary-500 transition-colors"
              >
                <Phone className="w-4 h-4" />
                +224 624-81-59-98
              </a>
              <span className="flex items-center gap-2 text-sm text-[var(--muted)]">
                <MapPin className="w-4 h-4" />
                Conakry, République de Guinée
              </span>
            </div>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h4 className="text-sm font-semibold text-[var(--foreground)] mb-4 uppercase tracking-wider">
                {title}
              </h4>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-[var(--muted)] hover:text-primary-500 transition-colors duration-200"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="py-6 border-t border-[var(--border)] flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-[var(--muted)]">
            © {new Date().getFullYear()} MedConnecte. Tous droits réservés.
          </p>

          <div className="flex items-center gap-3">
            {socialLinks.map((social) => (
              <a
                key={social.label}
                href={social.href}
                aria-label={social.label}
                className="w-9 h-9 rounded-full bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-[var(--muted)] hover:text-primary-500 hover:border-primary-500/30 hover:bg-primary-500/5 transition-all duration-200"
              >
                <social.icon className="w-4 h-4" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
