"use client";

import { useState } from "react";
import { 
  X, Plus, ClipboardList, Pill, Syringe, Calendar, 
  Loader2, CheckCircle2, AlertCircle, Save
} from "lucide-react";
import { 
  createConsultation, createOrdonnance, createVaccination, createRendezVous 
} from "@/lib/api_carnet";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

const Modal = ({ isOpen, onClose, title, icon, children }: ModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white dark:bg-[#0f172a] rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in duration-300">
        <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary-500/10 flex items-center justify-center text-primary-500">
              {icon}
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">{title}</h3>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Nouveau document</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
            <X className="w-6 h-6 text-slate-400" />
          </button>
        </div>
        <div className="p-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
};

interface AddRecordFormsProps {
  patientId: string;
  onSuccess: () => void;
}

export default function AddRecordForms({ patientId, onSuccess }: AddRecordFormsProps) {
  const [activeModal, setActiveModal] = useState<"consultation" | "ordonnance" | "vaccin" | "rendezvous" | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const resetState = () => {
    setActiveModal(null);
    setLoading(false);
    setSuccess(false);
  };

  const handleSuccess = () => {
    setSuccess(true);
    setTimeout(() => {
      onSuccess();
      resetState();
    }, 2000);
  };

  // ─── Consultation Form ──────────────────────────────────────────
  const ConsultationForm = () => {
    const [form, setForm] = useState({
      motif: "",
      diagnostic: "",
      notes: "",
      dateConsultation: new Date().toISOString().split('T')[0]
    });

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      try {
        await createConsultation({ ...form, patientId });
        handleSuccess();
      } catch (err) {
        console.error(err);
        alert("Erreur lors de la création de la consultation");
        setLoading(false);
      }
    };

    return (
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Motif de consultation</label>
          <textarea 
            required
            className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl focus:ring-2 focus:ring-primary-500 outline-none transition-all resize-none h-24"
            placeholder="Ex: Fièvre persistante, maux de gorge..."
            value={form.motif}
            onChange={e => setForm({...form, motif: e.target.value})}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Date</label>
            <input 
              type="date"
              className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl focus:ring-2 focus:ring-primary-500 outline-none transition-all"
              value={form.dateConsultation}
              onChange={e => setForm({...form, dateConsultation: e.target.value})}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Diagnostic (Optionnel)</label>
            <input 
              className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl focus:ring-2 focus:ring-primary-500 outline-none transition-all"
              placeholder="Ex: Grippe saisonnière"
              value={form.diagnostic}
              onChange={e => setForm({...form, diagnostic: e.target.value})}
            />
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Notes & Observations</label>
          <textarea 
            className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl focus:ring-2 focus:ring-primary-500 outline-none transition-all resize-none h-32"
            placeholder="Repos recommandé, hydratation..."
            value={form.notes}
            onChange={e => setForm({...form, notes: e.target.value})}
          />
        </div>
        <button 
          disabled={loading}
          className="w-full py-4 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-400 text-white rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl shadow-primary-600/20 transition-all active:scale-95"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5" /> Enregistrer la consultation</>}
        </button>
      </form>
    );
  };

  // ─── Ordonnance Form ─────────────────────────────────────────────
  const OrdonnanceForm = () => {
    const [medicaments, setMedicaments] = useState([{ nom: "", dosage: "", duree: "", instructions: "" }]);
    const [notes, setNotes] = useState("");

    const addMedicament = () => setMedicaments([...medicaments, { nom: "", dosage: "", duree: "", instructions: "" }]);
    const removeMedicament = (index: number) => setMedicaments(medicaments.filter((_, i) => i !== index));

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      try {
        await createOrdonnance({ patientId, medicaments, notes });
        handleSuccess();
      } catch (err) {
        console.error(err);
        alert("Erreur lors de la création de l'ordonnance");
        setLoading(false);
      }
    };

    return (
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Médicaments</label>
            <button type="button" onClick={addMedicament} className="text-xs font-black text-primary-600 hover:text-primary-700 flex items-center gap-1">
              <Plus className="w-4 h-4" /> Ajouter
            </button>
          </div>
          {medicaments.map((m, i) => (
            <div key={i} className="p-6 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-4 relative group">
              {medicaments.length > 1 && (
                <button type="button" onClick={() => removeMedicament(i)} className="absolute top-4 right-4 p-1 text-slate-400 hover:text-rose-500 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input 
                  required
                  className="w-full p-3 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-xl outline-none"
                  placeholder="Nom du médicament"
                  value={m.nom}
                  onChange={e => {
                    const newMeds = [...medicaments];
                    newMeds[i].nom = e.target.value;
                    setMedicaments(newMeds);
                  }}
                />
                <input 
                  required
                  className="w-full p-3 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-xl outline-none"
                  placeholder="Dosage (ex: 1 mat, 1 soir)"
                  value={m.dosage}
                  onChange={e => {
                    const newMeds = [...medicaments];
                    newMeds[i].dosage = e.target.value;
                    setMedicaments(newMeds);
                  }}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input 
                  required
                  className="w-full p-3 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-xl outline-none"
                  placeholder="Durée (ex: 5 jours)"
                  value={m.duree}
                  onChange={e => {
                    const newMeds = [...medicaments];
                    newMeds[i].duree = e.target.value;
                    setMedicaments(newMeds);
                  }}
                />
                <input 
                  className="w-full p-3 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-xl outline-none"
                  placeholder="Instructions (ex: avant repas)"
                  value={m.instructions}
                  onChange={e => {
                    const newMeds = [...medicaments];
                    newMeds[i].instructions = e.target.value;
                    setMedicaments(newMeds);
                  }}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Notes (Optionnel)</label>
          <textarea 
            className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl outline-none resize-none h-20"
            placeholder="Conseils supplémentaires..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>
        <button 
          disabled={loading}
          className="w-full py-4 bg-secondary-600 hover:bg-secondary-700 disabled:bg-slate-400 text-white rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl shadow-secondary-600/20 transition-all active:scale-95"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5" /> Générer l'ordonnance</>}
        </button>
      </form>
    );
  };

  // ─── Vaccination Form ───────────────────────────────────────────
  const VaccinForm = () => {
    const [form, setForm] = useState({
      vaccin: "",
      dateVaccin: new Date().toISOString().split('T')[0],
      prochainRappel: "",
      lotNumero: "",
      notes: ""
    });

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      try {
        await createVaccination({ ...form, patientId });
        handleSuccess();
      } catch (err) {
        console.error(err);
        alert("Erreur lors de l'enregistrement du vaccin");
        setLoading(false);
      }
    };

    return (
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Nom du vaccin</label>
          <input 
            required
            className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl outline-none"
            placeholder="Ex: BCG, Pfizer, Fièvre Jaune..."
            value={form.vaccin}
            onChange={e => setForm({...form, vaccin: e.target.value})}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Date d'administration</label>
            <input 
              type="date"
              className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl outline-none"
              value={form.dateVaccin}
              onChange={e => setForm({...form, dateVaccin: e.target.value})}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Prochain rappel</label>
            <input 
              type="date"
              className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl outline-none"
              value={form.prochainRappel}
              onChange={e => setForm({...form, prochainRappel: e.target.value})}
            />
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Numéro de lot</label>
          <input 
            className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl outline-none"
            placeholder="Ex: LOT12345"
            value={form.lotNumero}
            onChange={e => setForm({...form, lotNumero: e.target.value})}
          />
        </div>
        <button 
          disabled={loading}
          className="w-full py-4 bg-accent-600 hover:bg-accent-700 disabled:bg-slate-400 text-white rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl shadow-accent-600/20 transition-all active:scale-95"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5" /> Enregistrer la vaccination</>}
        </button>
      </form>
    );
  };

  // ─── Rendez-vous Form ────────────────────────────────────────────
  const RendezVousForm = () => {
    const [form, setForm] = useState({
      date: "",
      motif: "",
      notes: ""
    });

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      try {
        await createRendezVous({ ...form, patientId });
        handleSuccess();
      } catch (err) {
        console.error(err);
        alert("Erreur lors de la programmation du rendez-vous");
        setLoading(false);
      }
    };

    return (
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Motif du rendez-vous</label>
          <input 
            required
            className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl outline-none"
            placeholder="Ex: Consultation de suivi, Résultat d'analyse..."
            value={form.motif}
            onChange={e => setForm({...form, motif: e.target.value})}
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Date et Heure</label>
          <input 
            type="datetime-local"
            required
            className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl outline-none"
            value={form.date}
            onChange={e => setForm({...form, date: e.target.value})}
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Notes (Optionnel)</label>
          <textarea 
            className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl outline-none resize-none h-24"
            placeholder="Instructions pour le patient..."
            value={form.notes}
            onChange={e => setForm({...form, notes: e.target.value})}
          />
        </div>
        <button 
          disabled={loading}
          className="w-full py-4 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl transition-all active:scale-95"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Calendar className="w-5 h-5" /> Programmer le RDV</>}
        </button>
      </form>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4">
        <button 
          onClick={() => setActiveModal("consultation")}
          className="flex-1 min-w-[200px] p-6 bg-primary-500 text-white rounded-[2rem] shadow-lg shadow-primary-500/20 hover:scale-105 transition-all flex flex-col gap-4 items-start group"
        >
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center group-hover:rotate-12 transition-transform">
            <ClipboardList className="w-6 h-6" />
          </div>
          <div className="text-left">
            <p className="font-black text-lg">Consultation</p>
            <p className="text-xs text-white/70">Ajouter un diagnostic</p>
          </div>
        </button>

        <button 
          onClick={() => setActiveModal("ordonnance")}
          className="flex-1 min-w-[200px] p-6 bg-secondary-500 text-white rounded-[2rem] shadow-lg shadow-secondary-500/20 hover:scale-105 transition-all flex flex-col gap-4 items-start group"
        >
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center group-hover:rotate-12 transition-transform">
            <Pill className="w-6 h-6" />
          </div>
          <div className="text-left">
            <p className="font-black text-lg">Ordonnance</p>
            <p className="text-xs text-white/70">Prescrire des médicaments</p>
          </div>
        </button>

        <button 
          onClick={() => setActiveModal("vaccin")}
          className="flex-1 min-w-[200px] p-6 bg-accent-500 text-white rounded-[2rem] shadow-lg shadow-accent-500/20 hover:scale-105 transition-all flex flex-col gap-4 items-start group"
        >
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center group-hover:rotate-12 transition-transform">
            <Syringe className="w-6 h-6" />
          </div>
          <div className="text-left">
            <p className="font-black text-lg">Vaccination</p>
            <p className="text-xs text-white/70">Mettre à jour le carnet</p>
          </div>
        </button>

        <button 
          onClick={() => setActiveModal("rendezvous")}
          className="flex-1 min-w-[200px] p-6 bg-slate-800 text-white rounded-[2rem] shadow-lg shadow-slate-800/20 hover:scale-105 transition-all flex flex-col gap-4 items-start group"
        >
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center group-hover:rotate-12 transition-transform">
            <Calendar className="w-6 h-6" />
          </div>
          <div className="text-left">
            <p className="font-black text-lg">Rendez-vous</p>
            <p className="text-xs text-white/70">Planifier une visite</p>
          </div>
        </button>
      </div>

      {/* Modals */}
      <Modal 
        isOpen={activeModal === "consultation"} 
        onClose={resetState} 
        title="Nouvelle Consultation" 
        icon={<ClipboardList className="w-6 h-6" />}
      >
        {success ? (
          <div className="py-12 flex flex-col items-center justify-center text-center gap-4 animate-in zoom-in">
            <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500">
              <CheckCircle2 className="w-12 h-12" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white">Consultation Enregistrée</h3>
            <p className="text-slate-500">Le dossier du patient a été mis à jour.</p>
          </div>
        ) : <ConsultationForm />}
      </Modal>

      <Modal 
        isOpen={activeModal === "ordonnance"} 
        onClose={resetState} 
        title="Nouvelle Ordonnance" 
        icon={<Pill className="w-6 h-6" />}
      >
        {success ? (
          <div className="py-12 flex flex-col items-center justify-center text-center gap-4 animate-in zoom-in">
            <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500">
              <CheckCircle2 className="w-12 h-12" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white">Ordonnance Créée</h3>
            <p className="text-slate-500">L'ordonnance est maintenant disponible pour le patient.</p>
          </div>
        ) : <OrdonnanceForm />}
      </Modal>

      <Modal 
        isOpen={activeModal === "vaccin"} 
        onClose={resetState} 
        title="Enregistrer un Vaccin" 
        icon={<Syringe className="w-6 h-6" />}
      >
        {success ? (
          <div className="py-12 flex flex-col items-center justify-center text-center gap-4 animate-in zoom-in">
            <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500">
              <CheckCircle2 className="w-12 h-12" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white">Vaccin Enregistré</h3>
            <p className="text-slate-500">Le carnet vaccinal a été mis à jour.</p>
          </div>
        ) : <VaccinForm />}
      </Modal>

      <Modal 
        isOpen={activeModal === "rendezvous"} 
        onClose={resetState} 
        title="Programmer un Rendez-vous" 
        icon={<Calendar className="w-6 h-6" />}
      >
        {success ? (
          <div className="py-12 flex flex-col items-center justify-center text-center gap-4 animate-in zoom-in">
            <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500">
              <CheckCircle2 className="w-12 h-12" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white">RDV Programmé</h3>
            <p className="text-slate-500">Le patient recevra une notification pour son rendez-vous.</p>
          </div>
        ) : <RendezVousForm />}
      </Modal>
    </div>
  );
}
