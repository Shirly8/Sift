'use client';

import { useState } from 'react';


// deterministic color palette matching SpendingBars
const CATEGORY_COLORS = [
  '#CF5532', '#6B8F71', '#D4915E', '#D4735A', '#7B8794',
  '#C4A87A', '#A8B0A0', '#8B6F47', '#5A7D9A', '#9B6B8D',
];

const W = 380;
const H = 180;


export default function TrendChart({ categories, months }) {

  // assign colors to categories from backend
  const coloredCats = (categories || []).map((c, i) => ({
    ...c,
    color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
  }));

  const monthLabels = months || [];

  const [visible, setVisible] = useState(new Set(coloredCats.map(c => c.name)));
  const [hoverMonth, setHoverMonth] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0 });

  const numPoints = monthLabels.length || 1;
  const allValues = coloredCats.flatMap(c => c.data || []);
  const maxVal = allValues.length > 0 ? Math.max(...allValues) * 1.1 : 100;


  // toggle category visibility
  function toggleCat(name) {
    setVisible(prev => {
      const next = new Set(prev);
      if (next.has(name)) {
        if (next.size <= 1) return prev;
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }


  // convert data point to SVG coords
  function toPoint(val, idx) {
    const xDivisor = Math.max(numPoints - 1, 1);
    return {
      x: (idx / xDivisor) * W,
      y: H - (val / maxVal) * H,
    };
  }


  if (!coloredCats.length || !monthLabels.length) {
    return (
      <div className="card">
        <h3 className="heading-card">Spending Over Time</h3>
        <p className="text-sm ink-muted" style={{ marginTop: 8 }}>
          Need at least 2 months of data for trend analysis.
        </p>
      </div>
    );
  }


  return (
    <div className="card">

      <h3 className="heading-card" style={{ marginBottom: 4 }}>Spending Over Time</h3>
      <p className="text-sm ink-muted" style={{ marginBottom: 14 }}>
        Monthly totals by category &middot; Click legend to show/hide
      </p>


      {/* SVG chart */}
      <div style={{ position: 'relative' }}>
        <svg width="100%" height="200" viewBox={`-30 -5 ${W + 35} ${H + 10}`} preserveAspectRatio="none" style={{ overflow: 'visible' }}>

          {/* grid lines */}
          {[0,1,2,3,4].map(i => {
            const y = H - (i / 4) * H;
            return (
              <g key={i}>
                <line x1="0" y1={y} x2={W} y2={y} stroke="#EDECEA" strokeWidth="1" />
                <text x="-4" y={y + 3} fill="#A0A0A0" fontSize="9" textAnchor="end" fontFamily="Plus Jakarta Sans">
                  ${Math.round((i / 4) * maxVal)}
                </text>
              </g>
            );
          })}

          {/* hover columns */}
          {monthLabels.map((_, mi) => (
            <rect
              key={mi}
              x={(mi / Math.max(numPoints - 1, 1)) * W - W / (numPoints * 2)}
              y="0"
              width={W / numPoints}
              height={H}
              fill="transparent"
              onMouseEnter={() => {
                setHoverMonth(mi);
                setTooltipPos({ x: mi / Math.max(numPoints - 1, 1) });
              }}
              onMouseLeave={() => setHoverMonth(null)}
            />
          ))}

          {/* category lines */}
          {coloredCats.map((cat, ci) => {
            const isVisible = visible.has(cat.name);
            const data = cat.data || [];
            const points = data.map((v, i) => toPoint(v, i));
            const pointStr = points.map(p => `${p.x},${p.y}`).join(' ');
            const last = points[points.length - 1];

            if (!points.length) return null;

            return (
              <g key={cat.name} style={{ opacity: isVisible ? 1 : 0.08, transition: 'opacity 0.4s ease' }}>

                {/* fill area */}
                <polygon
                  points={`0,${H} ${pointStr} ${points[points.length - 1].x},${H}`}
                  fill={cat.color}
                  fillOpacity={isVisible ? 0.06 : 0}
                />

                {/* line */}
                <polyline
                  points={pointStr}
                  fill="none"
                  stroke={cat.color}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="800"
                  strokeDashoffset="800"
                >
                  <animate
                    attributeName="stroke-dashoffset"
                    from="800" to="0"
                    dur="1.5s" fill="freeze"
                    begin={`${0.5 + ci * 0.15}s`}
                    calcMode="spline" keySplines="0.22 1 0.36 1"
                  />
                </polyline>

                {/* endpoint dot */}
                <circle cx={last.x} cy={last.y} r="3.5" fill={cat.color} opacity="0">
                  <animate
                    attributeName="opacity"
                    from="0" to={isVisible ? 1 : 0.1}
                    dur="0.3s" fill="freeze"
                    begin={`${1.5 + ci * 0.15}s`}
                  />
                </circle>
              </g>
            );
          })}

          {/* hover line */}
          {hoverMonth !== null && (
            <line
              x1={(hoverMonth / Math.max(numPoints - 1, 1)) * W}
              y1="0"
              x2={(hoverMonth / Math.max(numPoints - 1, 1)) * W}
              y2={H}
              stroke="var(--terra)"
              strokeWidth="1"
              strokeDasharray="4,3"
              opacity="0.5"
            />
          )}
        </svg>


        {/* tooltip */}
        {hoverMonth !== null && (
          <div style={{
            position: 'absolute',
            display: 'block',
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '10px 14px',
            boxShadow: 'var(--shadow-lg)',
            pointerEvents: 'none',
            zIndex: 10,
            minWidth: 120,
            top: 10,
            ...(tooltipPos.x > 0.6
              ? { right: `${(1 - tooltipPos.x) * 100 + 5}%` }
              : { left: `${tooltipPos.x * 100 + 5}%` }
            ),
          }}>
            <div className="text-xs fw-600 ink-muted" style={{ marginBottom: 6 }}>
              {monthLabels[hoverMonth] || ''}
            </div>
            {coloredCats.map(cat => visible.has(cat.name) && (
              <div key={cat.name} className="flex justify-between gap-4" style={{ padding: '2px 0' }}>
                <span className="flex items-center gap-2">
                  <span style={{ width: 8, height: 3, borderRadius: 2, background: cat.color, display: 'inline-block' }} />
                  <span className="text-sm">{cat.name}</span>
                </span>
                <span className="text-sm fw-600">
                  ${(cat.data?.[hoverMonth] || 0).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>


      {/* legend */}
      <div className="flex gap-4 flex-wrap" style={{ marginTop: 12 }}>
        {coloredCats.map(cat => (
          <div
            key={cat.name}
            className={`legend-item ${!visible.has(cat.name) ? 'dimmed' : ''}`}
            onClick={() => toggleCat(cat.name)}
          >
            <span className="legend-swatch" style={{
              width: 10, height: 3, borderRadius: 2,
              background: cat.color, display: 'inline-block',
            }} />
            <span className="text-xs ink-soft">{cat.name}</span>
          </div>
        ))}
      </div>

    </div>
  );
}
