"use client";
// Dette préexistante, backlog points 21 et 22
/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/immutability, react-hooks/set-state-in-effect, prefer-const, react/no-unescaped-entities */

import { useState, useEffect, useCallback } from "react";
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
import { usePathname } from "next/navigation";
import { getProfilMedical, ProfilMedical, createUrgence, getAiFirstAid, getMonAlerteEnCours, Urgence } from "@/lib/api_carnet";
import { ApiError } from "@/lib/api_auth";

// Relecture de l'alerte en attente de prise en charge (D14)
const INTERVALLE_RELECTURE_MS = 20_000;

// Compte à rebours affiché en mm:ss
const formatMmSs = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const minutesRestantes = (ms: number) => Math.max(1, Math.ceil(ms / 60_000));
const libelleMinutes = (n: number) => `${n} minute${n > 1 ? "s" : ""}`;

export default function EmergencyButton() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<"sos_confirm" | "sos_sent" | "first_aid">("sos_confirm");
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [locLoading, setLocLoading] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [timerActive, setTimerActive] = useState(false);
  const [profile, setProfile] = useState<ProfilMedical | null>(null);
  const [aiResponse, setAiResponse] = useState<{ tag: string; reponse: string; certain: boolean; similarite: number } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [customQuestion, setCustomQuestion] = useState("");
  const [activeQuestion, setActiveQuestion] = useState("");

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

  // Alerte en cours (F5) : état lu sur le serveur, relu périodiquement, compte à rebours
  const [alerte, setAlerte] = useState<Urgence | null>(null);
  const [erreurEnvoi, setErreurEnvoi] = useState<string | null>(null);
  const [envoiEchoue, setEnvoiEchoue] = useState(false);
  // Alerte enregistrée mais aucun établissement prévenu (pas de position, aucun soignant)
  const [aucunEtablissement, setAucunEtablissement] = useState(false);
  const [maintenant, setMaintenant] = useState(() => Date.now());

  const chargerAlerte = useCallback(async () => {
    try {
      const res = await getMonAlerteEnCours();
      setAlerte(res.data ?? null);
      return res.data ?? null;
    } catch {
      // Lecture silencieuse : l'écran garde le dernier état connu
      return null;
    }
  }, []);

  // Tant que l'alerte attend une prise en charge, relecture toutes les 20 s
  const enAttente = isOpen && alerte?.status === "LANCE";
  useEffect(() => {
    if (!enAttente) return;
    const id = setInterval(chargerAlerte, INTERVALLE_RELECTURE_MS);
    return () => clearInterval(id);
  }, [enAttente, chargerAlerte]);

  // Horloge à la seconde pour le compte à rebours et le délai avant relance
  const horlogeActive = isOpen && !!alerte;
  useEffect(() => {
    if (!horlogeActive) return;
    const id = setInterval(() => setMaintenant(Date.now()), 1000);
    return () => clearInterval(id);
  }, [horlogeActive]);

  if (user?.role !== "PATIENT") return null;

  const ouvrir = () => {
    setIsOpen(true);
    getLoc();
    setTimerActive(true);
    setView("sos_confirm");
    setErreurEnvoi(null);
    setEnvoiEchoue(false);
    // Une alerte encore active bloque la relance : afficher son état au lieu d'envoyer
    chargerAlerte().then(a => {
      if (a?.peutRelancerA && new Date(a.peutRelancerA).getTime() > Date.now()) {
        setTimerActive(false);
        setView("sos_sent");
      }
    });
  };

  // Rejoue le flux d'envoi existant (position, compte à rebours de 5 s)
  const relancer = () => {
    setErreurEnvoi(null);
    setEnvoiEchoue(false);
    setAucunEtablissement(false);
    setCountdown(5);
    setView("sos_confirm");
    setTimerActive(true);
    getLoc();
  };

  const priseEnCharge = alerte?.status === "PRIS_EN_CHARGE";
  const finDelaiMs = alerte?.finDelaiAt ? new Date(alerte.finDelaiAt).getTime() - maintenant : 0;
  const delaiDepasse = priseEnCharge && finDelaiMs <= 0;
  const relanceMs = alerte?.peutRelancerA ? new Date(alerte.peutRelancerA).getTime() - maintenant : 0;
  const relanceBloquee = relanceMs > 0;

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
      const res = await createUrgence({
        latitude: loc?.lat,
        longitude: loc?.lng,
        message: "Urgence vitale déclenchée depuis le dashboard."
      });
      // Le serveur dit exactement qui a été prévenu : aucun faux succès affiché.
      const personnePrevenue = res.data?.structuresAlertees === 0;
      setAucunEtablissement(personnePrevenue);
      setErreurEnvoi(personnePrevenue ? res.message ?? null : null);
      setEnvoiEchoue(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // Alerte déjà en cours : message du serveur affiché tel quel
        setErreurEnvoi(err.message);
        setEnvoiEchoue(false);
      } else {
        setErreurEnvoi("L'alerte n'a pas pu être envoyée. Vérifiez votre connexion puis réessayez, ou appelez directement les secours.");
        setEnvoiEchoue(true);
      }
    }
    setMaintenant(Date.now());
    setView("sos_sent");
    chargerAlerte();
  };

  const handleGetFirstAid = async (label: string) => {
    const query = label || customQuestion;
    if (!query.trim()) return;

    setAiLoading(true);
    setAiResponse(null);
    setActiveQuestion(query);
    try {
      const res = await getAiFirstAid(query);
      if (res.success) {
        setAiResponse(res.data);
        setCustomQuestion("");
      }
    } catch (err) {
      console.error("Erreur secours IA", err);
    } finally {
      setAiLoading(false);
    }
  };

  const reset = () => {
    setIsOpen(false);
    setTimeout(() => {
      setView("sos_confirm");
      setCountdown(5);
      setTimerActive(false);
      setAiResponse(null);
    }, 300);
  };

  const emergencyPhone = profile?.contactTelephone || "";

  const isInputPage = pathname?.startsWith("/dashboard/chat") || pathname?.startsWith("/dashboard/diagnostic");

  return (
    <>
      {/* Floating Trigger Button */}
      <div className={`fixed ${isInputPage ? 'bottom-28 md:bottom-6' : 'bottom-6'} right-6 z-[60] transition-all duration-300`}>
        <button
          onClick={ouvrir}
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
                    {envoiEchoue || aucunEtablissement ? (
                      <div className="w-20 h-20 bg-emergency-500/10 rounded-full flex items-center justify-center text-emergency-600"><AlertTriangle className="w-12 h-12" /></div>
                    ) : (
                      <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500"><CheckCircle2 className="w-12 h-12" /></div>
                    )}
                    <div>
                      <h4 className="text-2xl font-black text-slate-900 dark:text-white mb-1">
                        {envoiEchoue ? "Alerte non envoyée" : aucunEtablissement ? "Aucun établissement alerté" : priseEnCharge ? "Prise en charge" : "Alerte envoyée"}
                      </h4>
                      {!envoiEchoue && (
                        <p className="text-sm text-slate-500">Position partagée : {location ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : "Localisation en cours..."}</p>
                      )}
                    </div>
                  </div>

                  {erreurEnvoi && (
                    <p role="alert" className="text-sm font-bold text-center text-emergency-600 dark:text-emergency-500">{erreurEnvoi}</p>
                  )}
                  {(envoiEchoue || aucunEtablissement) && (
                    <button
                      onClick={relancer}
                      className="w-full py-4 bg-emergency-600 text-white rounded-3xl font-black text-xs uppercase tracking-widest hover:bg-emergency-500 transition-all"
                    >
                      {aucunEtablissement ? "Relancer l'alerte" : "Réessayer l'envoi"}
                    </button>
                  )}

                  {/* Suivi de l'alerte en cours : prise en charge, délai d'arrivée, relance */}
                  {!envoiEchoue && alerte && (
                    <div aria-live="polite" className="p-5 rounded-3xl border-2 border-slate-200 dark:border-slate-700 text-center space-y-3">
                      {priseEnCharge && !delaiDepasse && (
                        <>
                          <p className="text-base font-black text-emerald-700 dark:text-emerald-400">
                            {alerte.structurePriseEnCharge?.nom ?? "Un établissement de santé"} a pris en charge votre alerte
                          </p>
                          <p aria-hidden="true" className="text-sm text-slate-700 dark:text-slate-200">
                            Les secours arrivent dans environ{" "}
                            <span className="block text-4xl font-black tabular-nums text-slate-900 dark:text-white">{formatMmSs(finDelaiMs)}</span>
                          </p>
                          <p className="sr-only">Les secours arrivent dans environ {libelleMinutes(minutesRestantes(finDelaiMs))}.</p>
                          <p className="text-xs text-slate-600 dark:text-slate-400">Restez joignable : gardez votre téléphone allumé et près de vous.</p>
                        </>
                      )}
                      {delaiDepasse && (
                        <p className="text-sm font-bold text-slate-900 dark:text-white">
                          Le délai annoncé est dépassé. Si personne n&apos;est arrivé, vous pouvez relancer une alerte.
                        </p>
                      )}
                      {!priseEnCharge && (
                        <>
                          <p className="text-sm font-bold text-slate-900 dark:text-white">
                            Votre alerte a été envoyée aux établissements de santé proches. En attente d&apos;une prise en charge.
                          </p>
                          {relanceBloquee && (
                            <p className="text-xs text-slate-600 dark:text-slate-400">
                              Vous pourrez relancer une alerte dans environ {libelleMinutes(minutesRestantes(relanceMs))}.
                            </p>
                          )}
                        </>
                      )}
                      {(delaiDepasse || !priseEnCharge) && (
                        <button
                          onClick={relancer}
                          disabled={relanceBloquee}
                          className="w-full py-3 bg-emergency-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emergency-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Relancer une alerte
                        </button>
                      )}
                    </div>
                  )}

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
                      
                      {/* Utilisation de safeParse pour les listes stockées en JSON */}
                      <div className="col-span-2">
                        <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Allergies Critiques</p>
                        <p className="text-xs font-bold text-rose-400 leading-relaxed">
                          {(() => {
                            try {
                              const allergies = JSON.parse(profile?.allergies || '[]');
                              return Array.isArray(allergies) ? allergies.join(', ') : (profile?.allergies || 'Aucune allergie connue');
                            } catch {
                              return profile?.allergies || 'Aucune allergie connue';
                            }
                          })()}
                        </p>
                      </div>

                      <div className="col-span-2">
                        <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Pathologies</p>
                        <p className="text-xs font-bold text-white/80 leading-relaxed">
                          {(() => {
                            try {
                              const paths = JSON.parse(profile?.pathologies || '[]');
                              return Array.isArray(paths) ? paths.join(', ') : (profile?.pathologies || 'Néant');
                            } catch {
                              return profile?.pathologies || 'Néant';
                            }
                          })()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {view === "first_aid" && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <button onClick={() => { setView("sos_confirm"); setAiResponse(null); }} className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-primary-500 transition-colors mb-2"><ChevronRight className="w-4 h-4 rotate-180" /> Retour</button>
                  
                  {!aiResponse && (
                    <>
                      <div className="p-4 bg-accent-500/5 border border-accent-500/10 rounded-3xl flex items-start gap-4 mb-4">
                        <Bot className="w-6 h-6 text-accent-500 shrink-0 mt-1" />
                        <div>
                          <p className="text-sm font-bold text-slate-900 dark:text-white">Assistant Premiers Secours</p>
                          <p className="text-xs text-slate-500">Posez une question ou choisissez une situation critique.</p>
                        </div>
                      </div>

                      {/* Barre de recherche IA */}
                      <div className="relative mb-6">
                        <input
                          type="text"
                          value={customQuestion}
                          onChange={(e) => setCustomQuestion(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && customQuestion.trim() && handleGetFirstAid(customQuestion)}
                          placeholder="Ex: Que faire pour une brûlure ?"
                          className="w-full py-4 pl-5 pr-14 bg-slate-50 dark:bg-slate-900/50 border-2 border-slate-100 dark:border-slate-800 rounded-2xl text-sm focus:border-accent-500/50 focus:outline-none transition-all"
                        />
                        <button 
                          disabled={!customQuestion.trim() || aiLoading}
                          onClick={() => handleGetFirstAid(customQuestion)}
                          className="absolute right-2 top-2 bottom-2 px-4 bg-accent-500 text-white rounded-xl disabled:opacity-30 transition-all hover:bg-accent-600"
                        >
                          {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                        </button>
                      </div>

                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-2">Situations Critiques (IA)</p>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { label: "Étouffement", query: "Que faire en cas d'étouffement?", icon: <Zap className="w-4 h-4" />, color: "bg-amber-500" },
                          { label: "Arrêt Cardiaque", query: "Comment faire la RCP??", icon: <Heart className="w-4 h-4" />, color: "bg-emergency-500" },
                          { label: "Crise Épileptique", query: "Comment traiter une crise epileptique?", icon: <AlertCircle className="w-4 h-4" />, color: "bg-purple-600" },
                          { label: "Fracture", query: "Comment traiter une fracture?", icon: <Zap className="w-4 h-4" />, color: "bg-slate-600" },
                          { label: "Empoisonnement", query: "Comment traiter un empoisonnement?", icon: <Info className="w-4 h-4" />, color: "bg-emerald-600" },
                          { label: "Morsure de Serpent", query: "Comment traiter une morsure de serpent?", icon: <Zap className="w-4 h-4" />, color: "bg-orange-600" },
                          { label: "Blessure Oculaire", query: "Comment traiter une blessure oculaire?", icon: <Zap className="w-4 h-4" />, color: "bg-blue-500" },
                          { label: "Brûlure Chimique", query: "Comment traiter une brulure chimique?", icon: <Zap className="w-4 h-4" />, color: "bg-rose-600" },
                        ].map((cat, i) => (
                          <button 
                            key={i} 
                            disabled={aiLoading}
                            onClick={() => handleGetFirstAid(cat.query)}
                            className="flex items-center gap-3 p-3 bg-white dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800 rounded-2xl hover:border-accent-500/50 hover:shadow-lg hover:shadow-accent-500/5 transition-all text-left group disabled:opacity-50"
                          >
                            <div className={`w-8 h-8 rounded-lg ${cat.color} text-white flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>{cat.icon}</div>
                            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 leading-tight">{cat.label}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}

                  {aiResponse && (
                    <div className="space-y-4 animate-in zoom-in duration-300">
                      <div className="p-5 bg-slate-900 text-white rounded-[2rem] border-2 border-accent-500/30">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-accent-500 rounded-lg flex items-center justify-center"><Bot className="w-5 h-5" /></div>
                            <h5 className="font-black text-xs uppercase tracking-widest text-accent-400">Assistant IA</h5>
                          </div>
                          <span className="px-3 py-1 bg-accent-500/20 border border-accent-500/30 rounded-full text-[10px] font-black text-accent-400 uppercase tracking-tighter">
                            Tag: {aiResponse.tag}
                          </span>
                        </div>

                        <div className="mb-4 pb-4 border-b border-slate-800">
                          <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Votre question :</p>
                          <p className="text-sm font-bold text-slate-300 italic">"{activeQuestion}"</p>
                        </div>

                        <div className="prose prose-invert prose-sm">
                          <p className="text-sm leading-relaxed text-slate-200 font-medium whitespace-pre-line">
                            {aiResponse.reponse}
                          </p>
                        </div>
                        {!aiResponse.certain && (
                          <div className="mt-4 p-3 bg-emergency-500/10 border border-emergency-500/20 rounded-xl flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-emergency-500 shrink-0 mt-0.5" />
                            <p className="text-[10px] text-emergency-500 font-bold leading-tight">Attention : Matching faible ({Math.round(aiResponse.similarite * 100)}%). Appelez les secours.</p>
                          </div>
                        )}
                      </div>
                      <button 
                        onClick={() => setAiResponse(null)}
                        className="w-full py-3 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-slate-200 transition-colors"
                      >
                        Autre situation
                      </button>
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </>
  );
}
