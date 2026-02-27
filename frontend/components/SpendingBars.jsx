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

  // compute totals for percentage of spending (not variance impact)
  const totalAvg = categories.reduce((sum, c) => sum + c.avg, 0) || 1;
  const maxAvg = Math.max(...categories.map(c => c.avg), 1);


  return (
    <div className="card card--hero" ref={containerRef}>

      <h3 className="heading-card" style={{ marginBottom: 4 }}>Where Your Money Goes</h3>
      <p className="text-sm ink-muted" style={{ marginBottom: 16 }}>
        How your spending breaks down each month, from most to least.
      </p>


      {/* spending bars */}
      <div className="spend-list">
        {categories.map(c => {
          const barPct = Math.round((c.avg / maxAvg) * 88);
          const sharePct = Math.round((c.avg / totalAvg) * 100);

          return (
            <div
              key={c.label}
              className="spend-bar"
              data-tooltip={`You spend about $${c.avg} on ${c.label} each month — that's ${sharePct}% of your total`}
            >

              <div className="spend-bar__label">{c.label}</div>

              <div className="spend-bar__track">
                <div
                  className="spend-bar__fill"
                  style={{ background: c.color, width: animated ? `${barPct}%` : 0 }}
                />
              </div>

              <div className="spend-bar__amt">
                <strong>${c.avg}<span>/mo</span></strong>
                <p>{sharePct}% of total</p>
              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
}
