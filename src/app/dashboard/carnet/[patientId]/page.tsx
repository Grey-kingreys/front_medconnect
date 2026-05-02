"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  Activity, Calendar, AlertCircle, 
  Loader2, ShieldAlert, Droplet, User as UserIcon, Phone,
  ClipboardList, CheckCircle2, ArrowLeft, Plus
} from "lucide-react";
import { getPatientCarnet, PatientCarnet } from "@/lib/api_carnet";
import AddRecordForms from "./components/AddRecordForms";


const BLOOD_GROUPS = [
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

export default function PatientCarnetViewPage() {
  const params = useParams();
  const router = useRouter();
  const patientId = params.patientId as string;
  
  const [data, setData] = useState<PatientCarnet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getPatientCarnet(patientId);
      setData(res.data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Erreur lors du chargement du carnet.");
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    if (patientId) fetchData();
  }, [patientId, fetchData]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-10 h-10 text-primary-500 animate-spin" />
        <p className="text-slate-500 animate-pulse">Chargement du dossier médical...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-3xl mx-auto mt-10 p-8 bg-emergency-500/10 border border-emergency-500/20 rounded-3xl text-center">
        <AlertCircle className="w-12 h-12 text-emergency-500 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-emergency-600 mb-2">Accès refusé ou erreur</h3>
        <p className="text-emergency-500/80 mb-6">{error || "Vous n'avez pas l'autorisation d'accéder à ce carnet médical (vous devez être le médecin traitant)."}</p>
        <button onClick={() => router.back()} className="px-6 py-2 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors">
          Retour à la liste
        </button>
      </div>
    );
  }

  const { patient, profil, stats, isMedecinTraitant } = data;
  const allergies = profil?.allergies || [];
  const pathologies = profil?.pathologies || [];
  const traitements = profil?.traitements || [];

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
      <button 
        onClick={() => router.back()}
        className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-primary-600 transition-colors w-fit"
      >
        <ArrowLeft className="w-4 h-4" /> Retour aux patients
      </button>

      {!isMedecinTraitant && (
        <div className="flex items-center gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-700 dark:text-amber-400">
          <ShieldAlert className="w-5 h-5 shrink-0" />
          <p className="text-sm">
            <strong>Accès restreint (Niveau Structure) :</strong> Vous n'êtes pas le médecin traitant de ce patient. 
            L'historique affiché se limite uniquement aux consultations et ordonnances réalisées au sein de votre structure. 
            <strong> Le profil médical complet et les informations de contact personnelles sont masqués pour des raisons de confidentialité.</strong>
          </p>
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
              {(patient.prenom?.[0] || "") + (patient.nom?.[0] || "")}
            </span>
          </div>
          
          <div className="flex-1 text-center sm:text-left space-y-2">
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight" style={{ fontFamily: "var(--font-outfit)" }}>
              {patient.prenom} {patient.nom}
            </h1>
            <div className="flex flex-wrap justify-center sm:justify-start gap-4 text-white/80 text-sm">
              <span className="flex items-center gap-2"><Calendar className="w-4 h-4" /> {profil?.dateNaissance ? new Date(profil.dateNaissance).toLocaleDateString('fr-FR') : "Âge inconnu"}</span>
              <span className="flex items-center gap-2"><UserIcon className="w-4 h-4" /> {profil?.genre || "Genre non défini"}</span>
              <span className="flex items-center gap-2"><Phone className="w-4 h-4" /> {patient.telephone || "Pas de téléphone"}</span>
            </div>
            
            <div className="pt-4 flex flex-wrap justify-center sm:justify-start gap-3">
              <div className="px-4 py-2 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 flex items-center gap-2">
                <Droplet className="w-4 h-4 text-rose-400" />
                <span className="text-sm font-bold text-white">Groupe {BLOOD_GROUPS.find(g => g.value === profil?.groupeSanguin)?.label || "Inconnu"}</span>
              </div>
              <div className="px-4 py-2 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-bold text-white">{profil?.poids || "—"} kg / {profil?.taille || "—"} cm</span>
              </div>
            </div>
          </div>
          
          <div className={`px-6 py-3 bg-white/10 backdrop-blur-md text-white rounded-2xl border border-white/20 font-bold text-sm shadow-xl flex items-center gap-2 ${isMedecinTraitant ? 'bg-amber-500/20 border-amber-500/50 text-amber-300' : ''}`}>
            <ShieldAlert className="w-4 h-4" /> {isMedecinTraitant ? 'Médecin Traitant' : 'Structure Autorisée'}
          </div>
        </div>
      </div>

      {/* Actions Section for Doctor */}
      <div className="space-y-4">
        <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
          <Plus className="w-4 h-4 text-primary-500" /> Actions Médicales
        </h3>
        <AddRecordForms patientId={patientId} onSuccess={fetchData} />
      </div>

      {/* Main Grid */}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Quick Stats */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#0f172a]/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800/50 rounded-[2rem] p-6 shadow-xl">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6">Aperçu Santé</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-primary-500/10 rounded-3xl border border-primary-500/20 text-center space-y-1">
                <p className="text-2xl font-black text-primary-400">{stats?.consultations || 0}</p>
                <p className="text-[10px] font-bold text-slate-500 uppercase">Consultations</p>
              </div>
              <div className="p-4 bg-secondary-500/10 rounded-3xl border border-secondary-500/20 text-center space-y-1">
                <p className="text-2xl font-black text-secondary-400">{stats?.ordonnances || 0}</p>
                <p className="text-[10px] font-bold text-slate-500 uppercase">Ordonnances</p>
              </div>
              <div className="p-4 bg-accent-500/10 rounded-3xl border border-accent-500/20 text-center space-y-1">
                <p className="text-2xl font-black text-accent-400">{stats?.vaccinations || 0}</p>
                <p className="text-[10px] font-bold text-slate-500 uppercase">Vaccins</p>
              </div>
              <div className="p-4 bg-rose-500/10 rounded-3xl border border-rose-500/20 text-center space-y-1">
                <p className="text-2xl font-black text-rose-400">{stats?.analyses || 0}</p>
                <p className="text-[10px] font-bold text-slate-500 uppercase">Analyses</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Details */}
        <div className="lg:col-span-2 space-y-6">
          {!isMedecinTraitant ? (
            <div className="bg-white dark:bg-[#0f172a]/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800/50 rounded-[2rem] p-12 shadow-xl flex flex-col items-center justify-center text-center h-full min-h-[400px]">
              <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
                <ShieldAlert className="w-10 h-10 text-slate-400" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Profil Médical Protégé</h3>
              <p className="text-slate-500 max-w-md">
                Les informations médicales personnelles (allergies, pathologies, traitements) sont confidentielles et réservées au médecin traitant du patient.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Allergies Card */}
                <div className="bg-white dark:bg-[#0f172a]/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800/50 rounded-[2rem] p-8 shadow-xl relative overflow-hidden group">
                  <div className="absolute -top-4 -right-4 w-24 h-24 bg-rose-500/5 rounded-full blur-2xl group-hover:bg-rose-500/10 transition-colors" />
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-500"><AlertCircle className="w-6 h-6" /></div>
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white">Allergies</h3>
                      <p className="text-xs text-slate-500">{allergies.length} signalée(s)</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {allergies.map((a, i) => (
                      <span key={i} className="px-3 py-1.5 bg-rose-500/5 border border-rose-500/10 text-rose-400 rounded-xl text-xs font-bold">{a}</span>
                    ))}
                    {allergies.length === 0 && <p className="text-sm text-slate-500 italic">Aucune allergie déclarée.</p>}
                  </div>
                </div>

                {/* Pathologies Card */}
                <div className="bg-white dark:bg-[#0f172a]/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800/50 rounded-[2rem] p-8 shadow-xl relative overflow-hidden group">
                  <div className="absolute -top-4 -right-4 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl group-hover:bg-amber-500/10 transition-colors" />
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500"><Activity className="w-6 h-6" /></div>
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white">Pathologies</h3>
                      <p className="text-xs text-slate-500">{pathologies.length} maladie(s) chronique(s)</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {pathologies.map((p, i) => (
                      <span key={i} className="px-3 py-1.5 bg-amber-500/5 border border-amber-500/10 text-amber-400 rounded-xl text-xs font-bold">{p}</span>
                    ))}
                    {pathologies.length === 0 && <p className="text-sm text-slate-500 italic">Aucune pathologie déclarée.</p>}
                  </div>
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
                    {traitements.map((t, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        <span className="text-sm text-slate-700 dark:text-slate-300">{t}</span>
                      </div>
                    ))}
                    {traitements.length === 0 && <p className="text-sm text-slate-500 italic">Aucun traitement en cours.</p>}
                  </div>
                </div>

                {/* Emergency Card */}
                <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-[2rem] p-8 text-white shadow-2xl relative overflow-hidden group">
                  <div className="relative z-10 space-y-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center"><Phone className="w-6 h-6" /></div>
                      <h3 className="font-bold">Contact d'urgence</h3>
                    </div>
                    <div>
                      <p className="text-white/50 text-xs uppercase font-black tracking-widest mb-1">Personne à prévenir</p>
                      <p className="text-xl font-bold tracking-tight">{profil?.contactUrgence || "Non renseigné"}</p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
