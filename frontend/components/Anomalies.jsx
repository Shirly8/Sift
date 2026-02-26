'use client';

import { useState } from 'react';


export default function Anomalies({ data }) {

  const [tab, setTab] = useState('spikes');

  if (!data) return null;

  const { outliers = [], spikes = [], newMerchants = [] } = data;

  const tabs = [
    { key: 'spikes',    label: 'Spending Spikes', count: spikes.length },
    { key: 'outliers',  label: 'Unusual Charges', count: outliers.length },
    { key: 'new',       label: 'New Merchants',   count: newMerchants.length },
  ].filter(t => t.count > 0);

  if (tabs.length === 0) return null;

  // default to first available tab
  const activeTab = tabs.find(t => t.key === tab) ? tab : tabs[0].key;


  return (
    <div className="card">

      <div className="section-header">
        <div>
          <h3 className="heading-card">Unusual Spending</h3>
          <p className="text-sm ink-muted" style={{ marginTop: 4 }}>
            Things that stood out in your transactions
          </p>
        </div>
      </div>

      {/* tab chips */}
      <div className="chip-group" style={{ marginBottom: 14 }}>
        {tabs.map(t => (
          <button
            key={t.key}
            className={`chip ${activeTab === t.key ? 'chip--active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>


      {/* SPENDING SPIKES */}
      {activeTab === 'spikes' && spikes.slice(0, 5).map((spike, i) => (
        <div key={i} className="anomaly-row">
          <div className="flex items-center gap-3">
            <div className="anomaly-icon anomaly-icon--spike">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </div>
            <div>
              <div className="text-md fw-600">{spike.category}</div>
              <div className="text-xs ink-muted">
                ${Math.round(spike.recent_month_total)} last month vs ${Math.round(spike.prior_avg)} avg
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="tag tag--low">+{Math.round(spike.spike_pct)}%</span>
          </div>
        </div>
      ))}


      {/* OUTLIER TRANSACTIONS */}
      {activeTab === 'outliers' && outliers.slice(0, 5).map((out, i) => (
        <div key={i} className="anomaly-row">
          <div className="flex items-center gap-3">
            <div className="anomaly-icon anomaly-icon--outlier">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <div>
              <div className="text-md fw-600">{out.merchant}</div>
              <div className="text-xs ink-muted">
                {out.category} &middot; {out.date} &middot; Much higher than usual
              </div>
            </div>
          </div>
          <div className="text-md fw-700">${out.amount.toFixed(2)}</div>
        </div>
      ))}


      {/* NEW MERCHANTS */}
      {activeTab === 'new' && newMerchants.slice(0, 5).map((m, i) => (
        <div key={i} className="anomaly-row">
          <div className="flex items-center gap-3">
            <div className="anomaly-icon anomaly-icon--new">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </div>
            <div>
              <div className="text-md fw-600">{m.merchant}</div>
              <div className="text-xs ink-muted">
                {m.category} &middot; First seen {m.first_seen} &middot; {m.occurrences}x &middot; {m.recurrence}
              </div>
            </div>
          </div>
          <div className="text-md fw-700">${m.avg_amount.toFixed(2)}</div>
        </div>
      ))}

    </div>
  );
}
