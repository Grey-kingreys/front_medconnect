"use client";

import React, { useState, useEffect } from "react";
import { X, Save, Search, Filter, MapPin, Navigation, Info, Hospital, Pill, Building2, Target } from "lucide-react";
import GlobePicker from "../GlobePicker";
import { Structure } from "@/lib/api_admin";

interface MapModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: "picker" | "viewer";
  initialLat?: number;
  initialLng?: number;
  onLocationSelect?: (lat: number, lng: number) => void;
  structures?: Structure[]; // For viewer mode
  hideCloseButton?: boolean;
}

export function MapModal({
  isOpen,
  onClose,
  mode,
  initialLat,
  initialLng,
  onLocationSelect,
  structures = [],
  hideCloseButton = false,
}: MapModalProps) {
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number } | null>(
    initialLat && initialLng ? { lat: initialLat, lng: initialLng } : null
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("ALL");

  if (!isOpen) return null;

  const handleSave = () => {
    if (selectedCoords && onLocationSelect) {
      onLocationSelect(selectedCoords.lat, selectedCoords.lng);
      onClose();
    }
  };

  const filteredStructures = structures.filter(s => {
    const matchesSearch = s.nom.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          s.ville?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === "ALL" || s.type === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center animate-in fade-in duration-300">
      {/* Background with heavy blur */}
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-xl" onClick={onClose} />

      <div 
        className="relative w-full h-full md:h-screen md:w-screen bg-white dark:bg-slate-900 shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header - Adaptive based on mode */}
        <div className="absolute top-0 inset-x-0 z-10 p-4 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-b from-white dark:from-slate-900 via-white/80 dark:via-slate-900/80 to-transparent">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary-500/10 dark:bg-primary-500/20 flex items-center justify-center border border-primary-500/20 dark:border-primary-500/30">
              <Navigation className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                {mode === "picker" ? "Définir la localisation" : "Explorer les structures"}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {mode === "picker" ? "Cliquez sur le globe pour placer votre structure" : "Trouvez les établissements de santé à proximité"}
              </p>
            </div>
          </div>

          {mode === "viewer" && (
            <div className="flex flex-1 max-w-2xl gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Rechercher une structure..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-100 dark:bg-slate-800/50 backdrop-blur-md border border-slate-200 dark:border-slate-700/50 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-500 focus:outline-none focus:border-primary-500/50 transition-all"
                />
              </div>
              <div className="relative">
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="pl-4 pr-10 py-2.5 bg-slate-100 dark:bg-slate-800/50 backdrop-blur-md border border-slate-200 dark:border-slate-700/50 rounded-xl text-slate-900 dark:text-white appearance-none cursor-pointer focus:outline-none focus:border-primary-500/50"
                >
                  <option value="ALL">Tous les types</option>
                  <option value="HOPITAL">Hôpitaux</option>
                  <option value="CLINIQUE">Cliniques</option>
                  <option value="PHARMACIE">Pharmacies</option>
                </select>
                <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              </div>
            </div>
          )}

          {!hideCloseButton && (
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 dark:hover:bg-slate-700/50 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all border border-slate-200 dark:border-slate-700/50"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* The Map/Globe */}
        <div className="flex-1 relative">
          <GlobePicker
            initialLat={initialLat}
            initialLng={initialLng}
            onLocationSelect={onLocationSelect ? (lat, lng) => setSelectedCoords({ lat, lng }) : undefined}
            structures={filteredStructures.map(s => ({
              id: s.id || s.nom,
              lat: s.latitude || 0,
              lng: s.longitude || 0,
              label: s.nom,
              type: s.type
            }))}
            className="w-full h-full rounded-none border-none"
          />
          
          {/* Legend/Info for Viewer mode */}
          {mode === "viewer" && (
            <div className="absolute left-6 bottom-6 space-y-2 pointer-events-none">
              <div className="p-3 bg-white/90 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200 dark:border-slate-700/50 rounded-2xl flex flex-col gap-2 pointer-events-auto">
                <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <span>Hôpitaux ({structures.filter(s => s.type === "HOPITAL").length})</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
                  <div className="w-2 h-2 rounded-full bg-purple-500" />
                  <span>Cliniques ({structures.filter(s => s.type === "CLINIQUE").length})</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Pharmacies ({structures.filter(s => s.type === "PHARMACIE").length})</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer for Picker mode */}
        {mode === "picker" && (
          <div className="absolute bottom-0 inset-x-0 p-6 bg-gradient-to-t from-slate-950/90 to-transparent backdrop-blur-sm border-t border-slate-800/50 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4 px-5 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl">
              <div className="p-2 bg-primary-500/10 rounded-lg">
                <MapPin className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Coordonnées sélectionnées</p>
                <p className="text-sm font-mono text-slate-900 dark:text-white">
                  {selectedCoords 
                    ? `${selectedCoords.lat.toFixed(6)}, ${selectedCoords.lng.toFixed(6)}`
                    : "En attente de sélection..."}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 md:px-8 py-4 rounded-2xl text-sm font-semibold text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-all"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!selectedCoords}
                className="flex-[2] md:px-10 py-4 group relative flex items-center justify-center gap-2 rounded-2xl text-sm font-bold text-white overflow-hidden disabled:opacity-50 transition-all shadow-lg shadow-primary-500/20"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-primary-600 to-cyan-500" />
                <span className="absolute inset-0 bg-gradient-to-r from-primary-500 to-secondary-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className="relative flex items-center gap-2">
                  <Save className="w-5 h-5" />
                  Enregistrer la position
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
