'use client';


const TYPE_LABELS = {
  subscription:   'Subscriptions',
  price_creep:    'Price Creep',
  discretionary:  'Spending',
};


export default function SavingsPlan({ plan }) {

  if (!plan || !plan.opportunities || plan.opportunities.length === 0) return null;


  return (
    <div className="card" style={{ padding: '22px 24px' }}>

      <div className="flex justify-between items-center" style={{ marginBottom: 4 }}>
        <h3 className="heading-card">Your Savings Plan</h3>
        <span className="num-large ink-sage">${plan.total_annual_savings.toLocaleString()}/yr</span>
      </div>

      <p className="text-sm ink-muted" style={{ marginBottom: 16 }}>
        Specific opportunities Sift found in your data
      </p>


      {/* opportunity list */}
      <div className="flex flex-col gap-3">
        {plan.opportunities.map((opp, idx) => (
          <div
            key={idx}
            style={{ padding: '14px 16px', background: 'var(--bg)', borderRadius: 'var(--r-md)' }}
          >
            <div className="flex justify-between items-start">

              <div style={{ flex: 1 }}>
                <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
                  <span className="text-sm fw-700">{opp.title}</span>
                  <span className="tag tag--neutral">{TYPE_LABELS[opp.type] || opp.type}</span>
                </div>
                <div className="text-sm ink-mid" style={{ lineHeight: 1.6 }}>
                  {opp.detail}
                </div>
              </div>

              <div className="text-md fw-700 ink-sage" style={{ whiteSpace: 'nowrap', marginLeft: 16 }}>
                ${Math.round(opp.annual_savings).toLocaleString()}/yr
              </div>

            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
