'use client';


// Shared safe text renderer — parses **bold** and double newlines without dangerouslySetInnerHTML
export default function SafeText({ text }) {
  if (!text) return null;

  const parts = text.split(/(\*\*[^*]+\*\*|\n\n)/g);

  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part === '\n\n') return <br key={i} />;
    return <span key={i}>{part}</span>;
  });
}
