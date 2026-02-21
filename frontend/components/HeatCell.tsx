'use client';

interface HeatCellProps {
  value: number;
  maxVal: number;
  color?: 'terracotta' | 'green';
  fillHeight?: boolean;
}

// Heatmap cell — intensity maps to color opacity (high → strong, low → neutral)
export default function HeatCell({ value, maxVal, color = 'terracotta', fillHeight = false }: HeatCellProps) {
  const intensity = value / maxVal;

  let bg;
  if (color === 'green') {
    bg = intensity > 0.35
      ? `rgba(107,143,113,${0.15 + intensity * 0.7})`
      : intensity > 0.1
        ? `rgba(107,143,113,${0.08 + intensity * 0.3})`
        : '#F8F7F4';
  } else {
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
        aspectRatio: fillHeight ? undefined : '1.6',
        height: fillHeight ? '100%' : undefined,
        background: bg,
        color: textColor,
      }}
    >
      {value > 0 ? `${value}%` : '—'}
    </div>
  );
}
