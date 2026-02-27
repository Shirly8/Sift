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


export function buildPatternCards(results) {
  const correlations = results.correlation_engine;
  if (!correlations || !Array.isArray(correlations) || correlations.length === 0) return undefined;

  // temporal context for "why" explanations + timing footers
  const temporal = results.temporal_patterns || {};
  const payday   = temporal.payday || {};
  const weekly   = temporal.weekly || {};

  return correlations.slice(0, 4).map(corr => {
    const a = corr.category_a;
    const b = corr.category_b;
    const positive = corr.correlation > 0;
    const adverb = corr.confidence === 'HIGH' ? 'strongly' : 'often';

    // base description
    let desc = positive
      ? `When **${a}** rises, **${b}** tends to follow — they ${adverb} move in lockstep.`
      : `When **${a}** goes up, **${b}** tends to drop — they ${adverb} move in opposite directions.`;

    // timing from temporal data
    let timing = '';
    const cats = [a.toLowerCase(), b.toLowerCase()];
    const weekendCats = ['dining', 'entertainment', 'shopping', 'delivery'];
    const paydayCats  = ['dining', 'shopping', 'personal care', 'delivery', 'entertainment'];

    if (payday.payday_detected && cats.some(c => paydayCats.includes(c))) {
      timing = 'Peaks week 1 after payday';
      desc += ` Both tend to jump in the first week after payday.`;
    } else if (weekly.weekend_spending_multiple > 1.3 && cats.some(c => weekendCats.includes(c))) {
      timing = 'Mostly on weekends';
      desc += ` Both tend to be higher on weekends.`;
    }

    return {
      catA:      a,
      catB:      b,
      desc,
      strength:  corr.confidence === 'HIGH' ? 'Strong pattern' : 'Likely pattern',
      theme:     corr.confidence === 'HIGH' ? 'pc--strong' : 'pc--moderate',
      direction: positive ? 'correlated' : 'inverse',
      timing,
    };
  });
}


export function buildSubscriptions(results) {
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
