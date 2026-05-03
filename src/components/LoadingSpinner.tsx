"use client";

import Image from "next/image";
import { Loader2 } from "lucide-react";

interface LoadingSpinnerProps {
  message?: string;
  fullPage?: boolean;
}

export function LoadingSpinner({ message = "Chargement...", fullPage = false }: LoadingSpinnerProps) {
  const content = (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <Image
          src="/images/logo.png"
          alt="MedConnect"
          width={fullPage ? 64 : 48}
          height={fullPage ? 64 : 48}
          className="rounded-2xl animate-pulse-glow"
        />
        <div className="absolute -bottom-2 -right-2 bg-white dark:bg-slate-900 rounded-full p-1 shadow-lg">
          <Loader2 className="w-5 h-5 text-primary-500 animate-spin" />
        </div>
      </div>
      <div className="flex flex-col items-center">
        <p className="text-sm font-semibold bg-gradient-to-r from-primary-400 to-cyan-400 bg-clip-text text-transparent animate-pulse">
          {message}
        </p>
        <div className="mt-2 w-32 h-1 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
          <div className="w-1/2 h-full bg-gradient-to-r from-primary-500 to-cyan-500 animate-loading-bar" />
        </div>
      </div>
    </div>
  );

  if (fullPage) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white dark:bg-[#030712] transition-colors duration-300">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary-500/5 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-500/5 rounded-full blur-[120px]" />
        </div>
        {content}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center p-8">
      {content}
    </div>
  );
}
