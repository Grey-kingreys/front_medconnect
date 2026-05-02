"use client";

import { useState, useEffect } from "react";
import { 
  Users, 
  Search, 
  User, 
  Mail, 
  Phone, 
  Calendar, 
  FileText, 
  ChevronRight, 
  Loader2, 
  AlertCircle,
  Plus,
  Filter
} from "lucide-react";
import { getMyPatients, PatientSummary } from "@/lib/api_patients";
import Link from "next/link";
import DoctorAddRecordModal from "@/components/DoctorAddRecordModal";

export default function PatientsPage() {
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  useEffect(() => {
    fetchPatients();
  }, []);

  const fetchPatients = async () => {
    setLoading(true);
    try {
      const res = await getMyPatients();
      setPatients(res.data);
    } catch (err) {
      setError("Impossible de charger la liste des patients.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredPatients = patients.filter(p => 
    p.nom.toLowerCase().includes(search.toLowerCase()) ||
    p.prenom.toLowerCase().includes(search.toLowerCase()) ||
    p.email.toLowerCase().includes(search.toLowerCase()) ||
    p.telephone.includes(search)
  );

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white" style={{ fontFamily: 'var(--font-outfit, var(--font-inter))' }}>
            Mes Patients
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Gérez la liste des patients ayant consulté dans votre établissement
          </p>
        </div>
        
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-semibold transition-all shadow-lg shadow-primary-500/25 active:scale-95"
        >
          <Plus className="w-5 h-5" />
          Nouvelle Consultation
        </button>
      </div>

      <DoctorAddRecordModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        type="consultation" 
        onSuccess={fetchPatients} 
      />

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input 
            type="text"
            placeholder="Rechercher un patient par nom, email ou téléphone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3.5 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500/50 transition-all shadow-sm"
          />
        </div>
        <button className="flex items-center gap-2 px-5 py-3.5 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-600 dark:text-slate-400 hover:text-primary-500 transition-all shadow-sm">
          <Filter className="w-5 h-5" />
          <span>Filtres</span>
        </button>
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-12 h-12 animate-spin text-primary-500 mb-4" />
          <p className="text-slate-500 animate-pulse">Chargement de votre patientèle...</p>
        </div>
      ) : error ? (
        <div className="p-8 bg-emergency-500/10 border border-emergency-500/20 rounded-3xl text-center">
          <AlertCircle className="w-12 h-12 text-emergency-500 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-emergency-600 mb-2">Une erreur est survenue</h3>
          <p className="text-emergency-500/80">{error}</p>
          <button onClick={fetchPatients} className="mt-4 px-6 py-2 bg-emergency-500 text-white rounded-xl hover:bg-emergency-600 transition-colors">
            Réessayer
          </button>
        </div>
      ) : filteredPatients.length === 0 ? (
        <div className="p-16 bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/50 rounded-3xl text-center">
          <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6">
            <Users className="w-10 h-10 text-slate-400" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Aucun patient trouvé</h3>
          <p className="text-slate-500 max-w-md mx-auto">
            {search ? "Aucun résultat ne correspond à votre recherche." : "Vous n'avez pas encore de patients enregistrés dans cette structure."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPatients.map((patient) => (
            <div 
              key={patient.id}
              className="group relative bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/50 rounded-3xl p-6 hover:border-primary-500/50 hover:shadow-xl hover:shadow-primary-500/5 transition-all duration-300"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-14 h-14 bg-gradient-to-br from-primary-500/20 to-cyan-500/20 rounded-2xl flex items-center justify-center border border-primary-500/10 group-hover:scale-110 transition-transform duration-300">
                  <User className="w-7 h-7 text-primary-500" />
                </div>
                {patient.profilMedical?.groupeSanguin && (
                  <span className="px-3 py-1 bg-emergency-500/10 text-emergency-500 text-[10px] font-bold rounded-full border border-emergency-500/20 uppercase">
                    GS: {patient.profilMedical.groupeSanguin.replace('_POSITIF', '+').replace('_NEGATIF', '-')}
                  </span>
                )}
              </div>

              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white truncate">
                  {patient.prenom} {patient.nom}
                </h3>
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Mail className="w-3.5 h-3.5" />
                  <span className="truncate">{patient.email}</span>
                </div>
                {patient.telephone && (
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Phone className="w-3.5 h-3.5" />
                    <span>{patient.telephone}</span>
                  </div>
                )}
              </div>

              <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    Dernière visite
                  </span>
                  <span className="font-medium text-slate-900 dark:text-slate-300">
                    {new Date(patient.derniereConsultation).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-start gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                  <FileText className="w-4 h-4 text-primary-500 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Dernier Motif</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-1">{patient.dernierMotif}</p>
                  </div>
                </div>
              </div>

              <Link 
                href={`/dashboard/carnet/${patient.id}`}
                className="mt-4 w-full flex items-center justify-center gap-2 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl text-sm font-bold opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300 shadow-xl"
              >
                Voir le carnet
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
