"use client";

import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { MapPin, Target, ZoomIn, ZoomOut, Layers, Crosshair } from "lucide-react";

interface GlobePickerProps {
  initialLat?: number;
  initialLng?: number;
  onLocationSelect?: (lat: number, lng: number) => void;
  onStructureClick?: (id: string) => void;
  className?: string;
  structures?: { id: string; lat: number; lng: number; label: string; type: string }[];
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

export default function GlobePicker({
  initialLat,
  initialLng,
  onLocationSelect,
  onStructureClick,
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
  const isInitialMount = useRef(true);

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      projection: { name: "globe" } as any,
    });

    map.current.on("style.load", () => {
      if (!map.current) return;
      
      const style = map.current.getStyle();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const isNight = style && (style.name?.toLowerCase().includes("night") || (style as any).id?.toLowerCase().includes("night"));

      // Use a more reliable GeoJSON source for continents
      if (!map.current.getSource('continents')) {
        map.current.addSource('continents', {
          type: 'geojson',
          data: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson'
        });

        // Find a safe layer to insert before (usually before labels)
        const layers = map.current.getStyle().layers;
        let firstLabelLayerId;
        if (layers) {
          for (const layer of layers) {
            if (layer.type === 'symbol' || layer.id.includes('label')) {
              firstLabelLayerId = layer.id;
              break;
            }
          }
        }

        map.current.addLayer({
          'id': 'continent-fill',
          'type': 'fill',
          'source': 'continents',
          'paint': {
            'fill-color': [
              'match',
              ['get', 'CONTINENT'],
              'Africa', '#f59e0b',
              'Asia', '#ef4444',
              'Europe', '#3b82f6',
              'North America', '#10b981',
              'South America', '#ec4899',
              'Oceania', '#8b5cf6',
              'Antarctica', '#f1f5f9',
              'rgba(148, 163, 184, 0.5)'
            ],
            'fill-opacity': isNight ? 0.25 : 0.2
          }
        }, firstLabelLayerId);

        map.current.addLayer({
          'id': 'continent-outline',
          'type': 'line',
          'source': 'continents',
          'paint': {
            'line-color': isNight ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
            'line-width': 0.8
          }
        }, firstLabelLayerId);
      }
      
      if (style && !style.name?.toLowerCase().includes("satellite")) {
        map.current.setFog({
          color: isNight ? "rgb(15, 23, 42)" : "rgb(186, 210, 247)", 
          "high-color": isNight ? "rgb(30, 41, 59)" : "rgb(36, 92, 223)",
          "horizon-blend": 0.02,
          "space-color": isNight ? "rgb(2, 6, 23)" : "rgb(255, 255, 255)",
          "star-intensity": isNight ? 0.6 : 0,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only once

  // Handle style toggle without re-init
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (!map.current) return;
    
    const setMapStyle = () => {
      map.current?.setStyle(isSatellite ? "mapbox://styles/mapbox/satellite-v9" : "mapbox://styles/mapbox/navigation-night-v1");
    };

    if (!map.current.isStyleLoaded()) {
      map.current.once("style.load", setMapStyle);
    } else {
      setMapStyle();
    }
  }, [isSatellite]);

  // Handle structures markers updates
  useEffect(() => {
    if (!map.current) return;

    // Clear existing markers
    markers.current.forEach(m => m.remove());
    markers.current = [];

    if (structures) {
      structures.forEach(s => {
        const el = document.createElement('div');
        el.className = 'custom-marker group cursor-pointer';
        
        // Define colors and icons based on type
        const config = s.type === "HOPITAL" 
          ? { color: "#3b82f6", icon: `<path d="M19 14h-4v4h-4v-4H7v-4h4V6h4v4h4v4z"/><path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14z"/>` }
          : s.type === "CLINIQUE" 
          ? { color: "#a855f7", icon: `<path d="M3 21h18v-2H3v2zm0-4h18v-2H3v2zm0-4h18v-2H3v2zm0-4h18V7H3v2zm0-4h18V3H3v2z"/>` } 
          : { color: "#10b981", icon: `<path d="M10.5 20a1.5 1.5 0 0 0 3 0v-4.5H18a1.5 1.5 0 0 0 0-3h-4.5V8a1.5 1.5 0 0 0-3 0v4.5H6a1.5 1.5 0 0 0 0 3h4.5V20z"/>` };

        el.innerHTML = `
          <div class="relative flex flex-col items-center">
            <!-- Pin Body -->
            <div class="relative flex items-center justify-center w-10 h-10 transform transition-all duration-300 group-hover:scale-110 group-hover:-translate-y-1">
              <svg viewBox="0 0 24 24" class="w-full h-full drop-shadow-xl" style="fill: ${config.color}">
                <path d="M12 0C7.58 0 4 3.58 4 8c0 5.25 7 13 8 16 1-3 8-10.75 8-16 0-4.42-3.58-8-8-8z"/>
              </svg>
              <div class="absolute inset-0 flex items-center justify-center pb-1">
                <svg viewBox="0 0 24 24" class="w-4 h-4 text-white fill-current">
                  ${config.icon}
                </svg>
              </div>
            </div>
            
            <!-- Label -->
            <div class="absolute top-10 mt-1 px-3 py-1.5 bg-slate-900/95 backdrop-blur-md rounded-xl border border-slate-700/50 shadow-2xl opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100 whitespace-nowrap z-10 pointer-events-none">
              <p class="text-[11px] font-bold text-white mb-0.5">${s.label}</p>
              <p class="text-[9px] text-slate-400 font-medium uppercase tracking-wider">${s.type}</p>
            </div>
            
            <!-- Pulse effect -->
            <div class="absolute -bottom-1 w-2 h-1 bg-black/40 rounded-full blur-[1px] group-hover:scale-150 transition-transform"></div>
          </div>
        `;

        const m = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([s.lng, s.lat])
          .addTo(map.current!);

        el.addEventListener('click', (e) => {
          e.stopPropagation();
          if (onStructureClick) onStructureClick(s.id);
        });
        
        markers.current.push(m);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
