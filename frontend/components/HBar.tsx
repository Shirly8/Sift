'use client';

import { useState, useEffect } from 'react';

interface HBarProps {
  label: string;
  value: number;
  maxValue: number;
  color: string;
  delay?: number;
  replay?: boolean;
}

// Horizontal bar that animates width on mount
// When `replay` toggles to true, resets width to 0 then re-animates
export default function HBar({ label, value, maxValue, color, delay = 0, replay }: HBarProps) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setWidth((value / maxValue) * 100), 150 + delay);
    return () => clearTimeout(timer);
  }, [value, maxValue, delay]);

  useEffect(() => {
    if (!replay) return;
    setWidth(0);
    const timer = setTimeout(() => setWidth((value / maxValue) * 100), 80);
    return () => clearTimeout(timer);
  }, [replay]);

  return (
    <div className="flex items-center gap-12 mb-10">

      {/* label */}
      <span className="w-[90px] text-md text-neutral-text-muted font-medium text-right shrink-0">
        {label}
      </span>


      {/* bar track */}
      <div className="flex-1 h-22 bg-neutral-hover rounded-sm overflow-hidden relative">

        {/* filled bar */}
        <div
          className="h-full rounded-sm flex items-center justify-end pr-8"
          style={{
            background: color,
            width: `${width}%`,
            transition: 'width 1.3s cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          {width > 15 && (
            <span className="text-sm font-semibold text-white tracking-wide">{value}%</span>
          )}
        </div>

        {/* percentage label outside bar when bar is too narrow */}
        {width <= 15 && (
          <span
            className="absolute top-1/2 -translate-y-1/2 text-sm font-semibold text-neutral-text"
            style={{ left: `calc(${width}% + 8px)` }}
          >
            {value}%
          </span>
        )}
      </div>
    </div>
  );
}
