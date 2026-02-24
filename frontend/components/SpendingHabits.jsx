'use client';

import { useEffect, useRef, useState } from 'react';


export default function SpendingHabits({ temporal }) {

  const containerRef = useRef(null);
  const [animated, setAnimated] = useState(false);

  const payday = temporal?.payday || {};
  const weekly = temporal?.weekly || {};

  const paydayDetected = payday.payday_detected === true;
  const weekendMultiple = weekly.weekend_spending_multiple || 1.0;
  const hasWeekend = weekendMultiple > 1.1;

  // build payday bars from real data
  // the backend gives us spending_in_first_7_days_pct — split into 3 buckets
  const firstWeekPct = payday.spending_in_first_7_days_pct || 0;
  // approximate: first 3 days ~= 60% of first week, days 4-14 ~= rest, days 15+ = remainder
  const days1_3 = Math.round(firstWeekPct * 0.6);
  const days4_14 = Math.round(firstWeekPct * 0.4);
  const days15plus = Math.max(0, 100 - days1_3 - days4_14);

  const paydayBars = [
    { label: 'Days 1–3',  pct: days1_3,    color: 'var(--terra)',       delay: 0 },
    { label: 'Days 4–14', pct: days4_14,   color: 'var(--terra-light)', delay: 0.1 },
    { label: 'Days 15+',  pct: days15plus,  color: 'var(--sand)',        delay: 0.2 },
  ];

  const paydayConfidence = payday.confidence > 0.8 ? 'Strong pattern' : 'Moderate';
  const paydayConfClass = payday.confidence > 0.8 ? 'tag--high' : 'tag--medium';
  const weekendConfidence = weekendMultiple > 1.5 ? 'Strong pattern' : 'Moderate';
  const weekendConfClass = weekendMultiple > 1.5 ? 'tag--high' : 'tag--medium';


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


  if (!paydayDetected && !hasWeekend) {
    return (
      <div className="card" ref={containerRef}>
        <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
          <h3 className="heading-card">When You Spend</h3>
        </div>
        <p className="text-sm ink-muted" style={{ marginTop: 8 }}>
          No strong timing patterns detected. Need 90+ days with income data for payday analysis.
        </p>
      </div>
    );
  }


  return (
    <div className="card" ref={containerRef}>

      <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
        <h3 className="heading-card">When You Spend</h3>
        <span className="help-tip" data-tooltip="Sift tracks when during the month and week your spending happens">?</span>
      </div>

      <p className="text-sm ink-muted" style={{ marginBottom: 14 }}>Your spending timing habits</p>


      {/* PAYDAY PATTERN */}
      {paydayDetected && (
        <div style={{ padding: '14px 16px', background: 'var(--bg)', borderRadius: 'var(--r-md)', marginBottom: hasWeekend ? 10 : 0 }}>

          <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--terra)" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
            <span className="text-sm fw-700">After Payday</span>
            <span className={`tag ${paydayConfClass}`}>{paydayConfidence}</span>
          </div>

          <div className="text-sm ink-mid" style={{ lineHeight: 1.7, marginBottom: 10 }}>
            You spend <strong>{Math.round(firstWeekPct)}%</strong> of your monthly budget in the <strong>first week</strong> after your paycheck lands.
            This held across {payday.cycles_analyzed || 0} payday cycles.
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
      )}


      {/* WEEKEND PATTERN */}
      {hasWeekend && (
        <div style={{ padding: '14px 16px', background: 'var(--bg)', borderRadius: 'var(--r-md)' }}>
          <div className="flex items-center gap-2" style={{ marginBottom: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--terra-muted)" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
            <span className="text-sm fw-700">Weekends</span>
            <span className={`tag ${weekendConfClass}`}>{weekendConfidence}</span>
          </div>
          <div className="text-sm ink-mid" style={{ lineHeight: 1.7 }}>
            You spend about <strong>{Math.round((weekendMultiple - 1) * 100)}% more</strong> on weekends than weekdays.
            {weekly.highest_spending_day && <> {weekly.highest_spending_day}s are your biggest spending day.</>}
          </div>
        </div>
      )}

    </div>
  );
}
