'use client';


export default function Toast({ message }) {

  return (
    <div className={`toast ${message ? 'visible' : ''}`}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <path d="M5 12l5 5L20 7" />
      </svg>
      <span>{message}</span>
    </div>
  );
}
