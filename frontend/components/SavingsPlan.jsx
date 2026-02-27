'use client';


export default function SavingsPlan({ plan }) {

  if (!plan || !plan.opportunities || plan.opportunities.length === 0) return null;


  return (
    <div className="savings-card">

      <div className="savings-label">Your Savings Plan</div>
      <div className="savings-amount">
        ${plan.total_annual_savings.toLocaleString()}
        <span> per year</span>
      </div>
      <div className="savings-subtitle">
        Specific opportunities Sift found in your spending data
      </div>

      <div className="savings-list">
        {plan.opportunities.map((opp, idx) => (
          <div key={idx} className="savings-item">
            <div>
              <p>{opp.title}</p>
              <p>{opp.detail}</p>
            </div>
            <strong>
              ${Math.round(opp.annual_savings).toLocaleString()}
              <span> per year</span>
            </strong>
          </div>
        ))}
      </div>

    </div>
  );
}
