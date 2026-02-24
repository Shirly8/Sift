'use client';

import { useState } from 'react';


const DEMO_TOOLS = [
  { name: 'Categorization',    time: '0.4s' },
  { name: 'Timing Patterns',   time: '0.5s' },
  { name: 'Unusual Spending',  time: '0.3s' },
  { name: 'Subscriptions',     time: '0.4s' },
  { name: 'Spending Links',    time: '0.3s' },
  { name: 'Spending Drivers',  time: '0.4s' },
];


export default function AgentProgress({ toolsRun = DEMO_TOOLS, onToast }) {

  const [steps, setSteps] = useState(toolsRun.map(() => 'done'));
  const [status, setStatus] = useState(`${toolsRun.length} checks completed`);
  const [running, setRunning] = useState(false);


  async function rerun() {
    if (running) return;

    setRunning(true);
    setStatus('Running analysis...');
    setSteps(toolsRun.map(() => 'pending'));

    for (let i = 0; i < toolsRun.length; i++) {
      setSteps(prev => prev.map((s, j) => j === i ? 'running' : s));
      await new Promise(r => setTimeout(r, 400 + Math.random() * 300));
      setSteps(prev => prev.map((s, j) => j === i ? 'done' : s));
    }

    setStatus(`${toolsRun.length} checks completed`);
    setRunning(false);
    if (onToast) onToast('Analysis complete');
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

      <p className="text-sm ink-muted" style={{ marginBottom: 10 }}>{status}</p>


      {/* progress steps */}
      {toolsRun.map((tool, i) => (
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

          {/* time */}
          <span className="text-xs ink-muted" style={{ marginLeft: 'auto' }}>
            {steps[i] === 'done' ? tool.time : ''}
          </span>

        </div>
      ))}

    </div>
  );
}
