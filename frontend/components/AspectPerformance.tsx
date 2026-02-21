'use client';


import { useState, useMemo } from 'react';
import DonutChart from './DonutChart';
import Sparkline from './Sparkline';
import { useRestaurant } from '@/context/RestaurantContext';
import {
  sentimentToScore,
  getSparklineFromTrends,
  computeTrend,
  formatTrendPercent,
} from '@/lib/restaurantData';


const ASPECT_COLORS = ['#CF5532', '#D4915E', '#8B7355', '#6B8F71', '#7B8794', '#C4A87A', '#A8B0A0', '#D4735A', '#7B8794'];


const ASPECT_KEYWORDS: Record<string, string[]> = {
  Service: ['service', 'wait times', 'staff', 'waiter', 'waitress', 'reservations'],
  Ambience: ['ambience', 'atmosphere', 'decor', 'noise level', 'lighting', 'seating'],
  Price: ['pricing', 'cost', 'affordability', 'value for money'],
  'Food Quality': ['food quality', 'freshness', 'ingredients', 'presentation'],
  Taste: ['taste', 'flavor', 'seasoning', 'texture'],
  Menu: ['menu variety', 'menu options', 'selection of dishes'],
  Location: ['location', 'accessibility', 'parking'],
  Drinks: ['drinks', 'cocktails', 'wine', 'beer', 'beverages'],
  Desserts: ['desserts', 'tiramisu', 'panna cotta', 'cheesecake', 'gelato'],
};


export default function AspectPerformance() {
  const { data } = useRestaurant();
  const [activeAspect, setActiveAspect] = useState<number | null>(null);


  const aspects = useMemo(() => {
    if (!data?.aspectSentiments || !data?.aspectTrends) return [];
    return Object.entries(data.aspectSentiments)
      .map(([name, s], i) => ({
        name,
        score: sentimentToScore(s.avg),
        reviews: s.total,
        trend: computeTrend(getSparklineFromTrends(data.aspectTrends, name)),
        sparkline: getSparklineFromTrends(data.aspectTrends, name),
        keywords: ASPECT_KEYWORDS[name] ?? [name.toLowerCase()],
        color: ASPECT_COLORS[i % ASPECT_COLORS.length] ?? '#CF5532',
      }))
      .sort((a, b) => b.reviews - a.reviews);
  }, [data]);


  return (
    <div className="flex flex-col h-[1650px] min-h-0 overflow-hidden bg-white rounded-2xl border border-neutral-border">

      {/* Header row with dropdown and search */}
      <div className="flex items-center mb-16 pt-22 px-20 shrink-0">
        <h3 className="font-display text-lg font-normal">
          Aspect Performance
        </h3>
      </div>


      {/* ASPECT CARDS — scrollable */}
      <div className="flex-1 min-h-0 overflow-y-auto px-20 pb-22">
      {aspects.length === 0 && (
        <p className="text-sm text-neutral-text-secondary">No aspect data available.</p>
      )}
      {aspects.map((a, i) => (
        <div
          key={a.name}
          className={`py-14 px-16 rounded-xl mb-8 border cursor-pointer transition-all duration-base ease ${
            activeAspect === i
              ? 'border-terracotta bg-terracotta-light'
              : 'border-[#F0EFEB] bg-transparent'
          }`}
          onMouseEnter={() => setActiveAspect(i)}
          onMouseLeave={() => setActiveAspect(null)}
        >

          {/* CARD CONTENT */}
          <div className="flex justify-between items-center">

            {/* left — name, trend, reviews, keywords */}
            <div className="flex-1">

              <div className="flex items-center gap-8 mb-4">
                <span className="font-bold text-[14px]">{a.name}</span>

                {/* trend badge — 0 instead of Stable, show as % */}
                <span
                  className={`text-xs font-semibold px-6 py-2 rounded-xs ${
                    a.trend > 0
                      ? 'bg-green-bg text-green-text'
                      : a.trend < 0
                        ? 'bg-red-bg text-red-text'
                        : 'bg-neutral-hover text-neutral-text-secondary'
                  }`}
                >
                  {a.trend > 0 ? '↑' : a.trend < 0 ? '↓' : ''} {formatTrendPercent(a.trend)}
                </span>
              </div>

              <div className="flex items-center gap-8 mb-6">
                <span className="text-sm text-neutral-text-secondary">{a.reviews} reviews</span>
                <Sparkline data={a.sparkline} color={a.color} width={48} height={18} />
              </div>

              {/* keyword tags — 3 before "See more" */}
              <div className="flex gap-4 flex-wrap items-center">
                {a.keywords.slice(0, 3).map((k, ki) => (
                  <span
                    key={ki}
                    className="text-xs py-2 px-7 rounded-xs bg-neutral-hover text-neutral-text-muted font-medium"
                  >
                    {k}
                  </span>
                ))}
                {a.keywords.length > 3 && (
                  <span className="text-xs font-semibold text-terracotta cursor-pointer">
                    See more
                  </span>
                )}
              </div>
            </div>


            {/* right — donut with score below */}
            <div className="flex flex-col items-center gap-6 ml-12">
              <DonutChart value={a.score} color={a.color} size={48} stroke={6} replay={activeAspect === i} />
              <span className="font-display text-3xl text-neutral-text">
                {a.score}
              </span>
            </div>
          </div>


          {/* view full reviews link */}
          <div className="mt-10 pt-10 border-t border-[#F0EFEB]">
            <span className="text-base font-semibold text-terracotta cursor-pointer">
              View Full Reviews →
            </span>
          </div>
        </div>
      ))}
      </div>
    </div>
  );
}
