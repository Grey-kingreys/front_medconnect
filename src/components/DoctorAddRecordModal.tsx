"use client";

import { useState, useEffect } from "react";
import { 
  X, Search, User, ClipboardList, Pill, Syringe, Calendar, 
  Loader2, CheckCircle2, Save, Plus, ArrowRight
} from "lucide-react";
import { 
  createConsultation, createOrdonnance, createVaccination, createRendezVous 
} from "@/lib/api_carnet";
import { getMyPatients, PatientSummary } from "@/lib/api_patients";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: "consultation" | "ordonnance" | "vaccin" | "rendezvous";
  onSuccess?: () => void;
}

export default function DoctorAddRecordModal({ isOpen, onClose, type, onSuccess }: ModalProps) {
  const [step, setStep] = useState<"select_patient" | "fill_form">("select_patient");
  const [selectedPatient, setSelectedPatient] = useState<PatientSummary | null>(null);
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [search, setSearch] = useState("");
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (isOpen && step === "select_patient") {
      fetchPatients();
    }
  }, [isOpen, step]);

  const fetchPatients = async () => {
    setLoadingPatients(true);
    try {
      const res = await getMyPatients();
      setPatients(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingPatients(false);
    }
  };

  const filteredPatients = patients.filter(p => 
    `${p.nom} ${p.prenom}`.toLowerCase().includes(search.toLowerCase()) ||
    p.email.toLowerCase().includes(search.toLowerCase())
  );

  const reset = () => {
    setStep("select_patient");
    setSelectedPatient(null);
    setSearch("");
    setSuccess(false);
    setSubmitting(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSuccess = () => {
    setSuccess(true);
    setTimeout(() => {
      onSuccess?.();
      handleClose();
    }, 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative w-full max-w-2xl bg-white dark:bg-[#0f172a] rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in duration-300 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary-500/10 flex items-center justify-center text-primary-500">
              {type === "consultation" && <ClipboardList className="w-6 h-6" />}
              {type === "ordonnance" && <Pill className="w-6 h-6" />}
              {type === "vaccin" && <Syringe className="w-6 h-6" />}
              {type === "rendezvous" && <Calendar className="w-6 h-6" />}
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                {type === "consultation" && "Nouvelle Consultation"}
                {type === "ordonnance" && "Nouvelle Ordonnance"}
                {type === "vaccin" && "Enregistrer un Vaccin"}
                {type === "rendezvous" && "Programmer un RDV"}
              </h3>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">
                {step === "select_patient" ? "Étape 1 : Choisir le patient" : `Étape 2 : Détails du document`}
              </p>
            </div>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
            <X className="w-6 h-6 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 overflow-y-auto custom-scrollbar flex-1">
          {success ? (
            <div className="py-12 flex flex-col items-center justify-center text-center gap-4 animate-in zoom-in">
              <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500">
                <CheckCircle2 className="w-12 h-12" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">Opération Réussie</h3>
              <p className="text-slate-500">Le dossier du patient a été mis à jour avec succès.</p>
            </div>
          ) : step === "select_patient" ? (
            <div className="space-y-6">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input 
                  type="text"
                  placeholder="Rechercher un patient (nom, email...)"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-primary-500/50 transition-all"
                />
              </div>

              {loadingPatients ? (
                <div className="flex flex-col items-center py-10 gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
                  <p className="text-sm text-slate-500">Chargement de votre liste de patients...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {filteredPatients.length === 0 ? (
                    <div className="py-10 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl">
                      <User className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                      <p className="text-sm text-slate-500">Aucun patient trouvé.</p>
                    </div>
                  ) : (
                    filteredPatients.map(p => (
                      <button 
                        key={p.id}
                        onClick={() => {
                          setSelectedPatient(p);
                          setStep("fill_form");
                        }}
                        className="flex items-center gap-4 p-4 hover:bg-primary-50 dark:hover:bg-primary-500/10 border border-slate-100 dark:border-slate-800 rounded-2xl transition-all group text-left"
                      >
                        <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 group-hover:bg-primary-500 group-hover:text-white transition-colors">
                          <User className="w-6 h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-900 dark:text-white truncate">{p.prenom} {p.nom}</p>
                          <p className="text-xs text-slate-500 truncate">{p.email}</p>
                        </div>
                        <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-primary-500 group-hover:translate-x-1 transition-all" />
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6 animate-in slide-in-from-right duration-300">
              <div className="flex items-center gap-4 p-4 bg-primary-500/5 border border-primary-500/10 rounded-2xl mb-6">
                <div className="w-10 h-10 rounded-lg bg-primary-500 text-white flex items-center justify-center font-bold">
                  {selectedPatient?.prenom[0]}{selectedPatient?.nom[0]}
                </div>
                <div>
                  <p className="text-xs font-bold text-primary-500 uppercase">Patient sélectionné</p>
                  <p className="font-bold text-slate-900 dark:text-white">{selectedPatient?.prenom} {selectedPatient?.nom}</p>
                </div>
                <button 
                  onClick={() => setStep("select_patient")}
                  className="ml-auto text-xs font-bold text-slate-500 hover:text-primary-500 underline"
                >
                  Changer
                </button>
              </div>

              {type === "consultation" && <ConsultationForm patientId={selectedPatient!.id} onCancel={() => setStep("select_patient")} onFinish={handleSuccess} setSubmitting={setSubmitting} submitting={submitting} />}
              {type === "ordonnance" && <OrdonnanceForm patientId={selectedPatient!.id} onCancel={() => setStep("select_patient")} onFinish={handleSuccess} setSubmitting={setSubmitting} submitting={submitting} />}
              {type === "vaccin" && <VaccinForm patientId={selectedPatient!.id} onCancel={() => setStep("select_patient")} onFinish={handleSuccess} setSubmitting={setSubmitting} submitting={submitting} />}
              {type === "rendezvous" && <RendezVousForm patientId={selectedPatient!.id} onCancel={() => setStep("select_patient")} onFinish={handleSuccess} setSubmitting={setSubmitting} submitting={submitting} />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-forms (Extracted for readability) ──────────────────────

function ConsultationForm({ patientId, onFinish, setSubmitting, submitting }: any) {
  const [form, setForm] = useState({ motif: "", diagnostic: "", notes: "", dateConsultation: new Date().toISOString().split('T')[0] });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createConsultation({ ...form, patientId });
      onFinish();
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la création");
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Motif</label>
        <textarea required className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:border-primary-500/50 h-24 resize-none" value={form.motif} onChange={e => setForm({...form, motif: e.target.value})} placeholder="Motif de la consultation..." />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Date</label>
          <input type="date" className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl outline-none" value={form.dateConsultation} onChange={e => setForm({...form, dateConsultation: e.target.value})} />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Diagnostic</label>
          <input className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl outline-none" value={form.diagnostic} onChange={e => setForm({...form, diagnostic: e.target.value})} placeholder="Diagnostic..." />
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Notes</label>
        <textarea className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl outline-none h-32 resize-none" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Observations..." />
      </div>
      <button disabled={submitting} className="w-full py-4 bg-primary-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-primary-700 transition-all flex items-center justify-center gap-2">
        {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5" /> Enregistrer la consultation</>}
      </button>
    </form>
  );
}

function OrdonnanceForm({ patientId, onFinish, setSubmitting, submitting }: any) {
  const [medicaments, setMedicaments] = useState([{ nom: "", dosage: "", duree: "", instructions: "" }]);
  const [notes, setNotes] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createOrdonnance({ patientId, medicaments, notes });
      onFinish();
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la création");
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        {medicaments.map((m, i) => (
          <div key={i} className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl relative group">
            {medicaments.length > 1 && <button type="button" onClick={() => setMedicaments(medicaments.filter((_, idx) => idx !== i))} className="absolute top-2 right-2 text-slate-400 hover:text-rose-500"><X className="w-4 h-4" /></button>}
            <div className="grid grid-cols-2 gap-3">
              <input required className="p-3 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl text-sm" placeholder="Médicament" value={m.nom} onChange={e => { const n = [...medicaments]; n[i].nom = e.target.value; setMedicaments(n); }} />
              <input required className="p-3 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl text-sm" placeholder="Dosage" value={m.dosage} onChange={e => { const n = [...medicaments]; n[i].dosage = e.target.value; setMedicaments(n); }} />
              <input required className="p-3 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl text-sm" placeholder="Durée" value={m.duree} onChange={e => { const n = [...medicaments]; n[i].duree = e.target.value; setMedicaments(n); }} />
              <input className="p-3 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl text-sm" placeholder="Instructions" value={m.instructions} onChange={e => { const n = [...medicaments]; n[i].instructions = e.target.value; setMedicaments(n); }} />
            </div>
          </div>
        ))}
        <button type="button" onClick={() => setMedicaments([...medicaments, { nom: "", dosage: "", duree: "", instructions: "" }])} className="w-full py-3 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-slate-400 hover:text-primary-500 hover:border-primary-500 transition-all flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest">
          <Plus className="w-4 h-4" /> Ajouter un médicament
        </button>
      </div>
      <button disabled={submitting} className="w-full py-4 bg-secondary-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-secondary-700 transition-all flex items-center justify-center gap-2">
        {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5" /> Générer l'ordonnance</>}
      </button>
    </form>
  );
}

function VaccinForm({ patientId, onFinish, setSubmitting, submitting }: any) {
  const [form, setForm] = useState({ vaccin: "", dateVaccin: new Date().toISOString().split('T')[0], prochainRappel: "", lotNumero: "", notes: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createVaccination({ ...form, patientId });
      onFinish();
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'enregistrement");
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Vaccin</label>
        <input required className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl outline-none" value={form.vaccin} onChange={e => setForm({...form, vaccin: e.target.value})} placeholder="Nom du vaccin..." />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Date</label>
          <input type="date" className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl outline-none" value={form.dateVaccin} onChange={e => setForm({...form, dateVaccin: e.target.value})} />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Rappel</label>
          <input type="date" className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl outline-none" value={form.prochainRappel} onChange={e => setForm({...form, prochainRappel: e.target.value})} />
        </div>
      </div>
      <button disabled={submitting} className="w-full py-4 bg-accent-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-accent-700 transition-all flex items-center justify-center gap-2">
        {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5" /> Enregistrer le vaccin</>}
      </button>
    </form>
  );
}

function RendezVousForm({ patientId, onFinish, setSubmitting, submitting }: any) {
  const [form, setForm] = useState({ date: "", motif: "", notes: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createRendezVous({ ...form, patientId });
      onFinish();
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la programmation");
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Motif</label>
        <input required className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl outline-none" value={form.motif} onChange={e => setForm({...form, motif: e.target.value})} placeholder="Motif du rendez-vous..." />
      </div>
      <div className="space-y-1">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Date et Heure</label>
        <input type="datetime-local" required className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl outline-none" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
      </div>
      <button disabled={submitting} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2">
        {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Calendar className="w-5 h-5" /> Programmer le RDV</>}
      </button>
    </form>
  );
}
