'use client';

import { useState } from 'react';


const W = 380;
const H = 180;


export default function TrendChart({ categories, months }) {

  const [visible, setVisible] = useState(new Set((categories || []).map(c => c.name)));
  const [hoverMonth, setHoverMonth] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0 });

  // no data = don't render (after hooks)
  if (!categories || !categories.length) return null;

  const monthLabels = months || categories[0].data.map((_, i) => `M${i + 1}`);
  const dataLen = monthLabels.length;

  const allValues = categories.flatMap(c => c.data);
  const maxVal = Math.max(...allValues, 1) * 1.1; // guard against all-zero data


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
  const lastIdx = Math.max(dataLen - 1, 1);
  function toPoint(val, idx) {
    return {
      x: (idx / lastIdx) * W,
      y: H - (val / maxVal) * H,
    };
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
                <text x="-4" y={y + 3} fill="#A0A0A0" fontSize="11" textAnchor="end" fontFamily="Plus Jakarta Sans">
                  ${Math.round((i / 4) * maxVal)}
                </text>
              </g>
            );
          })}

          {/* hover columns */}
          {monthLabels.map((_, mi) => (
            <rect
              key={mi}
              x={(mi / lastIdx) * W - W / (dataLen * 2)}
              y="0"
              width={W / dataLen}
              height={H}
              fill="transparent"
              onMouseEnter={() => {
                setHoverMonth(mi);
                setTooltipPos({ x: mi / lastIdx });
              }}
              onMouseLeave={() => setHoverMonth(null)}
            />
          ))}

          {/* category lines */}
          {categories.map((cat, ci) => {
            const isVisible = visible.has(cat.name);
            const points = cat.data.map((v, i) => toPoint(v, i));
            const pointStr = points.map(p => `${p.x},${p.y}`).join(' ');
            const last = points[points.length - 1];

            return (
              <g key={cat.name} style={{ opacity: isVisible ? 1 : 0.08, transition: 'opacity 0.4s ease' }}>

                {/* fill area */}
                <polygon
                  points={`0,${H} ${pointStr} ${(points.length - 1) / lastIdx * W},${H}`}
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
              x1={(hoverMonth / lastIdx) * W}
              y1="0"
              x2={(hoverMonth / lastIdx) * W}
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
              {monthLabels[hoverMonth]}
            </div>
            {categories.map(cat => visible.has(cat.name) && cat.data[hoverMonth] != null && (
              <div key={cat.name} className="flex justify-between gap-4" style={{ padding: '2px 0' }}>
                <span className="flex items-center gap-2">
                  <span style={{ width: 8, height: 3, borderRadius: 2, background: cat.color, display: 'inline-block' }} />
                  <span className="text-sm">{cat.name}</span>
                </span>
                <span className="text-sm fw-600">${cat.data[hoverMonth].toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>


      {/* legend */}
      <div className="flex gap-4 flex-wrap" style={{ marginTop: 12 }}>
        {categories.map(cat => (
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
