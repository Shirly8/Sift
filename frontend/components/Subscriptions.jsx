'use client';

import { useState, useMemo } from 'react';


const DEMO_SUBS = [
  { name: 'Netflix',    amount: 22.99, color: '#E50914', creep: true,  overlap: 'streaming', history: [15.99,15.99,16.49,17.99,19.99,22.99] },
  { name: 'Spotify',    amount: 11.99, color: '#1DB954', creep: false, overlap: null,        history: [9.99,9.99,10.99,10.99,11.99,11.99] },
  { name: 'Disney+',    amount: 13.99, color: '#113CCF', creep: false, overlap: 'streaming', history: [12.99,12.99,12.99,13.99,13.99,13.99] },
  { name: 'Crave',      amount: 19.99, color: '#0072CE', creep: false, overlap: 'streaming', history: [17.99,17.99,19.99,19.99,19.99,19.99] },
  { name: 'iCloud',     amount: 3.99,  color: '#A0A0A0', creep: false, overlap: null,        history: [3.99,3.99,3.99,3.99,3.99,3.99] },
  { name: 'Figma',      amount: 18.00, color: '#A259FF', creep: false, overlap: null,        history: [15.00,15.00,15.00,18.00,18.00,18.00] },
  { name: 'ChatGPT',    amount: 25.00, color: '#10A37F', creep: false, overlap: null,        history: [20.00,20.00,20.00,20.00,25.00,25.00] },
  { name: 'YouTube',    amount: 13.99, color: '#FF0000', creep: true,  overlap: 'streaming', history: [11.99,11.99,11.99,13.99,13.99,13.99] },
];


export default function Subscriptions({ subscriptions = DEMO_SUBS }) {

  const [filter, setFilter] = useState('all');
  const [expandedIdx, setExpandedIdx] = useState(null);


  const filtered = useMemo(() => {
    if (filter === 'creep') return subscriptions.filter(s => s.creep);
    if (filter === 'overlap') return subscriptions.filter(s => s.overlap);
    return subscriptions;
  }, [filter, subscriptions]);


  const totalMonthly = filtered.reduce((a, s) => a + s.amount, 0);
  const totalAnnual = totalMonthly * 12;


  // mini sparkline points for a sub's price history
  function miniSparkline(history, w = 60, h = 20) {
    const min = Math.min(...history) * 0.95;
    const max = Math.max(...history) * 1.05;
    const range = max - min || 1;
    return history.map((v, i) =>
      `${(i / (history.length - 1)) * w},${h - ((v - min) / range) * (h - 4) - 2}`
    ).join(' ');
  }


  // price creep chart for Netflix
  const priceData = [15.99,15.99,15.99,16.49,16.49,16.49,16.49,17.99,17.99,17.99,17.99,17.99,19.99,19.99,19.99,19.99,22.99,22.99,22.99,22.99,22.99,22.99,22.99];
  const pcW = 280, pcH = 90, pcMin = 14, pcMax = 25;
  const pcPoints = priceData.map((v, i) =>
    `${(i / 22) * pcW},${pcH - ((v - pcMin) / (pcMax - pcMin)) * (pcH - 10) - 5}`
  ).join(' ');


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
            const pctChange = ((s.history[s.history.length - 1] - s.history[0]) / s.history[0] * 100).toFixed(0);

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
                      Monthly
                      {s.creep && <> &middot; <span style={{ color: 'var(--terra)' }}>Price went up</span></>}
                      {s.overlap && <> &middot; <span style={{ color: '#2B6CB0' }}>{s.overlap}</span></>}
                    </div>
                  </div>
                </div>

                {/* right — sparkline + price */}
                <div className="flex items-center gap-3">
                  <svg width="60" height="20" style={{ opacity: 0.5 }}>
                    <polyline points={miniSparkline(s.history)} fill="none" stroke={s.color} strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  <div className="text-md fw-700">${s.amount.toFixed(2)}</div>
                </div>

                {/* expand */}
                <div className="sub-expand">
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid var(--surface-alt)' }}>
                    <div>
                      <div className="text-xs ink-muted">Per year</div>
                      <div className="text-sm fw-700">${Math.round(s.amount * 12)}</div>
                    </div>
                    <div>
                      <div className="text-xs ink-muted">Price change</div>
                      <div className={`text-sm fw-700 ${pctChange > 0 ? 'ink-terra' : 'ink-sage'}`}>
                        {pctChange > 0 ? '+' : ''}{pctChange}%
                      </div>
                    </div>
                    <div>
                      <div className="text-xs ink-muted">Since</div>
                      <div className="text-sm fw-600">Jan 2024</div>
                    </div>
                  </div>
                </div>

              </div>
            );
          })}
        </div>


        {/* price creep detail */}
        <div style={{ paddingLeft: 20 }}>

          {/* Netflix price creep chart */}
          <div className="flex items-center gap-2" style={{ marginBottom: 12 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#CF5532" strokeWidth="2">
              <path d="M2 20l4-4 4 4 4-8 4 4 4-8" />
            </svg>
            <span className="text-sm fw-600 ink-terra">Price Went Up</span>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div className="fw-700 text-md">Netflix</div>
            <div className="text-sm ink-muted" style={{ margin: '4px 0 8px' }}>
              Was $15.99, now $22.99 — that's 44% more than when you signed up
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
              <text x="2" y={pcH - ((15.99 - pcMin) / (pcMax - pcMin)) * (pcH - 10) - 10} fill="#A0A0A0" fontSize="9" fontFamily="Plus Jakarta Sans">$15.99</text>
              <text x={pcW - 32} y={pcH - ((22.99 - pcMin) / (pcMax - pcMin)) * (pcH - 10) - 10} fill="#CF5532" fontSize="9" fontWeight="700" fontFamily="Plus Jakarta Sans">$22.99</text>
            </svg>

            <div className="flex justify-between" style={{ marginTop: 4 }}>
              <span className="text-xs ink-muted">Jan 2024</span>
              <span className="text-xs ink-muted">Nov 2025</span>
            </div>
          </div>


          {/* streaming overlap callout */}
          <div style={{
            padding: '12px 16px',
            background: 'var(--terra-glow)',
            border: '1px solid var(--terra-border)',
            borderRadius: 'var(--r-md)',
          }}>
            <div className="text-sm fw-600 ink-terra" style={{ marginBottom: 4 }}>You have 4 streaming services</div>
            <div className="text-sm ink-mid">Netflix + Disney+ + Crave + YouTube = <strong>$71/month</strong></div>
            <div className="text-xs ink-muted" style={{ marginTop: 4 }}>Dropping one could save ~$180/year</div>
          </div>

        </div>

      </div>

    </div>
  );
}
