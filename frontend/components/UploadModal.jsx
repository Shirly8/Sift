'use client';

import { useState, useRef, useEffect } from 'react';


export default function UploadModal({ open, onClose, onComplete }) {

  const [state, setState] = useState('drop');    // drop | processing | ready
  const [dragover, setDragover] = useState(false);
  const [uploadSummary, setUploadSummary] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const fileInputRef = useRef(null);


  // reset when opened
  useEffect(() => {
    if (open) {
      setState('drop');
      setUploadSummary(null);
      setSessionId(null);
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

      if (data.session_id) setSessionId(data.session_id);
      setUploadSummary(data.summary);
      setState('ready');

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
