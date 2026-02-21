'use client';

import HBar from './HBar';
import { useRestaurant } from '@/context/RestaurantContext';
import { useMemo } from 'react';
import { sentimentToScore } from '@/lib/restaurantData';
import type { AspectSentiment } from '@/lib/restaurantTypes';

const barColors = ['#CF5532', '#D4735A', '#D4915E', '#C4A87A', '#A8B0A0'];

function generateInsight(aspectName: string, impactPct: number, s?: AspectSentiment): string {
  if (!s || s.total === 0) {
    return `${aspectName} explains ${impactPct}% of rating variance`;
  }
  const posRate = Math.round((s.Positive / s.total) * 100);
  const negRate = Math.round((s.Negative / s.total) * 100);
  const score = sentimentToScore(s.avg).toFixed(1);

  if (negRate >= 25) {
    return `${aspectName}: ${negRate}% negative sentiment · ${score}/5 avg · ${impactPct}% of variance`;
  }
  if (impactPct >= 25) {
    return `${aspectName}: ${posRate}% positive · ${score}/5 avg · top driver (${impactPct}% variance)`;
  }
  return `${aspectName}: ${score}/5 avg · ${posRate}% positive across ${s.total} reviews`;
}

export default function RatingDrivers() {
  const { impactAttribution, data } = useRestaurant();

  const drivers = useMemo(() => {
    if (!impactAttribution) return [];
    const sorted = Object.entries(impactAttribution)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);
    const total = sorted.reduce((s, [, v]) => s + v, 0);
    const scale = total > 0 ? 100 / total : 1;
    return sorted.map(([label, value]) => ({
      label,
      value: Math.round(value * scale),
    }));
  }, [impactAttribution]);

  const topDriver = drivers[0];

  return (
    <div className="bg-white rounded-2xl py-22 px-28 border border-neutral-border">

      {/* HEADER */}
      <div className="flex justify-between items-start mb-18">

        <div>
          <h2 className="font-display text-xl font-normal mb-4">
            What Drives Your Rating?
          </h2>
          <p className="text-base text-neutral-text-secondary">
            Aspect contribution to overall star rating based on regression analysis
          </p>
        </div>


        {/* Insight badge */}
        {topDriver && (
          <div className="py-6 px-12 rounded-md bg-terracotta-light border border-terracotta-border flex items-center gap-6 shrink-0">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#CF5532" strokeWidth="2">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
            <span className="text-sm font-semibold text-terracotta">
              {generateInsight(topDriver.label, topDriver.value, data?.aspectSentiments?.[topDriver.label])}
            </span>
          </div>
        )}
      </div>


      {/* BARS */}
      {drivers.length === 0 && (
        <p className="text-sm text-neutral-text-secondary">No driver data available.</p>
      )}
      {drivers.map((d, i) => (
        <HBar
          key={d.label}
          label={d.label}
          value={d.value}
          maxValue={Math.max(50, ...drivers.map((x) => x.value))}
          color={barColors[i]}
          delay={i * 100}
        />
      ))}
    </div>
  );
}
