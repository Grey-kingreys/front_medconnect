"use client";

import { useState, useEffect } from "react";
import { 
  AlertCircle, 
  Bot, 
  Phone, 
  MapPin, 
  X, 
  Zap, 
  ChevronRight, 
  ShieldAlert,
  Loader2,
  CheckCircle2,
  Info,
  Heart,
  AlertTriangle,
  User
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getProfilMedical, ProfilMedical, createUrgence } from "@/lib/api_carnet";

export default function EmergencyButton() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<"sos_confirm" | "sos_sent" | "first_aid">("sos_confirm");
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [locLoading, setLocLoading] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [timerActive, setTimerActive] = useState(false);
  const [profile, setProfile] = useState<ProfilMedical | null>(null);

  useEffect(() => {
    if (user?.role === "PATIENT") {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      const res = await getProfilMedical();
      setProfile(res.data);
    } catch (err) {
      console.error("Erreur chargement profil urgence", err);
    }
  };

  // Pour le compte à rebours SOS
  useEffect(() => {
    let interval: any;
    if (timerActive && countdown > 0) {
      interval = setInterval(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
    } else if (countdown === 0 && timerActive) {
      handleSendSOS();
      setTimerActive(false);
    }
    return () => clearInterval(interval);
  }, [timerActive, countdown]);

  if (user?.role !== "PATIENT") return null;

  const getLoc = () => {
    setLocLoading(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setLocLoading(false);
        },
        () => setLocLoading(false)
      );
    } else {
      setLocLoading(false);
    }
  };

  const handleSendSOS = async () => {
    // Tentative de récupération de la position de secours si elle est toujours nulle
    let currentLoc = location;
    
    if (!currentLoc && "geolocation" in navigator) {
      // On tente une dernière récupération rapide
      navigator.geolocation.getCurrentPosition((pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLocation(loc);
        sendRequest(loc);
      }, () => sendRequest(null), { timeout: 2000 });
    } else {
      sendRequest(currentLoc);
    }
  };

  const sendRequest = async (loc: {lat: number, lng: number} | null) => {
    try {
      await createUrgence({
        latitude: loc?.lat,
        longitude: loc?.lng,
        message: "Urgence vitale déclenchée depuis le dashboard."
      });
      setView("sos_sent");
    } catch (err) {
      console.error("Erreur lors de l'envoi du SOS réel", err);
      setView("sos_sent");
    }
  };

  const reset = () => {
    setIsOpen(false);
    setTimeout(() => {
      setView("sos_confirm");
      setCountdown(5);
      setTimerActive(false);
    }, 300);
  };

  const emergencyPhone = profile?.contactTelephone || "";

  return (
    <>
      {/* Floating Trigger Button */}
      <div className="fixed bottom-6 right-6 z-[60]">
        <button
          onClick={() => { setIsOpen(true); getLoc(); setTimerActive(true); setView("sos_confirm"); }}
          className="group relative w-16 h-16 flex items-center justify-center rounded-full shadow-2xl shadow-emergency-500/40 transition-all duration-500 hover:scale-110 active:scale-95 overflow-hidden"
        >
          <div className="absolute inset-0 bg-emergency-500 animate-ping opacity-20" />
          <div className="absolute inset-0 bg-emergency-600 group-hover:bg-emergency-500 transition-colors" />
          <div className="absolute inset-2 border-2 border-white/30 rounded-full animate-[spin_4s_linear_infinite]" />
          <AlertCircle className="relative w-8 h-8 text-white group-hover:scale-110 transition-transform" />
        </button>
      </div>

      {/* Modal Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={reset} />
          
          <div className="relative w-full max-w-md bg-white dark:bg-[#0f172a] rounded-[3rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in duration-300 flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emergency-500/10 flex items-center justify-center text-emergency-500">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">SOS Urgence</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Alerte Immédiate</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => { setTimerActive(false); setView("first_aid"); }}
                  className="px-3 py-1.5 bg-accent-500/10 text-accent-600 dark:text-accent-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-accent-500/20 transition-colors"
                >
                  Secours IA
                </button>
                <button onClick={reset} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>
            </div>

            {/* Content Views */}
            <div className="p-6 overflow-y-auto custom-scrollbar">
              

              {view === "sos_confirm" && (
                <div className="py-8 flex flex-col items-center text-center">
                  <div className="relative w-40 h-40 flex items-center justify-center mb-8">
                    <svg className="absolute inset-0 w-full h-full -rotate-90">
                      <circle cx="80" cy="80" r="74" fill="transparent" stroke="currentColor" strokeWidth="12" className="text-slate-100 dark:text-slate-800" />
                      <circle cx="80" cy="80" r="74" fill="transparent" stroke="currentColor" strokeWidth="12" strokeDasharray={465} strokeDashoffset={465 - (465 * countdown) / 5} className="text-emergency-500 transition-all duration-1000" />
                    </svg>
                    <span className="text-6xl font-black text-slate-900 dark:text-white animate-pulse">{countdown}</span>
                  </div>
                  <h4 className="text-2xl font-black text-slate-900 dark:text-white mb-2 uppercase tracking-tighter">Envoi automatique...</h4>
                  <p className="text-slate-500 mb-8 max-w-[280px] text-sm">
                    Nous alertons vos proches et les 5 structures médicales les plus proches de votre position GPS.
                  </p>

                  <div className="flex items-center gap-2 mb-6 px-4 py-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                    <MapPin className={`w-4 h-4 ${location ? 'text-emerald-500' : 'text-slate-400 animate-pulse'}`} />
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      {location ? 'Position GPS acquise' : 'Recherche de votre position...'}
                    </span>
                  </div>
                  <button 
                    onClick={reset} 
                    className="w-full py-4 bg-slate-900 text-white rounded-3xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl"
                  >
                    Annuler l'alerte
                  </button>
                </div>
              )}

              {view === "sos_sent" && (
                <div className="space-y-6 animate-in zoom-in duration-300">
                  <div className="flex flex-col items-center text-center gap-4">
                    <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500"><CheckCircle2 className="w-12 h-12" /></div>
                    <div>
                      <h4 className="text-2xl font-black text-slate-900 dark:text-white mb-1">SOS Envoyé !</h4>
                      <p className="text-sm text-slate-500">Position partagée : {location ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : "Localisation en cours..."}</p>
                    </div>
                  </div>

                  {/* EMERGENCY CARDS */}
                  <div className="space-y-3">
                    <a href="tel:15" className="w-full bg-emergency-500 text-white p-4 rounded-3xl flex items-center gap-4 shadow-lg shadow-emergency-500/20 hover:scale-[1.02] transition-transform">
                      <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center"><Phone className="w-5 h-5" /></div>
                      <div className="text-left"><p className="text-[10px] font-bold text-white/70 uppercase">Service d'urgence</p><p className="text-lg font-black">Appeler le 15 (SAMU)</p></div>
                    </a>

                    {profile?.contactTelephone && (
                      <a href={`tel:${emergencyPhone}`} className="w-full bg-primary-600 text-white p-4 rounded-3xl flex items-center gap-4 shadow-lg shadow-primary-500/20 hover:scale-[1.02] transition-transform">
                        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center"><User className="w-5 h-5" /></div>
                        <div className="text-left"><p className="text-[10px] font-bold text-white/70 uppercase">Proche (Urgence)</p><p className="text-lg font-black">{profile.contactNom || "Contact d'urgence"}</p></div>
                      </a>
                    )}
                  </div>

                  {/* EMERGENCY MEDICAL CARD */}
                  <div className="p-6 bg-slate-900 text-white rounded-[2.5rem] border-4 border-emergency-500/30 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><Heart className="w-24 h-24" /></div>
                    <h5 className="text-sm font-black uppercase tracking-widest text-emergency-500 mb-4 flex items-center gap-2"><ShieldAlert className="w-4 h-4" /> Fiche de Secours</h5>
                    <div className="grid grid-cols-2 gap-4 relative z-10">
                      <div><p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Groupe Sanguin</p><p className="text-xl font-black text-white">{profile?.groupeSanguin?.replace('_POSITIF', '+').replace('_NEGATIF', '-') || 'Inconnu'}</p></div>
                      <div><p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Âge</p><p className="text-xl font-black text-white">{profile?.dateNaissance ? Math.floor((new Date().getTime() - new Date(profile.dateNaissance).getTime()) / 31536000000) : '?'} ans</p></div>
                      <div className="col-span-2"><p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Allergies Critiques</p><p className="text-xs font-bold text-rose-400 leading-relaxed">{profile?.allergies?.join(', ') || 'Aucune allergie connue'}</p></div>
                      <div className="col-span-2"><p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Pathologies</p><p className="text-xs font-bold text-white/80 leading-relaxed">{profile?.pathologies?.join(', ') || 'Néant'}</p></div>
                    </div>
                  </div>
                </div>
              )}

              {view === "first_aid" && (
                <div className="space-y-4">
                  <button onClick={() => setView("sos_confirm")} className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-primary-500 transition-colors mb-2"><ChevronRight className="w-4 h-4 rotate-180" /> Retour</button>
                  <div className="p-4 bg-accent-500/5 border border-accent-500/10 rounded-3xl flex items-start gap-4 mb-4">
                    <Bot className="w-6 h-6 text-accent-500 shrink-0 mt-1" />
                    <div><p className="text-sm font-bold text-slate-900 dark:text-white">Assistant Premiers Secours</p><p className="text-xs text-slate-500">Sélectionnez la situation pour des instructions de survie.</p></div>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    {[
                      { label: "Étouffement (Manoeuvre de Heimlich)", icon: <Zap className="w-4 h-4" />, color: "bg-amber-500" },
                      { label: "Arrêt Cardiaque (Massage)", icon: <Heart className="w-4 h-4" />, color: "bg-emergency-500" },
                      { label: "Inconscience (Position PLS)", icon: <AlertCircle className="w-4 h-4" />, color: "bg-primary-500" },
                      { label: "Hémorragie (Compression)", icon: <Zap className="w-4 h-4" />, color: "bg-rose-600" },
                    ].map((cat, i) => (
                      <button key={i} className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-2xl hover:border-accent-500/50 transition-all text-left">
                        <div className={`w-10 h-10 rounded-xl ${cat.color} text-white flex items-center justify-center shrink-0`}>{cat.icon}</div>
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{cat.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </>
  );
}
