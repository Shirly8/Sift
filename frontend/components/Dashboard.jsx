'use client';

import { useState, useEffect, useRef, Component } from 'react';
import Header from './Header';
import MetricsRow from './MetricsRow';
import AskSift from './AskSift';
import SpendingBars from './SpendingBars';
import TrendChart from './TrendChart';
import PatternCards from './PatternCards';
import Subscriptions from './Subscriptions';
import InsightCards from './InsightCards';
import SavingsPlan from './SavingsPlan';
import SpendingHabits from './SpendingHabits';
import Anomalies from './Anomalies';
import FinancialResilience from './FinancialResilience';
import UploadModal from './UploadModal';
import Toast from './Toast';
import {
  buildSpendingBars, buildTrendData, buildHabitsData, buildInsights,
  buildAnomalies, buildResilience,
} from './transformers';


// Error boundary — prevents full-page crash from any child component error
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <h2 className="heading-section" style={{ marginBottom: 8 }}>Something went wrong</h2>
          <p className="text-sm ink-muted" style={{ marginBottom: 16 }}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <button
            className="btn btn--primary"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}


export default function Dashboard({ initialShowUpload = false, initialSessionId = null, initialAnalysisData = null }) {

  // upload + analysis state
  const [sessionId, setSessionId] = useState(initialSessionId);
  const [analysisData, setAnalysisData] = useState(initialAnalysisData);
  const [loading, setLoading] = useState(false);

  // SSE progress — just an array of step strings from the backend
  const [steps, setSteps] = useState([]);
  const fallbackUsed = useRef(false);

  // modal state
  const [showUpload, setShowUpload] = useState(initialShowUpload);

  // toast
  const [toast, setToast] = useState(null);

  // fade-in on mount
  const [loaded, setLoaded] = useState(false);

  // tab navigation
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => { setLoaded(true) }, []);


  // SSE-powered analysis with fetch fallback
  useEffect(() => {
    if (!sessionId || analysisData) return;

    setLoading(true);
    setSteps([]);
    fallbackUsed.current = false;

    const es = new EventSource(
      `${process.env.NEXT_PUBLIC_API_URL}/api/analyze-stream?session_id=${sessionId}`
    );

    es.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.done) {
        es.close();
        setAnalysisData(data.data);
        setLoading(false);
        showToast('Analysis complete');
        return;
      }

      if (data.error) {
        es.close();
        setLoading(false);
        showToast('Analysis failed');
        return;
      }

      if (data.step) {
        setSteps(prev => [...prev, data.step]);
      }
    };

    es.onerror = () => {
      es.close();
      if (fallbackUsed.current) return;
      fallbackUsed.current = true;

      // fallback to regular POST
      setSteps([]);
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
        .catch(() => showToast('Analysis failed'))
        .finally(() => setLoading(false));
    };

    return () => es.close();
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


  // Extract real data from analysis results for child components
  const results = analysisData?.results || {};
  const profile = analysisData?.profile || {};

  // SpendingBars: build from spending_impact results
  const spendingBarsData = buildSpendingBars(results);

  // TrendChart: build from monthly data
  const trendData = buildTrendData(results, profile);

  // PatternCards: undefined = tool skipped; [] = ran but no significant correlations found
  const patternData = 'correlation_engine' in results
    ? results.correlation_engine.slice(0, 4)
    : undefined;

  // Subscriptions: backend already joined price_creep + overlaps onto each entry
  const subscriptionData = results.subscription_hunter?.recurring?.length ? results.subscription_hunter.recurring : undefined;

  // SpendingHabits: build from temporal_patterns results
  const habitsData = buildHabitsData(results);

  const insightsData = buildInsights(analysisData?.insights);

  const anomalyData = buildAnomalies(results);

  const resilienceData = buildResilience(results);

  const savingsPlan = analysisData?.savings_plan || null;

  const savingsPotential = Math.round(analysisData?.savings_potential ?? 0);


  return (
    <ErrorBoundary>
    <div>


      {/* texture overlay */}
      <div className="texture" />


      {/* UPLOAD MODAL */}
      <UploadModal
        open={showUpload}
        onClose={() => setShowUpload(false)}
        onComplete={(sid, analysis) => {
          setSessionId(sid);
          if (analysis) setAnalysisData(analysis);
          setShowUpload(false);
          showToast(analysis ? 'Analysis complete' : 'Upload complete');
        }}
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


      {/* LOADING STATE — real-time progress from SSE */}
      {sessionId && loading && (
        <div className="shell" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ ...fadeIn(0), width: '100%', maxWidth: 380, textAlign: 'center' }}>

            <h1 className="logo" style={{ textAlign: 'center', marginBottom: 6 }}>Sift</h1>
            <p className="text-sm ink-soft" style={{ textAlign: 'center', marginBottom: 28 }}>Analyzing your spending...</p>

            {steps.length > 0 ? (
              <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 10, margin: '0 auto', textAlign: 'left' }}>
                {steps.map((step, i) => {
                  const isLast = i === steps.length - 1;
                  return (
                    <div key={i} className="flex items-center gap-3" style={{ opacity: 1, transition: 'opacity 0.3s ease' }}>
                      {isLast ? (
                        <div className="spinner" style={{ width: 22, height: 22, borderWidth: '2px', flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--sage-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--sage-dark)" strokeWidth="3" strokeLinecap="round"><path d="M5 12l5 5L20 7" /></svg>
                        </div>
                      )}
                      <span className={`text-sm ${isLast ? 'fw-600' : 'ink-mid'}`}>{step}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <div className="spinner" style={{ width: 40, height: 40, borderWidth: '3px', margin: '0 auto 16px' }} />
                <p className="text-sm ink-mid">This should take about 5-10 seconds</p>
              </div>
            )}

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
          />
        </div>


        {/* METRICS ROW */}
        <div style={fadeIn(0.1)}>
          <MetricsRow profile={analysisData?.profile} savingsPotential={savingsPotential} topCategory={spendingBarsData?.[0]} />
        </div>


        {/* ASK SIFT */}
        {sessionId && (
          <div style={fadeIn(0.15)}>
            <AskSift sessionId={sessionId} />
          </div>
        )}


        {/* TAB NAVIGATION */}
        <div className="tab-nav" style={fadeIn(0.18)}>
          {[
            { key: 'overview', label: 'Overview' },
            { key: 'health', label: 'Check-Up' },
          ].map(t => (
            <button
              key={t.key}
              className={`tab-nav__item ${activeTab === t.key ? 'tab-nav__item--active' : ''}`}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>


        {/* TAB CONTENT */}
        <div className="dashboard-sections tab-content" key={activeTab}>

          {activeTab === 'overview' && (
            <>
              <div className="bento-row bento-row--wide bento-row--stretch">
                <div className="bento-stack">
                  <SpendingBars categories={spendingBarsData} />
                  <PatternCards patterns={patternData} />
                </div>
                <InsightCards insights={insightsData} />
              </div>
              <div className="bento-row bento-row--wide">
                <div className="bento-stack">
                  <TrendChart categories={trendData.categories} months={trendData.months} />
                  <Subscriptions subscriptions={subscriptionData} />
                </div>
                <SavingsPlan plan={savingsPlan} />
              </div>
            </>
          )}

          {activeTab === 'health' && (
            <>
              <div className="bento-row bento-row--wide">
                {resilienceData && <FinancialResilience data={resilienceData} />}
                <div className="bento-stack">
                  <Anomalies data={anomalyData} />
                  <SpendingHabits data={habitsData} />
                </div>
              </div>
            </>
          )}

        </div>


        {/* FOOTER */}
        <footer className="footer" style={fadeIn(0.4)}>
          <span className="text-sm ink-faint">&copy; 2026 Sift &bull; All rights reserved by Shirley Huang</span>
        </footer>

      </div>
      )}
    </div>
    </ErrorBoundary>
  );
}
