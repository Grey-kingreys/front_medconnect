"use client";

import { useEffect, useState } from "react";

export interface DonutSlice {
  label: string;
  value: number;
  color: string; // hex or CSS color
}

interface DonutChartProps {
  data: DonutSlice[];
  centerLabel?: string;
  centerSub?: string;
  size?: number;
  thickness?: number;
  className?: string;
}

export function DonutChart({
  data,
  centerLabel,
  centerSub,
  size = 180,
  thickness = 30,
  className = "",
}: DonutChartProps) {
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 150);
    return () => clearTimeout(t);
  }, []);

  const total = data.reduce((sum, d) => sum + d.value, 0);
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - thickness) / 2;
  const circumference = 2 * Math.PI * r;

  // Build segments
  let accumulated = 0;
  const segments = data.map((d) => {
    const fraction = total > 0 ? d.value / total : 0;
    const dashLen = animated ? fraction * circumference : 0;
    const gap = circumference - dashLen;
    // rotate so first segment starts at top (-90°)
    const offset = -(accumulated / (total || 1)) * circumference - circumference * 0.25;
    accumulated += d.value;
    return { ...d, fraction, dashLen, gap, offset };
  });

  return (
    <div className={`flex flex-col lg:flex-row items-center gap-6 ${className}`}>
      {/* SVG Ring */}
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Background track */}
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="currentColor"
            className="text-slate-100 dark:text-white/5"
            strokeWidth={thickness}
          />
          {/* Segments */}
          {total === 0 ? (
            <circle
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke="currentColor"
              className="text-slate-200 dark:text-white/10"
              strokeWidth={thickness}
              strokeDasharray={`${circumference * 0.98} ${circumference * 0.02}`}
              strokeDashoffset={-circumference * 0.25}
            />
          ) : (
            segments.map((seg, i) => (
              <circle
                key={i}
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke={seg.color}
                strokeWidth={thickness}
                strokeDasharray={`${seg.dashLen} ${seg.gap}`}
                strokeDashoffset={seg.offset}
                strokeLinecap="butt"
                style={{
                  transition: `stroke-dasharray 0.9s cubic-bezier(0.4, 0, 0.2, 1) ${i * 80}ms`,
                }}
              />
            ))
          )}
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
          {centerLabel && (
            <p className="text-2xl font-bold text-slate-900 dark:text-white leading-none">{centerLabel}</p>
          )}
          {centerSub && (
            <p className="text-xs text-slate-500 mt-1 max-w-[80px] leading-tight">{centerSub}</p>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex-1 w-full space-y-3">
        {data.map((d, i) => (
          <div key={i} className="flex items-center justify-between group">
            <div className="flex items-center gap-2.5">
              <span
                className="w-3 h-3 rounded-full flex-shrink-0 shadow-sm"
                style={{ backgroundColor: d.color, boxShadow: `0 0 6px ${d.color}66` }}
              />
              <span className="text-sm text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-200 transition-colors">
                {d.label}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-900 dark:text-white">{d.value}</span>
              <span className="text-xs text-slate-600 w-10 text-right">
                {total > 0 ? Math.round((d.value / total) * 100) : 0}%
              </span>
            </div>
          </div>
        ))}
        {total === 0 && (
          <p className="text-sm text-slate-600 text-center py-2">Aucune donnée</p>
        )}
      </div>
    </div>
  );
}
