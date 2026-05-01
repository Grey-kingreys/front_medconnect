"use client";

import { useState } from "react";
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
  Info
} from "lucide-react";
import Link from "next/link";

export default function DiagnosticPage() {
  const [symptomes, setSymptomes] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!symptomes.trim()) return;

    setAnalyzing(true);
    setResult(null);

    // Mock AI Analysis delay
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Mock Result
    setResult({
      potentialCauses: [
        { name: "Grippe saisonnière", probability: "Élevée", description: "Infection virale courante se manifestant par de la fièvre et des courbatures." },
        { name: "Fatigue chronique", probability: "Moyenne", description: "État de fatigue persistant pouvant être lié au stress ou au manque de sommeil." }
      ],
      recommendation: "CONSULTATION",
      advice: "Reposez-vous, hydratez-vous abondamment et surveillez votre température. Si la fièvre persiste plus de 48h, consultez un médecin.",
      urgencyLevel: "MODERATE"
    });
    setAnalyzing(false);
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
          <div className="bg-white dark:bg-[#0f172a]/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800/50 rounded-[2.5rem] p-8 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-primary-500/10 flex items-center justify-center text-primary-500 text-sm">1</span>
              Quels sont vos symptômes ?
            </h3>
            
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
                <p className="text-xl font-bold text-slate-900 dark:text-white">Traitement des données...</p>
                <div className="flex flex-col gap-1">
                  {["Analyse sémantique", "Consultation de la base médicale", "Calcul des probabilités"].map((step, i) => (
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
                <div className={`p-6 ${result.urgencyLevel === 'HIGH' ? 'bg-emergency-500' : 'bg-secondary-500'} text-white`}>
                   <div className="flex items-center justify-between mb-4">
                     <span className="text-[10px] font-black uppercase tracking-widest text-white/70">Recommandation</span>
                     <div className="p-2 bg-white/20 rounded-lg"><Stethoscope className="w-4 h-4" /></div>
                   </div>
                   <h4 className="text-2xl font-black uppercase tracking-tight">{result.recommendation}</h4>
                </div>

                <div className="p-8 space-y-8">
                  <div className="space-y-4">
                    <h5 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                      <Info className="w-4 h-4" /> Causes potentielles
                    </h5>
                    <div className="space-y-3">
                      {result.potentialCauses.map((cause: any, i: number) => (
                        <div key={i} className="p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-2xl group">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-bold text-slate-900 dark:text-white">{cause.name}</span>
                            <span className="text-[10px] font-black text-secondary-500 bg-secondary-500/10 px-2 py-0.5 rounded-full">{cause.probability}</span>
                          </div>
                          <p className="text-xs text-slate-500 leading-relaxed">{cause.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h5 className="text-xs font-black uppercase tracking-widest text-slate-400">Conseils d'action</h5>
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                      {result.advice}
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
                onClick={() => {setResult(null); setSymptomes("");}}
                className="w-full py-4 text-slate-500 font-bold hover:text-slate-900 dark:hover:text-white transition-colors flex items-center justify-center gap-2"
              >
                Nouvelle analyse
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
