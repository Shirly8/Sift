'use client';

import HeatCell from './HeatCell';
import { useRestaurant } from '@/context/RestaurantContext';
import { getRatingDistributionHeatmap } from '@/lib/restaurantData';

export default function RatingHeatmap() {
  const { data } = useRestaurant();
  const heatmapData = data ? getRatingDistributionHeatmap(data.reviewData) : [];

  return (
    <div className="bg-white rounded-2xl py-22 px-24 border border-neutral-border">

      <h3 className="font-display text-lg font-normal mb-4">
        Rating Distribution
      </h3>
      <p className="text-sm text-neutral-text-secondary mb-14">
        Sentiment heatmap by aspect and star rating
      </p>


      {/* COLUMN HEADERS */}
      <div className="grid grid-cols-[80px_repeat(5,1fr)] gap-4 mb-4">
        <div />
        {['1★', '2★', '3★', '4★', '5★'].map((s) => (
          <div key={s} className="text-center text-xs font-semibold text-neutral-text-secondary">
            {s}
          </div>
        ))}
      </div>


      {/* DATA ROWS */}
      {heatmapData.length === 0 && (
        <p className="text-sm text-neutral-text-secondary">No distribution data available.</p>
      )}
      {heatmapData.map((row) => (
        <div key={row.aspect} className="grid grid-cols-[80px_repeat(5,1fr)] gap-4 mb-4">

          {/* row label */}
          <div className="text-sm font-medium text-neutral-text-muted flex items-center">
            {row.aspect}
          </div>

          {/* heat cells */}
          {row.stars.map((val, i) => (
            <HeatCell
              key={i}
              value={val}
              maxVal={Math.max(50, ...heatmapData.flatMap((r) => r.stars))}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
