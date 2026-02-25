'use client';

import AnimatedNumber from './AnimatedNumber';


export default function Header({ txnCount = 0, onUpload }) {

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

        {/* GitHub link */}
        <a href="https://github.com/Shirly8/Sift" target="_blank" rel="noopener noreferrer" className="icon-btn hide-mobile" style={{ color: 'var(--ink-faint)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
          </svg>
        </a>
      </div>

    </header>
  );
}
