"use client";

import { useState, useEffect } from "react";
import { Activity, Globe, Shield, Server, CheckCircle, XCircle, AlertTriangle, RefreshCw } from "lucide-react";

export default function DebugPage() {
  const [status, setStatus] = useState<any>({
    backend: "testing",
    env: {
      NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001 (default)",
      NODE_ENV: process.env.NODE_ENV,
    },
    error: null,
    details: null,
  });

  const checkConnectivity = async () => {
    setStatus((prev: any) => ({ ...prev, backend: "testing", error: null }));
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    
    try {
      console.log(`[Debug] Testing connectivity to: ${apiUrl}`);
      const startTime = Date.now();
      const res = await fetch(apiUrl, { 
        method: "GET",
        headers: { "Content-Type": "application/json" }
      });
      const duration = Date.now() - startTime;
      
      const data = await res.json();
      
      setStatus((prev: any) => ({
        ...prev,
        backend: "online",
        details: {
          status: res.status,
          statusText: res.statusText,
          latency: `${duration}ms`,
          data,
        }
      }));
    } catch (err: any) {
      console.error("[Debug] Connectivity test failed:", err);
      setStatus((prev: any) => ({
        ...prev,
        backend: "offline",
        error: err.message || "Failed to fetch",
        details: {
          stack: err.stack,
          type: err.name,
        }
      }));
    }
  };

  useEffect(() => {
    checkConnectivity();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 sm:p-8 font-mono">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className="w-8 h-8 text-primary-500" />
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Diagnostic Réseau MedConnect</h1>
          </div>
          <button 
            onClick={checkConnectivity}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${status.backend === "testing" ? "animate-spin" : ""}`} />
            Réessayer
          </button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Status Card */}
          <div className={`p-6 rounded-2xl border ${
            status.backend === "online" ? "bg-green-500/10 border-green-500/20" : 
            status.backend === "offline" ? "bg-red-500/10 border-red-500/20" : 
            "bg-blue-500/10 border-blue-500/20"
          }`}>
            <div className="flex items-center gap-2 mb-4">
              <Server className="w-5 h-5" />
              <h2 className="font-semibold text-sm uppercase tracking-wider">État Backend</h2>
            </div>
            <div className="flex items-center gap-3">
              {status.backend === "online" ? <CheckCircle className="w-8 h-8 text-green-500" /> : 
               status.backend === "offline" ? <XCircle className="w-8 h-8 text-red-500" /> : 
               <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />}
              <span className={`text-2xl font-bold ${
                status.backend === "online" ? "text-green-600" : 
                status.backend === "offline" ? "text-red-600" : 
                "text-blue-600"
              }`}>
                {status.backend.toUpperCase()}
              </span>
            </div>
          </div>

          {/* Config Card */}
          <div className="md:col-span-2 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 mb-4">
              <Globe className="w-5 h-5 text-slate-400" />
              <h2 className="font-semibold text-sm uppercase tracking-wider text-slate-500">Configuration Environnement</h2>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <span className="text-slate-400">NEXT_PUBLIC_API_URL</span>
                <span className="text-slate-900 dark:text-slate-200 font-bold">{status.env.NEXT_PUBLIC_API_URL}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">NODE_ENV</span>
                <span className="text-slate-900 dark:text-slate-200">{status.env.NODE_ENV}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Details Section */}
        <div className="p-6 rounded-2xl bg-slate-900 text-slate-300 border border-slate-800">
          <h2 className="text-sm font-semibold mb-4 text-slate-500 uppercase tracking-wider">Détails de la réponse / Erreurs</h2>
          {status.details ? (
            <pre className="text-xs overflow-auto max-h-96">
              {JSON.stringify(status.details, null, 2)}
            </pre>
          ) : (
            <div className="flex items-center gap-2 text-slate-500 italic">
              <AlertTriangle className="w-4 h-4" />
              En attente d'informations...
            </div>
          )}
          {status.error && (
            <div className="mt-4 p-4 bg-red-500/20 border border-red-500/40 rounded-xl text-red-400 text-sm">
              <div className="font-bold mb-1">Erreur Critique :</div>
              {status.error}
              <div className="mt-2 text-xs opacity-70">
                Conseil : Si l'erreur est "Failed to fetch", vérifiez que :
                <ul className="list-disc ml-4 mt-1">
                  <li>L'URL du backend est accessible depuis votre navigateur</li>
                  <li>Le backend a activé CORS pour ce domaine ({typeof window !== "undefined" ? window.location.origin : "votre domaine"})</li>
                  <li>Le certificat SSL est valide si vous êtes en HTTPS</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        <footer className="text-center text-slate-500 text-xs py-4">
          &copy; MedConnect Diagnostic Tool v1.0
        </footer>
      </div>
    </div>
  );
}
