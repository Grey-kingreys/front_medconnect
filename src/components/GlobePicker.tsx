"use client";

import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { MapPin, Target, ZoomIn, ZoomOut, Search, Layers, Crosshair } from "lucide-react";

interface GlobePickerProps {
  initialLat?: number;
  initialLng?: number;
  onLocationSelect?: (lat: number, lng: number) => void;
  className?: string;
  structures?: { lat: number; lng: number; label: string; type: string }[];
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

export default function GlobePicker({
  initialLat,
  initialLng,
  onLocationSelect,
  structures,
  className = "",
}: GlobePickerProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    initialLat && initialLng ? { lat: initialLat, lng: initialLng } : null
  );

  const [isSatellite, setIsSatellite] = useState(false);

  useEffect(() => {
    if (!mapContainer.current || !MAPBOX_TOKEN) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    const startLng = initialLng || -12.4848; 
    const startLat = initialLat || 9.9456;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/navigation-night-v1",
      center: [startLng, startLat],
      zoom: initialLat ? 12 : 2,
      projection: { name: "globe" } as any,
    });

    map.current.on("style.load", () => {
      if (!map.current) return;
      
      // Re-add fog only for non-satellite styles
      const style = map.current.getStyle();
      if (style && !style.name?.toLowerCase().includes("satellite")) {
        map.current.setFog({
          color: "rgb(186, 210, 247)", 
          "high-color": "rgb(36, 92, 223)",
          "horizon-blend": 0.02,
          "space-color": "rgb(11, 11, 25)",
          "star-intensity": 0.6,
        });
      }
    });

    if (initialLat && initialLng) {
      marker.current = new mapboxgl.Marker({ color: "#3b82f6" })
        .setLngLat([initialLng, initialLat])
        .addTo(map.current);
    }

    map.current.on("click", (e) => {
      if (!onLocationSelect) return;
      const { lng, lat } = e.lngLat;
      if (marker.current) {
        marker.current.setLngLat([lng, lat]);
      } else {
        marker.current = new mapboxgl.Marker({ color: "#3b82f6" })
          .setLngLat([lng, lat])
          .addTo(map.current!);
      }
      setCoords({ lat, lng });
      onLocationSelect(lat, lng);
    });

    return () => {
      map.current?.remove();
    };
  }, []); // Only once

  // Handle style toggle without re-init
  useEffect(() => {
    if (!map.current) return;
    map.current.setStyle(isSatellite ? "mapbox://styles/mapbox/satellite-v9" : "mapbox://styles/mapbox/navigation-night-v1");
  }, [isSatellite]);

  // Handle structures markers updates
  useEffect(() => {
    if (!map.current) return;

    // Clear existing markers
    markers.current.forEach(m => m.remove());
    markers.current = [];

    if (structures) {
      structures.forEach(s => {
        const color = s.type === "HOPITAL" ? "#3b82f6" : s.type === "CLINIQUE" ? "#a855f7" : "#10b981";
        const popup = new mapboxgl.Popup({ offset: 25 })
          .setHTML(`<div class="p-2 text-slate-900 font-bold">${s.label}</div>`);

        const m = new mapboxgl.Marker({ color })
          .setLngLat([s.lng, s.lat])
          .setPopup(popup)
          .addTo(map.current!);
        
        markers.current.push(m);
      });
    }
  }, [structures, isSatellite]);

  const handleZoomIn = (e: React.MouseEvent) => {
    e.stopPropagation();
    map.current?.zoomIn();
  };
  const handleZoomOut = (e: React.MouseEvent) => {
    e.stopPropagation();
    map.current?.zoomOut();
  };
  const handleReset = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (coords) {
      map.current?.flyTo({ center: [coords.lng, coords.lat], zoom: 15 });
    }
  };

  const handleAutoLocation = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      const { latitude, longitude } = pos.coords;
      map.current?.flyTo({ center: [longitude, latitude], zoom: 15 });
      if (onLocationSelect) {
        if (marker.current) {
          marker.current.setLngLat([longitude, latitude]);
        } else {
          marker.current = new mapboxgl.Marker({ color: "#3b82f6" })
            .setLngLat([longitude, latitude])
            .addTo(map.current!);
        }
        setCoords({ lat: latitude, lng: longitude });
        onLocationSelect(latitude, longitude);
      }
    });
  };

  const toggleStyle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsSatellite(!isSatellite);
  };

  if (!MAPBOX_TOKEN) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-slate-900/50 rounded-2xl border border-slate-800 text-center">
        <AlertCircle className="w-8 h-8 text-emergency-500 mb-2" />
        <p className="text-sm text-slate-400">NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN manquant dans le .env</p>
      </div>
    );
  }

  return (
    <div className={`relative group rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800/50 bg-slate-900 ${className}`}>
      <div ref={mapContainer} className="w-full h-full min-h-[350px]" />
      
      {/* Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2">
        <button
          type="button"
          onClick={handleZoomIn}
          className="p-2 bg-white dark:bg-slate-900/80 backdrop-blur-md border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 hover:text-primary-500 transition-colors shadow-lg"
          title="Zoomer"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          className="p-2 bg-white dark:bg-slate-900/80 backdrop-blur-md border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 hover:text-primary-500 transition-colors shadow-lg"
          title="Dézoomer"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <div className="h-px bg-slate-700/50 my-1 mx-1" />
        <button
          type="button"
          onClick={toggleStyle}
          className={`p-2 backdrop-blur-md border rounded-lg transition-all shadow-lg ${isSatellite ? "bg-primary-500 border-primary-400 text-white" : "bg-white dark:bg-slate-900/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"}`}
          title="Mode Satellite"
        >
          <Layers className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleAutoLocation}
          className="p-2 bg-white dark:bg-slate-900/80 backdrop-blur-md border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 hover:text-primary-500 transition-colors shadow-lg"
          title="Me localiser"
        >
          <Crosshair className="w-4 h-4" />
        </button>
        {coords && (
          <button
            type="button"
            onClick={handleReset}
            className="p-2 bg-white dark:bg-slate-900/80 backdrop-blur-md border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 hover:text-primary-500 transition-colors shadow-lg"
            title="Revenir au marqueur"
          >
            <Target className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Overlay info */}
      <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between pointer-events-none">
        <div className="px-3 py-1.5 bg-slate-900/80 backdrop-blur-md border border-slate-700 rounded-full flex items-center gap-2 text-[10px] text-slate-400 pointer-events-auto">
          <MapPin className="w-3 h-3 text-primary-500" />
          {coords ? (
            <span>{coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}</span>
          ) : (
            <span>Cliquez sur le globe pour choisir</span>
          )}
        </div>
      </div>
    </div>
  );
}

import { AlertCircle } from "lucide-react";
