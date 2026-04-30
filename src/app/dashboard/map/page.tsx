"use client";

import { useState, useEffect } from "react";
import { MapModal } from "@/components/modals/MapModal";
import { getAllStructures } from "@/lib/api_structure";
import { Loader2, Map as MapIcon, Globe, Navigation } from "lucide-react";

export default function MapPage() {
  const [structures, setStructures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAllStructures()
      .then(res => setStructures(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="h-[70vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
        <p className="text-slate-500 animate-pulse">Chargement de la carte et des structures...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Carte de Santé</h1>
          <p className="text-sm text-slate-500">Trouvez les établissements de santé, pharmacies et cliniques autour de vous.</p>
        </div>
      </div>

      <div className="relative h-[70vh] w-full rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800/60 shadow-2xl bg-slate-900 group">
        <MapModal
          isOpen={true}
          onClose={() => {}} // No-op as this is a page
          mode="viewer"
          structures={structures as any}
          hideCloseButton={true}
        />
        
        {/* Decorative elements if modal is not absolutely covering everything or as fallback */}
        {!structures.length && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm z-50">
            <div className="text-center p-8 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl">
              <Globe className="w-12 h-12 text-primary-500 mx-auto mb-4 animate-pulse" />
              <h3 className="text-lg font-bold text-white mb-2">Aucune structure trouvée</h3>
              <p className="text-sm text-slate-400">Revenez plus tard quand les établissements seront enregistrés.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
