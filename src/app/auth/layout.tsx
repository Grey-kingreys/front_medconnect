import Image from "next/image";
import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen flex gradient-hero overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-primary-500/8 rounded-full blur-3xl animate-blob" />
        <div className="absolute bottom-1/4 right-0 w-80 h-80 bg-accent-500/6 rounded-full blur-3xl animate-blob animate-delay-500" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/4 rounded-full blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: "64px 64px",
          }}
        />
      </div>

      {/* Left panel - Branding (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-[40%] relative flex-col justify-between p-12">
        <div className="relative z-10">
          {/* Logo */}
          <Link href="/" className="inline-flex items-center gap-2.5 group">
            <Image
              src="/images/logo.png"
              alt="MedConnect Logo"
              width={40}
              height={40}
              priority
              className="rounded-lg group-hover:scale-105 transition-transform duration-300"
            />
            <span
              className="text-xl font-bold tracking-tight"
              style={{ fontFamily: "var(--font-outfit, var(--font-inter))" }}
            >
              <span className="text-slate-900 dark:text-white">Med</span>
              <span className="gradient-text">Connect</span>
            </span>
          </Link>
        </div>

        {/* Tagline */}
        <div className="relative z-10 space-y-6">
          <h1
            className="text-4xl xl:text-5xl font-extrabold text-slate-900 dark:text-white leading-tight"
            style={{ fontFamily: "var(--font-outfit, var(--font-inter))" }}
          >
            Votre santé,
            <br />
            <span className="gradient-text-hero">connectée</span>
          </h1>
          <p className="text-lg text-slate-500 dark:text-slate-400 max-w-md leading-relaxed">
            Carnet de santé numérique, géolocalisation médicale, urgences et
            diagnostic IA — tout dans votre poche.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-3">
            {["Sécurisé", "Hors-ligne", "Gratuit"].map((tag) => (
              <span
                key={tag}
                className="px-3 py-1.5 text-xs font-medium text-primary-300 bg-primary-500/10 border border-primary-500/20 rounded-full"
              >
                ✓ {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="relative z-10 text-sm text-slate-600">
          © {new Date().getFullYear()} MedConnect. Tous droits réservés.
        </p>
      </div>

      {/* Right panel - Form */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="relative w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex justify-center mb-8">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <Image
                src="/images/logo.png"
                alt="MedConnect Logo"
                width={40}
                height={40}
                priority
                className="rounded-lg"
              />
              <span
                className="text-xl font-bold tracking-tight"
                style={{ fontFamily: "var(--font-outfit, var(--font-inter))" }}
              >
                <span className="text-slate-900 dark:text-white">Med</span>
                <span className="gradient-text">Connect</span>
              </span>
            </Link>
          </div>

          {/* Card */}
          <div className="bg-white dark:bg-[#0f172a]/80 backdrop-blur-2xl border border-slate-200 dark:border-slate-800/60 rounded-3xl p-8 sm:p-10 shadow-2xl shadow-black/10 dark:shadow-black/20">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
