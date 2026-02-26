'use client';

import AnimatedNumber from './AnimatedNumber';
import Sparkline from './Sparkline';


export default function MetricsRow({ profile = {}, savingsPotential = 0 }) {

  const totalSpent = profile.total_spent || 0;
  const monthlyTotals = profile.monthly_totals || [];
  const monthsCount = profile.months_count || 0;
  const monthlyAvg = profile.monthly_average || 0;
  const biggestSwing = profile.biggest_swing_category || {};
  const spendingTrend = profile.spending_trend || '';
  const highestMonth = profile.highest_month || {};
  const lowestMonth = profile.lowest_month || {};
  const monthlyIncome = profile.monthly_income || 0;
  const savingsRate = profile.savings_rate || 0;


  return (
    <div className="metrics-row-equal">

      {/* TOTAL SPENT */}
      <div className="card">
        <div className="card__accent" />
        <span className="label">Total Spent</span>
        <div className="flex items-baseline gap-1" style={{ marginTop: 6 }}>
          <span className="num-hero">$<AnimatedNumber value={totalSpent} /></span>
        </div>
        {monthsCount > 0 && (
          <div className="text-sm ink-muted" style={{ marginTop: 8 }}>over {monthsCount} months</div>
        )}
      </div>

      {/* MONTHLY AVERAGE */}
      <div className="card">
        <span className="label">Monthly Average</span>
        <div className="num-large" style={{ marginTop: 6 }}>$<AnimatedNumber value={monthlyAvg} /></div>
        {monthlyTotals.length > 1 && (
          <div style={{ marginTop: 8 }}><Sparkline data={monthlyTotals} color="#CF5532" /></div>
        )}
        {spendingTrend && spendingTrend !== 'Insufficient data' && (
          <div className="flex items-center gap-1" style={{ marginTop: 6 }}>
            <span style={{ fontSize: 12 }}>
              {spendingTrend === 'Gradually rising' ? '\u2197' : spendingTrend === 'Gradually declining' ? '\u2198' : '\u2192'}
            </span>
            <span className="text-xs ink-soft">{spendingTrend}</span>
          </div>
        )}
      </div>

      {/* BIGGEST SWING */}
      {biggestSwing.name && (
        <div className="card">
          <div className="flex items-center gap-2">
            <div className="dot dot--terra" />
            <span className="label label--terra">Biggest Swing</span>
            <span className="help-tip" data-tooltip="The category where your monthly spending changes the most">?</span>
          </div>
          <div className="fw-700 text-lg" style={{ marginTop: 8 }}>{biggestSwing.name}</div>
          <div className="num-large" style={{ marginTop: 2 }}>${Math.round(biggestSwing.min)}&ndash;${Math.round(biggestSwing.max)}</div>
          <div className="text-sm ink-muted" style={{ marginTop: 4 }}>per month range</div>
        </div>
      )}

      {/* COULD SAVE — computed from all detected opportunities */}
      {savingsPotential > 0 && (
        <div className="card">
          <div className="flex items-center gap-2">
            <div className="dot dot--sage" />
            <span className="label label--sage">Could Save</span>
          </div>
          <div className="flex items-baseline gap-2" style={{ marginTop: 8 }}>
            <span className="num-large ink-sage">$<AnimatedNumber value={savingsPotential} /></span>
            <span className="text-sm ink-muted">/ year</span>
          </div>
          <div className="text-sm ink-muted" style={{ marginTop: 4 }}>across all opportunities</div>
        </div>
      )}

      {/* SAVINGS RATE — only if income detected */}
      {monthlyIncome > 0 && (
        <div className="card">
          <div className="flex items-center gap-2">
            <div className="dot dot--sage" />
            <span className="label label--sage">Savings Rate</span>
          </div>
          <div className="num-hero ink-sage" style={{ marginTop: 6 }}>{savingsRate}%</div>
          <div className="text-sm ink-muted" style={{ marginTop: 8 }}>
            ${Math.round(monthlyIncome).toLocaleString()}/mo income
          </div>
          <div className="text-sm ink-muted" style={{ marginTop: 2 }}>
            ${Math.round(monthlyIncome - (profile.monthly_spending || monthlyAvg)).toLocaleString()}/mo saved
          </div>
        </div>
      )}

      {/* HIGH / LOW MONTHS — show when no savings card */}
      {savingsPotential === 0 && highestMonth.month && lowestMonth.month && (
        <div className="card">
          <span className="label">Spending Range</span>
          <div style={{ marginTop: 8 }}>
            <div className="flex justify-between items-baseline" style={{ marginBottom: 6 }}>
              <span className="text-sm fw-600">{highestMonth.month}</span>
              <span className="text-md fw-700" style={{ color: 'var(--terra)' }}>
                ${highestMonth.amount?.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-sm fw-600">{lowestMonth.month}</span>
              <span className="text-md fw-700" style={{ color: 'var(--sage)' }}>
                ${lowestMonth.amount?.toLocaleString()}
              </span>
            </div>
          </div>
          <div className="text-xs ink-muted" style={{ marginTop: 6 }}>highest vs lowest month</div>
        </div>
      )}

    </div>
  );
}
