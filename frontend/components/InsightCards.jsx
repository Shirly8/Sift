'use client';

import { useState } from 'react';


export default function InsightCards({ insights }) {

  const [expandedIdx, setExpandedIdx] = useState(null);

  if (!insights || !insights.length) return null;


  function toggleInsight(idx) {
    setExpandedIdx(expandedIdx === idx ? null : idx);
  }

  function badgeClass(confidence) {
    if (confidence === 'HIGH') return 'status-badge status-badge--sage';
    if (confidence === 'MEDIUM') return 'status-badge status-badge--amber';
    return 'status-badge status-badge--terra';
  }

  function badgeLabel(confidence) {
    if (confidence === 'HIGH') return 'Consistent pattern';
    if (confidence === 'MEDIUM') return 'Likely pattern';
    return 'Early signal';
  }


  return (
    <div className="card card--hero">

      <h3 className="heading-card" style={{ marginBottom: 4 }}>Things Worth Knowing</h3>
      <p className="text-sm ink-muted" style={{ marginBottom: 16 }}>
        Patterns we found in your spending
      </p>

      <div className="flex flex-col gap-3">
        {insights.map((ins, idx) => {
          const hasAction = !!ins.extra;
          return (
          <div
            key={idx}
            className={`insight ${expandedIdx === idx ? 'expanded' : ''}${!hasAction ? ' insight--static' : ''}`}
            onClick={hasAction ? () => toggleInsight(idx) : undefined}
          >

            {/* rank number — top right */}
            <div className="insight__rank">{ins.rank || idx + 1}</div>

            {/* chevron — only if expandable */}
            {hasAction && (
              <div className="insight__chevron">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ink-muted)" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </div>
            )}

            {/* impact amount — big number on top */}
            {ins.impact > 0 ? (
              <div className="insight__impact">
                ${ins.impact.toLocaleString()}<span className="text-xs ink-muted fw-500"> per year</span>
              </div>
            ) : (
              <div className="insight__impact" style={{ color: 'var(--ink-muted)', fontSize: 'var(--fs-sm)' }}>
                Good to know
              </div>
            )}

            {/* confidence badge */}
            <div>
              <span className={badgeClass(ins.confidence)}>
                {badgeLabel(ins.confidence)}
              </span>
            </div>

            {/* title + description */}
            <div className="insight__title">{ins.title}</div>
            <div className="insight__desc">{ins.desc}</div>

            {/* expandable action — only if content exists */}
            {hasAction && (
              <div className="expandable insight__expand">
                <div style={{ padding: '10px 0 4px', borderTop: '1px solid var(--surface-alt)' }}>
                  <div className="text-xs fw-600 ink-muted" style={{ marginBottom: 4 }}>WHAT YOU CAN DO</div>
                  <div className="text-xs ink-muted" style={{ lineHeight: 1.6 }}>{ins.extra}</div>
                </div>
              </div>
            )}

          </div>
          );
        })}
      </div>

    </div>
  );
}
