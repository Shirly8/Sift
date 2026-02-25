'use client';

import { useEffect, useRef, useState } from 'react';


export default function SpendingHabits({ data }) {

  const containerRef = useRef(null);
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setAnimated(true); obs.disconnect(); }
    }, { threshold: 0.2 });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  if (!data) return null;

  const payday = data.payday || {};
  const weekly = data.weekly || {};
  const weekendPct = Math.round(((weekly.weekend_spending_multiple || 1) - 1) * 100);
  const highestDay = weekly.highest_spending_day || 'N/A';

  // build bars from first-7-days pct
  const firstPct = Math.round(payday.spending_in_first_7_days_pct || 0);
  const restPct = Math.max(0, 100 - firstPct);


  return (
    <div className="card" ref={containerRef}>

      <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
        <h3 className="heading-card">When You Spend</h3>
        <span className="help-tip" data-tooltip="Sift tracks when during the month and week your spending happens">?</span>
      </div>
      <p className="text-sm ink-muted" style={{ marginBottom: 14 }}>Your spending timing habits</p>

      {/* PAYDAY */}
      <div style={{ padding: '14px 16px', background: 'var(--bg)', borderRadius: 'var(--r-md)', marginBottom: 10 }}>
        {payday.payday_detected ? (
          <>
            <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
              <span className="text-sm fw-700">After Payday</span>
              <span className={`tag ${payday.confidence >= 0.8 ? 'tag--high' : 'tag--medium'}`}>
                {payday.confidence >= 0.8 ? 'Strong pattern' : 'Moderate'}
              </span>
            </div>
            <div className="text-sm ink-mid" style={{ lineHeight: 1.7, marginBottom: 10 }}>
              You spend <strong>{firstPct}%</strong> of your monthly budget in the <strong>first 7 days</strong> after payday.
              This held across {payday.cycles_analyzed} cycles.
            </div>
            {[
              { label: 'Days 1–7', pct: firstPct, color: 'var(--terra)', delay: 0 },
              { label: 'Days 8+',  pct: restPct,  color: 'var(--sand)',  delay: 0.1 },
            ].map(bar => (
              <div key={bar.label} className="flex items-center gap-1" style={{ marginTop: 4 }}>
                <span className="text-xs ink-muted" style={{ width: 55 }}>{bar.label}</span>
                <div style={{ flex: 1, height: 18, background: 'var(--surface-alt)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: animated ? `${bar.pct}%` : 0, background: bar.color, borderRadius: 4, transition: `width 1.2s cubic-bezier(0.22,1,0.36,1) ${bar.delay}s` }} />
                </div>
                <span className="text-xs fw-600" style={{ width: 30, textAlign: 'right' }}>{bar.pct}%</span>
              </div>
            ))}
          </>
        ) : (
          <div className="text-sm ink-muted">{payday.reason || 'No clear payday pattern detected.'}</div>
        )}
      </div>

      {/* WEEKEND */}
      <div style={{ padding: '14px 16px', background: 'var(--bg)', borderRadius: 'var(--r-md)' }}>
        <div className="flex items-center gap-2" style={{ marginBottom: 6 }}>
          <span className="text-sm fw-700">Weekends</span>
          <span className={`tag ${weekendPct >= 40 ? 'tag--high' : 'tag--medium'}`}>
            {weekendPct >= 40 ? 'Strong pattern' : 'Moderate'}
          </span>
        </div>
        <div className="text-sm ink-mid" style={{ lineHeight: 1.7 }}>
          {weekendPct > 0
            ? <>You spend about <strong>{weekendPct}% more</strong> on weekends. {highestDay !== 'N/A' && <>{highestDay}s are your biggest day.</>}</>
            : <>Your weekday and weekend spending are roughly equal.</>
          }
        </div>
      </div>

    </div>
  );
}
