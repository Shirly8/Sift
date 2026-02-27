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

export function getCategoryColor(name, idx) {
  return CATEGORY_COLORS[name] || ['#CF5532','#6B8F71','#D4915E','#7B8794','#D4735A','#C4A87A','#A8B0A0'][idx % 7];
}


export function buildInsights(rawInsights) {
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


export function buildSpendingBars(results) {
  const impact = results.spending_impact;
  if (!impact?.model_valid || !impact?.impacts) return undefined;

  const impacts = impact.impacts;
  if (!impacts.length) return undefined;

  // sort by monthly_avg descending so bars show actual spending rank
  const sorted = [...impacts].sort((a, b) => (b.monthly_avg || 0) - (a.monthly_avg || 0));

  return sorted.slice(0, 7).map((imp, i) => ({
    label:      imp.category,
    avg:        Math.round(imp.monthly_avg || 0),
    color:      getCategoryColor(imp.category, i),
  }));
}


export function buildTrendData(results, profile) {
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


export function buildHabitsData(results) {
  const temporal = results.temporal_patterns;
  if (!temporal) return undefined;

  return {
    payday: temporal.payday || {},
    weekly: temporal.weekly || {},
    seasonal: temporal.seasonal || {},
  };
}


export function buildAnomalies(results) {
  const anomalies = results.anomaly_detection;
  if (!anomalies) return undefined;

  const outliers = anomalies.outliers || [];
  const spikes = anomalies.spending_spikes || [];
  const newMerchants = anomalies.new_merchants || [];

  if (outliers.length === 0 && spikes.length === 0 && newMerchants.length === 0) return undefined;

  return { outliers, spikes, newMerchants };
}


export function buildResilience(results) {
  const resilience = results.financial_resilience;
  if (!resilience?.runway || !resilience?.stress_test) return undefined;
  return resilience;
}
