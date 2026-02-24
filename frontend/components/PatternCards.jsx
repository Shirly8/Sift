'use client';


// pick an emoji based on the two categories
function pickEmoji(catA, catB) {
  const pair = `${catA} ${catB}`.toLowerCase();
  if (pair.includes('grocer') && pair.includes('deliver')) return '🍳';
  if (pair.includes('dining') && pair.includes('transport')) return '🍽️';
  if (pair.includes('shopping') && pair.includes('dining')) return '🛍️';
  if (pair.includes('entertainment')) return '🎬';
  if (pair.includes('health')) return '🏃';
  if (pair.includes('subscri')) return '📺';
  if (pair.includes('transport')) return '🚗';
  return '📊';
}

// generate a human-readable title from a correlation
function buildTitle(corr) {
  const r = corr.correlation;
  const a = corr.category_a;
  const b = corr.category_b;

  if (r < -0.5) return `More ${a} = less ${b}`;
  return `${a} and ${b} move together`;
}


export default function PatternCards({ correlations }) {

  // transform backend correlation data into pattern cards
  const patterns = (correlations || []).slice(0, 4).map(corr => {
    const r = corr.correlation;
    const isInverse = r < 0;
    const isStrong = Math.abs(r) > 0.7;

    return {
      emoji: pickEmoji(corr.category_a, corr.category_b),
      title: buildTitle(corr),
      desc: corr.interpretation || `${corr.category_a} and ${corr.category_b} (r=${r})`,
      strength: isStrong ? 'Strong pattern' : 'Moderate',
      strengthClass: isStrong ? 'tag--high' : 'tag--medium',
      direction: isInverse ? 'inverse' : 'correlated',
    };
  });


  if (!patterns.length) {
    return (
      <div className="card">
        <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
          <h3 className="heading-card">Patterns We Found</h3>
        </div>
        <p className="text-sm ink-muted" style={{ marginTop: 8 }}>
          Need 3+ months and 3+ categories to detect spending patterns.
        </p>
      </div>
    );
  }


  return (
    <div className="card">

      <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
        <h3 className="heading-card">Patterns We Found</h3>
        <span className="help-tip" data-tooltip="Sift looks at how your spending categories relate to each other over time">?</span>
      </div>

      <p className="text-sm ink-muted" style={{ marginBottom: 14 }}>
        How your spending categories connect to each other
      </p>


      {/* pattern cards */}
      <div className="flex flex-col gap-3">
        {patterns.map(p => (
          <div key={p.title} className="pattern-card">
            <div className="flex gap-3">

              {/* emoji icon */}
              <div
                className={`pattern-card__arrow pattern-card__arrow--${p.direction === 'inverse' ? 'down' : 'up'}`}
                style={{ marginTop: 2 }}
              >
                <span style={{ fontSize: 16 }}>{p.emoji}</span>
              </div>

              {/* text */}
              <div className="flex-1">
                <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
                  <span className="text-md fw-700">{p.title}</span>
                </div>
                <div className="text-sm ink-mid" style={{ lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: p.desc }} />
                <div style={{ marginTop: 6 }}>
                  <span className={`tag ${p.strengthClass}`}>{p.strength}</span>
                </div>
              </div>

            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
