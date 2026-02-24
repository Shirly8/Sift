'use client';

import AnimatedNumber from './AnimatedNumber';


export default function Header({ txnCount = 0, onUpload, onSettings }) {

  return (
    <header className="header">


      {/* LEFT — logo + tagline */}
      <div className="flex items-center gap-5">
        <h1 className="logo">Sift</h1>
        <div className="divider-v hide-mobile" />
        <span className="text-sm fw-500 ink-soft hide-mobile">Your spending, made visible</span>
      </div>


      {/* RIGHT — badge + buttons */}
      <div className="flex items-center gap-4">

        {/* transaction count badge */}
        <div className="pill pill--surface flex items-center gap-2">
          <div className="dot dot--sage" />
          <span className="text-sm fw-600 ink-soft">
            <AnimatedNumber value={txnCount} /> transactions
          </span>
        </div>

        {/* upload button */}
        <button className="btn btn--primary" onClick={onUpload}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 5v14M5 12l7-7 7 7" />
          </svg>
          Upload CSV
        </button>

        {/* settings icon */}
        <button className="icon-btn hide-mobile" onClick={onSettings}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
        </button>
      </div>

    </header>
  );
}
