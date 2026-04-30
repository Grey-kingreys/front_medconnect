"use client";

import { useEffect, useState } from "react";

export interface BarItem {
  label: string;
  value: number;
  color: string; // hex
  icon?: React.ReactNode;
  sublabel?: string;
}

interface BarChartProps {
  data: BarItem[];
  className?: string;
  showPercentage?: boolean;
  animationDelay?: number; // ms per bar
}

export function BarChart({
  data,
  className = "",
  showPercentage = true,
  animationDelay = 80,
}: BarChartProps) {
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 200);
    return () => clearTimeout(t);
  }, []);

  const max = Math.max(...data.map((d) => d.value), 1);
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className={`space-y-4 ${className}`}>
      {data.map((item, i) => {
        const pct = (item.value / max) * 100;
        const share = total > 0 ? Math.round((item.value / total) * 100) : 0;

        return (
          <div key={i} className="group space-y-1.5">
            {/* Label row */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {item.icon && (
                  <span className="flex-shrink-0 opacity-70">{item.icon}</span>
                )}
                <div className="min-w-0">
                  <span className="text-sm text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:text-white transition-colors truncate block">
                    {item.label}
                  </span>
                  {item.sublabel && (
                    <span className="text-xs text-slate-600">{item.sublabel}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-sm font-bold text-slate-900 dark:text-white">{item.value}</span>
                {showPercentage && (
                  <span
                    className="text-[10px] font-medium px-1.5 py-0.5 rounded-md"
                    style={{
                      backgroundColor: `${item.color}20`,
                      color: item.color,
                    }}
                  >
                    {share}%
                  </span>
                )}
              </div>
            </div>

            {/* Bar track */}
            <div className="h-2 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all ease-out"
                style={{
                  width: animated ? `${pct}%` : "0%",
                  backgroundColor: item.color,
                  boxShadow: `0 0 8px ${item.color}66`,
                  transitionDuration: "900ms",
                  transitionDelay: `${i * animationDelay}ms`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
