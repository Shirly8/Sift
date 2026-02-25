'use client';

import { useEffect, useRef, useState } from 'react';


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

  if (!categories || !categories.length) return null;


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
      {categories.map(c => (
        <div key={c.label} className="spend-bar" data-tooltip={c.tip}>

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
