'use client';


// Safe text renderer — parses **bold** without dangerouslySetInnerHTML
function SafeDesc({ text }) {
  if (!text) return null;
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}


export default function PatternCards({ patterns }) {

  if (!patterns || !patterns.length) return null;

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
          <div
            key={p.title}
            style={{ padding: '14px 16px', background: 'var(--bg)', borderRadius: 'var(--r-md)' }}
          >
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
                  <span className={`tag ${p.strengthClass}`}>{p.strength}</span>
                </div>
                <div className="text-sm ink-mid" style={{ lineHeight: 1.6 }}>
                  <SafeDesc text={p.desc} />
                </div>
              </div>

            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
