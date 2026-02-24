'use client';

import { useState } from 'react';
import AnimatedNumber from './AnimatedNumber';
import Sparkline from './Sparkline';


export default function MetricsRow({ profile = {} }) {

  const [totalOpen, setTotalOpen] = useState(false);
  const [avgOpen, setAvgOpen] = useState(false);

  // extract from backend or use demo data
  const totalSpent = profile.total_spent || 42360;
  const monthlyTotals = profile.monthly_totals || [3200, 3450, 3620, 3780, 4100, 3890, 3950, 4250, 4480, 3700, 3940];
  const monthsCount = profile.months_count || 11;
  const monthlyAvg = profile.monthly_average || 3851;
  const highestMonth = profile.highest_month || { amount: 4480, month: 'Sep' };
  const lowestMonth = profile.lowest_month || { amount: 3200, month: 'Jan' };
  const recentAvg = profile.recent_3mo_avg || 4040;
  const trend = profile.spending_trend || 'Gradually rising';
  const biggestSwing = profile.biggest_swing_category || { name: 'Dining Out', min: 380, max: 890 };
  const couldSave = profile.annual_savings_potential || 2250;


  return (
    <div className="metrics-row-equal">


      {/* TOTAL SPENT — hero card */}
      <div className="card card--clickable" onClick={() => setTotalOpen(!totalOpen)}>
        <div className="card__accent" />

        <span className="label">Total Spent</span>

        <div className="flex items-baseline gap-1" style={{ marginTop: 6 }}>
          <span className="num-hero">$<AnimatedNumber value={totalSpent} /></span>
        </div>

        <div className="flex items-center gap-2" style={{ marginTop: 8 }}>
          <span className="text-sm ink-muted">over {monthsCount} months</span>
        </div>

        {/* expand detail */}
        <div className={`metric-detail ${totalOpen ? 'open' : ''}`}>
          <div style={{ paddingTop: 12, borderTop: '1px solid var(--surface-alt)' }}>
            <div className="flex justify-between text-sm" style={{ padding: '3px 0' }}>
              <span className="ink-soft">Highest month</span>
              <span className="fw-600">${highestMonth.amount?.toLocaleString()} <span className="ink-muted fw-400">({highestMonth.month})</span></span>
            </div>
            <div className="flex justify-between text-sm" style={{ padding: '3px 0' }}>
              <span className="ink-soft">Lowest month</span>
              <span className="fw-600">${lowestMonth.amount?.toLocaleString()} <span className="ink-muted fw-400">({lowestMonth.month})</span></span>
            </div>
          </div>
        </div>
      </div>


      {/* MONTHLY AVERAGE */}
      <div className="card card--clickable" onClick={() => setAvgOpen(!avgOpen)}>
        <span className="label">Monthly Average</span>

        <div className="num-large" style={{ marginTop: 6 }}>
          $<AnimatedNumber value={monthlyAvg} />
        </div>

        <div style={{ marginTop: 8 }}>
          <Sparkline data={monthlyTotals} color="#CF5532" />
        </div>

        {/* expand detail */}
        <div className={`metric-detail ${avgOpen ? 'open' : ''}`}>
          <div style={{ paddingTop: 12, borderTop: '1px solid var(--surface-alt)' }}>
            <div className="flex justify-between text-sm" style={{ padding: '3px 0' }}>
              <span className="ink-soft">Recent 3 months</span>
              <span className="fw-600">${recentAvg?.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm" style={{ padding: '3px 0' }}>
              <span className="ink-soft">Trend</span>
              <span className="fw-600 ink-terra">{trend}</span>
            </div>
          </div>
        </div>
      </div>


      {/* BIGGEST SWING */}
      <div className="card">
        <div className="flex items-center gap-2">
          <div className="dot dot--terra" />
          <span className="label label--terra">Biggest Swing</span>
          <span className="help-tip" data-tooltip="The category where your monthly spending changes the most">?</span>
        </div>

        <div className="fw-700 text-lg" style={{ marginTop: 8 }}>{biggestSwing.name}</div>

        <div className="flex items-baseline gap-2" style={{ marginTop: 2 }}>
          <span className="num-large">${biggestSwing.min}–${biggestSwing.max}</span>
        </div>

        <div className="text-sm ink-muted" style={{ marginTop: 4 }}>per month range</div>
      </div>


      {/* COULD SAVE */}
      <div className="card">
        <div className="flex items-center gap-2">
          <div className="dot dot--sage" />
          <span className="label label--sage">Could Save</span>
        </div>

        <div className="flex items-baseline gap-2" style={{ marginTop: 8 }}>
          <span className="num-large ink-sage">$<AnimatedNumber value={couldSave} /></span>
          <span className="text-sm ink-muted">/ year</span>
        </div>

        <div className="text-sm ink-muted" style={{ marginTop: 4 }}>from subscriptions alone</div>
      </div>


    </div>
  );
}
