'use client';

import { useState } from 'react';


const INSIGHTS = [
  {
    rank: 1,
    confidence: 'HIGH',
    impact: 2250,
    title: 'Your subscriptions add up to $2,250 a year',
    desc: 'You have 8 active subscriptions. Netflix alone has gone up 44% since you signed up.',
    action: 'Dropping one streaming service could save about $180/year.',
    extra: 'You\'re paying for 4 streaming services: Netflix ($23), Disney+ ($14), Crave ($20), YouTube Premium ($14). That\'s $71/month just for streaming. Figma and ChatGPT are work tools — probably worth keeping.',
  },
  {
    rank: 2,
    confidence: 'HIGH',
    impact: 1440,
    title: 'You spend 40% of your budget right after payday',
    desc: 'In the first 3 days after your paycheck, you consistently spend way more than the rest of the month.',
    action: 'Setting aside a weekly budget before payday could smooth this out.',
    extra: 'Average daily spend in days 1–3: $207. Days 4–14: $49. Days 15+: $32. The first three days see 4x the daily rate of the rest of the month.',
  },
  {
    rank: 3,
    confidence: 'MEDIUM',
    impact: 960,
    title: 'When you cook more, you save about $80/month',
    desc: 'Your grocery and delivery spending move in opposite directions — the months you buy more groceries, you order way less delivery.',
    action: 'Planning meals for the week could shift more spending to groceries.',
    extra: 'Months with groceries over $600: delivery averaged $180. Under $500: delivery averaged $380. That\'s a $200 difference.',
  },
  {
    rank: 4,
    confidence: 'HIGH',
    impact: null,
    title: 'Dining out is where your spending swings most',
    desc: 'Your dining ranges from $380 to $890 per month. It\'s not that dining is "bad" — it\'s just where you have the most control.',
    action: null,
    extra: 'August ($890) was the big outlier — three restaurant bills over $125 each. Without August, your dining average drops from $456 to $410.',
  },
];


export default function InsightCards({ insights = INSIGHTS }) {

  const [expandedIdx, setExpandedIdx] = useState(null);


  function toggleInsight(idx) {
    setExpandedIdx(expandedIdx === idx ? null : idx);
  }


  return (
    <div className="card" style={{ padding: '22px 24px' }}>

      <div className="flex justify-between items-center" style={{ marginBottom: 4 }}>
        <h3 className="heading-card">Things Worth Knowing</h3>
      </div>

      <p className="text-sm ink-muted" style={{ marginBottom: 16 }}>
        What Sift found in your spending &middot; Biggest savings first
      </p>


      {/* insight cards */}
      <div className="flex flex-col gap-3">
        {insights.map((ins, idx) => (
          <div
            key={idx}
            className={`insight ${expandedIdx === idx ? 'expanded' : ''}`}
            onClick={() => toggleInsight(idx)}
          >

            {/* rank number */}
            <div className="insight__rank">{ins.rank}</div>

            {/* chevron */}
            <div className="insight__chevron">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-muted)" strokeWidth="2.5" strokeLinecap="round">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </div>

            {/* impact + confidence */}
            <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
              {ins.impact ? (
                <span className="insight__impact">
                  ${ins.impact.toLocaleString()}<span className="text-sm ink-muted fw-500">/yr</span>
                </span>
              ) : (
                <span className="tag tag--neutral">Good to know</span>
              )}
              <span className={`tag ${ins.confidence === 'HIGH' ? 'tag--high' : 'tag--medium'}`}>
                {ins.confidence === 'HIGH' ? 'Reliable' : 'Likely'}
              </span>
            </div>

            {/* title + description */}
            <div className="insight__title">{ins.title}</div>
            <div className="insight__desc">{ins.desc}</div>

            {/* expandable detail */}
            <div className="insight__expand">
              <div style={{ padding: '12px 0 4px', borderTop: '1px solid var(--surface-alt)' }}>
                <div className="text-xs fw-600 ink-muted" style={{ marginBottom: 6 }}>THE FULL PICTURE</div>
                <div className="text-sm ink-mid" style={{ lineHeight: 1.6 }}>{ins.extra}</div>
              </div>
              {ins.action && (
                <div className="insight__action">{ins.action}</div>
              )}
            </div>

          </div>
        ))}
      </div>

    </div>
  );
}
