'use client';

import { useState, useMemo } from 'react';
import { getCategoryColor } from './transformers';


export default function Subscriptions({ subscriptions }) {

  const [filter, setFilter] = useState('all');

  if (!subscriptions || !subscriptions.length) return null;

  const hasCreep = subscriptions.some(s => s.creep);
  const hasOverlap = subscriptions.some(s => s.overlap);

  const filtered = useMemo(() => {
    if (filter === 'creep') return subscriptions.filter(s => s.creep);
    if (filter === 'overlap') return subscriptions.filter(s => s.overlap);
    return subscriptions;
  }, [filter, subscriptions]);

  const totalMonthly = filtered.reduce((a, s) => a + s.amount, 0);
  const totalAnnual = filtered.reduce((a, s) => a + (s.annual_cost || s.amount * 12), 0);


  // mini sparkline from price history
  function sparkPoints(history, w = 60, h = 20) {
    if (!history || history.length < 2) return '0,10 60,10';
    const min = Math.min(...history) * 0.95;
    const max = Math.max(...history) * 1.05;
    const range = max - min || 1;
    return history.map((v, i) =>
      `${(i / (history.length - 1)) * w},${h - ((v - min) / range) * (h - 4) - 2}`
    ).join(' ');
  }


  return (
    <div className="card">

      <div className="section-header">
        <div>
          <h3 className="heading-card">Your Subscriptions</h3>
          <p className="text-sm ink-muted" style={{ marginTop: 4 }}>
            {filtered.length} active &middot; ${totalMonthly.toFixed(2)}/month &middot; ${Math.round(totalAnnual)}/year
          </p>
        </div>

        <div className="chip-group">
          <button className={`chip ${filter === 'all' ? 'chip--active' : ''}`} onClick={() => setFilter('all')}>All</button>
          {hasCreep && <button className={`chip ${filter === 'creep' ? 'chip--active' : ''}`} onClick={() => setFilter('creep')}>Price Increases</button>}
          {hasOverlap && <button className={`chip ${filter === 'overlap' ? 'chip--active' : ''}`} onClick={() => setFilter('overlap')}>Overlapping</button>}
        </div>
      </div>

      {filtered.map((s, i) => {
        const color = getCategoryColor(s.category, i);
        return (
          <div key={s.merchant} className="sub-row">
            <div className="flex items-center gap-3">
              <div className="sub-icon" style={{ background: color }}>{s.merchant.charAt(0)}</div>
              <div>
                <div className="text-md fw-600">{s.merchant}</div>
                <div className="text-xs ink-muted">
                  ${(s.annual_cost || s.amount * 12).toFixed(0)}/yr
                  {s.frequency && s.frequency !== 'monthly' && (
                    <> &middot; {s.frequency}</>
                  )}
                  {s.creep && (
                    <> &middot; <span style={{ color: 'var(--terra)' }}>
                      +{s.creep_pct}%
                      {s.creep_from != null && s.creep_to != null && (
                        <> (${s.creep_from.toFixed(2)} &rarr; ${s.creep_to.toFixed(2)})</>
                      )}
                    </span></>
                  )}
                  {s.overlap && (
                    <> &middot; <span style={{ color: 'var(--blue)' }}>
                      {s.overlap} ({s.overlap_count} subs)
                    </span></>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {s.history && s.history.length >= 2 && (
                <svg width="60" height="20" style={{ opacity: 0.5 }}>
                  <polyline points={sparkPoints(s.history)} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              )}
              <div className="text-md fw-700">${s.amount.toFixed(2)}</div>
            </div>
          </div>
        );
      })}

    </div>
  );
}
