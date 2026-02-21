'use client';

interface HeatCellProps {
  value: number;
  maxVal: number;
  color?: 'terracotta' | 'green';
}

// Heatmap cell — intensity maps to terracotta opacity (high → strong, low → neutral)
export default function HeatCell({ value, maxVal, color = 'terracotta' }: HeatCellProps) {
  const intensity = value / maxVal;

  let bg;
  if (color === 'green') {
    // Use rgba(107,143,113,...) for pairwise distribution
    bg = intensity > 0.35
      ? `rgba(107,143,113,${0.15 + intensity * 0.7})`
      : intensity > 0.1
        ? `rgba(107,143,113,${0.08 + intensity * 0.3})`
        : '#F8F7F4';
  } else {
    // default terracotta
    bg = intensity > 0.35
      ? `rgba(207, 85, 50, ${0.15 + intensity * 0.7})`
      : intensity > 0.1
        ? `rgba(207, 85, 50, ${0.08 + intensity * 0.3})`
        : '#F8F7F4';
  }

  const textColor = intensity > 0.5 ? '#fff' : '#1A1A2E';

  return (
    <div
      className="w-full rounded-sm flex items-center justify-center text-xs font-medium transition-colors duration-base"
      style={{
        aspectRatio: '1.6',
        background: bg,
        color: textColor,
      }}
    >
      {value > 0 ? `${value}%` : '—'}
    </div>
  );
}
