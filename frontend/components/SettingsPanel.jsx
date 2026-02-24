'use client';

import { useState, useEffect } from 'react';


export default function SettingsPanel({ open, onClose, onToast }) {

  const [autoRun, setAutoRun] = useState(true);
  const [strictFilter, setStrictFilter] = useState(true);
  const [ollamaBackup, setOllamaBackup] = useState(false);


  // escape to close
  useEffect(() => {
    function handleKey(e) { if (e.key === 'Escape') onClose() }
    if (open) document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);


  function toggleSetting(setter, current) {
    setter(!current);
    if (onToast) onToast('Setting updated');
  }


  return (
    <>

      {/* backdrop */}
      <div
        className={`settings-backdrop ${open ? 'open' : ''}`}
        onClick={onClose}
      />


      {/* panel */}
      <div className={`settings-panel ${open ? 'open' : ''}`}>


        {/* panel header */}
        <div style={{ padding: 24, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="heading-section">Settings</h2>
          <button className="modal__close" onClick={onClose} style={{ position: 'static' }}>
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round" width="14" height="14">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>


        {/* AI PROVIDER */}
        <div className="settings-group" style={{ paddingTop: 20 }}>
          <div className="settings-group__title">AI Provider</div>

          <div className="setting-row">
            <div>
              <div className="setting-row__label">Provider</div>
              <div className="setting-row__desc">Claude API</div>
            </div>
            <div className="pill pill--outline" style={{ fontSize: 11, padding: '4px 10px' }}>
              claude-sonnet-4-6
            </div>
          </div>

          <div className="setting-row">
            <div>
              <div className="setting-row__label">Use local model as backup</div>
              <div className="setting-row__desc">Ollama when API is unavailable</div>
            </div>
            <div
              className={`toggle ${ollamaBackup ? 'on' : ''}`}
              onClick={() => toggleSetting(setOllamaBackup, ollamaBackup)}
            >
              <div className="toggle__knob" />
            </div>
          </div>
        </div>


        {/* ANALYSIS */}
        <div className="settings-group" style={{ paddingTop: 20 }}>
          <div className="settings-group__title">Analysis</div>

          <div className="setting-row">
            <div>
              <div className="setting-row__label">Auto-run after upload</div>
              <div className="setting-row__desc">Start analysis immediately</div>
            </div>
            <div
              className={`toggle ${autoRun ? 'on' : ''}`}
              onClick={() => toggleSetting(setAutoRun, autoRun)}
            >
              <div className="toggle__knob" />
            </div>
          </div>

          <div className="setting-row">
            <div>
              <div className="setting-row__label">Strict pattern filtering</div>
              <div className="setting-row__desc">Only show highly reliable patterns</div>
            </div>
            <div
              className={`toggle ${strictFilter ? 'on' : ''}`}
              onClick={() => toggleSetting(setStrictFilter, strictFilter)}
            >
              <div className="toggle__knob" />
            </div>
          </div>
        </div>

      </div>

    </>
  );
}
