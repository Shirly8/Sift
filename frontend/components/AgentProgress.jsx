'use client';

import { useState } from 'react';


// map backend tool names to display names
const TOOL_DISPLAY_NAMES = {
  'temporal_patterns':      'Timing Patterns',
  'anomaly_detection':      'Unusual Spending',
  'subscription_hunter':    'Subscriptions',
  'correlation_engine':     'Spending Links',
  'spending_impact':        'Spending Drivers',
};


export default function AgentProgress({ toolsRun, toolsSkipped, executionTime, onToast }) {

  // build tool list from backend data
  const tools = (toolsRun || []).map(name => ({
    name: TOOL_DISPLAY_NAMES[name] || name.replace(/_/g, ' '),
    status: 'done',
  }));

  // add skipped tools
  (toolsSkipped || []).forEach(t => {
    tools.push({
      name: TOOL_DISPLAY_NAMES[t.name] || t.name.replace(/_/g, ' '),
      status: 'skipped',
      reason: t.reason,
    });
  });

  const doneCount = tools.filter(t => t.status === 'done').length;
  const skippedCount = tools.filter(t => t.status === 'skipped').length;

  const [steps, setSteps] = useState(tools.map(t => t.status));
  const [status, setStatus] = useState(
    `${doneCount} checks completed${skippedCount > 0 ? ` · ${skippedCount} skipped` : ''}`
  );
  const [running, setRunning] = useState(false);


  async function rerun() {
    if (running) return;

    setRunning(true);
    setStatus('Running analysis...');
    setSteps(tools.map(() => 'pending'));

    for (let i = 0; i < tools.length; i++) {
      if (tools[i].status === 'skipped') {
        setSteps(prev => prev.map((s, j) => j === i ? 'skipped' : s));
        continue;
      }
      setSteps(prev => prev.map((s, j) => j === i ? 'running' : s));
      await new Promise(r => setTimeout(r, 400 + Math.random() * 300));
      setSteps(prev => prev.map((s, j) => j === i ? 'done' : s));
    }

    setStatus(`${doneCount} checks completed${skippedCount > 0 ? ` · ${skippedCount} skipped` : ''}`);
    setRunning(false);
    if (onToast) onToast('Analysis complete');
  }


  if (!tools.length) {
    return (
      <div className="card">
        <h3 className="heading-card" style={{ fontSize: 15 }}>Analysis Details</h3>
        <p className="text-sm ink-muted" style={{ marginTop: 8 }}>No tools were run.</p>
      </div>
    );
  }


  return (
    <div className="card">

      <div className="flex justify-between items-center" style={{ marginBottom: 4 }}>
        <h3 className="heading-card" style={{ fontSize: 15 }}>Analysis Details</h3>
        <button className="btn btn--ghost btn--sm" onClick={rerun}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M1 4v6h6M23 20v-6h-6" />
            <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" />
          </svg>
          Re-run
        </button>
      </div>

      <p className="text-sm ink-muted" style={{ marginBottom: 10 }}>
        {status}
        {executionTime ? ` · ${executionTime}s` : ''}
      </p>


      {/* progress steps */}
      {tools.map((tool, i) => (
        <div key={tool.name} className="progress-step">

          {/* dot */}
          <div className={`progress-dot progress-dot--${steps[i]}`}>
            {steps[i] === 'done' && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" strokeWidth="3" strokeLinecap="round">
                <path d="M5 12l5 5L20 7" />
              </svg>
            )}
            {steps[i] === 'running' && (
              <div className="spinner" style={{ width: 12, height: 12, borderWidth: '1.5px' }} />
            )}
            {steps[i] === 'skipped' && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#A0A0A0" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            )}
            {steps[i] === 'pending' && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" strokeWidth="2">
                <circle cx="12" cy="12" r="4" />
              </svg>
            )}
          </div>

          {/* label */}
          <span className={`progress-label progress-label--${steps[i]}`}>
            {tool.name}
          </span>

          {/* reason for skipped */}
          <span className="text-xs ink-muted" style={{ marginLeft: 'auto' }}>
            {steps[i] === 'skipped' && tool.reason ? tool.reason : ''}
          </span>

        </div>
      ))}

    </div>
  );
}
