'use client';

import { useState, useRef, useEffect, useId } from 'react';


export default function FinancialResilience({ data }) {
  if (!data) return null;

  // backend -> orchestrator.py -> financial_resilience tool
  const { stress_test: stress, runway } = data;

  // runway calculations
  const months = runway?.months_of_runway ?? 0;
  const isInfinite = months === null || months === 'Infinity';
  const isSurplus = isInfinite || (runway?.net_monthly > 0 && months > 100);

  // badge state
  const badgeClass = isSurplus ? 'status-badge--sage'
    : months >= 6 ? 'status-badge--amber'
    : 'status-badge--terra';
  const badgeLabel = isSurplus ? 'Surplus'
    : months >= 6 ? 'Stable'
    : 'At Risk';

  // confidence interval from stress_test MC simulation
  const ci = stress?.runway_ci;
  const ciLow  = ci?.p10 ?? null;
  const ciHigh = ci?.p90 ?? null;

  // income vs spending
  const income   = Math.round(runway?.monthly_income || 0);
  const spending = Math.round(
    stress?.minimum_monthly_budget || runway?.monthly_burn || 0
  );
  const net = income - spending;

  // categories to cut — from stress_test
  const categories = stress?.categories_to_cut || [];
  const ordinals = ['Cut first', 'Cut second', 'Cut third'];

  // chart data
  const savings = runway?.estimated_savings || stress?.estimated_savings || 0;
  const burn = runway?.monthly_burn || spending;


  return (
    <div className="card card--static checkup-section">

      {/* HEADER */}
      <div className="checkup-section__head">
        <div>
          <h3 className="checkup-section__title">Your Safety Net</h3>
          <p className="checkup-section__sub">Based on your income &amp; spending</p>
        </div>
        <span className={`status-badge ${badgeClass}`}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5">
            {badgeClass === 'status-badge--sage'
              ? <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
              : <path d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />}
          </svg>
          {badgeLabel}
        </span>
      </div>


      {/* BODY */}
      <div className="checkup-section__body">

        {/* HERO NUMBER */}
        <div className="sn-hero">
          {isSurplus ? (
            <span style={{ color: 'var(--sage-dark)' }}>Surplus</span>
          ) : (
            <>
              <span>{Math.round(months)}</span>
              <span>months your savings could last</span>
            </>
          )}
        </div>

        {/* TAGLINE */}
        <p className="sn-tagline">
          {!isSurplus ? (
            <>
              If your income stopped today, your savings could cover your essential expenses for this long.
              {ciLow != null && ciHigh != null && ciLow !== ciHigh && (
                <> Depending on how much you cut back, that could stretch
                from <strong>{ciLow}</strong> to <strong>{ciHigh} months</strong>.</>
              )}
              {months === 0 && income === 0 && (
                <> We didn&rsquo;t detect income in your data &mdash; upload
                at least 3 months of deposits so Sift can calculate the full picture.</>
              )}
              {' '}<span style={{ opacity: 0.6, fontSize: '0.85em' }}>Estimated from the income and spending in this CSV only &mdash; savings held in other accounts are not included.</span>
            </>
          ) : (
            <>You&rsquo;re earning more than you spend. Your savings grow each
            month &mdash; that&rsquo;s a strong financial cushion.</>
          )}
        </p>

        {/* RUNWAY CHART */}
        {burn > 0 && (
          <RunwayChart savings={savings} burn={burn} income={income} />
        )}

        {/* INCOME vs SPENDING */}
        {income > 0 ? (
          <>
            <div className="sn-stats">
              <div className="tile sn-stat-tile">
                <div className="label-upper">Income</div>
                <div className="serif-num"><sup>$</sup>{income.toLocaleString()}</div>
                <p>per month</p>
              </div>
              <div className="tile sn-stat-tile">
                <div className="label-upper">Spending</div>
                <div className="serif-num"><sup>$</sup>{spending.toLocaleString()}</div>
                <p>per month</p>
              </div>
            </div>

            {net !== 0 && (
              <div className={`sn-callout ${net > 0 ? 'sn-callout--positive' : 'sn-callout--negative'}`}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
                  style={{ flexShrink: 0, marginTop: 1 }}>
                  <circle cx="8" cy="8" r="6"
                    stroke={net > 0 ? 'var(--sage-dark)' : 'var(--terra)'}
                    strokeWidth="1.4" />
                  <path d="M8 7.2v3"
                    stroke={net > 0 ? 'var(--sage-dark)' : 'var(--terra)'}
                    strokeWidth="1.4" strokeLinecap="round" />
                  <circle cx="8" cy="5.8" r=".7"
                    fill={net > 0 ? 'var(--sage-dark)' : 'var(--terra)'} />
                </svg>
                <p className="sn-callout__text">
                  {net > 0 ? (
                    <>You&rsquo;re putting away roughly <strong>${net.toLocaleString()}/mo</strong>. That&rsquo;s money growing your safety net each month.</>
                  ) : (
                    <>You&rsquo;re spending about <strong>${Math.abs(net).toLocaleString()}/mo</strong> more than you earn. Your savings are being drawn down over time.</>
                  )}
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="sn-stats">
            <div className="tile sn-stat-tile">
              <div className="label-upper">Spending</div>
              <div className="serif-num"><sup>$</sup>{spending.toLocaleString()}</div>
              <p>per month</p>
            </div>
          </div>
        )}

      </div>


      {/* CUT SECTION */}
      {categories.length > 0 && (
        <>
          <div className="checkup-section__rule" />
          <div className="checkup-section__cut">
            <div className="checkup-cut__title label-upper">Where to Cut First</div>
            <p className="checkup-cut__sub">
              If you needed to stretch your money further, here&rsquo;s what
              Sift would trim &mdash; biggest savings first.
            </p>

            {categories.map((cat, i) => (
              <div key={i} className="checkup-cut__row">
                <div>
                  <p>{cat.category}</p>
                  <p>${Math.round(cat.monthly_avg)}/mo avg</p>
                </div>
                <span>
                  <span className={`status-badge status-badge--${{ 1: 'terra', 2: 'amber', 3: 'neutral' }[Math.min(i + 1, 3)]}`}>
                    {ordinals[i] || `#${i + 1}`}
                  </span>
                  −${Math.round(cat.monthly_avg)}
                </span>
              </div>
            ))}

            <div className="checkup-cut__total">
              <span>Minimum monthly budget</span>
              <span className="serif-num">
                ${Math.round(stress?.minimum_monthly_budget || 0).toLocaleString()}
              </span>
            </div>
          </div>
        </>
      )}

    </div>
  );
}



function RunwayChart({ savings, burn, income }) {
  const uid = useId();
  const gradId = `runwayGrad${uid.replace(/:/g, '')}`;
  const [visible, setVisible] = useState(false);
  const chartRef = useRef(null);

  useEffect(() => {
    const el = chartRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); io.disconnect(); }
    }, { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const W = 720, H = 160;
  const PAD = { top: 8, right: 20, bottom: 22, left: 52 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;

  const hasSavings = savings > 0;
  const netMonthly = income - burn;
  const showSecond = income > 0 && netMonthly !== 0;

  const depletionMonth = hasSavings && burn > 0 ? Math.ceil(savings / burn) : 0;
  const maxMonths = hasSavings ? Math.min(depletionMonth + 3, 36) : 12;

  const mainLine = [];
  for (let m = 0; m <= maxMonths; m++) {
    mainLine.push(hasSavings ? Math.max(0, savings - burn * m) : burn * m);
  }

  let secondLine = null;
  if (hasSavings && showSecond) {
    secondLine = [];
    for (let m = 0; m <= maxMonths; m++) {
      secondLine.push(Math.max(0, savings + netMonthly * m));
    }
  }

  const allVals = [...mainLine, ...(secondLine || [])];
  const yMax = Math.max(...allVals, 1);

  const x = (i) => PAD.left + (i / maxMonths) * cW;
  const y = (v) => PAD.top + cH - (v / yMax) * cH;

  const pts = (arr) => arr.map((v, i) => `${x(i)},${y(v)}`).join(' ');

  const areaPath = `M${x(0)},${y(0)} ${mainLine.map((v, i) => `L${x(i)},${y(v)}`).join(' ')} L${x(mainLine.length - 1)},${y(0)} Z`;

  const fmtK = (v) => v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${Math.round(v)}`;

  const yTicks = [0, yMax / 2, yMax];
  const xLabels = [0];
  if (maxMonths >= 6) xLabels.push(Math.round(maxMonths / 2));
  xLabels.push(maxMonths);

  const showDepletion = hasSavings && depletionMonth > 0 && depletionMonth <= maxMonths;

  const lineStr = mainLine.map((v, i) => `${x(i)},${y(v)}`).join(' ');

  return (
    <div className="safety-chart" ref={chartRef}>
      <svg
        className="safety-chart__svg"
        viewBox={`0 0 ${W} ${H + 30}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ overflow: 'visible' }}
      >
        <defs>
          <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--terra)" stopOpacity="0.12" />
            <stop offset="100%" stopColor="var(--terra)" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {/* grid lines */}
        {yTicks.map((val, i) => (
          <line key={i} x1={PAD.left} y1={y(val)} x2={W - PAD.right} y2={y(val)}
            stroke="var(--border)" strokeDasharray="4 4" />
        ))}

        {/* area fill */}
        <path d={areaPath} fill={`url(#${gradId})`} />

        {/* baseline */}
        <line x1={PAD.left} y1={y(0)} x2={W - PAD.right} y2={y(0)}
          stroke="var(--border)" strokeWidth="1" />

        {/* with-income line */}
        {secondLine && (
          <polyline points={pts(secondLine)} fill="none"
            stroke="var(--sage)" strokeWidth="1.5" strokeLinecap="round"
            strokeDasharray="4,3" opacity="0.6" />
        )}

        {/* main line — animated draw */}
        <polyline
          points={lineStr}
          fill="none"
          stroke="var(--terra)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="2000"
          strokeDashoffset={visible ? '0' : '2000'}
          style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(0.22,1,0.36,1) 0.3s' }}
        />

        {/* depletion marker */}
        {showDepletion && (
          <>
            <line x1={x(depletionMonth)} y1={PAD.top} x2={x(depletionMonth)} y2={y(0)}
              stroke="var(--terra)" strokeWidth="1" strokeDasharray="3,3" opacity="0.4" />
            <circle cx={x(depletionMonth)} cy={y(0)} r="3" fill="var(--terra)" />
            <text x={x(depletionMonth)} y={PAD.top - 1} textAnchor="middle"
              fontSize="9" fontWeight="600" fill="var(--terra)"
              fontFamily="Plus Jakarta Sans, sans-serif">$0</text>
          </>
        )}

        {/* dots — first + last only, fade in on scroll */}
        {[0, mainLine.length - 1].map((i) => {
          const isLast = i === mainLine.length - 1;
          return (
            <circle key={i}
              cx={x(i)} cy={y(mainLine[i])}
              r={isLast ? 5 : 4}
              fill={isLast ? 'var(--terra)' : 'var(--card)'}
              stroke={isLast ? '#fff' : 'var(--terra)'}
              strokeWidth={isLast ? 3 : 2.5}
              style={{
                transition: `opacity 0.3s ease ${isLast ? 1.4 : 1.2}s`,
                opacity: visible ? 1 : 0,
              }}
            />
          );
        })}

        {/* y-axis labels */}
        {yTicks.map((val, i) => (
          <text key={i} x={PAD.left - 6} y={y(val) + 3} textAnchor="end"
            fontSize="9" fill="var(--ink-muted)"
            fontFamily="Plus Jakarta Sans, sans-serif">{fmtK(val)}</text>
        ))}

        {/* x-axis labels */}
        {xLabels.map((mo) => (
          <text key={mo} x={x(mo)} y={H + 22} textAnchor="middle"
            fontSize="9"
            fontWeight={mo === maxMonths ? 700 : 500}
            fill={mo === maxMonths ? 'var(--terra)' : 'var(--ink-muted)'}
            fontFamily="Plus Jakarta Sans, sans-serif">
            {mo === 0 ? 'Now' : `Mo ${mo}`}{mo === maxMonths ? ' ●' : ''}
          </text>
        ))}

      </svg>

      <div className="safety-chart__legend">
        <div className="safety-chart__legend-item">
          <span className="safety-chart__legend-dot" style={{ background: 'var(--terra)' }} />
          {hasSavings ? 'If income stops' : 'Monthly expenses'}
        </div>
        {secondLine && (
          <div className="safety-chart__legend-item">
            <span className="safety-chart__legend-dot" style={{ background: 'var(--sage)', opacity: 0.6 }} />
            Current pace
          </div>
        )}
      </div>
    </div>
  );
}
