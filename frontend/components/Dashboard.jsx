'use client';

import { useState, useEffect } from 'react';
import Header from './Header';
import MetricsRow from './MetricsRow';
import AskSift from './AskSift';
import SpendingBars from './SpendingBars';
import TrendChart from './TrendChart';
import PatternCards from './PatternCards';
import Subscriptions from './Subscriptions';
import InsightCards from './InsightCards';
import SpendingHabits from './SpendingHabits';
import AgentProgress from './AgentProgress';
import UploadModal from './UploadModal';
import SettingsPanel from './SettingsPanel';
import Toast from './Toast';


export default function Dashboard() {

  // upload + analysis state
  const [sessionId, setSessionId] = useState(null);
  const [analysisData, setAnalysisData] = useState(null);
  const [loading, setLoading] = useState(false);

  // modal / panel state
  const [showUpload, setShowUpload] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // toast
  const [toast, setToast] = useState(null);

  // fade-in on mount
  const [loaded, setLoaded] = useState(false);

  useEffect(() => { setLoaded(true) }, []);


  // auto-analyze when sessionId is set
  useEffect(() => {
    if (!sessionId) return;

    setLoading(true);
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId }),
    })
      .then(res => res.json())
      .then(data => {
        setAnalysisData(data);
        showToast('Analysis complete');
      })
      .catch(err => {
        console.error('Analysis error:', err);
        showToast('Analysis failed');
      })
      .finally(() => setLoading(false));
  }, [sessionId]);


  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }


  // staggered fade-in
  const fadeIn = (delay) => ({
    opacity: loaded ? 1 : 0,
    transform: loaded ? 'translateY(0)' : 'translateY(12px)',
    transition: `opacity 0.6s cubic-bezier(0.22, 1, 0.36, 1) ${delay}s, transform 0.6s cubic-bezier(0.22, 1, 0.36, 1) ${delay}s`,
  });


  return (
    <div>


      {/* texture overlay */}
      <div className="texture" />


      {/* UPLOAD MODAL */}
      <UploadModal
        open={showUpload}
        onClose={() => setShowUpload(false)}
        onComplete={(sid) => {
          setSessionId(sid);
          setShowUpload(false);
          showToast('Upload complete');
        }}
      />


      {/* SETTINGS PANEL */}
      <SettingsPanel
        open={showSettings}
        onClose={() => setShowSettings(false)}
        onToast={showToast}
      />


      {/* TOAST */}
      <Toast message={toast} />



      {/* EMPTY STATE — no sessionId */}
      {!sessionId && (
        <div className="shell" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
          <div style={fadeIn(0)}>
            <h1 className="logo" style={{ marginBottom: 16 }}>Sift</h1>
            <p className="text-sm ink-soft" style={{ marginBottom: 8 }}>Your spending, made visible</p>
          </div>

          <div style={fadeIn(0.1)}>
            <h2 className="heading-section" style={{ marginBottom: 8 }}>Upload your bank transactions</h2>
            <p className="text-md ink-mid" style={{ marginBottom: 24, maxWidth: 400 }}>
              Drop a CSV from your bank and we'll analyze your spending patterns, find hidden savings, and give you actionable insights.
            </p>

            <button
              className="btn btn--primary"
              style={{ padding: '12px 32px', fontSize: 16 }}
              onClick={() => setShowUpload(true)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 5v14M5 12l7-7 7 7" />
              </svg>
              Upload CSV
            </button>
          </div>

          <div style={fadeIn(0.2)}>
            <p className="text-xs ink-faint" style={{ marginTop: 32 }}>
              Works with Wealthsimple, RBC, TD, Scotiabank, or any CSV
            </p>
          </div>
        </div>
      )}


      {/* LOADING STATE */}
      {sessionId && loading && (
        <div className="shell" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
          <div style={fadeIn(0)}>
            <div className="spinner" style={{ width: 48, height: 48, borderWidth: '3px', margin: '0 auto 24px' }} />
            <h2 className="heading-section" style={{ marginBottom: 8 }}>Analyzing your spending...</h2>
            <p className="text-sm ink-mid">This should take about 5-10 seconds</p>
          </div>
        </div>
      )}


      {/* ===== MAIN APP — only show with real data ===== */}
      {sessionId && analysisData && (
      <div className="shell">


        {/* HEADER */}
        <div style={fadeIn(0)}>
          <Header
            txnCount={analysisData?.profile?.transaction_count || 0}
            onUpload={() => setShowUpload(true)}
            onSettings={() => setShowSettings(true)}
          />
        </div>


        {/* METRICS ROW */}
        <div style={fadeIn(0.1)}>
          <MetricsRow profile={analysisData?.profile} />
        </div>


        {/* ASK SIFT */}
        {sessionId && (
          <div style={fadeIn(0.15)}>
            <AskSift sessionId={sessionId} />
          </div>
        )}


        {/* ===== MAIN CONTENT GRID ===== */}
        <div className="main-grid-wide" style={fadeIn(0.2)}>


          {/* LEFT COLUMN */}
          <div className="flex flex-col gap-4">

            <SpendingBars />

            <div className="split-grid">
              <TrendChart />
              <PatternCards />
            </div>

            <Subscriptions />
          </div>


          {/* RIGHT COLUMN */}
          <div className="flex flex-col gap-4">
            <InsightCards insights={analysisData?.insights} />
            <SpendingHabits />
            <AgentProgress toolsRun={analysisData?.tools_run} onToast={showToast} />
          </div>

        </div>


        {/* FOOTER */}
        <footer className="footer" style={fadeIn(0.4)}>
          <span className="text-sm ink-faint">Analysis completed in 2.3s</span>
          <button
            className="text-sm ink-faint"
            onClick={() => showToast('Report exported')}
            style={{ cursor: 'pointer' }}
          >
            Export Report
          </button>
        </footer>

      </div>
      )}
    </div>
  );
}
