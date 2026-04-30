"use client";

import React from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  iconColor?: string;       // e.g. "text-primary-400"
  iconBg?: string;          // e.g. "bg-primary-500/10"
  trend?: {
    value: string;          // e.g. "+12%"
    positive?: boolean;
  };
  sublabel?: string;
  className?: string;
  gradient?: boolean;       // show a subtle gradient glow
  accentColor?: string;     // hex for glow effect
}

export function StatCard({
  label,
  value,
  icon,
  iconColor = "text-primary-400",
  iconBg = "bg-primary-500/10",
  trend,
  sublabel,
  className = "",
  gradient = false,
  accentColor,
}: StatCardProps) {
  return (
    <div
      className={`relative group bg-white dark:bg-[#0f172a]/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800/50 rounded-2xl p-5 overflow-hidden hover:border-slate-300 dark:hover:border-slate-700/60 transition-all duration-300 ${className}`}
    >
      {/* Optional glow */}
      {gradient && accentColor && (
        <div
          className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-10 pointer-events-none transition-opacity duration-300 group-hover:opacity-20"
          style={{ backgroundColor: accentColor }}
        />
      )}

      <div className="relative">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className={`p-2.5 rounded-xl ${iconBg} ${iconColor}`}>
            {icon}
          </div>
          {trend && (
            <span
              className={`text-xs font-semibold px-2 py-1 rounded-lg ${
                trend.positive !== false
                  ? "bg-secondary-500/10 text-secondary-400"
                  : "bg-emergency-500/10 text-emergency-500"
              }`}
            >
              {trend.value}
            </span>
          )}
        </div>

        {/* Value */}
        <p className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-0.5">
          {value === null || value === undefined ? (
            <span className="text-slate-600 text-lg">—</span>
          ) : (
            value
          )}
        </p>

        {/* Label */}
        <p className="text-sm text-slate-500">{label}</p>

        {/* Sublabel */}
        {sublabel && (
          <p className="text-xs text-slate-600 mt-1">{sublabel}</p>
        )}
      </div>
    </div>
  );
}
