'use client';

import { useEffect, useRef, useState } from 'react';


// deterministic color palette for categories
const CATEGORY_COLORS = [
  '#CF5532', '#6B8F71', '#D4915E', '#D4735A', '#7B8794',
  '#C4A87A', '#A8B0A0', '#8B6F47', '#5A7D9A', '#9B6B8D',
  '#6B9B8D', '#B87333', '#7B6B8F', '#8F7B6B', '#6B8F8F',
];


export default function SpendingBars({ categories }) {

  const containerRef = useRef(null);
  const [animated, setAnimated] = useState(false);


  // animate bars on scroll into view
  useEffect(() => {
    if (!containerRef.current) return;

    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setAnimated(true);
        obs.disconnect();
      }
    }, { threshold: 0.2 });

    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);


  if (!categories || categories.length === 0) {
    return (
      <div className="card card--hero" ref={containerRef}>
        <h2 className="heading-section">Where Your Money Goes</h2>
        <p className="text-sm ink-muted" style={{ marginTop: 8 }}>
          No category data available yet.
        </p>
      </div>
    );
  }


  // compute percentages relative to the highest average
  const maxAvg = Math.max(...categories.map(c => c.avg));

  const bars = categories.map((c, i) => ({
    label: c.label,
    avg: c.avg,
    range: `$${c.min.toLocaleString()}–$${c.max.toLocaleString()}`,
    color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
    pct: maxAvg > 0 ? Math.round((c.avg / maxAvg) * 100) : 0,
  }));


  return (
    <div className="card card--hero" ref={containerRef}>

      {/* section header */}
      <div className="section-header">
        <div>
          <h2 className="heading-section">Where Your Money Goes</h2>
          <p className="section-explain" style={{ marginTop: 4 }}>
            Your average monthly spending by category. Hover any bar to see details.
          </p>
        </div>
      </div>


      {/* spending bars */}
      {bars.map(c => (
        <div key={c.label} className="spend-bar">

          {/* label */}
          <div className="spend-bar__label">
            <div className="text-md fw-600">{c.label}</div>
            <div className="text-xs ink-muted">{c.range}/mo</div>
          </div>

          {/* bar track */}
          <div className="spend-bar__track">
            <div
              className="spend-bar__fill"
              style={{
                background: c.color,
                width: animated ? `${c.pct}%` : 0,
              }}
            >
              {c.pct > 30 && (
                <span className="text-xs fw-600" style={{ color: '#fff' }}>${c.avg}/mo</span>
              )}
            </div>

            {c.pct <= 30 && (
              <span style={{
                position: 'absolute',
                left: `calc(${c.pct}% + 8px)`,
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--ink)',
              }}>
                ${c.avg}/mo
              </span>
            )}
          </div>

          {/* dollar amount */}
          <div className="spend-bar__amt">
            <span className="text-sm fw-700">${c.avg}</span>
            <span className="text-xs ink-muted">/mo avg</span>
          </div>

        </div>
      ))}

    </div>
  );
}
