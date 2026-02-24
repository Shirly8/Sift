'use client';

import { useState, useRef, useEffect } from 'react';


const STEPS = [
  { key: 'detect',     label: 'Recognizing your bank format...' },
  { key: 'normalize',  label: 'Cleaning up transactions...' },
  { key: 'categorize', label: 'Sorting into categories...' },
  { key: 'quality',    label: 'Checking everything looks right...' },
];


export default function UploadModal({ open, onClose, onComplete }) {

  const [state, setState] = useState('drop');    // drop | processing | ready
  const [progress, setProgress] = useState(0);
  const [stepStates, setStepStates] = useState(STEPS.map(() => 'pending'));
  const [dragover, setDragover] = useState(false);
  const [uploadSummary, setUploadSummary] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const fileInputRef = useRef(null);


  // reset when opened
  useEffect(() => {
    if (open) {
      setState('drop');
      setProgress(0);
      setStepStates(STEPS.map(() => 'pending'));
    }
  }, [open]);


  // escape to close
  useEffect(() => {
    function handleKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);


  // upload to backend /api/upload
  async function handleUpload(file) {
    if (!file || !file.name.endsWith('.csv')) {
      alert('Please provide a CSV file');
      return;
    }

    setState('processing');

    // step 1: format detection
    setStepStates(prev => prev.map((s, j) => j === 0 ? 'active' : s));

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      const data = await response.json();

      // store session_id from response
      if (data.session_id) {
        setSessionId(data.session_id);
      }

      // simulate step progression for UX
      const steps = [0, 1, 2, 3];
      const stepDurations = [400, 600, 800, 400];

      for (let i = 0; i < steps.length; i++) {
        if (i > 0) setStepStates(prev => prev.map((s, j) => j === i - 1 ? 'done' : s));
        setStepStates(prev => prev.map((s, j) => j === i ? 'active' : s));

        const elapsed = stepDurations.slice(0, i).reduce((a, b) => a + b, 0);
        const totalDur = stepDurations.reduce((a, b) => a + b, 0);
        const newProgress = Math.min((elapsed + stepDurations[i]) / totalDur * 100, 100);

        setProgress(newProgress);
        await new Promise(r => setTimeout(r, stepDurations[i]));
      }

      setStepStates(prev => prev.map((s, j) => j === STEPS.length - 1 ? 'done' : s));
      await new Promise(r => setTimeout(r, 300));
      setState('ready');

      // store upload summary for display
      setUploadSummary(data.summary);

    } catch (err) {
      console.error('Upload error:', err);
      alert(`Upload failed: ${err.message}`);
      setState('drop');
    }
  }


  return (
    <div
      className={`modal-overlay ${open ? 'open' : ''}`}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="modal">


        {/* close button */}
        <button className="modal__close" onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round" width="14" height="14">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>


        {/* STATE 1 — drop zone */}
        {state === 'drop' && (
          <div>
            <h2 className="heading-section" style={{ marginBottom: 6 }}>Upload Your Transactions</h2>
            <p className="text-sm ink-muted" style={{ marginBottom: 20 }}>
              Drop a CSV from your bank. We'll figure out the format automatically.
            </p>

            <div
              className={`upload-zone ${dragover ? 'dragover' : ''}`}
              onDragOver={e => { e.preventDefault(); setDragover(true) }}
              onDragLeave={() => setDragover(false)}
              onDrop={e => { e.preventDefault(); setDragover(false); handleUpload(e.dataTransfer.files[0]) }}
              onClick={() => fileInputRef.current?.click()}
            >
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--terra)" strokeWidth="1.5" strokeLinecap="round" style={{ margin: '0 auto 14px' }}>
                <path d="M12 5v14M5 12l7-7 7 7" />
              </svg>
              <div className="fw-600 text-md" style={{ marginBottom: 4 }}>Drop CSV file here</div>
              <div className="text-sm ink-muted">
                or <span style={{ color: 'var(--terra)', cursor: 'pointer', fontWeight: 600 }}>browse files</span>
              </div>
              <div className="text-xs ink-faint" style={{ marginTop: 12 }}>
                Works with Wealthsimple, RBC, TD, Scotiabank, or any CSV
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              style={{ display: 'none' }}
              onChange={(e) => handleUpload(e.target.files?.[0])}
            />
          </div>
        )}


        {/* STATE 2 — processing */}
        {state === 'processing' && (
          <div>
            <h2 className="heading-section" style={{ marginBottom: 6 }}>Reading your transactions...</h2>
            <p className="text-sm ink-muted">transactions.csv</p>

            <div className="upload-progress">
              <div className="upload-progress__fill" style={{ width: `${progress}%` }} />
            </div>

            <div className="upload-steps">
              {STEPS.map((step, i) => (
                <div key={step.key} className={`upload-step ${stepStates[i]}`}>
                  <div className="upload-step__dot">
                    {stepStates[i] === 'done' && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#2D7A2D" strokeWidth="3" strokeLinecap="round">
                        <path d="M5 12l5 5L20 7" />
                      </svg>
                    )}
                  </div>
                  <span>{step.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}


        {/* STATE 3 — ready */}
        {state === 'ready' && uploadSummary && (
          <div style={{ textAlign: 'center' }}>

            {/* success icon */}
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'var(--sage-light)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--sage-dark)" strokeWidth="2.5" strokeLinecap="round">
                <path d="M5 12l5 5L20 7" />
              </svg>
            </div>

            <h2 className="heading-section" style={{ marginBottom: 6 }}>Ready to go</h2>
            <p className="text-sm ink-muted" style={{ marginBottom: 6 }}>
              {uploadSummary.total} transactions &middot; {uploadSummary.date_range?.days} days of history
            </p>
            <p className="text-sm ink-muted" style={{ marginBottom: 20 }}>
              {uploadSummary.coverage_pct}% auto-categorized &middot; {uploadSummary.needs_llm} need categorization
            </p>

            <button
              className="btn btn--primary"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => onComplete && onComplete(sessionId)}
            >
              Analyze My Spending
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}


      </div>
    </div>
  );
}
