'use client';

import { useState, useRef, useEffect } from 'react';


export default function UploadModal({ open, onClose, onComplete }) {

  const [state, setState] = useState('drop');    // drop | processing | ready | blocked
  const [dragover, setDragover] = useState(false);
  const [uploadSummary, setUploadSummary] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [blockedMessage, setBlockedMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const fileInputRef = useRef(null);


  // reset and check service status when opened
  useEffect(() => {
    if (!open) return;
    setState('drop');
    setUploadSummary(null);
    setSessionId(null);
    setBlockedMessage('');
    setErrorMessage('');

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/status`)
      .then(r => r.json())
      .then(data => {
        if (!data.accepting) {
          setBlockedMessage(data.message || 'Uploads are temporarily paused.');
          setState('blocked');
        }
      })
      .catch(() => {});
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
      setErrorMessage('Please provide a CSV file.');
      return;
    }

    setErrorMessage('');
    setState('processing');

    try {
      const formData = new FormData();
      formData.append('file', file);

      let response;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/upload`, {
            method: 'POST',
            body: formData,
          });
          break;
        } catch {
          if (attempt === 2) throw new Error('Failed to fetch');
          await new Promise(r => setTimeout(r, 2000));
        }
      }

      if (response.status === 429) {
        const data = await response.json();
        setBlockedMessage(data.message || "You've used up your demo for today. Come back tomorrow for another try.");
        setState('blocked');
        return;
      }

      if (response.status === 503) {
        const data = await response.json();
        setBlockedMessage(data.message || 'The demo is temporarily unavailable. Check back soon.');
        setState('blocked');
        return;
      }

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      const data = await response.json();

      if (data.session_id) setSessionId(data.session_id);
      setUploadSummary(data.summary);
      setState('ready');

    } catch (err) {
      console.error('Upload error:', err);
      setErrorMessage(err.message === 'Failed to fetch'
        ? 'Could not reach the server. Please try again.'
        : `Something went wrong: ${err.message}`);
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
            <h2 className="heading-section upload-heading">Upload Your Transactions</h2>
            <p className="upload-desc">
              Drop a CSV from your bank. We&rsquo;ll figure out the format automatically.
            </p>

            <div
              className={`upload-zone ${dragover ? 'dragover' : ''}`}
              onDragOver={e => { e.preventDefault(); setDragover(true) }}
              onDragLeave={() => setDragover(false)}
              onDrop={e => { e.preventDefault(); setDragover(false); handleUpload(e.dataTransfer.files[0]) }}
              onClick={() => fileInputRef.current?.click()}
            >
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--terra)" strokeWidth="1.5" strokeLinecap="round">
                <path d="M12 5v14M5 12l7-7 7 7" />
              </svg>
              <h3>Drop CSV file here</h3>
              <p>or <a onClick={e => e.stopPropagation()}>browse files</a></p>
              <footer>Works with Wealthsimple, RBC, TD, Scotiabank, or any CSV</footer>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              style={{ display: 'none' }}
              onChange={(e) => handleUpload(e.target.files?.[0])}
            />

            {errorMessage && (
              <p style={{ marginTop: 16, textAlign: 'center', fontSize: 13, color: 'var(--terra)' }}>
                {errorMessage}
              </p>
            )}

            <p style={{ marginTop: 12, textAlign: 'center', fontSize: 13, color: 'var(--ink-muted)' }}>
              Don&rsquo;t have a CSV?{' '}
              <a
                href="/sample_transactions.csv"
                download="sample_transactions.csv"
                style={{ color: 'var(--terra)', textDecoration: 'underline', cursor: 'pointer' }}
              >
                Download a sample
              </a>{' '}and try it out.
            </p>
          </div>
        )}


        {/* STATE: blocked — rate limited or service disabled */}
        {state === 'blocked' && (
          <div className="upload-processing">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--terra)" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <h2 className="heading-section upload-heading">You've reached the demo limit</h2>
            <p className="upload-desc">{blockedMessage}</p>
          </div>
        )}


        {/* STATE 2 — processing (sub-second, just a spinner) */}
        {state === 'processing' && (
          <div className="upload-processing">
            <div className="spinner spinner--lg" />
            <h2 className="heading-section upload-heading">Reading your transactions...</h2>
            <p className="upload-desc">This should only take a moment</p>
          </div>
        )}


        {/* STATE 3 — ready */}
        {state === 'ready' && uploadSummary && (
          <div className="upload-ready">

            {/* success icon */}
            <div className="upload-success-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--sage-dark)" strokeWidth="2.5" strokeLinecap="round">
                <path d="M5 12l5 5L20 7" />
              </svg>
            </div>

            <h2 className="heading-section upload-heading">Ready to go</h2>
            <p className="upload-summary">
              {uploadSummary.total} transactions &middot; {uploadSummary.date_range?.days} days of history
            </p>
            <p className="upload-desc">
              {uploadSummary.coverage_pct}% auto-categorized &middot; {uploadSummary.needs_llm} need categorization
            </p>

            <button
              className="btn btn--primary btn--block"
              onClick={() => onComplete && onComplete(sessionId, null)}
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
