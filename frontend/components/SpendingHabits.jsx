'use client';

import { useEffect, useRef, useState } from 'react';


const DEMO_PAYDAY_BARS = [
  { label: 'Days 1–3',  pct: 40, color: 'var(--terra)',       delay: 0 },
  { label: 'Days 4–14', pct: 35, color: 'var(--terra-light)',  delay: 0.1 },
  { label: 'Days 15+',  pct: 25, color: 'var(--sand)',         delay: 0.2 },
];


export default function SpendingHabits({ paydayBars = DEMO_PAYDAY_BARS }) {

  const containerRef = useRef(null);
  const [animated, setAnimated] = useState(false);


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
    <div className="card" ref={containerRef}>

      <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
        <h3 className="heading-card">When You Spend</h3>
        <span className="help-tip" data-tooltip="Sift tracks when during the month and week your spending happens">?</span>
      </div>

      <p className="text-sm ink-muted" style={{ marginBottom: 14 }}>Your spending timing habits</p>


      {/* PAYDAY PATTERN */}
      <div style={{ padding: '14px 16px', background: 'var(--bg)', borderRadius: 'var(--r-md)', marginBottom: 10 }}>

        <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--terra)" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
          <span className="text-sm fw-700">After Payday</span>
          <span className="tag tag--high">Strong pattern</span>
        </div>

        <div className="text-sm ink-mid" style={{ lineHeight: 1.7, marginBottom: 10 }}>
          You spend <strong>40%</strong> of your monthly budget in the <strong>first 3 days</strong> after your paycheck lands.
          This happened 9 out of 11 months.
        </div>

        {/* bars */}
        {paydayBars.map(bar => (
          <div key={bar.label} className="flex items-center gap-1" style={{ marginTop: bar.delay > 0 ? 4 : 0 }}>
            <span className="text-xs ink-muted" style={{ width: 60 }}>{bar.label}</span>
            <div style={{ flex: 1, height: 18, background: 'var(--surface-alt)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: animated ? `${bar.pct}%` : 0,
                background: bar.color,
                borderRadius: 4,
                transition: `width 1.2s cubic-bezier(0.22, 1, 0.36, 1) ${bar.delay}s`,
              }} />
            </div>
            <span className="text-xs fw-600" style={{ width: 30, textAlign: 'right' }}>{bar.pct}%</span>
          </div>
        ))}
      </div>


      {/* WEEKEND PATTERN */}
      <div style={{ padding: '14px 16px', background: 'var(--bg)', borderRadius: 'var(--r-md)' }}>
        <div className="flex items-center gap-2" style={{ marginBottom: 6 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--terra-muted)" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
          <span className="text-sm fw-700">Weekends</span>
          <span className="tag tag--medium">Moderate</span>
        </div>
        <div className="text-sm ink-mid" style={{ lineHeight: 1.7 }}>
          You spend about <strong>60% more</strong> on weekends than weekdays. Saturdays are your biggest spending day.
        </div>
      </div>

    </div>
  );
}
