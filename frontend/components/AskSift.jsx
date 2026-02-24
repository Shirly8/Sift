'use client';

import { useState, useRef, useMemo } from 'react';


// build question suggestions from real analysis data
function buildChips(analysisData) {
  if (!analysisData) return [];

  const chips = [];
  const results = analysisData.results || {};
  const profile = analysisData.profile || {};

  // 1. top subscription — "What if I cancel X?"
  const subs = results.subscription_hunter?.recurring || [];
  if (subs.length > 0) {
    const top = subs[0];
    chips.push({ label: `What if I cancel ${top.merchant}?`, q: `What if I cancel ${top.merchant}?` });
  }

  // 2. biggest spending category — "Break down my X spending"
  const categories = profile.category_breakdown || [];
  if (categories.length > 0) {
    const top = categories[0];
    chips.push({ label: `Break down my ${top.label} spending`, q: `Break down my ${top.label} spending` });
  }

  // 3. payday pattern — "Do I spend more after payday?"
  const payday = results.temporal_patterns?.payday;
  if (payday?.payday_detected) {
    chips.push({ label: 'Do I spend more after payday?', q: 'Do I spend more after payday?' });
  }

  // 4. spending spike — "Why was [month] so expensive?"
  const spikes = results.anomaly_detection?.spending_spikes || [];
  if (spikes.length > 0) {
    const spike = spikes[0];
    const month = spike.recent_month; // e.g. "2025-11"
    chips.push({ label: `Why did ${spike.category} spike?`, q: `Why did ${spike.category} spike in ${month}?` });
  }

  // fallback if we have fewer than 2 data-driven chips
  if (chips.length < 2) {
    chips.push({ label: 'Where can I cut back?', q: 'Where can I cut back?' });
  }

  return chips.slice(0, 4);
}


export default function AskSift({ sessionId, analysisData }) {

  const [input, setInput] = useState('');
  const [response, setResponse] = useState(null);
  const [typing, setTyping] = useState(false);
  const [chipsVisible, setChipsVisible] = useState(true);
  const [toolLabel, setToolLabel] = useState('');
  const [toolDone, setToolDone] = useState(false);
  const responseRef = useRef(null);

  const chips = useMemo(() => buildChips(analysisData), [analysisData]);


  async function handleAsk(question) {
    if (!question.trim() || typing) return;

    setInput(question);
    setChipsVisible(false);
    setResponse(null);
    setToolDone(false);
    setTyping(true);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          question: question,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Request failed');
      }

      const data = await response.json();

      // show tool being used
      setToolLabel(data.tool_used || 'analysis');

      // simulate tool lookup delay
      await new Promise(r => setTimeout(r, 600));
      setToolDone(true);
      await new Promise(r => setTimeout(r, 300));

      // type out answer
      const answerText = data.answer || 'No response generated.';
      const words = answerText.split(' ');
      let html = '';

      for (let i = 0; i < words.length; i++) {
        let w = words[i].replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        if (w === '\n\n') { html += '<br><br>'; }
        else { html += (i > 0 ? ' ' : '') + w; }

        setResponse(html + '<span class="typing-cursor"></span>');
        await new Promise(r => setTimeout(r, 20 + Math.random() * 15));
      }

      setResponse(html);

    } catch (err) {
      console.error('Ask error:', err);
      setResponse(`Error: ${err.message}`);
      setToolLabel('error');
      setToolDone(true);

    } finally {
      setTyping(false);
    }
  }


  return (
    <div className="ask-bar">

      {/* input row */}
      <div className="flex items-center gap-4">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--terra)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" />
        </svg>

        <input
          className="ask-bar__input"
          type="text"
          placeholder="Ask anything about your spending..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAsk(input)}
        />

        <button className="ask-bar__send" onClick={() => handleAsk(input)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round">
            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" />
          </svg>
        </button>
      </div>


      {/* suggestion chips — generated from real data */}
      {chipsVisible && chips.length > 0 && (
        <div className="flex gap-2 flex-wrap" style={{ marginTop: 12 }}>
          {chips.map(c => (
            <button key={c.q} className="chip" onClick={() => handleAsk(c.q)}>
              {c.label}
            </button>
          ))}
        </div>
      )}


      {/* agent response */}
      {(response || typing) && (
        <div className={`agent-response ${response || typing ? 'visible' : ''}`} ref={responseRef}>

          {/* tool badge */}
          <div className="flex items-center gap-2" style={{ marginBottom: 10 }}>
            {!toolDone ? (
              <div className="spinner" style={{ width: 14, height: 14, borderWidth: '1.5px' }} />
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2D7A2D" strokeWidth="2.5" strokeLinecap="round">
                <path d="M5 12l5 5L20 7" />
              </svg>
            )}
            <span className={`text-xs fw-600 ${toolDone ? 'ink-sage' : 'ink-terra'}`}>
              {toolDone ? 'Done' : `Checking ${toolLabel}...`}
            </span>
          </div>

          {/* text */}
          {response && (
            <div className="text-sm ink-mid" style={{ lineHeight: 1.7 }} dangerouslySetInnerHTML={{ __html: response }} />
          )}
        </div>
      )}

    </div>
  );
}
