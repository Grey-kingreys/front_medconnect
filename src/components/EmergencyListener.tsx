"use client";

import { useState, useEffect, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "@/hooks/useAuth";
import { takeChargeSOS } from "@/lib/api_carnet";
import { 
  AlertTriangle, 
  MapPin, 
  User, 
  Phone, 
  Bell, 
  X, 
  ChevronRight,
  ShieldAlert,
  Navigation,
  Loader2
} from "lucide-react";
import Link from "next/link";

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

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
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [activeAlert, setActiveAlert] = useState<EmergencyAlert | null>(null);
  const [handledBy, setHandledBy] = useState<string | null>(null);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  const [loading, setLoading] = useState(false);

  // Initialize Socket
  useEffect(() => {
    if (!user || (user.role !== "MEDECIN" && user.role !== "STRUCTURE_ADMIN" && user.role !== "ADMIN")) {
      return;
    }

    const token = localStorage.getItem("access_token");
    if (!token) return;

    const newSocket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket"]
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [user]);

  // Listen for alerts
  useEffect(() => {
    if (!socket) return;

    socket.on("emergencyAlert", (data: EmergencyAlert) => {
      setActiveAlert(data);
      setHandledBy(null);
      playAlarm();
    });

    socket.on("emergencyHandled", (data: { urgenceId: string, structureName: string }) => {
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
      const alarm = new Audio("https://cdn.pixabay.com/audio/2022/03/10/audio_5e9f899c71.mp3"); // Siren sound
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
            ) : (
              <button 
                onClick={async () => {
                  setLoading(true);
                  try {
                    await takeChargeSOS(activeAlert.urgenceId);
                    stopAlarm();
                  } catch (err) {
                    console.error(err);
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading}
                className="flex-1 py-5 bg-emergency-500 text-white rounded-3xl font-black text-sm uppercase tracking-widest hover:bg-emergency-600 transition-all shadow-xl shadow-emergency-500/30 flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Prendre en Charge <ChevronRight className="w-5 h-5" /></>}
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
