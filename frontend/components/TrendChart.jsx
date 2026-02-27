'use client';

import { useState, useRef, useEffect, useId } from 'react';


const W = 720;
const H = 200;
const PAD_L = 60;
const PAD_R = 20;
const CHART_W = W - PAD_L - PAD_R;


export default function TrendChart({ categories, months }) {

  const uid = useId();
  const gradId = `trendAreaGrad${uid.replace(/:/g, '')}`;
  const [hoverIdx, setHoverIdx] = useState(null);
  const [visible, setVisible] = useState(false);
  const chartRef = useRef(null);

  useEffect(() => {
    const el = chartRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); io.disconnect(); }
    }, { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  if (!categories || !categories.length) return null;

  const monthLabels = months || categories[0].data.map((_, i) => `M${i + 1}`);
  const dataLen = monthLabels.length;
  const lastIdx = Math.max(dataLen - 1, 1);

  // sum all categories → single total per month (what users actually care about)
  const totals = monthLabels.map((_, mi) =>
    categories.reduce((sum, cat) => sum + (cat.data[mi] || 0), 0)
  );

  const maxVal = Math.ceil(Math.max(...totals, 1) * 1.15);
  const GRID_LINES = 4;

  // nice grid values
  const gridStep = Math.ceil(maxVal / GRID_LINES / 100) * 100;
  const gridValues = Array.from({ length: GRID_LINES + 1 }, (_, i) => gridStep * i);

  // coords
  function toX(idx) { return PAD_L + (idx / lastIdx) * CHART_W; }
  function toY(val) { return H - (val / (gridStep * GRID_LINES)) * H; }

  const points = totals.map((v, i) => ({ x: toX(i), y: toY(v) }));
  const lineStr = points.map(p => `${p.x},${p.y}`).join(' ');
  const areaPath = `M${PAD_L},${H} ${points.map(p => `L${p.x},${p.y}`).join(' ')} L${points[points.length - 1].x},${H} Z`;

  // trend direction for subtitle
  const firstHalf = totals.slice(0, Math.ceil(dataLen / 2));
  const secondHalf = totals.slice(Math.ceil(dataLen / 2));
  const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
  const trendLabel = dataLen < 4
    ? ''
    : avgSecond > avgFirst * 1.05
      ? 'trending upward'
      : avgSecond < avgFirst * 0.95
        ? 'trending downward'
        : 'holding steady';


  return (
    <div className="card">

      <h3 className="heading-card" style={{ marginBottom: 4 }}>Spending Over Time</h3>
      <p className="text-sm ink-muted" style={{ marginBottom: 16 }}>
        Your total monthly spending{trendLabel ? `, ${trendLabel}` : ''}
      </p>


      <div ref={chartRef} style={{ position: 'relative' }}>
        <svg
          width="100%"
          viewBox={`0 0 ${W} ${H + 30}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ overflow: 'visible' }}
        >
          <defs>
            <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--terra)" stopOpacity="0.12" />
              <stop offset="100%" stopColor="var(--terra)" stopOpacity="0.01" />
            </linearGradient>
          </defs>


          {/* gridlines + dollar labels */}
          {gridValues.map((val, i) => {
            const y = toY(val);
            return (
              <g key={i}>
                <line
                  x1={PAD_L} y1={y} x2={W - PAD_R} y2={y}
                  stroke="var(--border)" strokeDasharray="4 4"
                />
                <text
                  x={PAD_L - 8} y={y + 4}
                  fill="var(--ink-muted)" fontSize="9" textAnchor="end"
                  fontFamily="Plus Jakarta Sans"
                >
                  ${val.toLocaleString()}
                </text>
              </g>
            );
          })}


          {/* area fill */}
          <path d={areaPath} fill={`url(#${gradId})`} />


          {/* line */}
          <polyline
            points={lineStr}
            fill="none"
            stroke="var(--terra)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="2000"
            strokeDashoffset={visible ? '0' : '2000'}
            style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(0.22,1,0.36,1) 0.3s' }}
          />


          {/* dots */}
          {points.map((p, i) => {
            const isLast = i === points.length - 1;
            const isHovered = hoverIdx === i;
            return (
              <circle
                key={i}
                cx={p.x} cy={p.y}
                r={isLast ? 5 : isHovered ? 5 : 4}
                fill={isLast ? 'var(--terra)' : 'var(--card)'}
                stroke={isLast ? '#fff' : 'var(--terra)'}
                strokeWidth={isLast ? 3 : 2.5}
                style={{
                  transition: `r 0.2s ease, opacity 0.3s ease ${1.2 + i * 0.08}s`,
                  opacity: visible ? 1 : 0,
                }}
              />
            );
          })}


          {/* hover zones */}
          {monthLabels.map((_, mi) => (
            <rect
              key={mi}
              x={toX(mi) - CHART_W / (dataLen * 2)}
              y={0}
              width={CHART_W / dataLen}
              height={H}
              fill="transparent"
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHoverIdx(mi)}
              onMouseLeave={() => setHoverIdx(null)}
            />
          ))}


          {/* hover vertical line */}
          {hoverIdx !== null && (
            <line
              x1={toX(hoverIdx)} y1={0}
              x2={toX(hoverIdx)} y2={H}
              stroke="var(--terra)" strokeWidth="1"
              strokeDasharray="4 3" opacity="0.4"
            />
          )}


          {/* month labels along bottom */}
          {monthLabels.map((m, i) => {
            const isLast = i === monthLabels.length - 1;
            return (
              <text
                key={i}
                x={toX(i)}
                y={H + 22}
                textAnchor="middle"
                fontSize="9"
                fontWeight={isLast ? 700 : 500}
                fill={isLast ? 'var(--terra)' : 'var(--ink-muted)'}
                fontFamily="Plus Jakarta Sans"
              >
                {m}{isLast ? ' ●' : ''}
              </text>
            );
          })}
        </svg>


        {/* tooltip */}
        {hoverIdx !== null && (
          <div style={{
            position: 'absolute',
            top: 0,
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '12px 16px',
            boxShadow: 'var(--shadow-lg)',
            pointerEvents: 'none',
            zIndex: 10,
            minWidth: 140,
            maxWidth: 'calc(100% - 16px)',
            ...((hoverIdx / lastIdx) > 0.6
              ? { right: `clamp(0%, ${(1 - hoverIdx / lastIdx) * 100 + 4}%, 90%)` }
              : { left: `clamp(0%, ${(PAD_L / W * 100) + (hoverIdx / lastIdx) * (CHART_W / W * 100) + 4}%, 90%)` }
            ),
          }}>
            {/* month + total */}
            <div className="text-xs fw-600 ink-muted" style={{ marginBottom: 4 }}>
              {monthLabels[hoverIdx]}
            </div>
            <div style={{
              fontFamily: "'DM Serif Display', Georgia, serif",
              fontSize: 16,
              color: 'var(--ink)',
              lineHeight: 1,
            }}>
              ${totals[hoverIdx].toLocaleString()}
            </div>
            <div className="text-xs ink-muted" style={{ marginTop: 2, marginBottom: 8 }}>
              total spending
            </div>

            {/* category breakdown */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 6 }}>
              {categories
                .filter(cat => cat.data[hoverIdx] != null && cat.data[hoverIdx] > 0)
                .sort((a, b) => b.data[hoverIdx] - a.data[hoverIdx])
                .map(cat => (
                  <div key={cat.name} className="flex justify-between gap-4" style={{ padding: '2px 0' }}>
                    <span className="flex items-center gap-2">
                      <span style={{ width: 8, height: 3, borderRadius: 2, background: cat.color, display: 'inline-block' }} />
                      <span className="text-sm">{cat.name}</span>
                    </span>
                    <span className="text-sm fw-600">${cat.data[hoverIdx].toLocaleString()}</span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
