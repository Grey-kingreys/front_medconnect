"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  updateProfile,
  changePassword,
  ApiError,
  type UserProfile,
} from "@/lib/api_auth";
import {
  User,
  Mail,
  Phone,
  Shield,
  Building2,
  Calendar,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Lock,
  Eye,
  EyeOff,
  Pencil,
  X,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────

function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    PATIENT: "Patient",
    MEDECIN: "Médecin",
    PHARMACIEN: "Pharmacien",
    STRUCTURE_ADMIN: "Admin Structure",
    ADMIN: "Administrateur",
    SUPER_ADMIN: "Super Admin",
  };
  return labels[role] || role;
}

function getRoleGradient(role: string): string {
  const colors: Record<string, string> = {
    PATIENT: "from-primary-500 to-cyan-500",
    MEDECIN: "from-secondary-500 to-cyan-500",
    PHARMACIEN: "from-accent-500 to-primary-500",
    STRUCTURE_ADMIN: "from-amber-500 to-orange-500",
    ADMIN: "from-primary-600 to-accent-500",
    SUPER_ADMIN: "from-emergency-500 to-accent-500",
  };
  return colors[role] || "from-primary-500 to-cyan-500";
}

// ─── Page ───────────────────────────────────────────────────────

export default function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth();

  // Form state
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    nom: "",
    prenom: "",
    email: "",
    telephone: "",
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");

  // Password form
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  // Initialize form with profile data
  useEffect(() => {
    if (profile) {
      setForm({
        nom: profile.nom || "",
        prenom: profile.prenom || "",
        email: profile.email || "",
        telephone: profile.telephone || "",
      });
    }
  }, [profile]);

  if (!user || !profile) return null;

  const roleGradient = getRoleGradient(user.role);
  const roleLabel = getRoleLabel(user.role);
  const initials = `${user.prenom[0] || ""}${user.nom[0] || ""}`.toUpperCase();

  // ─── Handlers ───────────────────────────────────────────────

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (saveError) setSaveError("");
    if (saveSuccess) setSaveSuccess("");
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError("");
    setSaveSuccess("");
    setSaving(true);

    try {
      const updateData: Record<string, string> = {};
      if (form.nom !== profile.nom) updateData.nom = form.nom;
      if (form.prenom !== profile.prenom) updateData.prenom = form.prenom;
      if (form.email !== profile.email) updateData.email = form.email;
      if (form.telephone !== (profile.telephone || ""))
        updateData.telephone = form.telephone;

      if (Object.keys(updateData).length === 0) {
        setSaveSuccess("Aucune modification détectée.");
        setSaving(false);
        setEditing(false);
        return;
      }

      await updateProfile(updateData);
      await refreshProfile();
      setSaveSuccess("Profil mis à jour avec succès !");
      setEditing(false);
    } catch (err) {
      if (err instanceof ApiError) {
        setSaveError(err.message);
      } else {
        setSaveError("Une erreur est survenue lors de la mise à jour.");
      }
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPasswordForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (passwordError) setPasswordError("");
    if (passwordSuccess) setPasswordSuccess("");
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("Les mots de passe ne correspondent pas.");
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      setPasswordError("Le nouveau mot de passe doit contenir au moins 8 caractères.");
      return;
    }

    setPasswordSaving(true);

    try {
      await changePassword(
        passwordForm.currentPassword,
        passwordForm.newPassword
      );
      setPasswordSuccess("Mot de passe modifié avec succès !");
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setShowPasswordForm(false);
    } catch (err) {
      if (err instanceof ApiError) {
        setPasswordError(err.message);
      } else {
        setPasswordError("Une erreur est survenue.");
      }
    } finally {
      setPasswordSaving(false);
    }
  };

  const cancelEdit = () => {
    setForm({
      nom: profile.nom || "",
      prenom: profile.prenom || "",
      email: profile.email || "",
      telephone: profile.telephone || "",
    });
    setEditing(false);
    setSaveError("");
    setSaveSuccess("");
  };

  // ─── Render ───────────────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
      {/* Page Title */}
      <div>
        <h1
          className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white"
          style={{ fontFamily: "var(--font-outfit, var(--font-inter))" }}
        >
          Mon Profil
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Gérez vos informations personnelles et la sécurité de votre compte
        </p>
      </div>

      {/* Profile Header Card */}
      <div className="relative overflow-hidden rounded-3xl bg-slate-100 dark:bg-gradient-to-br dark:from-[#0f172a] dark:to-[#1e1b4b] border border-slate-200 dark:border-slate-800/50 p-6 sm:p-8">
        {/* Background decorations */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-accent-500/8 rounded-full blur-3xl" />
        </div>

        <div className="relative flex flex-col sm:flex-row items-center sm:items-start gap-6">
          {/* Avatar */}
          <div className={`relative flex-shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br ${roleGradient} flex items-center justify-center shadow-2xl`}>
            <span className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">{initials}</span>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-secondary-500 rounded-full border-3 border-[#0f172a] flex items-center justify-center">
              <CheckCircle2 className="w-3 h-3 text-slate-900 dark:text-white" />
            </div>
          </div>

          {/* Info */}
          <div className="text-center sm:text-left flex-1">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
              {profile.prenom} {profile.nom}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{profile.email}</p>
            <div className="mt-3 flex flex-wrap items-center justify-center sm:justify-start gap-3">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-gradient-to-r ${roleGradient} text-slate-900 dark:text-white`}>
                <Shield className="w-3 h-3" />
                {roleLabel}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-800/50 rounded-full border border-slate-700/50">
                <Calendar className="w-3 h-3" />
                Membre depuis{" "}
                {new Date(profile.createdAt).toLocaleDateString("fr-FR", {
                  month: "long",
                  year: "numeric",
                })}
              </span>
            </div>
            {profile.structure && (
              <div className="mt-3 flex items-center gap-2 justify-center sm:justify-start text-sm text-slate-500">
                <Building2 className="w-4 h-4 text-secondary-400" />
                <span>
                  {profile.structure.nom} — {profile.structure.type.toLowerCase()}
                </span>
              </div>
            )}
          </div>

          {/* Edit Button */}
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-primary-400 bg-primary-500/10 border border-primary-500/20 hover:bg-primary-500/20 transition-all duration-200"
            >
              <Pencil className="w-4 h-4" />
              Modifier
            </button>
          )}
        </div>
      </div>

      {/* Success / Error alerts */}
      {saveSuccess && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-secondary-500/10 border border-secondary-500/20 text-secondary-400 text-sm animate-slide-up">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>{saveSuccess}</span>
        </div>
      )}
      {saveError && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-emergency-500/10 border border-emergency-500/20 text-emergency-500 text-sm animate-slide-up">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      {/* Profile Form */}
      <div className="bg-white dark:bg-[#0f172a]/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800/50 rounded-3xl p-6 sm:p-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white" style={{ fontFamily: "var(--font-outfit, var(--font-inter))" }}>
            Informations personnelles
          </h3>
          {editing && (
            <button
              onClick={cancelEdit}
              className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white transition-colors"
            >
              <X className="w-4 h-4" />
              Annuler
            </button>
          )}
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Nom */}
            <div>
              <label htmlFor="nom" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
                Nom
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  id="nom"
                  name="nom"
                  type="text"
                  value={form.nom}
                  onChange={handleFormChange}
                  disabled={!editing}
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-900/60 border border-slate-700/50 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-600 focus:outline-none focus:border-primary-500/50 focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            {/* Prénom */}
            <div>
              <label htmlFor="prenom" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
                Prénom
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  id="prenom"
                  name="prenom"
                  type="text"
                  value={form.prenom}
                  onChange={handleFormChange}
                  disabled={!editing}
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-900/60 border border-slate-700/50 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-600 focus:outline-none focus:border-primary-500/50 focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
              Adresse email
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                id="email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleFormChange}
                disabled={!editing}
                className="w-full pl-12 pr-4 py-3.5 bg-slate-900/60 border border-slate-700/50 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-600 focus:outline-none focus:border-primary-500/50 focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {/* Téléphone */}
          <div>
            <label htmlFor="telephone" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
              Téléphone
            </label>
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                id="telephone"
                name="telephone"
                type="tel"
                value={form.telephone}
                onChange={handleFormChange}
                disabled={!editing}
                placeholder="Non renseigné"
                className="w-full pl-12 pr-4 py-3.5 bg-slate-900/60 border border-slate-700/50 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-600 focus:outline-none focus:border-primary-500/50 focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {/* Save button */}
          {editing && (
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={saving}
                className="group relative flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-slate-900 dark:text-white overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-primary-500/25 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-primary-600 to-cyan-500" />
                <span className="absolute inset-0 bg-gradient-to-r from-primary-500 to-secondary-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <span className="relative flex items-center gap-2">
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {saving ? "Enregistrement..." : "Enregistrer"}
                </span>
              </button>
            </div>
          )}
        </form>
      </div>

      {/* Password Section */}
      <div className="bg-white dark:bg-[#0f172a]/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800/50 rounded-3xl p-6 sm:p-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white" style={{ fontFamily: "var(--font-outfit, var(--font-inter))" }}>
            Sécurité
          </h3>
        </div>

        {!showPasswordForm ? (
          <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-900/40 border border-slate-200 dark:border-slate-800/50">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-slate-800/50 text-slate-500 dark:text-slate-400">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white">Mot de passe</p>
                <p className="text-xs text-slate-500">
                  Dernière modification :{" "}
                  {new Date(profile.updatedAt).toLocaleDateString("fr-FR")}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowPasswordForm(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-accent-400 bg-accent-500/10 border border-accent-500/20 hover:bg-accent-500/20 transition-all duration-200"
            >
              <Lock className="w-4 h-4" />
              Changer
            </button>
          </div>
        ) : (
          <form onSubmit={handleSavePassword} className="space-y-5">
            {/* Password error / success */}
            {passwordError && (
              <div className="flex items-center gap-3 p-4 rounded-2xl bg-emergency-500/10 border border-emergency-500/20 text-emergency-500 text-sm">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}
            {passwordSuccess && (
              <div className="flex items-center gap-3 p-4 rounded-2xl bg-secondary-500/10 border border-secondary-500/20 text-secondary-400 text-sm">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                <span>{passwordSuccess}</span>
              </div>
            )}

            {/* Current Password */}
            <div>
              <label htmlFor="currentPassword" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
                Mot de passe actuel
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  id="currentPassword"
                  name="currentPassword"
                  type={showPasswords.current ? "text" : "password"}
                  value={passwordForm.currentPassword}
                  onChange={handlePasswordChange}
                  required
                  className="w-full pl-12 pr-12 py-3.5 bg-slate-900/60 border border-slate-700/50 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-600 focus:outline-none focus:border-primary-500/50 focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 text-sm"
                />
                <button
                  type="button"
                  onClick={() =>
                    setShowPasswords((p) => ({ ...p, current: !p.current }))
                  }
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-600 dark:text-slate-300 transition-colors"
                >
                  {showPasswords.current ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
                Nouveau mot de passe
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  id="newPassword"
                  name="newPassword"
                  type={showPasswords.new ? "text" : "password"}
                  value={passwordForm.newPassword}
                  onChange={handlePasswordChange}
                  required
                  minLength={8}
                  className="w-full pl-12 pr-12 py-3.5 bg-slate-900/60 border border-slate-700/50 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-600 focus:outline-none focus:border-primary-500/50 focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 text-sm"
                />
                <button
                  type="button"
                  onClick={() =>
                    setShowPasswords((p) => ({ ...p, new: !p.new }))
                  }
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-600 dark:text-slate-300 transition-colors"
                >
                  {showPasswords.new ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
                Confirmer le nouveau mot de passe
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showPasswords.confirm ? "text" : "password"}
                  value={passwordForm.confirmPassword}
                  onChange={handlePasswordChange}
                  required
                  minLength={8}
                  className="w-full pl-12 pr-12 py-3.5 bg-slate-900/60 border border-slate-700/50 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-600 focus:outline-none focus:border-primary-500/50 focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 text-sm"
                />
                <button
                  type="button"
                  onClick={() =>
                    setShowPasswords((p) => ({ ...p, confirm: !p.confirm }))
                  }
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-600 dark:text-slate-300 transition-colors"
                >
                  {showPasswords.confirm ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowPasswordForm(false);
                  setPasswordError("");
                  setPasswordSuccess("");
                  setPasswordForm({
                    currentPassword: "",
                    newPassword: "",
                    confirmPassword: "",
                  });
                }}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white hover:bg-slate-800/50 transition-all duration-200"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={passwordSaving}
                className="group relative flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-slate-900 dark:text-white overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-accent-500/25 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-accent-600 to-primary-500" />
                <span className="absolute inset-0 bg-gradient-to-r from-accent-500 to-primary-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <span className="relative flex items-center gap-2">
                  {passwordSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Lock className="w-4 h-4" />
                  )}
                  {passwordSaving ? "Modification..." : "Changer le mot de passe"}
                </span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Account Info */}
      <div className="bg-white dark:bg-[#0f172a]/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800/50 rounded-3xl p-6 sm:p-8">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-6" style={{ fontFamily: "var(--font-outfit, var(--font-inter))" }}>
          Informations du compte
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-200 dark:border-slate-800/50">
            <p className="text-xs text-slate-500 mb-1">Identifiant</p>
            <p className="text-sm text-slate-900 dark:text-white font-mono truncate">{profile.id}</p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-200 dark:border-slate-800/50">
            <p className="text-xs text-slate-500 mb-1">Rôle</p>
            <p className="text-sm text-slate-900 dark:text-white">{roleLabel}</p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-200 dark:border-slate-800/50">
            <p className="text-xs text-slate-500 mb-1">Compte créé le</p>
            <p className="text-sm text-slate-900 dark:text-white">
              {new Date(profile.createdAt).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-200 dark:border-slate-800/50">
            <p className="text-xs text-slate-500 mb-1">Dernière modification</p>
            <p className="text-sm text-slate-900 dark:text-white">
              {new Date(profile.updatedAt).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
