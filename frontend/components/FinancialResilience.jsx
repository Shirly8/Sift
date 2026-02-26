'use client';

import { useState, useEffect, useRef } from 'react';

export default function FinancialResilience({ data }) {
  if (!data) return null;

  const { stress_test: stress, runway } = data;
  const [visible, setVisible] = useState(false);
  const cardRef = useRef(null);

  // scroll-triggered animation
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.15 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const months = runway?.months_of_runway ?? 0;
  const isInfinite = months === Infinity || months === null || (typeof months === 'string' && months === 'Infinity');
  const isSurplus = isInfinite || (runway?.net_monthly > 0 && months > 100);

  const runwayTag = isSurplus ? 'tag--high'
    : months >= 6 ? 'tag--medium'
    : 'tag--low';

  const runwayLabel = isSurplus ? 'Surplus'
    : months >= 6 ? 'Stable'
    : 'At Risk';

  const ci = runway?.confidence_interval || [0, 0];
  const categories = stress?.categories_to_cut || [];
  const projection = stress?.projection?.cumulative_net;

  return (
    <div className="card" ref={cardRef}>
      <div className="card__accent" />

      {/* Header */}
      <div className="section-header">
        <div>
          <h2 className="heading-card">Your Safety Net</h2>
          <span className="label" style={{ marginTop: 2 }}>Based on your income &amp; spending</span>
        </div>
        <span className={`tag ${runwayTag}`}>{runwayLabel}</span>
      </div>

      {/* Runway Hero */}
      <div className="flex items-baseline gap-3" style={{ marginBottom: 4 }}>
        {isSurplus ? (
          <span className="num-large ink-sage">Surplus</span>
        ) : (
          <>
            <span className={`num-large ${months === 0 ? 'ink-terra' : ''}`}>
              {Math.round(months)}
            </span>
            <span className="text-md ink-soft">months covered</span>
          </>
        )}
      </div>

      {!isSurplus && (
        <p className="text-sm ink-muted" style={{ marginBottom: 4 }}>
          Could range from {ci[0]} to {ci[1]} months
        </p>
      )}

      {/* Income vs Spending */}
      <div className="resilience-stats">
        <div className="resilience-stat">
          <span className="label">Income</span>
          <span className="font-serif text-lg ink-sage">
            ${Math.round(runway?.monthly_income || 0).toLocaleString()}<span className="text-xs ink-muted">/mo</span>
          </span>
        </div>
        <div className="resilience-stat">
          <span className="label">Spending</span>
          <span className="font-serif text-lg ink-terra">
            ${Math.round(stress?.minimum_monthly_budget || runway?.monthly_burn_rate || 0).toLocaleString()}<span className="text-xs ink-muted">/mo</span>
          </span>
        </div>
        {runway?.net_monthly !== undefined && (
          <div className="resilience-stat">
            <span className="label">Net</span>
            <span className={`font-serif text-lg ${runway.net_monthly >= 0 ? 'ink-sage' : 'ink-terra'}`}>
              {runway.net_monthly >= 0 ? '+' : ''}${Math.round(runway.net_monthly).toLocaleString()}<span className="text-xs ink-muted">/mo</span>
            </span>
          </div>
        )}
      </div>

      {/* Fan Chart */}
      {projection && <FanChart data={projection} visible={visible} />}

      {/* Categories to Cut */}
      {categories.length > 0 && (
        <div style={{ marginTop: 'var(--sp-5)' }}>
          <p className="label" style={{ marginBottom: 10 }}>If income stops — categories to reduce</p>
          {categories.map((cat, i) => (
            <div key={i} className="resilience-row">
              <div>
                <span className="text-sm fw-600">{cat.category}</span>
                <span className="text-xs ink-muted" style={{ marginLeft: 8 }}>
                  ${Math.round(cat.monthly_avg)}/mo avg
                </span>
              </div>
              <span className="font-serif text-sm ink-sage">
                -${Math.round(cat.potential_savings)}/mo
              </span>
            </div>
          ))}
          <div className="flex justify-between" style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--surface-alt)' }}>
            <span className="text-xs ink-muted">Minimum monthly budget</span>
            <span className="font-serif text-sm fw-600">
              ${Math.round(stress?.minimum_monthly_budget || 0).toLocaleString()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}


function FanChart({ data, visible }) {
  const W = 520, H = 180, PAD = { top: 10, right: 10, bottom: 24, left: 48 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const p10 = data[10] || data['10'] || [];
  const p25 = data[25] || data['25'] || [];
  const p50 = data[50] || data['50'] || [];
  const p75 = data[75] || data['75'] || [];
  const p90 = data[90] || data['90'] || [];

  const n = p50.length;
  if (n === 0) return null;

  const allVals = [...p10, ...p90];
  const yMin = Math.min(0, ...allVals);
  const yMax = Math.max(0, ...allVals);
  const yRange = yMax - yMin || 1;

  const x = (i) => PAD.left + (i / (n - 1)) * chartW;
  const y = (v) => PAD.top + chartH - ((v - yMin) / yRange) * chartH;

  const band = (upper, lower) => {
    const fwd = upper.map((v, i) => `${x(i)},${y(v)}`).join(' ');
    const rev = [...lower].reverse().map((v, i) => `${x(n - 1 - i)},${y(v)}`).join(' ');
    return `${fwd} ${rev}`;
  };

  const line = (arr) => arr.map((v, i) => `${x(i)},${y(v)}`).join(' ');

  const medianLen = p50.reduce((sum, v, i) => {
    if (i === 0) return 0;
    const dx = x(i) - x(i - 1);
    const dy = y(v) - y(p50[i - 1]);
    return sum + Math.sqrt(dx * dx + dy * dy);
  }, 0);

  const zeroY = y(0);

  // x-axis labels at key months
  const labelIndices = [];
  if (n > 0) labelIndices.push(0);
  if (n > 5) labelIndices.push(5);
  if (n > 11) labelIndices.push(11);
  if (n > 17) labelIndices.push(17);
  if (n > 1) labelIndices.push(n - 1);

  // y-axis ticks
  const yTicks = [];
  const step = yRange / 3;
  for (let i = 0; i <= 3; i++) {
    const val = yMin + step * i;
    yTicks.push(val);
  }

  const fmtK = (v) => {
    const abs = Math.abs(v);
    if (abs >= 1000) return `${v < 0 ? '-' : ''}$${(abs / 1000).toFixed(1)}k`;
    return `${v < 0 ? '-' : ''}$${Math.round(abs)}`;
  };

  return (
    <div className="resilience-chart">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
        {/* Outer band 10-90 */}
        <polygon
          points={band(p90, p10)}
          fill="var(--terra)"
          opacity={visible ? 0.08 : 0}
          style={{ transition: 'opacity 0.8s ease' }}
        />
        {/* Inner band 25-75 */}
        <polygon
          points={band(p75, p25)}
          fill="var(--terra)"
          opacity={visible ? 0.18 : 0}
          style={{ transition: 'opacity 0.8s ease 0.2s' }}
        />
        {/* Zero line */}
        {yMin < 0 && yMax > 0 && (
          <line
            x1={PAD.left} y1={zeroY} x2={W - PAD.right} y2={zeroY}
            stroke="var(--ink-faint)" strokeWidth="1" strokeDasharray="4,3"
          />
        )}
        {/* Median line */}
        <polyline
          points={line(p50)}
          fill="none"
          stroke="var(--terra)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={medianLen}
          strokeDashoffset={visible ? 0 : medianLen}
          style={{ transition: `stroke-dashoffset 1.2s cubic-bezier(0.22, 1, 0.36, 1) 0.3s` }}
        />
        {/* Y-axis labels */}
        {yTicks.map((val, i) => (
          <text
            key={i}
            x={PAD.left - 6}
            y={y(val) + 3}
            textAnchor="end"
            fontSize="11"
            fill="var(--ink-muted)"
            fontFamily="Plus Jakarta Sans, sans-serif"
          >
            {fmtK(val)}
          </text>
        ))}
        {/* X-axis labels */}
        {labelIndices.map((idx) => (
          <text
            key={idx}
            x={x(idx)}
            y={H - 4}
            textAnchor="middle"
            fontSize="11"
            fill="var(--ink-muted)"
            fontFamily="Plus Jakarta Sans, sans-serif"
          >
            Mo {idx + 1}
          </text>
        ))}
      </svg>
    </div>
  );
}
