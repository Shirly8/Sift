'use client';

import HeatCell from './HeatCell';
import { useRestaurant } from '@/context/RestaurantContext';

export default function DistributionHeatmap() {
  const { data } = useRestaurant();

  // Correlation matrix is NOT in the data — placeholder. Show ALL aspects from data.
  const aspects = data?.aspectSentiments
    ? Object.keys(data.aspectSentiments)
    : ['Food Quality', 'Service', 'Ambiance', 'Price', 'Cleanliness'];
  // Placeholder NxN matrix (diagonal=1, symmetric)
  const base = [
    [1.0, 0.32, 0.28, 0.11, 0.87],
    [0.32, 1.0, 0.72, 0.18, 0.29],
    [0.28, 0.72, 1.0, 0.24, 0.22],
    [0.11, 0.18, 0.24, 1.0, 0.09],
    [0.87, 0.29, 0.22, 0.09, 1.0],
  ];
  const n = aspects.length;
  const matrix: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => {
      if (i === j) return 1;
      const bi = Math.min(i, j) % 5;
      const bj = Math.max(i, j) % 5;
      return base[bi]?.[bj] ?? 0.2;
    })
  );

  return (
    <div className="bg-white rounded-2xl py-22 px-24 border border-neutral-border min-h-[420px] flex flex-col">
      <h3 className="font-display text-lg font-normal mb-4">
        Aspect Pairwise Distribution
      </h3>
      <p className="text-sm text-neutral-text-secondary mb-14">
        Pairwise relationships between aspects (correlation). Note: Correlation matrix is not stored in the data files — placeholder shown.
      </p>
      {/* COLUMN HEADERS */}
      <div
        className="grid gap-4 mb-4"
        style={{ gridTemplateColumns: `80px repeat(${aspects.length}, 1fr)` }}
      >
        <div />
        {aspects.map((aspect) => (
          <div key={aspect} className="text-center text-xs font-semibold text-neutral-text-secondary">
            {aspect}
          </div>
        ))}
      </div>

      {/* DATA ROWS — increased row spacing for taller layout */}
      <div className="flex-1 flex flex-col justify-around">
      {matrix.slice(0, aspects.length).map((row, i) => (
        <div
          key={aspects[i]}
          className="grid gap-3 mb-5"
          style={{ gridTemplateColumns: `90px repeat(${aspects.length}, 1fr)` }}
        >
          {/* row label */}
          <div className="text-sm font-medium text-neutral-text-muted flex items-center">
            {aspects[i]}
          </div>
          {/* heat cells */}
          {row.slice(0, aspects.length).map((val, j) =>
            <HeatCell key={j} value={Math.round(val * 100)} maxVal={100} color="green" />
          )}
        </div>
      ))}
      </div>
    </div>
  );
}
