'use client';

import { useEffect, useState } from 'react';
import AnimatedNumber from './AnimatedNumber';


export default function MetricsRow({ profile = {}, savingsPotential = 0, topCategory }) {

  const totalSpent = profile.total_spent || 0;
  const monthsCount = profile.months_count || 0;
  const monthlyAvg = profile.monthly_average || 0;
  const biggestSwing = profile.biggest_swing_category || {};
  const spendingTrend = profile.spending_trend || '';

  // Top spending category from parent
  const topLabel = topCategory?.label || '';
  const topAvg = topCategory?.avg || 0;
  // Compute % of total monthly spending (not variance impact)
  const topPct = monthlyAvg > 0 ? Math.round((topAvg / monthlyAvg) * 100) : 0;

  // Trend arrow helper
  const trendArrow = spendingTrend === 'Gradually rising' ? '\u2197'
    : spendingTrend === 'Gradually declining' ? '\u2198'
    : '\u2192';

  const trendClass = spendingTrend === 'Gradually rising' ? 'trend--rising'
    : spendingTrend === 'Gradually declining' ? 'trend--falling'
    : 'trend--stable';

  // Stagger animation
  const [visible, setVisible] = useState(false);
  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);

  return (
    <div className={`metrics-hero ${visible ? 'metrics-hero--visible' : ''}`}>

      {/* ── NARRATIVE HERO ── */}
      <section className="metrics-hero__story">
        {monthsCount > 0 && (
          <p className="metrics-hero__greeting">
            Here&rsquo;s your {monthsCount}-month spending picture
          </p>
        )}

        <h1 className="metrics-hero__headline">
          You spent{' '}
          <span className="metrics-hero__amount">
            $<AnimatedNumber value={totalSpent} />
          </span>{' '}
          total.
          <br />
          Here&rsquo;s where it all went.
        </h1>

        <p className="metrics-hero__subtitle">
          {topLabel && (
            <>
              Your biggest category is <strong>{topLabel}</strong> at ${topAvg}/mo
              {spendingTrend && spendingTrend !== 'Insufficient data' && (
                <>, and your spending has been {spendingTrend.toLowerCase()}</>
              )}
              .{' '}
            </>
          )}
          {savingsPotential > 0 && (
            <>
              The good news? We found about{' '}
              <strong>${savingsPotential.toLocaleString()}/year</strong> you could save.
            </>
          )}
        </p>

      </section>


      {/* ── SUMMARY CARDS ── */}
      <section className="summary-row">

        {/* Monthly Average */}
        <div className="card card--summary">
          <div className="summary-card__accent summary-card__accent--terra" />
          <span className="summary-card__label label-upper">Monthly Average</span>
          <div className="summary-card__value serif-num">
            $<AnimatedNumber value={monthlyAvg} />
          </div>
          {spendingTrend && spendingTrend !== 'Insufficient data' && (
            <div className={`summary-card__context ${trendClass}`}>
              <span className="summary-card__trend-arrow">{trendArrow}</span>
              {spendingTrend}
            </div>
          )}
        </div>

        {/* Where You Spend Most */}
        {topLabel && (
          <div className="card card--summary">
            <div className="summary-card__accent summary-card__accent--sage" />
            <span className="summary-card__label label-upper">Where You Spend Most</span>
            <div className="summary-card__value summary-card__value--text serif-num">{topLabel}</div>
            <div className="summary-card__context">
              ${topAvg}/mo &middot; {topPct}% of your spending
            </div>
          </div>
        )}

        {/* Fluctuates Most */}
        {biggestSwing.name && biggestSwing.name !== 'N/A' && (
          <div className="card card--summary">
            <div className="summary-card__accent summary-card__accent--amber" />
            <span className="summary-card__label label-upper">Fluctuates Most</span>
            <div className="summary-card__value summary-card__value--text serif-num">{biggestSwing.name}</div>
            <div className="summary-card__context">
              Some months ${Math.round(biggestSwing.min)}, others up to ${Math.round(biggestSwing.max)}
            </div>
          </div>
        )}

        {/* Could Save */}
        <div className="card card--summary">
          <div className="summary-card__accent summary-card__accent--rose" />
          <span className="summary-card__label label-upper">You Could Save</span>
          <div className="summary-card__value serif-num">
            {savingsPotential > 0
              ? <><span className="ink-sage">$<AnimatedNumber value={savingsPotential} /></span></>
              : <span className="ink-muted">&mdash;</span>
            }
          </div>
          <div className="summary-card__context">
            {savingsPotential > 0
              ? <><span className="trend--falling">&#8595; per year</span> across all opportunities</>
              : 'No opportunities detected yet'
            }
          </div>
        </div>

      </section>
    </div>
  );
}
