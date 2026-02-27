'use client';


export default function SpendingHabits({ data }) {

  if (!data) return null;

  const payday = data.payday || {};
  const weekly = data.weekly || {};

  const weekendPct = Math.round(((weekly.weekend_spending_multiple || 1) - 1) * 100);
  const highestDay = weekly.highest_spending_day || null;
  const lowestDay = weekly.lowest_spending_day || null;
  const firstPct = Math.round(payday.spending_in_first_7_days_pct || 0);

  const showTiles = weekly.weekday_avg > 0 && weekly.weekend_avg > 0;


  return (
    <div className="card card--static checkup-section">

      <div className="checkup-section__head">
        <div>
          <h3 className="checkup-section__title">When You Spend</h3>
          <p className="checkup-section__sub">Your spending timing patterns</p>
        </div>
      </div>

      <div className="checkup-section__body">

        {/* WEEKDAY vs WEEKEND TILES */}
        {showTiles && (
          <div className="wys-tile-grid">
            <div className="tile wys-tile wys-tile--weekday">
              <div className="label-upper">Weekdays</div>
              <div className="serif-num">${Math.round(weekly.weekday_avg)}</div>
              <p>daily average</p>
            </div>
            <div className="tile wys-tile wys-tile--weekend">
              <div className="label-upper">Weekends</div>
              <div className="serif-num">${Math.round(weekly.weekend_avg)}</div>
              <p>daily average</p>
            </div>
          </div>
        )}

        {/* INSIGHTS */}
        <div className="wys-insights">

          {showTiles && (
            <div className="tile wys-insight">
              <div className="wys-insight__icon wys-insight__icon--sage">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 9l3-3 2 2 3-4" stroke="var(--sage-dark)"
                    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p>
                {weekendPct > 0
                  ? <>You spend about <strong>{weekendPct}% more on weekends</strong>.</>
                  : <>Your weekday and weekend spending are <strong>roughly equal</strong>.</>}
                {highestDay && (
                  <> <em style={{ fontStyle: 'normal', fontWeight: 600, color: 'var(--sage-dark)' }}>{highestDay}s</em> are your biggest day</>
                )}
                {highestDay && lowestDay && (
                  <>, <em style={{ fontStyle: 'normal', fontWeight: 600, color: 'var(--sand)' }}>{lowestDay}s</em> your lightest</>
                )}
                {(highestDay || lowestDay) && '.'}
              </p>
            </div>
          )}

          {payday.payday_detected && (
            <div className="tile wys-insight">
              <div className="wys-insight__icon wys-insight__icon--terra">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <circle cx="6" cy="6" r="4" stroke="var(--terra)" strokeWidth="1.3" />
                  <path d="M6 4v2.5l1.5 1.2" stroke="var(--terra)"
                    strokeWidth="1.3" strokeLinecap="round" />
                </svg>
              </div>
              <p>
                <strong>{firstPct}%</strong> of your spending happens in the{' '}
                <em style={{ fontStyle: 'normal', fontWeight: 600, color: 'var(--terra)' }}>first 7 days</em> after payday.
                {firstPct >= 40
                  ? ' Most of your budget goes early in the pay cycle — spreading purchases out could ease late-month tightness.'
                  : firstPct >= 30
                    ? ' Slightly front-loaded, but mostly balanced across your pay cycle.'
                    : ' Well-paced — your spending is evenly spread across the pay cycle.'}
              </p>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
