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
import UploadModal from './UploadModal';
import Toast from './Toast';


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


export default function Dashboard({ initialShowUpload = false }) {

  // upload + analysis state
  const [sessionId, setSessionId] = useState(null);
  const [analysisData, setAnalysisData] = useState(null);
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

  // PatternCards: build from correlation engine + temporal context
  const patternData = buildPatternCards(results);

  // Subscriptions: build from subscription_hunter results
  const subscriptionData = buildSubscriptions(results);

  // SpendingHabits: build from temporal_patterns results
  const habitsData = buildHabitsData(results);

  // InsightCards: map backend field names to frontend props
  const insightsData = buildInsights(analysisData?.insights);

  // Anomalies: build from anomaly_detection results
  const anomalyData = buildAnomalies(results);

  // Compute annual savings potential from subscription overlap data
  const savingsPotential = computeSavingsPotential(results, analysisData?.insights);

  // Savings plan: concrete opportunities from backend
  const savingsPlan = analysisData?.savings_plan || null;


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
          <MetricsRow profile={analysisData?.profile} savingsPotential={savingsPotential} />
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

            <SpendingBars categories={spendingBarsData} />

            <div className="split-grid">
              <TrendChart categories={trendData.categories} months={trendData.months} />
              <PatternCards patterns={patternData} />
            </div>

            <Subscriptions subscriptions={subscriptionData} />

            <Anomalies data={anomalyData} />
          </div>


          {/* RIGHT COLUMN */}
          <div className="flex flex-col gap-4">
            <SavingsPlan plan={savingsPlan} />
            <InsightCards insights={insightsData} />
            <SpendingHabits data={habitsData} />
          </div>

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


// ─── Data transformers: analysis results → component props ───

const CATEGORY_COLORS = {
  'Dining':            '#CF5532',
  'Groceries':         '#6B8F71',
  'Shopping':          '#D4915E',
  'Transport':         '#7B8794',
  'Subscriptions':     '#D4735A',
  'Delivery':          '#C4A87A',
  'Entertainment':     '#A8B0A0',
  'Health':            '#5B8C85',
  'Bills & Utilities': '#8B7355',
  'Personal Care':     '#B5838D',
  'Education':         '#6C757D',
  'Insurance':         '#9B8EC5',
  'Rent & Housing':    '#7A6C5D',
};

function getCategoryColor(name, idx) {
  return CATEGORY_COLORS[name] || ['#CF5532','#6B8F71','#D4915E','#7B8794','#D4735A','#C4A87A','#A8B0A0'][idx % 7];
}


function buildInsights(rawInsights) {
  if (!rawInsights || !rawInsights.length) return undefined;

  return rawInsights.map((ins, idx) => ({
    rank:       idx + 1,
    impact:     ins.dollar_impact || 0,
    confidence: ins.confidence || 'MEDIUM',
    title:      ins.title || '',
    desc:       ins.description || '',
    extra:      ins.action_option || '',
    source:     ins.tool_source || '',
  }));
}


function buildSpendingBars(results) {
  const impact = results.spending_impact;
  if (!impact?.model_valid || !impact?.impacts) return undefined;

  const impacts = impact.impacts;
  if (!impacts.length) return undefined;

  return impacts.slice(0, 7).map((imp, i) => ({
    label:  imp.category,
    avg:    Math.round(imp.monthly_avg || imp.monthly_std * 3),
    range:  `\u00B1$${Math.round(imp.monthly_std)}`,
    color:  getCategoryColor(imp.category, i),
    pct:    Math.round(imp.impact_pct),
    tip:    `${imp.category}: ~$${Math.round(imp.monthly_avg || imp.monthly_std * 3)}/mo avg, ${imp.impact_pct}% of your spending variance.`,
  }));
}


function buildTrendData(results, profile) {
  const monthlyTotals = profile.monthly_totals;
  if (!monthlyTotals || monthlyTotals.length < 2) return { categories: undefined, months: undefined };

  const startDate = profile.start_date ? new Date(profile.start_date) : new Date();
  const months = monthlyTotals.map((_, i) => {
    const d = new Date(startDate);
    d.setMonth(d.getMonth() + i);
    return d.toLocaleString('default', { month: 'short' });
  });

  const seasonal = results.temporal_patterns?.seasonal;
  if (seasonal?.seasonal_detected && seasonal?.monthly_totals) {
    const values = Object.values(seasonal.monthly_totals);
    const labels = Object.keys(seasonal.monthly_totals).map(m => m.split(' ')[0].slice(0, 3));

    return {
      months: labels,
      categories: [
        { name: 'Total', color: '#CF5532', data: values },
      ],
    };
  }

  return {
    months,
    categories: [
      { name: 'Total', color: '#CF5532', data: monthlyTotals },
    ],
  };
}


function buildPatternCards(results) {
  const correlations = results.correlation_engine;
  if (!correlations || !Array.isArray(correlations) || correlations.length === 0) return undefined;

  // temporal context for "why" explanations
  const temporal = results.temporal_patterns || {};
  const payday   = temporal.payday || {};
  const weekly   = temporal.weekly || {};

  return correlations.slice(0, 3).map(corr => {
    const a = corr.category_a;
    const b = corr.category_b;
    const positive = corr.correlation > 0;
    const strength = corr.confidence === 'HIGH' ? 'strongly' : 'often';

    // base description
    let desc = positive
      ? `When you spend more on **${a}**, **${b}** tends to go up too — they ${strength} move together.`
      : `When **${a}** goes up, **${b}** tends to drop — they ${strength} move in opposite directions.`;

    // add "why" from temporal data
    const cats = [a.toLowerCase(), b.toLowerCase()];
    const weekendCats = ['dining', 'entertainment', 'shopping', 'delivery'];
    const paydayCats  = ['dining', 'shopping', 'personal care', 'delivery', 'entertainment'];

    if (payday.payday_detected && cats.some(c => paydayCats.includes(c))) {
      desc += ` Both tend to spike in the first week after payday (${payday.spending_in_first_7_days_pct}% of spending happens then).`;
    } else if (weekly.weekend_spending_multiple > 1.3 && cats.some(c => weekendCats.includes(c))) {
      desc += ` Both are weekend-heavy categories — weekends run ${weekly.weekend_spending_multiple}x weekday spending.`;
    }

    return {
      emoji:         positive ? '\u{1F4C8}' : '\u{1F504}',
      title:         `${a} & ${b}`,
      desc,
      strength:      corr.confidence === 'HIGH' ? 'Strong pattern' : 'Moderate',
      strengthClass: corr.confidence === 'HIGH' ? 'tag--high' : 'tag--medium',
      direction:     positive ? 'correlated' : 'inverse',
    };
  });
}


function buildSubscriptions(results) {
  const subs = results.subscription_hunter;
  if (!subs?.recurring || subs.recurring.length === 0) return undefined;

  const priceCreepMap = {};
  if (subs.price_creep) {
    subs.price_creep.forEach(pc => {
      if (pc.price_creep_detected) priceCreepMap[pc.merchant] = pc;
    });
  }

  const overlapMap = {};
  if (subs.overlaps) {
    subs.overlaps.forEach(o => {
      overlapMap[o.category] = o;
    });
  }

  return subs.recurring.map((r, i) => {
    const creepData = priceCreepMap[r.merchant];
    const overlapData = overlapMap[r.category];

    return {
      name:          r.merchant,
      amount:        r.amount,
      annualCost:    r.annual_cost,
      frequency:     r.frequency,
      color:         getCategoryColor(r.category, i),
      creep:         !!creepData,
      creepPct:      creepData ? Math.round(creepData.total_increase_pct) : 0,
      creepFrom:     creepData?.original_price,
      creepTo:       creepData?.current_price,
      overlap:       overlapData ? r.category : null,
      overlapCount:  overlapData?.count || 0,
      history:       creepData?.price_history?.map(p => p.amount) || [r.amount],
    };
  });
}


function buildHabitsData(results) {
  const temporal = results.temporal_patterns;
  if (!temporal) return undefined;

  return {
    payday: temporal.payday || {},
    weekly: temporal.weekly || {},
  };
}


function buildAnomalies(results) {
  const anomalies = results.anomaly_detection;
  if (!anomalies) return undefined;

  const outliers = anomalies.outliers || [];
  const spikes = anomalies.spending_spikes || [];
  const newMerchants = anomalies.new_merchants || [];

  if (outliers.length === 0 && spikes.length === 0 && newMerchants.length === 0) return undefined;

  return { outliers, spikes, newMerchants };
}


function computeSavingsPotential(results, insights) {
  let savings = 0;

  // from subscription overlaps
  const subs = results.subscription_hunter;
  if (subs?.overlaps) {
    savings += subs.overlaps.reduce((sum, o) => sum + (o.potential_savings || 0), 0);
  }

  // from price creep (annual cost increases)
  if (subs?.price_creep) {
    savings += subs.price_creep
      .filter(pc => pc.price_creep_detected)
      .reduce((sum, pc) => sum + (pc.annual_cost_increase || 0), 0);
  }

  // from insight dollar impacts (non-subscription to avoid double-counting)
  if (insights?.length) {
    savings += insights
      .filter(ins => ins.dollar_impact > 0 && ins.tool_source !== 'cross_reference')
      .reduce((sum, ins) => sum + (ins.dollar_impact || 0), 0);
  }

  // from spending spikes (excess above baseline)
  const spikes = results.anomaly_detection?.spending_spikes;
  if (spikes?.length) {
    savings += spikes.reduce((sum, s) => {
      const excess = (s.recent_month_total || 0) - (s.prior_avg || 0);
      return sum + Math.max(0, excess) * 12;
    }, 0);
  }

  return Math.round(savings);
}
