'use client';

import { useState, useEffect } from 'react';

interface DonutChartProps {
  value: number;
  max?: number;
  size?: number;
  stroke?: number;
  color: string;
  replay?: boolean;
}

// Animate percentage arc from 0% → target %
// When `replay` toggles to true, resets and re-animates
export default function DonutChart({ value, max = 5, size = 48, stroke = 5, color, replay }: DonutChartProps) {

  const [progress, setProgress] = useState(0);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = value / max;

  // initial mount animation
  useEffect(() => {
    const timer = setTimeout(() => setProgress(pct), 100);
    return () => clearTimeout(timer);
  }, [pct]);

  // replay animation on hover
  useEffect(() => {
    if (replay) {
      setProgress(0);
      const timer = setTimeout(() => setProgress(pct), 50);
      return () => clearTimeout(timer);
    }
  }, [replay, pct]);

  return (
    <svg width={size} height={size} className="-rotate-90">

      {/* background track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#F0EFEB"
        strokeWidth={stroke}
      />

      {/* animated fill */}
      <circle
        cx={size / 2} cy={size / 2} r={radius} fill="none"
        stroke={color} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - progress)}
        style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.22, 1, 0.36, 1)' }}
      />
    </svg>
  );
}
