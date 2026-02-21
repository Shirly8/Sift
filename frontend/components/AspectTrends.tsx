'use client';

import { useMemo, useState, useRef } from 'react';
import { useRestaurant } from '@/context/RestaurantContext';
import { getAspectTrendLines, getTrendMonthLabels } from '@/lib/restaurantData';

const W = 600;
const H = 180;
const pad = { t: 10, r: 12, b: 24, l: 28 };

export default function AspectTrends() {
  const { data } = useRestaurant();
  const svgRef = useRef<SVGSVGElement>(null);

  // Per-line hover tooltip: null when no line is near
  const [tooltip, setTooltip] = useState<{
    svgX: number;
    dotY: number;
    lineName: string;
    lineColor: string;
    value: number;
    monthIdx: number;
  } | null>(null);

  // Checked lines (all on by default)
  const [hiddenLines, setHiddenLines] = useState<Set<string>>(new Set());

  const { lines, monthLabels } = useMemo(() => {
    if (!data?.aspectTrends) return { lines: [], monthLabels: [] };
    const allAspects = data.aspectSentiments
      ? Object.entries(data.aspectSentiments)
          .sort(([, a], [, b]) => b.total - a.total)
          .map(([name]) => name)
      : undefined;
    const lines = getAspectTrendLines(data.aspectTrends, allAspects);
    const monthLabels = getTrendMonthLabels(data.aspectTrends);
    return { lines, monthLabels };
  }, [data]);

  const visibleLines = lines.filter((l) => !hiddenLines.has(l.name));

  const allVals = visibleLines.flatMap((l) => l.data);
  const mn = allVals.length ? Math.min(...allVals) - 0.3 : 3;
  const mx = allVals.length ? Math.max(...allVals) + 0.3 : 5;
  const range = mx - mn || 1;
  const cW = W - pad.l - pad.r;
  const cH = H - pad.t - pad.b;

  const makePath = (d: number[]) => {
    if (d.length < 2) return '';
    return d
      .map((v, i) => {
        const x = pad.l + (i / (d.length - 1)) * cW;
        const y = pad.t + cH - ((v - mn) / range) * cH;
        return (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1);
      })
      .join(' ');
  };

  const sortedByTrend = [...visibleLines]
    .map((l) => ({ ...l, trend: l.data[l.data.length - 1]! - l.data[0]! }))
    .sort((a, b) => b.trend - a.trend);
  const bestTrend = sortedByTrend[0];

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || visibleLines.length === 0 || monthLabels.length < 2) return;
    const rect = svgRef.current.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * W;
    const svgY = ((e.clientY - rect.top) / rect.height) * H;

    // Only detect within chart plot area
    if (svgX < pad.l || svgX > W - pad.r || svgY < pad.t || svgY > pad.t + cH) {
      setTooltip(null);
      return;
    }

    // Interpolate each line's Y at this X, find nearest
    const fracMonth = ((svgX - pad.l) / cW) * (monthLabels.length - 1);
    const floorIdx = Math.max(0, Math.min(monthLabels.length - 2, Math.floor(fracMonth)));
    const frac = fracMonth - floorIdx;
    const monthIdx = Math.round(fracMonth);

    let closest: typeof tooltip = null;
    let closestDist = Infinity;

    for (const l of visibleLines) {
      const v1 = l.data[floorIdx];
      const v2 = l.data[floorIdx + 1] ?? v1;
      if (v1 == null) continue;
      const interpVal = v1 + ((v2 ?? v1) - v1) * frac;
      const lineY = pad.t + cH - ((interpVal - mn) / range) * cH;
      const dist = Math.abs(svgY - lineY);
      if (dist < closestDist) {
        closestDist = dist;
        closest = {
          svgX: Math.max(pad.l, Math.min(W - pad.r, svgX)),
          dotY: lineY,
          lineName: l.name,
          lineColor: l.color,
          value: interpVal,
          monthIdx: Math.max(0, Math.min(monthLabels.length - 1, monthIdx)),
        };
      }
    }

    // Only show tooltip if within ~18 SVG units of the nearest line
    setTooltip(closestDist < 18 ? closest : null);
  };

  const toggleLine = (name: string) => {
    setHiddenLines((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  // Tooltip box — flip to left if near right edge
  const ttW = 92;
  const ttH = 38;
  const ttX = tooltip
    ? tooltip.svgX + ttW + 12 > W
      ? tooltip.svgX - ttW - 8
      : tooltip.svgX + 8
    : 0;
  const ttY = tooltip
    ? Math.max(pad.t, Math.min(pad.t + cH - ttH, tooltip.dotY - ttH / 2))
    : 0;

  return (
    <div className="bg-white rounded-2xl py-22 px-24 border border-neutral-border">
      <div className="flex items-start justify-between mb-14">
        <div>
          <h3 className="font-display text-lg font-normal mb-4">Aspect Trends</h3>
          <p className="text-sm text-neutral-text-secondary">
            6-month sentiment trajectory — all aspects
          </p>
        </div>

        {bestTrend && (
          <div className="py-6 px-12 rounded-md bg-green-bg border border-green-text flex items-center gap-6 shrink-0">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="#6B8F71">
              <path d="M8 2l2 5H4z" />
            </svg>
            <span className="text-xs font-semibold text-green-text">
              {bestTrend.name} trending up
            </span>
          </div>
        )}
      </div>

      {lines.length === 0 ? (
        <p className="text-sm text-neutral-text-secondary">No trend data available.</p>
      ) : (
        <>
          <svg
            ref={svgRef}
            width="100%"
            viewBox={`0 0 ${W} ${H}`}
            className="block mb-12 cursor-crosshair"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setTooltip(null)}
          >
            {/* Y-axis grid + labels */}
            {[2, 3, 4, 5].map((i) => {
              const y = pad.t + cH - ((i - mn) / range) * cH;
              if (y < pad.t - 5 || y > pad.t + cH + 5) return null;
              return (
                <g key={i}>
                  <line x1={pad.l} x2={W - pad.r} y1={y} y2={y} stroke="#F0EFEB" strokeWidth="1" />
                  <text
                    x={pad.l - 7} y={y + 3.5}
                    fontSize="7" fill="#B0B0B0" textAnchor="end"
                    fontFamily="var(--font-sans)"
                  >
                    {i}
                  </text>
                </g>
              );
            })}

            {/* X-axis labels */}
            {monthLabels.map((m, i) => (
              <text
                key={m}
                x={pad.l + (i / Math.max(1, monthLabels.length - 1)) * cW}
                y={H - 4}
                fontSize="7" fill="#B0B0B0" textAnchor="middle"
                fontFamily="var(--font-sans)"
              >
                {m}
              </text>
            ))}

            {/* Lines — dim non-hovered when tooltip is active */}
            {visibleLines.map((l) => {
              const isHovered = tooltip?.lineName === l.name;
              return (
                <path
                  key={l.name}
                  d={makePath(l.data)}
                  fill="none"
                  stroke={l.color}
                  strokeWidth={isHovered ? 2.5 : 2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={tooltip ? (isHovered ? 1 : 0.18) : 0.8}
                  style={{ transition: 'opacity 0.12s ease, stroke-width 0.12s ease' }}
                />
              );
            })}

            {/* Tooltip + dot on the hovered line */}
            {tooltip && (
              <g>
                <circle
                  cx={tooltip.svgX} cy={tooltip.dotY} r="3.5"
                  fill={tooltip.lineColor} stroke="white" strokeWidth="1.2"
                />
                <rect
                  x={ttX} y={ttY} width={ttW} height={ttH} rx="4"
                  fill="white" stroke="#E0DFDA" strokeWidth="0.8"
                  style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.08))' }}
                />
                {/* Colour swatch + aspect name */}
                <rect x={ttX + 8} y={ttY + 9} width={5} height={5} rx="1" fill={tooltip.lineColor} />
                <text
                  x={ttX + 17} y={ttY + 14.5}
                  fontSize="6.5" fontWeight="600" fill="#333"
                  fontFamily="var(--font-sans)"
                >
                  {tooltip.lineName}
                </text>
                {/* Month · value */}
                <text
                  x={ttX + 8} y={ttY + 30}
                  fontSize="6.5" fill="#777"
                  fontFamily="var(--font-sans)"
                >
                  {monthLabels[tooltip.monthIdx]} · {tooltip.value.toFixed(1)}★
                </text>
              </g>
            )}
          </svg>

          {/* Checkbox legend */}
          <div className="flex gap-12 mt-8 flex-wrap">
            {lines.map((l) => {
              const hidden = hiddenLines.has(l.name);
              return (
                <button
                  key={l.name}
                  onClick={() => toggleLine(l.name)}
                  className="flex items-center gap-5 select-none"
                  style={{ opacity: hidden ? 0.38 : 1, transition: 'opacity 0.15s ease' }}
                >
                  {/* Checkbox */}
                  <div
                    className="w-[13px] h-[13px] rounded-[3px] border flex items-center justify-center shrink-0"
                    style={{
                      background: hidden ? 'transparent' : l.color,
                      borderColor: l.color,
                    }}
                  >
                    {!hidden && (
                      <svg width="7" height="7" viewBox="0 0 8 8">
                        <path
                          d="M1.5 4L3 5.5L6.5 2"
                          stroke="white" strokeWidth="1.3"
                          strokeLinecap="round" strokeLinejoin="round"
                          fill="none"
                        />
                      </svg>
                    )}
                  </div>
                  <span className="text-xs text-neutral-text-secondary font-medium">{l.name}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
