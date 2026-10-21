"use client";

import { useEffect, useRef, useState } from "react";
import { X, CameraOff, Loader2 } from "lucide-react";

/**
 * Scanner de QR basé sur l'API native `BarcodeDetector` (aucune dépendance).
 * - Disponible sur Chromium/Android (cible des terminaux d'accueil).
 * - Repli gracieux : si l'API ou la caméra n'est pas dispo → message + saisie manuelle.
 * - Nécessite un contexte sécurisé (localhost en dev, HTTPS via Traefik en prod).
 */

interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}
type BarcodeDetectorCtor = new (opts?: { formats?: string[] }) => BarcodeDetectorLike;

export function QrScanner({
  onDetected,
  onClose,
}: {
  onDetected: (code: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;

    const stop = () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };

    const start = async () => {
      const Ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
      if (!Ctor) {
        setError("Le scan n'est pas supporté par ce navigateur. Saisissez le code manuellement.");
        setStarting(false);
        return;
      }
      const detector = new Ctor({ formats: ["qr_code"] });
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setStarting(false);

        const scan = async () => {
          if (stopped || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            const value = codes?.[0]?.rawValue?.trim();
            if (value) {
              stop();
              onDetected(value);
              return;
            }
          } catch {
            /* frame pas encore prête : on réessaie */
          }
          raf = requestAnimationFrame(scan);
        };
        raf = requestAnimationFrame(scan);
      } catch (e) {
        const name = (e as { name?: string })?.name;
        setError(name === "NotAllowedError" ? "Accès à la caméra refusé." : "Impossible d'ouvrir la caméra.");
        setStarting(false);
      }
    };

    start();
    return stop;
  }, [onDetected]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-slide-up">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800/50">
          <h3 className="font-semibold text-slate-900 dark:text-white">Scanner le QR du patient</h3>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4">
          {error ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <CameraOff className="w-10 h-10 text-slate-400" />
              <p className="text-sm text-slate-500">{error}</p>
            </div>
          ) : (
            <>
              <div className="relative aspect-square rounded-2xl overflow-hidden bg-slate-950">
                <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
                <div className="absolute inset-8 border-2 border-white/70 rounded-2xl pointer-events-none" />
                {starting && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-white" />
                  </div>
                )}
              </div>
              <p className="text-xs text-slate-400 text-center mt-3">Placez le QR du patient dans le cadre.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
