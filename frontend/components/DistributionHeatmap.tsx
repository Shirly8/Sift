'use client';

import HeatCell from './HeatCell';
import { useRestaurant } from '@/context/RestaurantContext';

export default function DistributionHeatmap() {
  const { data } = useRestaurant();

  const pairDist = data?.pairDistribution ?? {};
  const aspects = data?.aspectSentiments
    ? Object.keys(data.aspectSentiments)
    : Object.keys(pairDist);

  const matrix: number[][] = aspects.map((a) =>
    aspects.map((b) => Math.round((pairDist[a]?.[b] ?? (a === b ? 1 : 0)) * 100))
  );

  return (
    <div className="bg-white rounded-2xl py-22 px-16 border border-neutral-border flex flex-col h-full">
      <h3 className="font-display text-lg font-normal mb-4">
        Aspect Pairwise Distribution
      </h3>
      <p className="text-sm text-neutral-text-secondary mb-14">
        Pearson correlation between aspect sentiments across all reviews
      </p>

      {aspects.length === 0 ? (
        <p className="text-sm text-neutral-text-secondary">No data available.</p>
      ) : (
        <div className="flex-1 flex flex-col min-h-0">
          {/* COLUMN HEADERS */}
          <div
            className="grid gap-1.5 mb-1.5"
            style={{ gridTemplateColumns: `50px repeat(${aspects.length}, 1fr)` }}
          >
            <div />
            {aspects.map((aspect) => (
              <div
                key={aspect}
                className="text-center font-semibold text-neutral-text-secondary overflow-hidden"
                style={{ fontSize: '7px', lineHeight: '1.2' }}
              >
                {aspect.substring(0, 3)}
              </div>
            ))}
          </div>

          {/* DATA ROWS — flex-1 so rows fill remaining card height */}
          <div className="flex flex-col gap-1.5 flex-1">
            {matrix.map((row, i) => (
              <div
                key={aspects[i]}
                className="grid gap-1.5 flex-1"
                style={{ gridTemplateColumns: `50px repeat(${aspects.length}, 1fr)` }}
              >
                <div
                  className="font-medium text-neutral-text-muted flex items-center overflow-hidden"
                  style={{ fontSize: '7px' }}
                >
                  {aspects[i]!.substring(0, 3)}
                </div>
                {row.map((val, j) => (
                  <HeatCell key={j} value={val} maxVal={100} color="green" fillHeight />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
