"use client";

import { useState, useEffect } from "react";
import { 
  Bot, 
  Send, 
  Sparkles, 
  Activity, 
  AlertTriangle, 
  ChevronRight, 
  History, 
  Stethoscope, 
  ArrowRight,
  Loader2,
  ShieldCheck,
  Info,
  Clock,
  X
} from "lucide-react";
import Link from "next/link";
import { createAutoDiagnostic, getAutoDiagnostics, AutoDiagnostic } from "@/lib/api_carnet";

export default function DiagnosticPage() {
  const [symptomes, setSymptomes] = useState("");
  const [lastSymptomes, setLastSymptomes] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [history, setHistory] = useState<AutoDiagnostic[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await getAutoDiagnostics();
      setHistory(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    const message = symptomes.trim();
    if (!message) return;

    setLastSymptomes(message); // Garder trace de la question
    setSymptomes(""); 
    setAnalyzing(true);
    setResult(null);

    try {
      const res = await createAutoDiagnostic(message);
      setResult(res.data.analyseia);
      fetchHistory();
    } catch (err: any) {
      setSymptomes(message);
      alert(err.message || "Erreur lors de l'analyse");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10 animate-fade-in pb-20">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-[3rem] bg-slate-900 p-8 sm:p-12 text-white shadow-2xl">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary-600/20 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/4 animate-pulse" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-indigo-600/10 rounded-full blur-[80px] translate-y-1/2 -translate-x-1/4" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-10">
          <div className="flex-1 space-y-6 text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 backdrop-blur-md">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-black uppercase tracking-widest text-amber-400">Intelligence Artificielle</span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-tight" style={{ fontFamily: "var(--font-outfit)" }}>
              Auto-Diagnostic <span className="text-primary-400">IA</span>
            </h1>
            <p className="text-slate-400 text-lg leading-relaxed max-w-xl">
              Décrivez vos symptômes en langage naturel. Notre IA médicale analyse vos données pour vous orienter vers la meilleure prise en charge.
            </p>
            <div className="flex items-center justify-center md:justify-start gap-4">
               <div className="flex -space-x-3">
                 {[1,2,3].map(i => <div key={i} className="w-10 h-10 rounded-full border-2 border-slate-900 bg-slate-800 flex items-center justify-center text-[10px] font-bold">Dr</div>)}
               </div>
               <p className="text-xs text-slate-500">Validé par une équipe de <span className="text-white font-bold">12 médecins</span></p>
            </div>
          </div>
          
          <div className="w-48 h-48 sm:w-64 sm:h-64 rounded-[3rem] bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center shadow-[0_0_50px_rgba(59,130,246,0.3)] relative group overflow-hidden">
            <Bot className="w-24 h-24 sm:w-32 sm:h-32 text-white group-hover:scale-110 transition-transform duration-500" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Input Section */}
        <div className="lg:col-span-7 space-y-6">
          {result ? (
            <div className="bg-white dark:bg-[#0f172a]/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800/50 rounded-[2.5rem] p-8 shadow-xl h-full">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-500 text-sm">
                  <Bot className="w-4 h-4" />
                </span>
                Votre description
              </h3>
              <div className="p-6 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-slate-100 dark:border-slate-800">
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed italic font-medium">
                  "{lastSymptomes}"
                </p>
              </div>
              <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-800/50">
                 <button 
                  onClick={() => {setResult(null); setSymptomes("");}}
                  className="px-6 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-xl font-bold transition-all flex items-center gap-2"
                >
                  <ArrowRight className="w-4 h-4 rotate-180" /> Nouvelle analyse
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-[#0f172a]/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800/50 rounded-[2.5rem] p-8 shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-primary-500/10 flex items-center justify-center text-primary-500 text-sm">1</span>
                  Quels sont vos symptômes ?
                </h3>
                {symptomes && (
                  <button 
                    onClick={() => setSymptomes("")}
                    className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-rose-500 hover:text-rose-600 transition-colors bg-rose-500/5 px-3 py-1.5 rounded-full"
                  >
                    <X className="w-3 h-3" /> Vider le champ
                  </button>
                )}
              </div>
              
              <form onSubmit={handleAnalyze} className="space-y-6">
                <div className="relative">
                  <textarea 
                    value={symptomes}
                    onChange={(e) => setSymptomes(e.target.value)}
                    placeholder="Ex: J'ai mal à la tête depuis ce matin, j'ai un peu de fièvre et je me sens très fatigué..."
                    className="w-full h-48 px-6 py-5 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-3xl text-slate-900 dark:text-white placeholder:text-slate-500 focus:outline-none focus:border-primary-500 transition-all text-base leading-relaxed resize-none"
                    disabled={analyzing}
                  />
                  <div className="absolute bottom-4 right-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {symptomes.length} caractères
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={analyzing || !symptomes.trim()}
                  className="group w-full py-5 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white rounded-[1.5rem] font-bold shadow-xl shadow-primary-500/20 transition-all flex items-center justify-center gap-3 active:scale-95"
                >
                  {analyzing ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" />
                      <span>Analyse en cours...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                      <span>Lancer l'analyse intelligente</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          <div className="p-6 bg-amber-500/5 border border-amber-500/10 rounded-3xl flex items-start gap-4">
            <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0" />
            <p className="text-xs text-amber-600/80 leading-relaxed italic">
              <strong>Attention :</strong> Cet outil est une aide à l'orientation basée sur l'IA. Il ne remplace en aucun cas un diagnostic médical professionnel. En cas d'urgence, contactez immédiatement le 15 ou rendez-vous aux urgences les plus proches.
            </p>
          </div>
        </div>

        {/* Results Section */}
        <div className="lg:col-span-5">
          {!result && !analyzing ? (
            <div className="bg-slate-50 dark:bg-slate-900/30 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-12 text-center h-full flex flex-col items-center justify-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center text-slate-300">
                <Activity className="w-10 h-10" />
              </div>
              <div>
                <p className="text-slate-500 font-bold">Prêt pour l'analyse</p>
                <p className="text-xs text-slate-400">Remplissez le formulaire à gauche</p>
              </div>
            </div>
          ) : analyzing ? (
            <div className="bg-white dark:bg-[#0f172a]/80 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-12 text-center h-full flex flex-col items-center justify-center space-y-8 shadow-xl">
              <div className="relative">
                <div className="w-32 h-32 rounded-full border-4 border-primary-500/10 border-t-primary-500 animate-spin" />
                <Bot className="absolute inset-0 m-auto w-12 h-12 text-primary-500 animate-pulse" />
              </div>
              <div className="space-y-2">
                <p className="text-xl font-bold text-slate-900 dark:text-white">Analyse médicale IA...</p>
                <div className="flex flex-col gap-1">
                  {["Traitement du langage naturel", "Identification des pathologies", "Génération des recommandations"].map((step, i) => (
                    <div key={i} className="flex items-center justify-center gap-2 text-xs text-slate-500">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-ping" style={{ animationDelay: `${i*0.5}s` }} />
                      {step}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="animate-slide-up space-y-6">
              <div className="bg-white dark:bg-[#0f172a]/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl">
                <div className={`p-6 ${result.confiance > 0.7 ? 'bg-emerald-500' : result.confiance > 0.4 ? 'bg-amber-500' : 'bg-rose-500'} text-white`}>
                   <div className="flex items-center justify-between mb-4">
                     <span className="text-[10px] font-black uppercase tracking-widest text-white/70">Analyse terminée</span>
                     <div className="p-2 bg-white/20 rounded-lg"><Stethoscope className="w-4 h-4" /></div>
                   </div>
                   <h4 className="text-2xl font-black tracking-tight">{result.maladie}</h4>
                   <p className="text-xs text-white/80 mt-1">Indice de confiance : {(result.confiance * 100).toFixed(0)}%</p>
                </div>

                <div className="p-8 space-y-8">
                  <div className="space-y-3">
                    <h5 className="text-xs font-black uppercase tracking-widest text-slate-400">Analyse & Conseils</h5>
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                      {result.reponse}
                    </p>
                  </div>

                  <Link href="/dashboard/map" className="block w-full">
                    <button className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all">
                      Trouver un médecin proche <ArrowRight className="w-4 h-4" />
                    </button>
                  </Link>
                </div>
              </div>
              
              <button 
                onClick={() => {setResult(null); setSymptomes(""); setLastSymptomes("");}}
                className="w-full py-4 text-slate-500 font-bold hover:text-slate-900 dark:hover:text-white transition-colors flex items-center justify-center gap-2"
              >
                <X className="w-4 h-4" /> Fermer l'analyse
              </button>
            </div>
          )}
        </div>
      </div>

      {/* History Section */}
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <History className="w-6 h-6 text-slate-400" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Historique de mes analyses</h2>
        </div>

        {loadingHistory ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
          </div>
        ) : history.length === 0 ? (
          <div className="p-10 text-center bg-white dark:bg-slate-900/50 rounded-[2.5rem] border border-slate-100 dark:border-slate-800">
            <p className="text-slate-500 text-sm">Aucun historique d'analyse disponible.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {history.map((diag) => (
              <div key={diag.id} className="p-6 bg-white dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-[2rem] space-y-4 hover:shadow-lg transition-all group">
                <div className="flex items-start justify-between">
                  <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-400"><Clock className="w-4 h-4" /></div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {new Date(diag.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-medium line-clamp-2 italic mb-2">"{diag.symptomes}"</p>
                  <h4 className="font-bold text-slate-900 dark:text-white">{diag.recommendation || "Analyse en attente"}</h4>
                </div>
                <button 
                  onClick={() => {
                    const parsed = typeof diag.analyseia === 'string' ? JSON.parse(diag.analyseia) : diag.analyseia;
                    setResult(parsed);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="text-xs font-bold text-primary-500 hover:text-primary-600 transition-colors flex items-center gap-1"
                >
                  Voir les détails <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
