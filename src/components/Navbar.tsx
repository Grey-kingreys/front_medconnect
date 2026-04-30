"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Menu,
  X,
  Heart,
  ChevronRight,
  LayoutDashboard,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";

const navLinks = [
  { label: "Fonctionnalités", href: "#features" },
  { label: "Comment ça marche", href: "#how-it-works" },
  { label: "Témoignages", href: "#testimonials" },
  { label: "Tarifs", href: "#pricing" },
];

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { user, isAuthenticated, loading, logout } = useAuth();

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const initials = user
    ? `${user.prenom[0] || ""}${user.nom[0] || ""}`.toUpperCase()
    : "";

  return (
    <header
      id="navbar"
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        isScrolled
          ? "bg-[#0b1120]/95 backdrop-blur-xl shadow-lg shadow-black/10 py-3 border-b border-white/5"
          : "bg-transparent py-5"
      }`}
    >
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        {/* Logo */}
        <a href="#" className="flex items-center gap-2.5 group">
          <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-primary-500/25 group-hover:shadow-primary-500/40 transition-shadow duration-300">
            <Heart className="w-5 h-5 text-white fill-white" />
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary-400 to-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <Heart className="absolute w-5 h-5 text-white fill-white z-10" />
          </div>
          <span
            className="text-xl font-bold tracking-tight"
            style={{ fontFamily: "var(--font-outfit, var(--font-inter))" }}
          >
            <span className="text-white">Med</span>
            <span className="gradient-text">Connect</span>
          </span>
        </a>

        {/* Desktop Nav */}
        <div className="hidden lg:flex items-center gap-1">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="relative px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors duration-300 group"
            >
              {link.label}
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-0.5 bg-gradient-to-r from-primary-500 to-cyan-500 group-hover:w-3/4 transition-all duration-300 rounded-full" />
            </a>
          ))}
        </div>

        {/* Desktop CTA */}
        <div className="hidden lg:flex items-center gap-3">
          <ThemeSwitcher />
          {!loading && isAuthenticated && user ? (
            <>
              {/* Bouton Mon espace */}
              <Link
                href="/dashboard"
                className="group relative inline-flex items-center gap-2.5 px-5 py-2.5 text-sm font-semibold text-white rounded-xl overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-primary-500/25"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-primary-600 to-cyan-500 transition-opacity duration-300" />
                <span className="absolute inset-0 bg-gradient-to-r from-primary-500 to-secondary-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <LayoutDashboard className="relative w-4 h-4" />
                <span className="relative">Mon espace</span>
              </Link>

              {/* Avatar + nom */}
              <div className="flex items-center gap-2 pl-2 border-l border-slate-700/50">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-cyan-500 flex items-center justify-center">
                  <span className="text-xs font-bold text-white">{initials}</span>
                </div>
                <span className="text-sm text-slate-300 font-medium max-w-[100px] truncate">
                  {user.prenom}
                </span>
              </div>
            </>
          ) : !loading ? (
            <>
              <a
                href="/auth/login"
                className="px-5 py-2.5 text-sm font-medium text-slate-300 hover:text-white border border-slate-700 hover:border-slate-500 rounded-xl transition-all duration-300"
              >
                Se connecter
              </a>
              <a
                href="/auth/register"
                className="group relative px-5 py-2.5 text-sm font-semibold text-white rounded-xl overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-primary-500/25"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-primary-600 to-cyan-500 transition-opacity duration-300" />
                <span className="absolute inset-0 bg-gradient-to-r from-primary-500 to-secondary-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <span className="relative flex items-center gap-1.5">
                  Commencer
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-300" />
                </span>
              </a>
            </>
          ) : null}
        </div>

        {/* Mobile toggle */}
        <button
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="lg:hidden p-2 text-slate-300 hover:text-white transition-colors"
          aria-label="Toggle menu"
          id="mobile-menu-toggle"
        >
          {isMobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </nav>

      {/* Mobile Menu */}
      <div
        className={`lg:hidden overflow-hidden transition-all duration-500 ${
          isMobileOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="glass-strong mx-4 mt-3 rounded-2xl p-4 space-y-1 border border-slate-800">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setIsMobileOpen(false)}
              className="block px-4 py-3 text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5 rounded-xl transition-all duration-200"
            >
              {link.label}
            </a>
          ))}
          <div className="pt-3 mt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex justify-between items-center px-4 py-2">
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Thème</span>
              <ThemeSwitcher />
            </div>
            {!loading && isAuthenticated && user ? (
              <>
                {/* Mobile: Mon espace */}
                <Link
                  href="/dashboard"
                  onClick={() => setIsMobileOpen(false)}
                  className="flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-center text-white bg-gradient-to-r from-primary-600 to-cyan-500 rounded-xl hover:shadow-lg transition-all"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  Mon espace
                </Link>
                {/* Mobile: Déconnexion */}
                <button
                  onClick={() => {
                    setIsMobileOpen(false);
                    logout();
                  }}
                  className="flex items-center justify-center gap-2 w-full px-4 py-3 text-sm font-medium text-slate-400 border border-slate-700 rounded-xl hover:bg-white/5 hover:text-emergency-500 hover:border-emergency-500/30 transition-all"
                >
                  <LogOut className="w-4 h-4" />
                  Se déconnecter
                </button>
              </>
            ) : !loading ? (
              <>
                <a
                  href="/auth/login"
                  className="block px-4 py-3 text-sm font-medium text-center text-slate-300 border border-slate-700 rounded-xl hover:bg-white/5 transition-all"
                >
                  Se connecter
                </a>
                <a
                  href="/auth/register"
                  onClick={() => setIsMobileOpen(false)}
                  className="block px-4 py-3 text-sm font-semibold text-center text-white bg-gradient-to-r from-primary-600 to-cyan-500 rounded-xl hover:shadow-lg transition-all"
                >
                  Commencer gratuitement
                </a>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
