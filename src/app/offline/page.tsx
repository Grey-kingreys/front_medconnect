"use client";

import React from "react";
import Link from "next/link";
import { WifiOff, Home, RefreshCw } from "lucide-react";

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white">
      <div className="max-w-md w-full text-center space-y-6 bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700">
        <div className="flex justify-center">
          <div className="p-4 bg-blue-100 dark:bg-blue-900/30 rounded-full text-blue-600 dark:text-blue-400">
            <WifiOff size={48} />
          </div>
        </div>
        
        <div className="space-y-2">
          <h1 className="text-2xl font-bold font-outfit">Vous êtes hors ligne</h1>
          <p className="text-slate-600 dark:text-slate-400">
            Il semble que vous n'ayez pas de connexion internet. Certaines fonctionnalités de MedConnect restent disponibles hors ligne, comme votre carnet de santé et vos patients déjà consultés.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <button 
            onClick={() => window.location.reload()}
            className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-all active:scale-95"
          >
            <RefreshCw size={18} />
            Réessayer la connexion
          </button>
          
          <Link 
            href="/dashboard"
            className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-900 dark:text-white rounded-xl font-medium transition-all"
          >
            <Home size={18} />
            Retour au tableau de bord
          </Link>
        </div>
        
        <p className="text-xs text-slate-500 dark:text-slate-500 pt-4 border-t border-slate-100 dark:border-slate-700">
          MedConnect utilise la technologie PWA pour vous accompagner même sans réseau.
        </p>
      </div>
    </div>
  );
}
