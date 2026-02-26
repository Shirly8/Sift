'use client';

import { useState } from 'react';
import StartPage from '@/components/StartPage';
import Dashboard from '@/components/Dashboard';


export default function Home() {

  // intro -> dashboard flow
  const [showIntro, setShowIntro] = useState(true);
  const [initialSession, setInitialSession] = useState(null);
  const [initialAnalysis, setInitialAnalysis] = useState(null);


  if (showIntro) {
    return <StartPage onUpload={(sid, analysis) => {
      setInitialSession(sid);
      setInitialAnalysis(analysis);
      setShowIntro(false);
    }} />;
  }

  return <Dashboard initialSessionId={initialSession} initialAnalysisData={initialAnalysis} />;
}
