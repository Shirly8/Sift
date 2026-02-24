'use client';


const DEMO_PATTERNS = [
  {
    emoji: '🍳',
    title: 'Cooking more = ordering less',
    desc: 'When your grocery spending goes up, your delivery spending drops almost equally. The months you cook more, you save about <strong>$80</strong>.',
    strength: 'Strong pattern',
    strengthClass: 'tag--high',
    direction: 'inverse',
  },
  {
    emoji: '🍽️',
    title: 'Dining out means getting there',
    desc: 'Your dining and transport spending tend to rise together — going out to eat usually means paying for the ride too.',
    strength: 'Moderate',
    strengthClass: 'tag--medium',
    direction: 'correlated',
  },
  {
    emoji: '🛍️',
    title: 'Shopping sprees include dinner',
    desc: 'Months with higher shopping also have higher dining. Big spending days tend to include both.',
    strength: 'Moderate',
    strengthClass: 'tag--medium',
    direction: 'correlated',
  },
];


export default function PatternCards({ patterns = DEMO_PATTERNS }) {

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
