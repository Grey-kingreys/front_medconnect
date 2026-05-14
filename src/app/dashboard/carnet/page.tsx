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
  CarnetResume,
  getConsultations,
  getOrdonnances,
  getVaccinations,
  getAnalyses,
  Consultation,
  Ordonnance,
  Vaccination,
  ResultatAnalyse
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
    taille: "Inconnu" as string | number,
    poids: "Inconnu" as string | number,
    genre: "Inconnu" as string,
    contactNom: "",
    contactTelephone: "",
    contactEmail: "",
    dateNaissance: "",
  });
  
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [ordonnances, setOrdonnances] = useState<Ordonnance[]>([]);
  const [vaccinations, setVaccinations] = useState<Vaccination[]>([]);
  const [analyses, setAnalyses] = useState<ResultatAnalyse[]>([]);

  const [newAllergy, setNewAllergy] = useState("");
  const [newPathology, setNewPathology] = useState("");

  const calculateAge = (dateNaissance: string): number => {
    const birthDate = new Date(dateNaissance);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [profRes, resumeRes, consRes, ordRes, vacRes, anaRes] = await Promise.all([
        getProfilMedical(),
        getCarnetResume(),
        getConsultations(),
        getOrdonnances(),
        getVaccinations(),
        getAnalyses()
      ]);
      
      setProfile(profRes.data);
      setResume(resumeRes.data);
      setConsultations(consRes.data);
      setOrdonnances(ordRes.data);
      setVaccinations(vacRes.data);
      setAnalyses(anaRes.data);
      
      if (profRes.data) {
        const safeParse = (val: any) => {
          if (typeof val !== 'string') return val || [];
          try { return JSON.parse(val); } catch { return [val]; }
        };

        setForm({
          groupeSanguin: profRes.data.groupeSanguin,
          allergies: safeParse(profRes.data.allergies),
          pathologies: safeParse(profRes.data.pathologies),
          traitements: safeParse(profRes.data.traitements),
          taille: profRes.data.taille || "",
          poids: profRes.data.poids || "",
          genre: profRes.data.genre || "",
          contactNom: profRes.data.contactNom || "",
          contactTelephone: profRes.data.contactTelephone || "",
          contactEmail: profRes.data.contactEmail || "",
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
        allergies: JSON.stringify(form.allergies),
        pathologies: JSON.stringify(form.pathologies),
        traitements: JSON.stringify(form.traitements),
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
              {/* Âge calculé dynamiquement — jamais la date brute */}
              <span className="flex items-center gap-2">
                <Activity className="w-4 h-4" />
                {(form.dateNaissance || user?.dateNaissance) ? `${calculateAge(form.dateNaissance || (user?.dateNaissance as any))} ans` : "Âge non renseigné"}
              </span>
              <span className="flex items-center gap-2"><UserIcon className="w-4 h-4" /> {form.genre || "Genre non défini"}</span>
              <span className="flex items-center gap-2"><Phone className="w-4 h-4" /> {user?.telephone || "Pas de téléphone"}</span>
              {(form.taille || user?.taille) && <span className="flex items-center gap-2"><Ruler className="w-4 h-4" /> {form.taille || user?.taille} cm</span>}
              {(form.poids || user?.poids) && <span className="flex items-center gap-2"><Scale className="w-4 h-4" /> {form.poids || user?.poids} kg</span>}
            </div>
            
            <div className="pt-4 flex flex-wrap justify-center sm:justify-start gap-3">
              <div className="px-4 py-2 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 flex items-center gap-2">
                <Droplet className="w-4 h-4 text-rose-400" />
                <span className="text-sm font-bold text-white">Groupe {BLOOD_GROUPS.find(g => g.value === form.groupeSanguin)?.label}</span>
              </div>
              <div className="px-4 py-2 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-bold text-white">
                  {(form.poids || user?.poids) || "—"} kg / {(form.taille || user?.taille) || "—"} cm
                </span>
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
            <button className="w-full py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-sm font-bold transition-all">Lancer l&apos;auto-diagnostic</button>
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
                  <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">Proche : Nom complet</label>
                  <input type="text" value={form.contactNom} onChange={e => setForm(p => ({ ...p, contactNom: e.target.value }))} className={inputCls} placeholder="Mamadou Diallo" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">Proche : Téléphone</label>
                  <input type="tel" value={form.contactTelephone} onChange={e => setForm(p => ({ ...p, contactTelephone: e.target.value }))} className={inputCls} placeholder="+224 622 00 00 00" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">Proche : Email</label>
                  <input type="email" value={form.contactEmail} onChange={e => setForm(p => ({ ...p, contactEmail: e.target.value }))} className={inputCls} placeholder="proche@email.com" />
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
                  <p className="text-xs text-slate-500 leading-relaxed">Vos données médicales sont cryptées de bout en bout. Seuls les médecins que vous autorisez lors d&apos;une consultation pourront y accéder temporairement.</p>
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
                      <h3 className="font-bold">Contact d&apos;urgence</h3>
                    </div>
                    <div>
                      <p className="text-white/70 text-xs uppercase font-black tracking-widest mb-1">Personne à prévenir</p>
                      <p className="text-xl font-bold tracking-tight">{form.contactNom || "Non configuré"}</p>
                      <p className="text-sm font-medium">{form.contactTelephone}</p>
                      <p className="text-[10px] opacity-70">{form.contactEmail}</p>
                    </div>
                    <p className="text-rose-100/60 text-[10px] leading-relaxed">Ce numéro sera affiché sur votre écran de verrouillage si vous activez le mode "S.O.S Médical".</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* History Section for Patient */}
      {!editing && (
        <div className="space-y-6">
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-primary-500" /> Votre Historique Médical
          </h3>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Consultations List */}
            <div className="bg-white dark:bg-[#0f172a]/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800/50 rounded-[2rem] p-8 shadow-xl">
              <h4 className="font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary-500" /> Vos Consultations
              </h4>
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin">
                {consultations.map((c) => (
                  <div key={c.id} className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-primary-500/30 transition-all group">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-bold text-primary-500">{new Date(c.dateConsultation).toLocaleDateString('fr-FR')}</span>
                      <span className="text-[10px] bg-slate-200 dark:bg-slate-800 px-2 py-1 rounded-full text-slate-500">{c.structure?.nom || "Externe"}</span>
                    </div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white mb-1">{c.motif}</p>
                    <p className="text-xs text-slate-500 line-clamp-2">{c.diagnostic || "Aucun diagnostic renseigné"}</p>
                    {c.medecinNom && <p className="text-[10px] text-slate-400 mt-2 italic">Par {c.medecinNom}</p>}
                  </div>
                ))}
                {consultations.length === 0 && (
                  <div className="text-center py-10 opacity-50">
                    <Activity className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    <p className="text-sm">Aucune consultation enregistrée</p>
                  </div>
                )}
              </div>
            </div>

            {/* Ordonnances List */}
            <div className="bg-white dark:bg-[#0f172a]/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800/50 rounded-[2rem] p-8 shadow-xl">
              <h4 className="font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-secondary-500" /> Vos Ordonnances
              </h4>
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin">
                {ordonnances.map((o) => (
                  <div key={o.id} className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-secondary-500/30 transition-all">
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-xs font-bold text-secondary-500">{new Date(o.dateEmission).toLocaleDateString('fr-FR')}</span>
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div className="space-y-1">
                      {Array.isArray(o.medicaments) ? o.medicaments.map((m: any, idx: number) => (
                        <p key={idx} className="text-xs text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-secondary-400" />
                          <strong>{m.nom}</strong> — {m.dosage}
                        </p>
                      )) : <p className="text-xs text-slate-500 italic">Format invalide</p>}
                    </div>
                  </div>
                ))}
                {ordonnances.length === 0 && (
                  <div className="text-center py-10 opacity-50">
                    <ClipboardList className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    <p className="text-sm">Aucune ordonnance</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Vaccinations List */}
            <div className="bg-white dark:bg-[#0f172a]/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800/50 rounded-[2rem] p-8 shadow-xl">
              <h4 className="font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                <Droplet className="w-5 h-5 text-accent-500" /> Vos Vaccinations
              </h4>
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin">
                {vaccinations.map((v) => (
                  <div key={v.id} className="flex items-center gap-4 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                    <div className="w-10 h-10 rounded-xl bg-accent-500/10 flex items-center justify-center text-accent-500">
                      <Droplet className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{v.vaccin}</p>
                      <p className="text-[10px] text-slate-500">{new Date(v.dateVaccin).toLocaleDateString('fr-FR')}</p>
                    </div>
                    {v.prochainRappel && (
                      <div className="text-right">
                        <p className="text-[9px] font-black text-slate-400 uppercase">Prochain rappel</p>
                        <p className="text-[10px] font-bold text-amber-500">{new Date(v.prochainRappel).toLocaleDateString('fr-FR')}</p>
                      </div>
                    )}
                  </div>
                ))}
                {vaccinations.length === 0 && <p className="text-center py-6 text-sm text-slate-500 italic">Aucun vaccin</p>}
              </div>
            </div>

            {/* Lab Results (Analyses) */}
            <div className="bg-white dark:bg-[#0f172a]/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800/50 rounded-[2rem] p-8 shadow-xl">
              <h4 className="font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                <Activity className="w-5 h-5 text-rose-500" /> Vos Résultats d&apos;Analyses
              </h4>
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin">
                {analyses.map((a) => (
                  <div key={a.id} className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{a.typeAnalyse}</p>
                      <span className="text-[10px] font-bold text-rose-500">{new Date(a.dateAnalyse).toLocaleDateString('fr-FR')}</span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-1">{a.resultats}</p>
                    {a.laboratoire && <p className="text-[9px] text-slate-500 mt-2 uppercase tracking-wider font-bold">{a.laboratoire}</p>}
                  </div>
                ))}
                {analyses.length === 0 && <p className="text-center py-6 text-sm text-slate-500 italic">Aucune analyse</p>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
