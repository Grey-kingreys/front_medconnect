"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { 
  Heart, 
  Activity, 
  Scale, 
  Ruler, 
  Calendar, 
  AlertCircle, 
  Plus, 
  Edit2, 
  CheckCircle2, 
  Loader2, 
  ShieldAlert,
  Save,
  X,
  Droplet,
  User as UserIcon,
  Phone,
  ClipboardList,
  FileText,
  Bot
} from "lucide-react";
import { 
  getProfilMedical, 
  upsertProfilMedical, 
  ProfilMedical, 
  GroupeSanguin,
  getCarnetResume,
  CarnetResume
} from "@/lib/api_carnet";

const BLOOD_GROUPS: { value: GroupeSanguin; label: string }[] = [
  { value: "A_POSITIF", label: "A+" },
  { value: "A_NEGATIF", label: "A-" },
  { value: "B_POSITIF", label: "B+" },
  { value: "B_NEGATIF", label: "B-" },
  { value: "AB_POSITIF", label: "AB+" },
  { value: "AB_NEGATIF", label: "AB-" },
  { value: "O_POSITIF", label: "O+" },
  { value: "O_NEGATIF", label: "O-" },
  { value: "INCONNU", label: "Inconnu" },
];

export default function CarnetPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfilMedical | null>(null);
  const [resume, setResume] = useState<CarnetResume | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({
    groupeSanguin: "INCONNU" as GroupeSanguin,
    allergies: [] as string[],
    pathologies: [] as string[],
    traitements: [] as string[],
    taille: "" as string | number,
    poids: "" as string | number,
    genre: "" as string,
    contactUrgence: "",
    dateNaissance: "",
  });

  const [newAllergy, setNewAllergy] = useState("");
  const [newPathology, setNewPathology] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [profRes, resumeRes] = await Promise.all([
        getProfilMedical(),
        getCarnetResume()
      ]);
      
      setProfile(profRes.data);
      setResume(resumeRes.data);
      
      if (profRes.data) {
        setForm({
          groupeSanguin: profRes.data.groupeSanguin,
          allergies: profRes.data.allergies,
          pathologies: profRes.data.pathologies,
          traitements: profRes.data.traitements,
          taille: profRes.data.taille || "",
          poids: profRes.data.poids || "",
          genre: profRes.data.genre || "",
          contactUrgence: profRes.data.contactUrgence || "",
          dateNaissance: profRes.data.dateNaissance ? profRes.data.dateNaissance.split('T')[0] : "",
        });
      }
    } catch (err: any) {
      console.error(err);
      setError("Erreur lors du chargement de votre carnet.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await upsertProfilMedical({
        ...form,
        taille: form.taille ? Number(form.taille) : null,
        poids: form.poids ? Number(form.poids) : null,
        dateNaissance: form.dateNaissance || null,
      });
      setSuccess("Carnet de santé mis à jour !");
      setEditing(false);
      fetchData();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message || "Erreur lors de la sauvegarde.");
    } finally {
      setSaving(false);
    }
  };

  const addItem = (listName: "allergies" | "pathologies", value: string, setter: (v: string) => void) => {
    if (!value.trim()) return;
    if (form[listName].includes(value.trim())) return;
    setForm(prev => ({ ...prev, [listName]: [...prev[listName], value.trim()] }));
    setter("");
  };

  const removeItem = (listName: "allergies" | "pathologies", index: number) => {
    setForm(prev => ({
      ...prev,
      [listName]: prev[listName].filter((_, i) => i !== index)
    }));
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-10 h-10 text-primary-500 animate-spin" />
        <p className="text-slate-500 animate-pulse">Chargement de votre carnet de santé...</p>
      </div>
    );
  }

  const inputCls = "w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-500 focus:outline-none focus:border-primary-500/50 text-sm transition-all";

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
      {/* Toast Messages */}
      {success && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl bg-secondary-500/20 border border-secondary-500/30 text-secondary-300 text-sm font-medium animate-slide-up shadow-2xl">
          <CheckCircle2 className="w-4 h-4" /> {success}
        </div>
      )}
      
      {error && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl bg-emergency-500/20 border border-emergency-500/30 text-emergency-300 text-sm font-medium animate-slide-up shadow-2xl">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {/* Header Profile Section */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-primary-600 to-indigo-700 p-8 sm:p-12 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-400/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4" />
        
        <div className="relative flex flex-col sm:flex-row items-center gap-8">
          {/* Avatar */}
          <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-[2rem] bg-white/20 backdrop-blur-xl border border-white/30 flex items-center justify-center shadow-inner group overflow-hidden">
            <span className="text-4xl sm:text-5xl font-black text-white group-hover:scale-110 transition-transform">
              {(user?.prenom?.[0] || "") + (user?.nom?.[0] || "")}
            </span>
          </div>
          
          <div className="flex-1 text-center sm:text-left space-y-2">
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight" style={{ fontFamily: "var(--font-outfit)" }}>
              {user?.prenom} {user?.nom}
            </h1>
            <div className="flex flex-wrap justify-center sm:justify-start gap-4 text-white/80 text-sm">
              <span className="flex items-center gap-2"><Calendar className="w-4 h-4" /> {form.dateNaissance ? new Date(form.dateNaissance).toLocaleDateString('fr-FR') : "Âge inconnu"}</span>
              <span className="flex items-center gap-2"><UserIcon className="w-4 h-4" /> {form.genre || "Genre non défini"}</span>
              <span className="flex items-center gap-2"><Phone className="w-4 h-4" /> {user?.telephone || "Pas de téléphone"}</span>
            </div>
            
            <div className="pt-4 flex flex-wrap justify-center sm:justify-start gap-3">
              <div className="px-4 py-2 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 flex items-center gap-2">
                <Droplet className="w-4 h-4 text-rose-400" />
                <span className="text-sm font-bold text-white">Groupe {BLOOD_GROUPS.find(g => g.value === form.groupeSanguin)?.label}</span>
              </div>
              <div className="px-4 py-2 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-bold text-white">{form.poids || "—"} kg / {form.taille || "—"} cm</span>
              </div>
            </div>
          </div>
          
          <button 
            onClick={() => setEditing(!editing)}
            className="px-6 py-3 bg-white text-primary-600 rounded-2xl font-bold text-sm shadow-xl hover:bg-slate-50 transition-all active:scale-95 flex items-center gap-2"
          >
            {editing ? <><X className="w-4 h-4" /> Annuler</> : <><Edit2 className="w-4 h-4" /> Modifier le carnet</>}
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Quick Stats & Actions */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#0f172a]/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800/50 rounded-[2rem] p-6 shadow-xl">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6">Aperçu Santé</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-primary-500/10 rounded-3xl border border-primary-500/20 text-center space-y-1">
                <p className="text-2xl font-black text-primary-400">{resume?.stats.consultations || 0}</p>
                <p className="text-[10px] font-bold text-slate-500 uppercase">Consultations</p>
              </div>
              <div className="p-4 bg-secondary-500/10 rounded-3xl border border-secondary-500/20 text-center space-y-1">
                <p className="text-2xl font-black text-secondary-400">{resume?.stats.ordonnances || 0}</p>
                <p className="text-[10px] font-bold text-slate-500 uppercase">Ordonnances</p>
              </div>
              <div className="p-4 bg-accent-500/10 rounded-3xl border border-accent-500/20 text-center space-y-1">
                <p className="text-2xl font-black text-accent-400">{resume?.stats.vaccinations || 0}</p>
                <p className="text-[10px] font-bold text-slate-500 uppercase">Vaccins</p>
              </div>
              <div className="p-4 bg-rose-500/10 rounded-3xl border border-rose-500/20 text-center space-y-1">
                <p className="text-2xl font-black text-rose-400">{resume?.stats.analyses || 0}</p>
                <p className="text-[10px] font-bold text-slate-500 uppercase">Analyses</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-slate-900 to-indigo-950 rounded-[2rem] p-8 text-white shadow-2xl relative overflow-hidden group">
            <Bot className="absolute -right-4 -bottom-4 w-32 h-32 opacity-10 group-hover:rotate-12 transition-transform duration-500" />
            <h3 className="text-lg font-bold mb-2">Un symptôme ?</h3>
            <p className="text-slate-400 text-sm mb-6 leading-relaxed">Utilisez notre intelligence artificielle pour un pré-diagnostic rapide et discret.</p>
            <button className="w-full py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-sm font-bold transition-all">Lancer l'auto-diagnostic</button>
          </div>
        </div>

        {/* Right Column: Form or Details */}
        <div className="lg:col-span-2">
          {editing ? (
            <form onSubmit={handleSave} className="bg-white dark:bg-[#0f172a]/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800/50 rounded-[2rem] p-8 shadow-2xl space-y-8 animate-slide-up">
              <div className="flex items-center gap-3 pb-6 border-b border-slate-100 dark:border-slate-800/50">
                <div className="w-10 h-10 rounded-xl bg-primary-500/20 flex items-center justify-center text-primary-400"><Save className="w-5 h-5" /></div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Édition du carnet</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">Groupe Sanguin</label>
                  <select value={form.groupeSanguin} onChange={e => setForm(p => ({ ...p, groupeSanguin: e.target.value as GroupeSanguin }))} className={inputCls}>
                    {BLOOD_GROUPS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">Genre</label>
                  <select value={form.genre} onChange={e => setForm(p => ({ ...p, genre: e.target.value }))} className={inputCls}>
                    <option value="">Non défini</option>
                    <option value="M">Masculin</option>
                    <option value="F">Féminin</option>
                    <option value="Autre">Autre</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">Date de naissance</label>
                  <input type="date" value={form.dateNaissance} onChange={e => setForm(p => ({ ...p, dateNaissance: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">Contact d'urgence</label>
                  <input type="text" value={form.contactUrgence} onChange={e => setForm(p => ({ ...p, contactUrgence: e.target.value }))} className={inputCls} placeholder="Nom - Téléphone" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">Taille (cm)</label>
                  <div className="relative">
                    <Ruler className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input type="number" value={form.taille} onChange={e => setForm(p => ({ ...p, taille: e.target.value }))} className={`${inputCls} pl-12`} placeholder="175" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">Poids (kg)</label>
                  <div className="relative">
                    <Scale className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input type="number" step="0.1" value={form.poids} onChange={e => setForm(p => ({ ...p, poids: e.target.value }))} className={`${inputCls} pl-12`} placeholder="70.5" />
                  </div>
                </div>
              </div>

              {/* Tags Section: Allergies & Pathologies */}
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">Allergies</label>
                  <div className="flex gap-2 mb-3">
                    <input type="text" value={newAllergy} onChange={e => setNewAllergy(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addItem('allergies', newAllergy, setNewAllergy))} className={inputCls} placeholder="Ajouter une allergie..." />
                    <button type="button" onClick={() => addItem('allergies', newAllergy, setNewAllergy)} className="px-4 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"><Plus className="w-5 h-5" /></button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {form.allergies.map((a, i) => (
                      <span key={i} className="px-3 py-1.5 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-full text-xs font-bold flex items-center gap-2">
                        {a} <button type="button" onClick={() => removeItem('allergies', i)}><X className="w-3 h-3" /></button>
                      </span>
                    ))}
                    {form.allergies.length === 0 && <span className="text-xs text-slate-500 italic">Aucune allergie répertoriée</span>}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">Pathologies (Maladies chroniques)</label>
                  <div className="flex gap-2 mb-3">
                    <input type="text" value={newPathology} onChange={e => setNewPathology(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addItem('pathologies', newPathology, setNewPathology))} className={inputCls} placeholder="Ex: Asthme, Diabète..." />
                    <button type="button" onClick={() => addItem('pathologies', newPathology, setNewPathology)} className="px-4 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"><Plus className="w-5 h-5" /></button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {form.pathologies.map((p, i) => (
                      <span key={i} className="px-3 py-1.5 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-full text-xs font-bold flex items-center gap-2">
                        {p} <button type="button" onClick={() => removeItem('pathologies', i)}><X className="w-3 h-3" /></button>
                      </span>
                    ))}
                    {form.pathologies.length === 0 && <span className="text-xs text-slate-500 italic">Aucune pathologie déclarée</span>}
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-6 border-t border-slate-100 dark:border-slate-800/50">
                <button type="button" onClick={() => setEditing(false)} className="flex-1 py-4 px-6 rounded-2xl font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 transition-all">Annuler</button>
                <button type="submit" disabled={saving} className="flex-[2] py-4 px-6 bg-gradient-to-r from-primary-600 to-indigo-600 rounded-2xl font-bold text-white shadow-xl shadow-primary-500/20 hover:opacity-90 transition-all flex items-center justify-center gap-2">
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  {saving ? "Enregistrement..." : "Mettre à jour mon carnet"}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              {/* Profile Details Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Allergies Card */}
                <div className="bg-white dark:bg-[#0f172a]/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800/50 rounded-[2rem] p-8 shadow-xl relative overflow-hidden group">
                  <div className="absolute -top-4 -right-4 w-24 h-24 bg-rose-500/5 rounded-full blur-2xl group-hover:bg-rose-500/10 transition-colors" />
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-500"><AlertCircle className="w-6 h-6" /></div>
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white">Allergies</h3>
                      <p className="text-xs text-slate-500">{form.allergies.length} signalée(s)</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {form.allergies.map((a, i) => (
                      <span key={i} className="px-3 py-1.5 bg-rose-500/5 border border-rose-500/10 text-rose-400 rounded-xl text-xs font-bold">{a}</span>
                    ))}
                    {form.allergies.length === 0 && <p className="text-sm text-slate-500 italic">Aucune allergie déclarée.</p>}
                  </div>
                </div>

                {/* Pathologies Card */}
                <div className="bg-white dark:bg-[#0f172a]/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800/50 rounded-[2rem] p-8 shadow-xl relative overflow-hidden group">
                  <div className="absolute -top-4 -right-4 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl group-hover:bg-amber-500/10 transition-colors" />
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500"><Activity className="w-6 h-6" /></div>
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white">Pathologies</h3>
                      <p className="text-xs text-slate-500">{form.pathologies.length} maladie(s) chronique(s)</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {form.pathologies.map((p, i) => (
                      <span key={i} className="px-3 py-1.5 bg-amber-500/5 border border-amber-500/10 text-amber-400 rounded-xl text-xs font-bold">{p}</span>
                    ))}
                    {form.pathologies.length === 0 && <p className="text-sm text-slate-500 italic">Aucune pathologie déclarée.</p>}
                  </div>
                </div>
              </div>

              {/* Informational Alerts */}
              <div className="p-6 bg-slate-900 rounded-[2rem] border border-slate-800 flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary-500/20 flex items-center justify-center text-primary-400 shrink-0"><ShieldAlert className="w-6 h-6" /></div>
                <div>
                  <h4 className="text-sm font-bold text-white mb-1">Confidentialité de vos données</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">Vos données médicales sont cryptées de bout en bout. Seuls les médecins que vous autorisez lors d'une consultation pourront y accéder temporairement.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Traitements Section */}
                <div className="bg-white dark:bg-[#0f172a]/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800/50 rounded-[2rem] p-8 shadow-xl">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500"><ClipboardList className="w-6 h-6" /></div>
                    <h3 className="font-bold text-slate-900 dark:text-white">Traitements en cours</h3>
                  </div>
                  <div className="space-y-3">
                    {form.traitements.map((t, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        <span className="text-sm text-slate-700 dark:text-slate-300">{t}</span>
                      </div>
                    ))}
                    {form.traitements.length === 0 && <p className="text-sm text-slate-500 italic">Aucun traitement en cours.</p>}
                  </div>
                </div>

                {/* Emergency Card */}
                <div className="bg-gradient-to-br from-rose-500 to-emergency-600 rounded-[2rem] p-8 text-white shadow-2xl relative overflow-hidden group">
                  <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10" />
                  <div className="relative z-10 space-y-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center"><Phone className="w-6 h-6" /></div>
                      <h3 className="font-bold">Contact d'urgence</h3>
                    </div>
                    <div>
                      <p className="text-white/70 text-xs uppercase font-black tracking-widest mb-1">Personne à prévenir</p>
                      <p className="text-xl font-bold tracking-tight">{form.contactUrgence || "Non configuré"}</p>
                    </div>
                    <p className="text-rose-100/60 text-[10px] leading-relaxed">Ce numéro sera affiché sur votre écran de verrouillage si vous activez le mode "S.O.S Médical".</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
