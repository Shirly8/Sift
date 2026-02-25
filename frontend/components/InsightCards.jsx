'use client';

import { useState } from 'react';


export default function InsightCards({ insights }) {

  const [expandedIdx, setExpandedIdx] = useState(null);

  if (!insights || !insights.length) return null;


  function toggleInsight(idx) {
    setExpandedIdx(expandedIdx === idx ? null : idx);
  }


  return (
    <div className="card" style={{ padding: '22px 24px' }}>

      <div className="flex justify-between items-center" style={{ marginBottom: 4 }}>
        <h3 className="heading-card">Things Worth Knowing</h3>
      </div>

      <p className="text-sm ink-muted" style={{ marginBottom: 16 }}>
        What Sift found in your spending &middot; Biggest savings first
      </p>


      {/* insight cards */}
      <div className="flex flex-col gap-3">
        {insights.map((ins, idx) => (
          <div
            key={idx}
            className={`insight ${expandedIdx === idx ? 'expanded' : ''}`}
            onClick={() => toggleInsight(idx)}
          >

            {/* rank number */}
            <div className="insight__rank">{ins.rank || idx + 1}</div>

            {/* chevron */}
            <div className="insight__chevron">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-muted)" strokeWidth="2.5" strokeLinecap="round">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </div>

            {/* impact + confidence */}
            <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
              {ins.impact ? (
                <span className="insight__impact">
                  ${ins.impact.toLocaleString()}<span className="text-sm ink-muted fw-500">/yr</span>
                </span>
              ) : (
                <span className="tag tag--neutral">Good to know</span>
              )}
              <span className={`tag ${ins.confidence === 'HIGH' ? 'tag--high' : 'tag--medium'}`}>
                {ins.confidence === 'HIGH' ? 'Reliable' : 'Likely'}
              </span>
            </div>

            {/* title + description */}
            <div className="insight__title">{ins.title}</div>
            <div className="insight__desc">{ins.desc}</div>

            {/* expandable detail */}
            <div className="insight__expand">
              {ins.extra && (
                <div style={{ padding: '12px 0 4px', borderTop: '1px solid var(--surface-alt)' }}>
                  <div className="text-xs fw-600 ink-muted" style={{ marginBottom: 6 }}>WHAT YOU CAN DO</div>
                  <div className="text-sm ink-mid" style={{ lineHeight: 1.6 }}>{ins.extra}</div>
                </div>
              )}
            </div>

          </div>
        ))}
      </div>

    </div>
  );
}
