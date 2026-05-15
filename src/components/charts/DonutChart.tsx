"use client";

import { useState, useEffect } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface DonutChartProps {
  data: { label: string; value: number; color: string }[];
  centerLabel: string;
  centerSub: string;
  size?: number;
  thickness?: number;
}

export function DonutChart({ data, centerLabel, centerSub }: DonutChartProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div className="h-[200px] w-full flex items-center justify-center bg-slate-100 dark:bg-slate-800/50 rounded-full animate-pulse mx-auto max-w-[160px]" />;

  return (
    <div className="h-[200px] w-full flex items-center justify-center relative">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={1}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={5}
            dataKey="value"
            stroke="none"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', fontSize: '12px' }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute flex flex-col items-center justify-center pointer-events-none">
        <span className="text-2xl font-black text-slate-900 dark:text-white leading-none">{centerLabel}</span>
        <span className="text-[10px] font-bold text-slate-500 uppercase mt-1">{centerSub}</span>
      </div>
    </div>
  );
}
