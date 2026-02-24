'use client';

import { useEffect, useRef, useState } from 'react';


const DEMO_CATEGORIES = [
  { label: 'Dining Out',     avg: 456, range: '$380–$890', color: '#CF5532', pct: 88,  tip: 'Your most variable category. August was an outlier at $890.' },
  { label: 'Groceries',      avg: 558, range: '$420–$650', color: '#6B8F71', pct: 100, tip: 'Fairly steady. When groceries go up, your delivery spending goes down.' },
  { label: 'Shopping',       avg: 262, range: '$180–$1,247', color: '#D4915E', pct: 50, tip: 'One month had a $1,247 Best Buy purchase — an outlier.' },
  { label: 'Subscriptions',  avg: 188, range: '$180–$195', color: '#D4735A', pct: 36,  tip: '8 active subscriptions. Netflix has gone up 44% since you signed up.' },
  { label: 'Transport',      avg: 135, range: '$120–$150', color: '#7B8794', pct: 26,  tip: 'Very consistent. Tends to go up on months you dine out more.' },
  { label: 'Delivery',       avg: 118, range: '$60–$380',  color: '#C4A87A', pct: 23,  tip: 'Inversely linked to groceries — you order more when you cook less.' },
  { label: 'Entertainment',  avg: 95,  range: '$70–$130',  color: '#A8B0A0', pct: 18,  tip: 'Stable and modest. No concerns here.' },
];


export default function SpendingBars({ categories = DEMO_CATEGORIES }) {

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
