'use client';

import { useState, useEffect, useRef, Fragment } from 'react';
import UploadModal from './UploadModal';
import './startpage.css';


// ghost transaction list
const TRANSACTIONS = [
    { merchant: 'UBER EATS 4F2K9', cat: 'dining', label: 'Dining', amt: '$34.50' },
    { merchant: 'LOBLAWS #1192', cat: 'grocery', label: 'Groceries', amt: '$87.23' },
    { merchant: 'NETFLIX.COM', cat: 'sub', label: 'Subscription', amt: '$22.99' },
    { merchant: 'PRESTO TRANSIT', cat: 'transport', label: 'Transport', amt: '$12.00' },
    { merchant: 'STARBUCKS #8834', cat: 'dining', label: 'Dining', amt: '$6.75' },
    { merchant: 'METRO INC ON', cat: 'grocery', label: 'Groceries', amt: '$52.10' },
    { merchant: 'SPOTIFY P1A8F2', cat: 'sub', label: 'Subscription', amt: '$11.99' },
    { merchant: 'DOORDASH*PAD THAI', cat: 'dining', label: 'Dining', amt: '$28.40' },
    { merchant: 'SHELL STN 0442', cat: 'transport', label: 'Transport', amt: '$65.00' },
];

// pipeline steps
const PIPELINE = [
    { num: '01', name: 'Ingest', desc: 'Auto-detects bank format. Cleans merchants, dedupes, scores quality.', tags: [{ label: 'Deterministic', type: 'rules' }] },
    { num: '02', name: 'Categorize', desc: 'Rules handle 70% at zero cost. LLM only for the ambiguous rest.', tags: [{ label: 'Rules', type: 'rules' }, { label: 'LLM', type: 'llm' }] },
    { num: '03', name: 'Plan', desc: 'Agent profiles your data. Decides which tools to run and which to skip.', tags: [{ label: 'Agent', type: 'agent' }] },
    { num: '04', name: 'Analyze', desc: "Five statistical tools with data minimums. Skips what it can't trust.", tags: [{ label: 'Statistical', type: 'stats' }] },
    { num: '05', name: 'Synthesize', desc: 'Cross-references all results. Ranks insights by annual dollar impact.', tags: [{ label: 'LLM', type: 'llm' }] },
    { num: '06', name: 'Ask', desc: 'Follow-ups route to real computation. LLM explains — never invents.', tags: [{ label: 'Agent', type: 'agent' }, { label: 'LLM', type: 'llm' }] },
];

// spending bars for dashboard preview
const SPENDING_BARS = [
    { label: 'Dining', width: 78, color: 'var(--terra)', amt: '$1,420' },
    { label: 'Groceries', width: 62, color: 'var(--sage)', amt: '$1,140' },
    { label: 'Transport', width: 38, color: 'var(--sand)', amt: '$690' },
    { label: 'Shopping', width: 30, color: 'var(--slate)', amt: '$547' },
    { label: 'Subs', width: 20, color: 'var(--terra-muted)', amt: '$375' },
];

// insight cards
const INSIGHTS = [
    { rank: 1, impact: '$2,250/yr', tag: 'high', tagLabel: 'Reliable', title: '8 active subscriptions at $187/mo', desc: 'Netflix has increased 43.7% since you subscribed. Three streaming services overlap at $53/mo.' },
    { rank: 2, impact: '$1,440/yr', tag: 'high', tagLabel: 'Reliable', title: 'Payday spending concentration', desc: '40% of discretionary budget spent within 3 days of deposit, 9 of 11 months.' },
    { rank: 3, impact: '$960/yr', tag: 'med', tagLabel: 'Likely', title: 'Groceries ↔ Delivery inverse', desc: 'When grocery spending rises, delivery drops proportionally — a strong, consistent pattern.' },
];

// philosophy table rows
const PHIL_ROWS = [
    { system: 'Find patterns across 12 months of data', human: 'Decide which patterns matter to your life' },
    { system: 'Quantify the dollar impact of each pattern', human: 'Decide which trade-offs are worth making' },
    { system: 'Rank insights by statistical confidence', human: 'Decide if $53/mo in streaming brings you joy' },
    { system: 'Detect behavioral triggers and cycles', human: 'Decide if the behavior is intentional' },
];



export default function StartPage({ onUpload }) {


    // scroll state
    const [scrolled, setScrolled] = useState(false);

    // animation triggers
    const [flowVisible, setFlowVisible] = useState(false);

    // modal state for upload
    const [showUploadModal, setShowUploadModal] = useState(false);

    // refs
    const containerRef = useRef(null);



    // nav scroll background
    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 60);
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);


    // scroll reveal — adds .visible to .reveal elements on intersection
    useEffect(() => {
        if (!containerRef.current) return;

        const obs = new IntersectionObserver((entries) => {
            entries.forEach(e => {
                if (e.isIntersecting) {
                    e.target.classList.add('visible');
                    obs.unobserve(e.target);
                }
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

        containerRef.current.querySelectorAll('.reveal').forEach(el => obs.observe(el));
        return () => obs.disconnect();
    }, []);


    // animation triggers — consolidated observer for all data-animate elements
    useEffect(() => {
        if (!containerRef.current) return;

        const obs = new IntersectionObserver((entries) => {
            entries.forEach(e => {
                if (!e.isIntersecting) return;
                const el = e.target;
                const type = el.dataset.animate;

                // pipeline flow line
                if (type === 'pipeline') {
                    setFlowVisible(true);
                }

                // SVG polyline draw
                if (type === 'svg-lines') {
                    el.querySelectorAll('.anim-line').forEach((line, i) => {
                        const svg = line;
                        setTimeout(() => {
                            svg.style.transition = 'stroke-dashoffset 1.4s cubic-bezier(0.22,1,0.36,1)';
                            svg.style.strokeDashoffset = '0';
                        }, i * 200);
                    });
                }

                // payday bar heights
                if (type === 'payday') {
                    el.querySelectorAll('.payday-bar').forEach((bar, i) => {
                        const b = bar;
                        setTimeout(() => { b.style.height = b.dataset.h + 'px'; }, i * 150);
                    });
                }

                // dashboard spending bar widths
                if (type === 'dash') {
                    el.querySelectorAll('.dash-bar-fill').forEach((fill, i) => {
                        const f = fill;
                        setTimeout(() => { f.style.width = f.dataset.width + '%'; }, i * 100);
                    });
                }

                // ghost transaction list — add system-visible after visible
                if (type === 'ghost') {
                    setTimeout(() => { el.classList.add('system-visible'); }, 600);
                }

                obs.unobserve(e.target);
            });
        }, { threshold: 0.25 });

        containerRef.current.querySelectorAll('[data-animate]').forEach(el => obs.observe(el));
        return () => obs.disconnect();
    }, []);



    // open upload modal
    const openUploadModal = () => {
        setShowUploadModal(true);
    };



    return (
        <div ref={containerRef}>


            {/* UPLOAD MODAL */}
            <UploadModal
                open={showUploadModal}
                onClose={() => setShowUploadModal(false)}
                onComplete={(sid, analysis) => {
                    setShowUploadModal(false);
                    onUpload?.(sid, analysis);
                }}
            />


            {/* texture overlay */}
            <div className="texture" />


            {/* NAV */}
            <nav className={`nav ${scrolled ? 'scrolled' : ''}`}>
                <span className="nav-logo">Sift</span>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <a href="https://github.com/Shirly8/Sift" target="_blank" rel="noopener noreferrer" className="icon-btn" style={{ color: 'var(--ink-soft)' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
                        </svg>
                    </a>
                    <button className="nav-cta" onClick={openUploadModal}>Upload CSV</button>
                </div>
            </nav>



            {/* ====== OPENING ====== */}
            <section className="opening">
                <div className="opening__logo">Sift</div>
                <div className="opening__sub">Your money, actually understood</div>
                <div className="opening__scroll">
                    <span className="opening__scroll-text">Scroll</span>
                    <div className="opening__scroll-line" />
                </div>
            </section>



            {/* ====== PROVOCATION ====== */}
            <section className="provocation">
                <div className="prov-copy">
                    <div className="prov-line prov-line--1 reveal">
                        ~50 transactions a month.<br />
                        Your bank gives you a list.
                    </div>
                    <div className="prov-line prov-line--2 reveal">
                        Same format since 2006. Date, merchant, amount, scroll. But your spending data
                        isn&apos;t just line items — it&apos;s behavioral data. Correlations between categories,
                        subscriptions quietly increasing, cycles tied to your paycheck. Patterns that exist
                        in every bank statement but nobody has the tools to find.
                    </div>
                    <div className="prov-line prov-line--3 reveal">
                        Sift finds them.
                    </div>
                </div>

                {/* ghost transaction list */}
                <div className="prov-ghost reveal" data-animate="ghost">
                    <div className="prov-ghost__header">
                        <span>Recent Transactions</span>
                        <span>Amount</span>
                    </div>
                    {TRANSACTIONS.map((txn, i) => (
                        <div key={i} className={`prov-txn prov-txn--${txn.cat}`}>
                            <span className="prov-txn__merchant">{txn.merchant}</span>
                            <span className="prov-txn__cat">{txn.label}</span>
                            <span className="prov-txn__amt">{txn.amt}</span>
                        </div>
                    ))}
                    <div className="prov-ghost__footer">3 categories identified · 2 patterns detected</div>
                </div>
            </section>


            <div className="rule reveal" />



            {/* ====== THESIS ====== */}
            <section className="thesis">
                <div className="section-label reveal">The idea</div>
                <p className="thesis__text reveal">
                    Understanding your finances is personal. Where you spend, why you spend, what
                    trade-offs feel right — <strong>that will always be human.</strong>
                    <br /><br />
                    But scanning 600 transactions for price creep? Cross-referencing categories across
                    11 months? Detecting behavioral cycles tied to your paycheck? That&apos;s not human
                    work. <em>That&apos;s exactly what a system should do.</em>
                    <br /><br />
                    Sift handles the cognitive load — the statistical analysis, the pattern recognition,
                    the anomaly detection. Then it shows you what it found. You decide what matters.
                </p>
            </section>


            <div className="rule reveal" />



            {/* ====== PATTERNS ====== */}

            {/* pattern 1: correlation */}
            <section className="pattern">
                <div className="pattern__stat reveal">
                    <div className="pattern__stat-number">&minus;0.72</div>
                    <div className="pattern__stat-unit">Spending correlation</div>
                    <div className="pattern-viz" data-animate="svg-lines">
                        <svg width="200" height="80" viewBox="0 0 200 80" fill="none">
                            <polyline points="0,60 30,52 60,48 90,38 120,30 150,22 180,18 200,12"
                                stroke="var(--sage)" strokeWidth="2" fill="none" strokeLinecap="round"
                                strokeDasharray="300" strokeDashoffset="300" className="anim-line" />
                            <text x="200" y="10" fontSize="9" fill="var(--sage)" fontWeight="600" textAnchor="end" fontFamily="Plus Jakarta Sans">Groceries</text>
                            <polyline points="0,20 30,28 60,34 90,42 120,50 150,58 180,62 200,68"
                                stroke="var(--terra)" strokeWidth="2" fill="none" strokeLinecap="round"
                                strokeDasharray="300" strokeDashoffset="300" className="anim-line" />
                            <text x="200" y="76" fontSize="9" fill="var(--terra)" fontWeight="600" textAnchor="end" fontFamily="Plus Jakarta Sans">Delivery</text>
                            <line x1="0" y1="78" x2="200" y2="78" stroke="var(--border)" strokeWidth="1" />
                        </svg>
                    </div>
                </div>
                <div className="pattern__text reveal">
                    <div className="pattern__label">Spending connection</div>
                    <div className="pattern__title">Groceries and delivery move in opposite directions</div>
                    <div className="pattern__desc">
                        When one rises $80, the other drops $60. Cook more in a month, save roughly $80.
                        Nobody spots these patterns by scrolling a bank statement. Sift can.
                    </div>
                </div>
            </section>


            {/* pattern 2: price creep */}
            <section className="pattern pattern--reverse">
                <div className="pattern__stat reveal">
                    <div className="pattern__stat-number">$84</div>
                    <div className="pattern__stat-unit">Per year, unchosen</div>
                    <div className="pattern-viz" data-animate="svg-lines">
                        <svg width="200" height="80" viewBox="0 0 200 80" fill="none">
                            <polyline points="0,68 40,68 40,54 80,54 80,40 130,40 130,22 200,22"
                                stroke="var(--terra)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"
                                strokeDasharray="400" strokeDashoffset="400" className="anim-line" />
                            <text x="10" y="64" fontSize="9" fill="var(--ink-muted)" fontFamily="Plus Jakarta Sans">$15.99</text>
                            <text x="50" y="50" fontSize="9" fill="var(--ink-muted)" fontFamily="Plus Jakarta Sans">$16.99</text>
                            <text x="90" y="36" fontSize="9" fill="var(--ink-muted)" fontFamily="Plus Jakarta Sans">$17.99</text>
                            <text x="140" y="18" fontSize="9" fill="var(--terra)" fontWeight="600" fontFamily="Plus Jakarta Sans">$22.99</text>
                            <line x1="0" y1="78" x2="200" y2="78" stroke="var(--border)" strokeWidth="1" />
                            <text x="0" y="78" fontSize="8" fill="var(--ink-faint)" dy="10" fontFamily="Plus Jakarta Sans">2023</text>
                            <text x="190" y="78" fontSize="8" fill="var(--ink-faint)" dy="10" textAnchor="end" fontFamily="Plus Jakarta Sans">2024</text>
                        </svg>
                    </div>
                </div>
                <div className="pattern__text reveal">
                    <div className="pattern__label">Price creep</div>
                    <div className="pattern__title">Netflix: $15.99 to $22.99. You didn&apos;t notice.</div>
                    <div className="pattern__desc">
                        Each bump was small enough to ignore. Annualized: $84 you never chose to spend.
                        Multiply across 8 subscriptions and the number gets uncomfortable.
                    </div>
                </div>
            </section>


            {/* pattern 3: anomaly detection */}
            <section className="pattern">
                <div className="pattern__stat reveal">
                    <div className="pattern__stat-number">$340</div>
                    <div className="pattern__stat-unit">Flagged instantly</div>
                    <div className="pattern-viz">
                        <svg width="200" height="80" viewBox="0 0 200 80" fill="none">
                            {/* normal dots */}
                            <circle cx="10" cy="58" r="4" fill="var(--surface-alt)" />
                            <circle cx="30" cy="62" r="3.5" fill="var(--surface-alt)" />
                            <circle cx="48" cy="55" r="5" fill="var(--surface-alt)" />
                            <circle cx="68" cy="60" r="4" fill="var(--surface-alt)" />
                            <circle cx="86" cy="56" r="3" fill="var(--surface-alt)" />
                            <circle cx="104" cy="63" r="4.5" fill="var(--surface-alt)" />
                            <circle cx="122" cy="58" r="3.5" fill="var(--surface-alt)" />
                            {/* outlier */}
                            <circle cx="145" cy="18" r="8" fill="none" stroke="var(--terra)" strokeWidth="2" strokeDasharray="4 2" />
                            <circle cx="145" cy="18" r="4" fill="var(--terra)" />
                            <text x="160" y="22" fontSize="9" fill="var(--terra)" fontWeight="600" fontFamily="Plus Jakarta Sans">$340</text>
                            {/* normal continues */}
                            <circle cx="170" cy="60" r="3.5" fill="var(--surface-alt)" />
                            <circle cx="190" cy="57" r="4" fill="var(--surface-alt)" />
                            <line x1="0" y1="78" x2="200" y2="78" stroke="var(--border)" strokeWidth="1" />
                        </svg>
                    </div>
                </div>
                <div className="pattern__text reveal">
                    <div className="pattern__label">Anomaly detection</div>
                    <div className="pattern__title">A charge you&apos;d miss scrolling</div>
                    <div className="pattern__desc">
                        New merchant. Three times your average transaction. Sift flags outliers, spending
                        spikes, and merchants you&apos;ve never used before — the things that hide in plain
                        sight on a bank statement.
                    </div>
                </div>
            </section>


            {/* pattern 4: payday cycle */}
            <section className="pattern pattern--center">
                <div className="pattern__stat reveal">
                    <div className="pattern__stat-number">40%</div>
                    <div className="pattern__stat-unit">Of discretionary budget</div>
                    <div className="pattern-viz">
                        <div className="payday-bars" data-animate="payday">
                            <div className="payday-bar-group">
                                <div className="payday-bar-pct">40%</div>
                                <div className="payday-bar" data-h="64" style={{ background: 'var(--terra)' }} />
                                <div className="payday-bar-label">Days 1–3</div>
                            </div>
                            <div className="payday-bar-group">
                                <div className="payday-bar-pct">35%</div>
                                <div className="payday-bar" data-h="52" style={{ background: 'var(--sand)' }} />
                                <div className="payday-bar-label">Days 4–14</div>
                            </div>
                            <div className="payday-bar-group">
                                <div className="payday-bar-pct">25%</div>
                                <div className="payday-bar" data-h="36" style={{ background: 'var(--surface-alt)' }} />
                                <div className="payday-bar-label">Days 15–30</div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="pattern__text reveal" style={{ textAlign: 'center' }}>
                    <div className="pattern__title">Spent within 3 days of payday. Every month.</div>
                    <div className="pattern__desc">
                        9 of 11 months. Whether that&apos;s a problem is your call, not ours.
                        The system counts. You interpret.
                    </div>
                </div>
            </section>


            <div className="rule reveal" />



            {/* ====== DASHBOARD PREVIEW ====== */}
            <section className="preview-section">
                <div className="section-label reveal">What you see</div>

                <div className="dashboard-frame reveal" data-animate="dash">

                    {/* chrome bar */}
                    <div className="dash-chrome">
                        <span className="dash-chrome__logo">Sift</span>
                        <div className="dash-chrome__right">
                            <span className="dash-chrome__badge"><span className="dot" /> 847 transactions</span>
                            <span className="dash-chrome__btn">Upload CSV</span>
                        </div>
                    </div>

                    {/* metrics */}
                    <div className="dash-metrics">
                        <div className="dash-metric">
                            <div className="dash-metric__label">Total Spent</div>
                            <div className="dash-metric__val">$4,847</div>
                            <div className="dash-metric__sub">Jan — Nov 2024</div>
                        </div>
                        <div className="dash-metric">
                            <div className="dash-metric__label">Monthly Avg</div>
                            <div className="dash-metric__val">$441</div>
                            <div className="dash-metric__sub">across 14 categories</div>
                        </div>
                        <div className="dash-metric">
                            <div className="dash-metric__label">Biggest Swing</div>
                            <div className="dash-metric__val">Dining</div>
                            <div className="dash-metric__sub">32% of variance</div>
                        </div>
                        <div className="dash-metric">
                            <div className="dash-metric__label">Could Save</div>
                            <div className="dash-metric__val dash-metric__val--sage">$2,250</div>
                            <div className="dash-metric__sub">per year identified</div>
                        </div>
                    </div>

                    {/* ask bar */}
                    <div className="dash-ask">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" strokeWidth="2" strokeLinecap="round">
                            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                        <span className="dash-ask__text">Ask Sift anything about your spending...</span>
                        <div className="dash-ask__chips">
                            <span className="dash-ask__chip">Subscriptions</span>
                            <span className="dash-ask__chip">Trends</span>
                            <span className="dash-ask__chip">Savings</span>
                        </div>
                    </div>

                    {/* body — bars + insights */}
                    <div className="dash-body">
                        <div className="dash-bars">
                            <div className="dash-bars__title">Spending by Category</div>
                            {SPENDING_BARS.map((bar, i) => (
                                <div key={i} className="dash-bar-row">
                                    <span className="dash-bar-label">{bar.label}</span>
                                    <div className="dash-bar-track">
                                        <div className="dash-bar-fill" data-width={bar.width} style={{ background: bar.color }} />
                                    </div>
                                    <span className="dash-bar-amt">{bar.amt}</span>
                                </div>
                            ))}
                        </div>

                        <div className="dash-insights">
                            {INSIGHTS.map((ins, i) => (
                                <div key={i} className="dash-insight">
                                    <div className="dash-insight__rank">{ins.rank}</div>
                                    <div className="dash-insight__impact">{ins.impact}</div>
                                    <div className={`dash-insight__tag dash-insight__tag--${ins.tag}`}>{ins.tagLabel}</div>
                                    <div className="dash-insight__title">{ins.title}</div>
                                    <div className="dash-insight__desc">{ins.desc}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>


            <div className="rule reveal" />



            {/* ====== PIPELINE ====== */}
            <section className="pipeline">
                <div className="section-label">How the agent works</div>

                <div
                    className={`pipeline__flow ${flowVisible ? 'flow-visible' : ''}`}
                    data-animate="pipeline"
                >
                    {PIPELINE.map((step, i) => (
                        <div key={i} className="pipe-step reveal">
                            <div className="pipe-step__dot" />
                            <div className="pipe-step__num">{step.num}</div>
                            <div className="pipe-step__name">{step.name}</div>
                            <div className="pipe-step__desc">{step.desc}</div>
                            <div className="pipe-step__tags">
                                {step.tags.map((tag, j) => (
                                    <span key={j} className={`pipe-step__tag pipe-step__tag--${tag.type}`}>{tag.label}</span>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </section>


            <div className="rule reveal" />



            {/* ====== AGENT LOG ====== */}
            <section className="agent-log">
                <div className="section-label">Agent decision log</div>
                <div className="agent-log__grid">

                    {/* log entries */}
                    <div className="agent-log__entries">
                        <div className="log-entry reveal">scanning <span className="val">847</span> transactions</div>
                        <div className="log-entry reveal"><span className="val">11</span> months of data · <span className="val">14</span> categories · income <span className="on">detected</span></div>
                        <div className="log-entry reveal"><span className="dim">───────────────────────────────</span></div>
                        <div className="log-entry reveal"><span className="on">✓</span> temporal_patterns <span className="dim">— 11 mo ≥ 3 mo minimum</span></div>
                        <div className="log-entry reveal"><span className="on">✓</span> anomaly_detection <span className="dim">— always enabled</span></div>
                        <div className="log-entry reveal"><span className="on">✓</span> subscription_hunter <span className="dim">— recurring charges detected</span></div>
                        <div className="log-entry reveal"><span className="on">✓</span> correlation_engine <span className="dim">— 14 categories, 11 months</span></div>
                        <div className="log-entry reveal"><span className="on">✓</span> impact_attribution <span className="dim">— 11 mo ≥ 6 mo minimum</span></div>
                        <div className="log-entry reveal"><span className="dim">───────────────────────────────</span></div>
                        <div className="log-entry reveal">full suite enabled · executing <span className="val">5</span> tools</div>
                        <div className="log-entry reveal">done in <span className="val">2.3s</span></div>
                    </div>

                    {/* aside explanation */}
                    <div className="agent-log__aside reveal">
                        <div className="agent-log__aside-title">More data, deeper analysis. Less data, honest limits.</div>
                        Give it 6 weeks of transactions and it runs only anomaly detection and subscription
                        hunting. It tells you exactly which tools were skipped and why — &quot;correlation
                        analysis requires 3+ months of data.&quot;
                        <br /><br />
                        Two weeks? You still get a focused report on what the data can support. Twelve months?
                        Full suite — all five tools, cross-referenced. The agent scales its analysis to match
                        your data. Nothing more, nothing less.
                    </div>
                </div>
            </section>


            <div className="rule reveal" />



            {/* ====== PHILOSOPHY ====== */}
            <section className="philosophy">
                <div className="phil-grid">

                    {/* left — headline + body */}
                    <div>
                        <div className="phil-line phil-line--1 reveal">Sift does the work.</div>
                        <div className="phil-line phil-line--2 reveal">You make the call.</div>
                        <div className="phil-rule reveal" />
                        <p className="phil-body reveal">
                            Sift might flag that you spend 40% of your budget within 3 days of payday.
                            But maybe those days are date night and your kid&apos;s soccer.{' '}
                            <strong>That context? Only you have it.</strong> Sift finds the patterns.
                            You decide what they mean.
                        </p>
                    </div>

                    {/* right — comparison table */}
                    <div className="phil-right reveal" style={{ transitionDelay: '0.3s' }}>
                        <div className="phil-table">
                            <div className="phil-col-head">The system does</div>
                            <div className="phil-col-head">You do</div>
                            {PHIL_ROWS.map((row, i) => (
                                <Fragment key={i}>
                                    <div className="phil-cell">{row.system}</div>
                                    <div className="phil-cell">{row.human}</div>
                                </Fragment>
                            ))}
                        </div>
                    </div>
                </div>
            </section>


            <div className="rule reveal" />



            {/* ====== CLOSE / CTA ====== */}
            <section className="close-section">
                <h2 className="close__title reveal">
                    Your bank statement knows more than <em>you think</em>.
                </h2>
                <p className="close__desc reveal">
                    Drop a CSV. Get back the patterns, the correlations, the price creep — everything
                    that was always there but never visible. Takes about 10 seconds.
                </p>
                <button className="close__btn reveal" onClick={openUploadModal}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M12 5v14M5 12l7-7 7 7" />
                    </svg>
                    Upload CSV
                </button>
                <div className="close__banks reveal">
                    <span className="close__banks-label">Works with</span>
                    <span>
                        <span className="close__bank">RBC</span><span className="close__bank-sep">·</span>
                        <span className="close__bank">TD</span><span className="close__bank-sep">·</span>
                        <span className="close__bank">BMO</span><span className="close__bank-sep">·</span>
                        <span className="close__bank">Any CSV</span>
                    </span>
                </div>
            </section>



            {/* FOOTER */}
            <footer className="intro-footer">
                <span className="nav-logo" style={{ fontSize: 16 }}>Sift</span>
                <span>Spending intelligence. Not spending judgment.</span>
                <a
                    href="https://github.com/Shirly8/Sift"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 32,
                        height: 32,
                        cursor: 'pointer'
                    }}
                    title="View on GitHub"
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--ink-soft)' }}>
                        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.016 12.016 0 0024 12c0-6.63-5.37-12-12-12z" />
                    </svg>
                </a>
            </footer>


        </div>
    );
}
