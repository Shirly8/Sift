'use client';

import { useRef, useState, useEffect } from 'react';
import SafeText from './SafeText';


export default function PatternCards({ patterns }) {

  const trackRef = useRef(null);
  const [scrollCls, setScrollCls] = useState('at-start');


  // track scroll position for edge-fade gradients
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    function sync() {
      const { scrollLeft, scrollWidth, clientWidth } = track;
      const atStart = scrollLeft < 6;
      const atEnd   = scrollLeft + clientWidth >= scrollWidth - 6;

      setScrollCls(
        atStart && atEnd ? 'at-start at-end' :
        atStart ? 'at-start' :
        atEnd   ? 'at-end'   : ''
      );
    }

    track.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    sync();

    return () => {
      track.removeEventListener('scroll', sync);
      window.removeEventListener('resize', sync);
    };
  }, [patterns]);


  if (!patterns || !patterns.length) return null;


  return (
    <div className="card card--hero pc-section">

      {/* Header */}
      <div className="pc-header">
        <div>
          <h3 className="heading-card">Patterns We Found</h3>
          <p className="text-sm ink-muted">Categories that tend to rise or fall together in your spending</p>
          <p className="text-sm ink-muted">These connections can reveal saving opportunities</p>
        </div>
      </div>

      {/* Scroll wrapper with edge fades */}
      <div className={`pc-scroll ${scrollCls}`}>
        <div className="pc-track" ref={trackRef}>
          {patterns.map((p, i) => (
            <div key={i} className={`pc ${p.theme}`}>

              {/* Icon */}
              <div className="pc__icon">
                {p.direction === 'correlated' ? (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M2 12.5L6 8L8.5 11L14 4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M11 4.5H14V7.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M2 4.5L6 9L8.5 6L14 12.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M11 12.5H14V9.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>

              {/* Badge */}
              <span className="pc__badge">{p.strength}</span>

              {/* Category pair with connector */}
              <div className="pc__cats">
                <span>{p.catA}</span>
                <div className="pc__connector">
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                    <path d="M1.5 4h5M4.8 2l2 2-2 2" stroke="var(--ink-muted)" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <span>{p.catB}</span>
              </div>

              <p><SafeText text={p.desc} /></p>

              {p.timing && (
                <div className="pc__footer">
                  <span>{p.timing}</span>
                </div>
              )}

            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
