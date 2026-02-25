'use client';

import { useState, useRef } from 'react';


// suggested questions
const CHIPS = [
  { label: 'What if I cancel Netflix?', q: 'What if I cancel Netflix?' },
  { label: 'Why was August so expensive?', q: 'Why was August so expensive?' },
  { label: 'Do I spend more after payday?', q: 'Do I spend more after payday?' },
  { label: 'Where can I cut back?', q: 'Where can I cut back?' },
];


// Fix #3: Safe text renderer — parses **bold** and newlines without dangerouslySetInnerHTML
function SafeText({ text }) {
  if (!text) return null;

  // split on **bold** markers and double newlines
  const parts = text.split(/(\*\*[^*]+\*\*|\n\n)/g);

  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part === '\n\n') return <br key={i} />;
    return <span key={i}>{part}</span>;
  });
}


export default function AskSift({ sessionId }) {

  const [input, setInput] = useState('');
  const [response, setResponse] = useState(null);
  const [typing, setTyping] = useState(false);
  const [showCursor, setShowCursor] = useState(false);
  const [chipsVisible, setChipsVisible] = useState(true);
  const [toolLabel, setToolLabel] = useState('');
  const [toolDone, setToolDone] = useState(false);
  const responseRef = useRef(null);


  async function handleAsk(question) {
    if (!question.trim() || typing) return;

    setInput(question);
    setChipsVisible(false);
    setResponse(null);
    setToolDone(false);
    setTyping(true);
    setShowCursor(false);

    try {
      // call backend /api/ask
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

      // type out answer — plain text, no HTML
      const answerText = data.answer || 'No response generated.';
      const words = answerText.split(' ');
      let built = '';

      setShowCursor(true);
      for (let i = 0; i < words.length; i++) {
        if (words[i] === '\n\n') { built += '\n\n'; }
        else { built += (i > 0 ? ' ' : '') + words[i]; }

        setResponse(built);
        await new Promise(r => setTimeout(r, 20 + Math.random() * 15));
      }

      setShowCursor(false);
      setResponse(built);

    } catch (err) {
      console.error('Ask error:', err);
      setResponse(`Error: ${err.message}`);
      setToolLabel('error');
      setToolDone(true);
      setShowCursor(false);

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


      {/* suggestion chips */}
      {chipsVisible && (
        <div className="flex gap-2 flex-wrap" style={{ marginTop: 12 }}>
          {CHIPS.map(c => (
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

          {/* text — safe rendering, no dangerouslySetInnerHTML */}
          {response && (
            <div className="text-sm ink-mid" style={{ lineHeight: 1.7 }}>
              <SafeText text={response} />
              {showCursor && <span className="typing-cursor" />}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
