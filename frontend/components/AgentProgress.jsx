'use client';


const TOOL_LABELS = {
  temporal_patterns:   'Timing Patterns',
  anomaly_detection:   'Unusual Spending',
  subscription_hunter: 'Subscriptions',
  correlation_engine:  'Spending Links',
  spending_impact:     'Spending Drivers',
};


export default function AgentProgress({ planTools, executionTime }) {

  const tools = planTools || [];
  if (!tools.length) return null;

  const enabled = tools.filter(t => t.enabled);
  const skipped = tools.filter(t => !t.enabled);
  const timeLabel = executionTime ? `${executionTime}s` : null;


  return (
    <div className="card">

      <h3 className="heading-card" style={{ fontSize: 15, marginBottom: 4 }}>Agent Plan</h3>

      <p className="text-sm ink-muted" style={{ marginBottom: 12 }}>
        {enabled.length} tools run{skipped.length > 0 ? `, ${skipped.length} skipped` : ''}
        {timeLabel ? ` · ${timeLabel}` : ''}
      </p>

      {enabled.map(tool => (
        <div key={tool.name} style={{ marginBottom: 10 }}>
          <div className="progress-step" style={{ marginBottom: 2 }}>
            <div className="progress-dot progress-dot--done">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                <path d="M5 12l5 5L20 7" />
              </svg>
            </div>
            <span className="progress-label progress-label--done">
              {TOOL_LABELS[tool.name] || tool.name}
            </span>
            {tool.priority != null && (
              <span className="text-xs ink-faint" style={{ marginLeft: 6, opacity: 0.5 }}>#{tool.priority}</span>
            )}
          </div>
          {tool.reasoning && (
            <p className="text-xs ink-faint" style={{ paddingLeft: 28, lineHeight: 1.4, opacity: 0.7 }}>
              {tool.reasoning}
            </p>
          )}
        </div>
      ))}

      {skipped.length > 0 && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
          {skipped.map(tool => (
            <div key={tool.name} style={{ marginBottom: 6 }}>
              <div className="progress-step" style={{ marginBottom: 2, opacity: 0.4 }}>
                <div className="progress-dot" style={{ background: 'transparent', border: '1.5px dashed var(--ink-faint)' }} />
                <span className="progress-label text-xs" style={{ textDecoration: 'line-through' }}>
                  {TOOL_LABELS[tool.name] || tool.name}
                </span>
              </div>
              {tool.reason && (
                <p className="text-xs ink-faint" style={{ paddingLeft: 28, lineHeight: 1.4, opacity: 0.5 }}>
                  {tool.reason}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
