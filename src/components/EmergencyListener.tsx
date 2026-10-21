"use client";
// Dette préexistante, backlog points 21 et 22
/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/immutability, react-hooks/set-state-in-effect, react/no-unescaped-entities */

import { useState, useEffect } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "@/hooks/useAuth";
import { takeChargeSOS } from "@/lib/api_carnet";
import { ApiError } from "@/lib/api_auth";
import { gererSessionRevoquee } from "@/lib/deconnexion_forcee";
import { 
  AlertTriangle, 
  MapPin, 
  User,
  Bell, 
  X, 
  ChevronRight,
  ShieldAlert,
  Navigation,
  Loader2
} from "lucide-react";
import Link from "next/link";

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

// Délai d'arrivée annoncé : bornes du serveur et choix rapides
const DELAI_MIN = 1;
const DELAI_MAX = 240;
const DELAIS_RAPIDES = [10, 15, 20, 30, 45, 60];

interface EmergencyAlert {
  urgenceId: string;
  patientId: string;
  patientName: string;
  latitude: number;
  longitude: number;
  message: string;
  createdAt: string;
  profilMedical?: any;
}

export default function EmergencyListener() {
  const { user, profile } = useAuth();
  // Même règle que le serveur : seuls les titulaires de sos:respond reçoivent les alertes SOS
  const peutRepondreSOS = profile?.permissions?.includes("sos:respond") ?? false;
  const utilisateurId = user?.id;
  const [socket, setSocket] = useState<Socket | null>(null);
  const [activeAlert, setActiveAlert] = useState<EmergencyAlert | null>(null);
  const [handledBy, setHandledBy] = useState<string | null>(null);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  const [loading, setLoading] = useState(false);
  // Délai d'arrivée annoncé au patient avant de confirmer la prise en charge (F5)
  const [choixDelai, setChoixDelai] = useState(false);
  const [delaiSaisi, setDelaiSaisi] = useState("");
  const [erreurPriseEnCharge, setErreurPriseEnCharge] = useState<string | null>(null);
  const delaiMinutes = Number(delaiSaisi);
  const delaiValide = /^\d+$/.test(delaiSaisi) && delaiMinutes >= DELAI_MIN && delaiMinutes <= DELAI_MAX;

  const confirmerPriseEnCharge = async () => {
    if (!activeAlert || !delaiValide) return;
    setLoading(true);
    setErreurPriseEnCharge(null);
    try {
      await takeChargeSOS(activeAlert.urgenceId, delaiMinutes);
      setChoixDelai(false);
      setDelaiSaisi("");
      stopAlarm();
    } catch (err) {
      setErreurPriseEnCharge(
        err instanceof ApiError && err.status !== 0 && err.status < 500
          ? err.message
          : "La prise en charge n'a pas pu être enregistrée. Vérifiez votre connexion puis réessayez."
      );
    } finally {
      setLoading(false);
    }
  };

  // Initialize Socket
  useEffect(() => {
    if (!utilisateurId || !peutRepondreSOS) {
      return;
    }

    const token = localStorage.getItem("access_token");
    if (!token) return;

    const newSocket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket"]
    });

    newSocket.on("sessionRevoquee", gererSessionRevoquee);

    setSocket(newSocket);

    return () => {
      newSocket.off("sessionRevoquee", gererSessionRevoquee);
      newSocket.disconnect();
    };
  }, [utilisateurId, peutRepondreSOS]);

  // Listen for alerts
  useEffect(() => {
    if (!socket) return;

    socket.on("emergencyAlert", (data: EmergencyAlert) => {
      setActiveAlert(data);
      setHandledBy(null);
      setChoixDelai(false);
      setErreurPriseEnCharge(null);
      playAlarm();
    });

    // Payload enrichi (délai d'arrivée), champs supplémentaires facultatifs
    socket.on("emergencyHandled", (data: { urgenceId: string, structureName: string, delaiArriveeMinutes?: number, finDelaiAt?: string }) => {
      if (activeAlert?.urgenceId === data.urgenceId) {
        setHandledBy(data.structureName);
        // On arrête l'alarme si c'est pris par quelqu'un d'autre
        if (audio) {
          audio.pause();
          audio.currentTime = 0;
        }
      }
    });

    return () => {
      socket.off("emergencyAlert");
      socket.off("emergencyHandled");
    };
  }, [socket, activeAlert, audio]);

  const playAlarm = async () => {
    try {
      const alarm = new Audio("/sounds/sirene.wav"); // Sirène hébergée localement (générée par scripts/generer-sirene.mjs)
      alarm.loop = true;
      setAudio(alarm);
      await alarm.play();
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        console.warn("L'autostart audio a été bloqué par le navigateur. L'alerte visuelle reste active.");
      } else {
        console.error("Erreur lecture alarme", err);
      }
    }
  };

  const stopAlarm = () => {
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      setAudio(null);
    }
    setActiveAlert(null);
  };

  if (!activeAlert) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-emergency-500/20 backdrop-blur-md animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-slate-900/60" onClick={stopAlarm} />
      
      <div className="relative w-full max-w-lg bg-white dark:bg-[#0f172a] rounded-[2.5rem] shadow-[0_0_50px_rgba(220,38,38,0.5)] border-4 border-emergency-500 overflow-hidden animate-in zoom-in duration-500">
        
        {/* Animated Background Pulse */}
        <div className="absolute inset-0 bg-emergency-500/5 animate-pulse" />

        {/* Header */}
        <div className="bg-emergency-500 p-6 text-white flex items-center justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-20 scale-150 rotate-12">
            <AlertTriangle className="w-24 h-24" />
          </div>
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-emergency-500 shadow-lg animate-bounce">
              <Bell className="w-6 h-6 fill-current" />
            </div>
            <div>
              <h2 className="text-2xl font-black uppercase tracking-tighter">ALERTE SOS VITALE</h2>
              <p className="text-xs font-bold text-white/80 uppercase tracking-widest">Intervention Requise Immédiate</p>
            </div>
          </div>
          <button onClick={stopAlarm} className="relative z-10 p-2 hover:bg-white/20 rounded-xl transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 space-y-6 relative z-10">
          
          {/* Patient Info */}
          <div className="flex items-start gap-6">
            <div className="w-20 h-20 rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 border border-slate-200 dark:border-slate-700">
              <User className="w-10 h-10" />
            </div>
            <div className="flex-1">
              <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-1">{activeAlert.patientName}</h3>
              <p className="text-slate-500 text-sm mb-3">Patient MedConnecte en détresse</p>
              <div className="flex gap-2">
                <span className="px-3 py-1 bg-emergency-500/10 text-emergency-500 text-[10px] font-black rounded-lg uppercase tracking-widest">
                  Groupe {activeAlert.profilMedical?.groupeSanguin?.replace('_POSITIF', '+').replace('_NEGATIF', '-') || '?'}
                </span>
                {activeAlert.profilMedical?.allergies?.length > 0 && (
                  <span className="px-3 py-1 bg-rose-500/10 text-rose-500 text-[10px] font-black rounded-lg uppercase tracking-widest">
                    Allergies
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Location Card */}
          <div className="p-6 bg-slate-50 dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-500">
                <MapPin className="w-5 h-5" />
                <span className="text-sm font-black uppercase tracking-widest">Position GPS</span>
              </div>
              <span className="text-[10px] text-slate-400 font-bold">{new Date(activeAlert.createdAt).toLocaleTimeString()}</span>
            </div>
            
            <p className="text-sm text-slate-600 dark:text-slate-400 italic">"{activeAlert.message || "Besoin d'aide immédiate !"}"</p>
            
            <div className="grid grid-cols-2 gap-3">
              <a 
                href={`https://www.google.com/maps/search/?api=1&query=${activeAlert.latitude},${activeAlert.longitude}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition-all shadow-sm"
              >
                <Navigation className="w-4 h-4" /> Voir sur Maps
              </a>
              <Link 
                href={`/dashboard/carnet/${activeAlert.patientId}`}
                className="flex items-center justify-center gap-2 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition-all shadow-sm"
              >
                <ShieldAlert className="w-4 h-4" /> Fiche Médicale
              </Link>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4">
            {handledBy ? (
              <div className="flex-1 py-5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-3xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 border-2 border-slate-200 dark:border-slate-700">
                <ShieldAlert className="w-5 h-5 text-emerald-500" /> Pris en charge par {handledBy}
              </div>
            ) : choixDelai ? (
              <div className="flex-1 space-y-4">
                <label htmlFor="delai-arrivee" className="block text-sm font-black text-slate-900 dark:text-white">
                  Dans combien de minutes vos équipes peuvent-elles arriver ?
                </label>
                <div className="grid grid-cols-3 gap-2" role="group" aria-label="Choix rapides du délai">
                  {DELAIS_RAPIDES.map(m => (
                    <button
                      key={m}
                      type="button"
                      aria-pressed={delaiSaisi === String(m)}
                      onClick={() => setDelaiSaisi(String(m))}
                      className={`py-3 rounded-2xl text-sm font-black transition-colors border-2 ${
                        delaiSaisi === String(m)
                          ? "bg-emergency-600 border-emergency-600 text-white"
                          : "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-emergency-500"
                      }`}
                    >
                      {m} min
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <input
                    id="delai-arrivee"
                    type="number"
                    inputMode="numeric"
                    min={DELAI_MIN}
                    max={DELAI_MAX}
                    step={1}
                    value={delaiSaisi}
                    onChange={e => setDelaiSaisi(e.target.value)}
                    aria-describedby="delai-arrivee-aide"
                    aria-invalid={delaiSaisi !== "" && !delaiValide}
                    placeholder="Autre délai"
                    className="w-32 p-3 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emergency-500"
                  />
                  <span className="text-sm font-bold text-slate-600 dark:text-slate-300">minutes</span>
                </div>
                <p id="delai-arrivee-aide" className={`text-xs ${delaiSaisi !== "" && !delaiValide ? "text-emergency-600 dark:text-emergency-500 font-bold" : "text-slate-600 dark:text-slate-400"}`}>
                  {delaiSaisi !== "" && !delaiValide
                    ? `Indiquez un nombre entier de minutes, entre ${DELAI_MIN} et ${DELAI_MAX}.`
                    : "Ce délai sera communiqué au patient."}
                </p>
                {erreurPriseEnCharge && (
                  <p role="alert" className="text-sm font-bold text-emergency-600 dark:text-emergency-500">
                    {erreurPriseEnCharge}
                  </p>
                )}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => { setChoixDelai(false); setErreurPriseEnCharge(null); }}
                    className="px-5 py-4 rounded-3xl text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    Retour
                  </button>
                  <button
                    type="button"
                    onClick={confirmerPriseEnCharge}
                    disabled={loading || !delaiValide}
                    className="flex-1 py-4 bg-emergency-600 text-white rounded-3xl font-black text-sm uppercase tracking-widest hover:bg-emergency-500 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : erreurPriseEnCharge ? "Réessayer" : "Confirmer la prise en charge"}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setChoixDelai(true)}
                className="flex-1 py-5 bg-emergency-500 text-white rounded-3xl font-black text-sm uppercase tracking-widest hover:bg-emergency-600 transition-all shadow-xl shadow-emergency-500/30 flex items-center justify-center gap-3 disabled:opacity-50"
              >
                Prendre en Charge <ChevronRight className="w-5 h-5" />
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
