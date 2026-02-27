'use client';

import { useState } from 'react';

export default function Anomalies({ data }) {
  const [tab, setTab] = useState('spikes');

  if (!data) return null;

  const { outliers = [], spikes = [], newMerchants = [] } = data;

  const tabs = [
    { key: 'spikes',   label: 'Spending Spikes', count: spikes.length },
    { key: 'outliers', label: 'Unusual Charges', count: outliers.length },
    { key: 'new',      label: 'New Merchants',   count: newMerchants.length },
  ].filter(t => t.count > 0);

  if (tabs.length === 0) return null;

  const activeTab = tabs.find(t => t.key === tab) ? tab : tabs[0].key;

  return (
    <div className="savings-card">

      <div className="savings-label">Unusual Spending</div>
      <div className="savings-amount" style={{ fontSize: 'clamp(1.2rem, 2vw, 1.6rem)' }}>
        {tabs.length} {tabs.length === 1 ? 'category' : 'categories'} flagged
        <span> this month</span>
      </div>
      <div className="savings-subtitle">
        Things that stood out in your transactions
      </div>

      <div className="chip-group" style={{ marginBottom: 20 }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              fontSize: 9, fontWeight: 700,
              padding: '5px 11px', borderRadius: 4,
              border: activeTab === t.key ? '1px solid rgba(255,255,255,0.6)' : '1px solid rgba(255,255,255,0.25)',
              background: activeTab === t.key ? 'rgba(255,255,255,0.2)' : 'transparent',
              color: activeTab === t.key ? '#fff' : 'rgba(255,255,255,0.6)',
              letterSpacing: '0.05em', textTransform: 'uppercase',
              cursor: 'pointer', transition: 'all 0.2s ease',
            }}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      <div className="savings-list">

        {activeTab === 'spikes' && spikes.slice(0, 5).map((spike, i) => (
          <div key={i} className="savings-item">
            <div>
              <p>{spike.category}</p>
              <p>${Math.round(spike.recent_month_total)} last month vs ${Math.round(spike.prior_avg)} avg</p>
            </div>
            <strong>+{Math.round(spike.spike_pct)}%<span> vs usual</span></strong>
          </div>
        ))}

        {activeTab === 'outliers' && outliers.slice(0, 5).map((out, i) => (
          <div key={i} className="savings-item">
            <div>
              <p>{out.merchant}</p>
              <p>{out.category} &middot; {out.date} &middot; Much higher than usual</p>
            </div>
            <strong>${out.amount.toFixed(2)}</strong>
          </div>
        ))}

        {activeTab === 'new' && newMerchants.slice(0, 5).map((m, i) => (
          <div key={i} className="savings-item">
            <div>
              <p>{m.merchant}</p>
              <p>{m.category} &middot; First seen {m.first_seen} &middot; {m.occurrences}x &middot; {m.recurrence}</p>
            </div>
            <strong>${m.avg_amount.toFixed(2)}</strong>
          </div>
        ))}

      </div>
    </div>
  );
}
