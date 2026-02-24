'use client';

import { useState, useMemo } from 'react';


// deterministic colors for subscription icons
const SUB_COLORS = [
  '#CF5532', '#6B8F71', '#D4915E', '#113CCF', '#A259FF',
  '#10A37F', '#E50914', '#1DB954', '#0072CE', '#FF0000',
  '#7B8794', '#C4A87A', '#8B6F47', '#5A7D9A', '#9B6B8D',
];


export default function Subscriptions({ recurring, priceCreep, overlaps }) {

  const [filter, setFilter] = useState('all');
  const [expandedIdx, setExpandedIdx] = useState(null);


  // build subscription list by merging recurring + price_creep + overlaps
  const subscriptions = useMemo(() => {
    if (!recurring || recurring.length === 0) return [];

    // index price creep by merchant name
    const creepMap = {};
    (priceCreep || []).forEach(pc => {
      if (pc.price_creep_detected) {
        creepMap[pc.merchant.toUpperCase()] = pc;
      }
    });

    // index overlaps by merchant name
    const overlapMap = {};
    (overlaps || []).forEach(o => {
      (o.subscriptions || []).forEach(s => {
        overlapMap[s.merchant.toUpperCase()] = o.category;
      });
    });

    return recurring.map((r, i) => {
      const key = r.merchant.toUpperCase();
      const pc = creepMap[key];
      const history = pc?.price_history?.map(h => h.amount) || [r.amount];

      return {
        name: r.merchant,
        amount: r.amount,
        color: SUB_COLORS[i % SUB_COLORS.length],
        creep: !!pc,
        overlap: overlapMap[key] || null,
        history: history,
        annualCost: r.annual_cost,
        frequency: r.frequency,
        nCharges: r.n_charges,
        originalPrice: pc?.original_price,
        currentPrice: pc?.current_price,
        increasePct: pc?.total_increase_pct,
        annualIncrease: pc?.annual_cost_increase,
      };
    });
  }, [recurring, priceCreep, overlaps]);


  const filtered = useMemo(() => {
    if (filter === 'creep') return subscriptions.filter(s => s.creep);
    if (filter === 'overlap') return subscriptions.filter(s => s.overlap);
    return subscriptions;
  }, [filter, subscriptions]);


  const totalMonthly = filtered.reduce((a, s) => a + s.amount, 0);
  const totalAnnual = totalMonthly * 12;


  // mini sparkline for a sub's price history
  function miniSparkline(history, w = 60, h = 20) {
    if (!history || history.length < 2) return '';
    const min = Math.min(...history) * 0.95;
    const max = Math.max(...history) * 1.05;
    const range = max - min || 1;
    return history.map((v, i) =>
      `${(i / (history.length - 1)) * w},${h - ((v - min) / range) * (h - 4) - 2}`
    ).join(' ');
  }


  if (!subscriptions.length) {
    return (
      <div className="card">
        <h3 className="heading-card">Your Subscriptions</h3>
        <p className="text-sm ink-muted" style={{ marginTop: 8 }}>
          No recurring charges detected. Need 100+ transactions for subscription detection.
        </p>
      </div>
    );
  }


  // find the top price-creep subscription for the detail chart
  const topCreep = subscriptions.find(s => s.creep && s.history.length > 2);

  // build price creep chart data
  let pcPoints = '';
  let pcW = 280, pcH = 90, pcMin = 0, pcMax = 100;
  if (topCreep && topCreep.history.length > 1) {
    pcMin = Math.min(...topCreep.history) * 0.9;
    pcMax = Math.max(...topCreep.history) * 1.1;
    pcPoints = topCreep.history.map((v, i) =>
      `${(i / (topCreep.history.length - 1)) * pcW},${pcH - ((v - pcMin) / (pcMax - pcMin || 1)) * (pcH - 10) - 5}`
    ).join(' ');
  }

  // overlapping categories summary
  const overlapGroups = overlaps || [];


  return (
    <div className="card">


      {/* SECTION HEADER */}
      <div className="section-header">
        <div>
          <h3 className="heading-card">Your Subscriptions</h3>
          <p className="text-sm ink-muted" style={{ marginTop: 4 }}>
            {filtered.length} active &middot; ${totalMonthly.toFixed(2)}/month &middot; ${Math.round(totalAnnual)}/year
          </p>
        </div>

        {/* filter chips */}
        <div className="chip-group">
          {['all', 'creep', 'overlap'].map(f => (
            <button
              key={f}
              className={`chip ${filter === f ? 'chip--active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'All' : f === 'creep' ? 'Price Increases' : 'Overlapping'}
            </button>
          ))}
        </div>
      </div>


      {/* SPLIT — list + price creep */}
      <div className="split-grid" style={{ gap: 0 }}>


        {/* subscription list */}
        <div style={{ paddingRight: 20, borderRight: '1px solid var(--surface-alt)' }}>
          {filtered.map((s, i) => {
            const pctChange = s.history.length >= 2
              ? (((s.history[s.history.length - 1] - s.history[0]) / s.history[0]) * 100).toFixed(0)
              : '0';

            return (
              <div
                key={s.name}
                className={`sub-row ${expandedIdx === i ? 'expanded' : ''}`}
                onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
              >

                {/* left — icon + name */}
                <div className="flex items-center gap-3">
                  <div className="sub-icon" style={{ background: s.color }}>
                    {s.name.charAt(0)}
                  </div>
                  <div>
                    <div className="text-md fw-600">{s.name}</div>
                    <div className="text-xs ink-muted">
                      {s.frequency}
                      {s.creep && <> &middot; <span style={{ color: 'var(--terra)' }}>Price went up</span></>}
                      {s.overlap && <> &middot; <span style={{ color: '#2B6CB0' }}>{s.overlap}</span></>}
                    </div>
                  </div>
                </div>

                {/* right — sparkline + price */}
                <div className="flex items-center gap-3">
                  {s.history.length >= 2 && (
                    <svg width="60" height="20" style={{ opacity: 0.5 }}>
                      <polyline points={miniSparkline(s.history)} fill="none" stroke={s.color} strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  )}
                  <div className="text-md fw-700">${s.amount.toFixed(2)}</div>
                </div>

                {/* expand */}
                <div className="sub-expand">
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid var(--surface-alt)' }}>
                    <div>
                      <div className="text-xs ink-muted">Per year</div>
                      <div className="text-sm fw-700">${Math.round(s.annualCost || s.amount * 12)}</div>
                    </div>
                    <div>
                      <div className="text-xs ink-muted">Price change</div>
                      <div className={`text-sm fw-700 ${pctChange > 0 ? 'ink-terra' : 'ink-sage'}`}>
                        {pctChange > 0 ? '+' : ''}{pctChange}%
                      </div>
                    </div>
                    <div>
                      <div className="text-xs ink-muted">Charges</div>
                      <div className="text-sm fw-600">{s.nCharges}</div>
                    </div>
                  </div>
                </div>

              </div>
            );
          })}
        </div>


        {/* price creep detail */}
        <div style={{ paddingLeft: 20 }}>

          {/* price creep chart */}
          {topCreep && topCreep.history.length > 1 ? (
            <>
              <div className="flex items-center gap-2" style={{ marginBottom: 12 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#CF5532" strokeWidth="2">
                  <path d="M2 20l4-4 4 4 4-8 4 4 4-8" />
                </svg>
                <span className="text-sm fw-600 ink-terra">Price Went Up</span>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div className="fw-700 text-md">{topCreep.name}</div>
                <div className="text-sm ink-muted" style={{ margin: '4px 0 8px' }}>
                  Was ${topCreep.originalPrice}, now ${topCreep.currentPrice} — that's {topCreep.increasePct}% more
                </div>

                <svg width="100%" height="100" viewBox={`0 0 ${pcW} ${pcH}`} preserveAspectRatio="none" style={{ overflow: 'visible' }}>
                  <defs>
                    <linearGradient id="pcGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#CF5532" stopOpacity="0.12" />
                      <stop offset="100%" stopColor="#CF5532" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <polygon points={`0,${pcH} ${pcPoints} ${pcW},${pcH}`} fill="url(#pcGrad)" />
                  <polyline points={pcPoints} fill="none" stroke="#CF5532" strokeWidth="2" strokeLinecap="round"
                    strokeDasharray="600" strokeDashoffset="600">
                    <animate attributeName="stroke-dashoffset" from="600" to="0" dur="1.5s" fill="freeze" begin="0.8s" />
                  </polyline>
                  <text x="2" y={pcH - ((topCreep.history[0] - pcMin) / (pcMax - pcMin || 1)) * (pcH - 10) - 10} fill="#A0A0A0" fontSize="9" fontFamily="Plus Jakarta Sans">${topCreep.originalPrice}</text>
                  <text x={pcW - 32} y={pcH - ((topCreep.currentPrice - pcMin) / (pcMax - pcMin || 1)) * (pcH - 10) - 10} fill="#CF5532" fontSize="9" fontWeight="700" fontFamily="Plus Jakarta Sans">${topCreep.currentPrice}</text>
                </svg>
              </div>
            </>
          ) : (
            <div style={{ marginBottom: 16 }}>
              <div className="text-sm ink-muted">No significant price increases detected.</div>
            </div>
          )}


          {/* overlap callout */}
          {overlapGroups.length > 0 && overlapGroups.map((o, i) => (
            <div key={i} style={{
              padding: '12px 16px',
              background: 'var(--terra-glow)',
              border: '1px solid var(--terra-border)',
              borderRadius: 'var(--r-md)',
              marginBottom: 8,
            }}>
              <div className="text-sm fw-600 ink-terra" style={{ marginBottom: 4 }}>
                {o.count} {o.category} subscriptions
              </div>
              <div className="text-sm ink-mid">
                {o.subscriptions.map(s => s.merchant).join(' + ')} = <strong>${Math.round(o.combined_annual / 12)}/month</strong>
              </div>
              {o.potential_savings > 0 && (
                <div className="text-xs ink-muted" style={{ marginTop: 4 }}>
                  Dropping one could save ~${Math.round(o.potential_savings)}/year
                </div>
              )}
            </div>
          ))}

          {overlapGroups.length === 0 && !topCreep && (
            <div className="text-sm ink-muted">
              No overlapping subscriptions or price increases detected.
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
