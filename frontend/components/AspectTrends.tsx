'use client';


import { useMemo } from 'react';
import { useRestaurant } from '@/context/RestaurantContext';
import { getAspectTrendLines, getTrendMonthLabels } from '@/lib/restaurantData';


const W = 420;
const H = 155;
const pad = { t: 10, r: 10, b: 28, l: 32 };


export default function AspectTrends() {
  const { data } = useRestaurant();


  const { lines, monthLabels } = useMemo(() => {
    if (!data?.aspectTrends) return { lines: [], monthLabels: [] };
    // Top 4 aspects by review count for readable chart
    const topAspects = data.aspectSentiments
      ? Object.entries(data.aspectSentiments)
          .sort(([, a], [, b]) => b.total - a.total)
          .slice(0, 4)
          .map(([name]) => name)
      : undefined;
    const lines = getAspectTrendLines(data.aspectTrends, topAspects);
    const monthLabels = getTrendMonthLabels(data.aspectTrends);
    return { lines, monthLabels };
  }, [data]);


  const path = (d: number[]) => {
    if (d.length < 2) return '';
    const cW = W - pad.l - pad.r;
    const cH = H - pad.t - pad.b;
    const all = lines.flatMap((l) => l.data);
    const mn = Math.min(...all) - 0.3;
    const mx = Math.max(...all) + 0.3;
    const range = mx - mn || 1;
    return d
      .map((v, i) => {
        const x = pad.l + (i / (d.length - 1)) * cW;
        const y = pad.t + cH - ((v - mn) / range) * cH;
        return (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1);
      })
      .join(' ');
  };


  const allVals = lines.flatMap((l) => l.data);
  const mn = allVals.length ? Math.min(...allVals) - 0.3 : 3;
  const mx = allVals.length ? Math.max(...allVals) + 0.3 : 5;
  const range = mx - mn || 1;
  const cH = H - pad.t - pad.b;


  return (
    <div className="bg-white rounded-2xl py-22 px-24 border border-neutral-border">

      <h3 className="font-display text-lg font-normal mb-4">
        Aspect Trends
      </h3>
      <p className="text-sm text-neutral-text-secondary mb-14">
        6-month sentiment trajectory
      </p>


      {lines.length === 0 ? (
        <p className="text-sm text-neutral-text-secondary">No trend data available.</p>
      ) : (
        <>
          <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="block">
            {/* Y-axis grid */}
            {[2, 3, 4, 5].map((i) => {
              const y = pad.t + cH - ((i - mn) / range) * cH;
              if (y < pad.t - 5 || y > pad.t + cH + 5) return null;
              return (
                <g key={i}>
                  <line x1={pad.l} x2={W - pad.r} y1={y} y2={y} stroke="#F0EFEB" strokeWidth="1" />
                  <text x={pad.l - 7} y={y + 3.5} fontSize="9.5" fill="#B0B0B0" textAnchor="end" fontFamily="var(--font-sans)">
                    {i}
                  </text>
                </g>
              );
            })}
            {/* X-axis labels */}
            {monthLabels.map((m, i) => (
              <text
                key={m}
                x={pad.l + (i / Math.max(1, monthLabels.length - 1)) * (W - pad.l - pad.r)}
                y={H - 5}
                fontSize="9.5"
                fill="#B0B0B0"
                textAnchor="middle"
                fontFamily="var(--font-sans)"
              >
                {m}
              </text>
            ))}
            {/* Lines */}
            {lines.map((l) => (
              <path
                key={l.name}
                d={path(l.data)}
                fill="none"
                stroke={l.color}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.85}
              />
            ))}
          </svg>

          {/* Legend */}
          <div className="flex gap-12 mt-12 flex-wrap">
            {lines.map((l) => (
              <div key={l.name} className="flex items-center gap-5">
                <div
                  className="w-14 h-3 rounded-sm shrink-0"
                  style={{ background: l.color }}
                />
                <span className="text-[10.5px] text-neutral-text-secondary font-medium">{l.name}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
