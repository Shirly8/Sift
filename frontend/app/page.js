'use client';

import { useState } from 'react';
import StartPage from '@/components/StartPage';
import Dashboard from '@/components/Dashboard';


export default function Home() {

  // intro -> dashboard flow
  const [showIntro, setShowIntro] = useState(true);


  if (showIntro) {
    return <StartPage onUpload={() => setShowIntro(false)} />;
  }

  return <Dashboard initialShowUpload />;
}
