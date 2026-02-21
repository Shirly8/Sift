'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface ModalsProps {
  showEval: boolean;
  showCSV: boolean;
  showTrain: boolean;
  showSettings?: boolean;
  onCloseEval: () => void;
  onCloseCSV: () => void;
  onCloseTrain: () => void;
  onCloseSettings?: () => void;
  onShowEval?: () => void;
}

export default function Modals({
  showEval,
  showCSV,
  showTrain,
  showSettings = false,
  onCloseEval,
  onCloseCSV,
  onCloseTrain,
  onCloseSettings,
  onShowEval,
}: ModalsProps) {
  const [csvProgress, setCsvProgress] = useState<number | null>(null);
  const [csvDone, setCsvDone] = useState(false);
  const [trainProgress, setTrainProgress] = useState<number | null>(null);
  const [trainLogs, setTrainLogs] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);
  const [evalData, setEvalData] = useState<any>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [trainFile, setTrainFile] = useState<File | null>(null);
  const [trainMode, setTrainMode] = useState<'quick' | 'full' | null>(null);
  const [hasExistingModel, setHasExistingModel] = useState(false);

  // Generate synthetic reviews
  const [csvTab, setCsvTab] = useState<'upload' | 'generate'>('upload');
  const [restaurantName, setRestaurantName] = useState('');
  const [cuisine, setCuisine] = useState('');
  const [description, setDescription] = useState('');
  const [reviewCount, setReviewCount] = useState(5);
  const [generatedReviews, setGeneratedReviews] = useState<any[]>([]);
  const [generateProgress, setGenerateProgress] = useState<number | null>(null);
  const [generateFileName, setGenerateFileName] = useState<string>('');
  const [uploadResults, setUploadResults] = useState<any[]>([]);

  // LLM Settings
  const [llmModel, setLlmModel] = useState('');
  const [llmApiKey, setLlmApiKey] = useState('');
  const [llmBaseUrl, setLlmBaseUrl] = useState('http://localhost:11434');
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [llmDetected, setLlmDetected] = useState<boolean | null>(null);
  const [testProgress, setTestProgress] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Check if user has existing trained model
  useEffect(() => {
    fetch('/api/check-model')
      .then((res) => res.json())
      .then((data) => setHasExistingModel(data.exists))
      .catch(() => setHasExistingModel(false));
  }, []);

  useEffect(() => {
    fetch('/data/evaluation_results.json')
      .then((res) => res.json())
      .then((data) => setEvalData(data))
      .catch((err) => console.error('Failed to load evaluation data:', err));
  }, []);

  // Load current LLM settings from environment
  useEffect(() => {
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => {
        if (data.llmModel) setLlmModel(data.llmModel);
        if (data.llmBaseUrl) setLlmBaseUrl(data.llmBaseUrl);
      })
      .catch((err) => console.error('Failed to load settings:', err));
  }, []);

  // Detect LLM availability
  useEffect(() => {
    const checkLlmAvailability = async () => {
      try {
        const settingsRes = await fetch('/api/settings');
        const settings = await settingsRes.json();
        const baseUrl = settings.llmBaseUrl || 'http://localhost:11434';

        // Try to ping the LLM endpoint
        const response = await fetch(`${baseUrl}/api/tags`, {
          method: 'GET',
          signal: AbortSignal.timeout(3000),
        });

        setLlmDetected(response.ok);
      } catch (error) {
        setLlmDetected(false);
      }
    };

    // Check on mount and when CSV modal opens
    if (showCSV) {
      checkLlmAvailability();
    }
  }, [showCSV]);

  const handleCSVUpload = async () => {
    if (!csvFile) return;

    setCsvProgress(0);
    setCsvDone(false);

    try {
      const formData = new FormData();
      formData.append('file', csvFile);
      formData.append('restaurantName', csvFile.name.replace('.csv', ''));

      // Simulate progress while uploading
      const progressInterval = setInterval(() => {
        setCsvProgress((p) => {
          if (p === null) return 0;
          const next = Math.min(95, p + Math.random() * 15 + 5);
          return next;
        });
      }, 300);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);

      if (response.ok) {
        const data = await response.json();
        setCsvProgress(100);
        setCsvDone(true);
        setCsvFile(null);
        setUploadResults(data.reviews || []);
      } else {
        const error = await response.json();
        alert(`Upload failed: ${error.error}`);
        setCsvProgress(null);
      }
    } catch (error) {
      alert(`Upload error: ${error}`);
      setCsvProgress(null);
    }
  };

  const handleGenerateReviews = async () => {
    if (!restaurantName || !cuisine) {
      alert('Please enter restaurant name and cuisine');
      return;
    }

    setGenerateProgress(0);

    try {
      const progressInterval = setInterval(() => {
        setGenerateProgress((p) => {
          if (p === null) return 0;
          const next = Math.min(95, p + Math.random() * 10 + 3);
          return next;
        });
      }, 300);

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantName,
          cuisine,
          description: description || undefined,
          count: reviewCount,
        }),
      });

      clearInterval(progressInterval);

      if (response.ok) {
        const data = await response.json();
        setGeneratedReviews(data.reviews);
        setGenerateFileName(data.fileName);
        setGenerateProgress(100);
      } else {
        const error = await response.json();
        alert(`Generation failed: ${error.error}`);
        setGenerateProgress(null);
      }
    } catch (error) {
      alert(`Generation error: ${error}`);
      setGenerateProgress(null);
    }
  };

  const handleUploadGenerated = async () => {
    if (!generateFileName || generatedReviews.length === 0) return;

    setCsvProgress(0);

    try {
      const progressInterval = setInterval(() => {
        setCsvProgress((p) => {
          if (p === null) return 0;
          const next = Math.min(95, p + Math.random() * 15 + 5);
          return next;
        });
      }, 300);

      const formData = new FormData();
      const csvContent = [
        'restaurant,review,rating,date',
        ...generatedReviews.map(
          (r) =>
            `"${r.restaurant}","${r.review.replace(/"/g, '""')}",${r.rating},"${r.date}"`
        ),
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const file = new File([blob], generateFileName, { type: 'text/csv' });
      formData.append('file', file);
      formData.append('restaurantName', restaurantName);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);

      if (response.ok) {
        const data = await response.json();
        setCsvProgress(100);
        setCsvDone(true);
        setUploadResults(data.reviews || []);
        setGeneratedReviews([]);
        setGenerateFileName('');
        setRestaurantName('');
        setCuisine('');
        setDescription('');
        setCsvTab('upload');
      } else {
        const error = await response.json();
        alert(`Upload failed: ${error.error}`);
        setCsvProgress(null);
      }
    } catch (error) {
      alert(`Upload error: ${error}`);
      setCsvProgress(null);
    }
  };

  const handleSaveSettings = async () => {
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          llmModel,
          llmApiKey,
          llmBaseUrl,
        }),
      });

      if (response.ok) {
        setSettingsSaved(true);
        setTimeout(() => setSettingsSaved(false), 3000);
      } else {
        alert('Failed to save settings');
      }
    } catch (error) {
      alert(`Error saving settings: ${error}`);
    }
  };

  const handleTestEndpoint = async () => {
    setTestProgress(0);
    setTestResult(null);

    // Simulate progress animation
    const progressInterval = setInterval(() => {
      setTestProgress((p) => {
        if (p === null) return 0;
        return Math.min(90, p + Math.random() * 25);
      });
    }, 100);

    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          llmModel,
          llmApiKey,
          llmBaseUrl,
          test: true,
        }),
      });

      const data = await response.json();
      clearInterval(progressInterval);

      if (data.success) {
        setTestProgress(100);
        setTestResult({
          success: true,
          message: data.message,
        });
        setTimeout(() => {
          setTestProgress(null);
          setTestResult(null);
        }, 3000);
      } else {
        setTestProgress(null);
        setTestResult({
          success: false,
          message: data.error || 'Connection test failed',
        });
        setTimeout(() => setTestResult(null), 5000);
      }
    } catch (error) {
      clearInterval(progressInterval);
      setTestProgress(null);
      setTestResult({
        success: false,
        message: `Connection error: ${error}`,
      });
      setTimeout(() => setTestResult(null), 5000);
    }
  };

  const handleTrain = async (mode: 'quick' | 'full') => {
    if (!trainFile) return;

    setTrainProgress(0);
    setTrainLogs([]);
    setTrainMode(mode);

    try {
      const formData = new FormData();
      formData.append('file', trainFile);
      formData.append('mode', mode);

      const response = await fetch('/api/train', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        alert(`Training failed: ${error.error}`);
        setTrainProgress(null);
        return;
      }

      // Stream logs from response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            try {
              const data = JSON.parse(line);
              if (data.log) {
                setTrainLogs((prev) => [...prev, data.log]);
              }
              if (data.progress) {
                setTrainProgress(data.progress);
              }
            } catch (e) {
              // Skip invalid JSON lines
            }
          }
        }
      }

      setTrainProgress(100);
    } catch (error) {
      alert(`Training error: ${error}`);
      setTrainProgress(null);
    }
  };

  if (!mounted) return null;

  const modalOverlay = (open: boolean, onClose: () => void, children: React.ReactNode) => {
    if (!open) return null;
    return createPortal(
      <div
        className="fixed inset-0 z-[200000] flex items-center justify-center bg-black bg-opacity-35"
        onClick={onClose}
      >
        <div onClick={(e) => e.stopPropagation()}>{children}</div>
      </div>,
      document.body
    );
  };

  return (
    <>
      {/* ═══ MODEL EVALUATION MODAL ═══ */}
      {modalOverlay(
        showEval,
        onCloseEval,
        <div className="bg-white rounded-2xl border border-neutral-border w-[680px] max-h-[80vh] overflow-y-auto shadow-2xl p-28">
          <div className="flex items-start justify-between mb-20">
            <div>
              <h2 className="font-display text-2xl font-normal mb-4">Model Performance</h2>
              <p className="text-sm text-neutral-text-secondary">
                DeBERTa fine-tuned on SemEval 2014 + 1,247 real reviews
              </p>
            </div>
            <button
              onClick={onCloseEval}
              className="w-8 h-8 flex items-center justify-center text-neutral-text-muted hover:text-terracotta transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-4 gap-10 mb-20">
            {evalData && [
              { label: 'Accuracy', value: `${(evalData.accuracy * 100).toFixed(1)}%` },
              { label: 'Precision', value: evalData.precision.toFixed(2) },
              { label: 'Recall', value: evalData.recall.toFixed(2) },
              { label: 'Weighted F1', value: evalData.f1.toFixed(2) },
            ].map((m) => (
              <div
                key={m.label}
                className="text-center p-14 bg-neutral-hover rounded-xl"
              >
                <div className="text-xs font-semibold text-neutral-text-secondary uppercase tracking-wide mb-4">
                  {m.label}
                </div>
                <div className="font-display text-2xl text-neutral-text">{m.value}</div>
              </div>
            ))}
            {!evalData && [
              { label: 'Accuracy', value: '—' },
              { label: 'Precision', value: '—' },
              { label: 'Recall', value: '—' },
              { label: 'Weighted F1', value: '—' },
            ].map((m) => (
              <div
                key={m.label}
                className="text-center p-14 bg-neutral-hover rounded-xl"
              >
                <div className="text-xs font-semibold text-neutral-text-secondary uppercase tracking-wide mb-4">
                  {m.label}
                </div>
                <div className="font-display text-2xl text-neutral-text">{m.value}</div>
              </div>
            ))}
          </div>

          {/* Per-Aspect F1 Scores */}
          <h4 className="text-base font-semibold mb-12">Per-Aspect F1 Scores</h4>
          {evalData && Object.entries(evalData.per_aspect).map(([name, aspect]: any) => (
            <div key={name} className="flex items-center gap-10 mb-8">
              <span className="w-60 text-sm text-neutral-text-muted font-medium whitespace-nowrap flex-shrink-0">
                {name}
              </span>
              <div className="flex-1 h-3 bg-neutral-hover rounded-sm overflow-hidden">
                <div
                  className="h-full bg-terracotta rounded-sm"
                  style={{ width: `${aspect.f1 * 100}%`, opacity: 0.55 + aspect.f1 * 0.45 }}
                />
              </div>
              <span className="text-sm font-bold w-12">{aspect.f1.toFixed(2)}</span>
            </div>
          ))}

          {/* Aspect Discovery Recall */}
          <div className="mt-16 p-16 bg-neutral-hover rounded-xl flex justify-between">
            <span className="text-sm text-neutral-text-muted">Aspect Discovery Recall</span>
            <span className="font-display text-2xl text-sage">{evalData ? `${(evalData.aspect_discovery_recall * 100).toFixed(1)}%` : '—'}</span>
          </div>
        </div>
      )}

      {/* ═══ CSV UPLOAD MODAL ═══ */}
      {modalOverlay(
        showCSV,
        onCloseCSV,
        <div className="bg-white rounded-2xl border border-neutral-border w-[660px] max-h-[80vh] overflow-y-auto shadow-2xl p-28">
          <div className="flex items-start justify-between mb-20">
            <div>
              <h2 className="font-display text-2xl font-normal mb-4">
                {csvTab === 'upload' ? 'Upload CSV' : 'Generate Synthetic Reviews'}
              </h2>
              <p className="text-sm text-neutral-text-secondary">
                {csvTab === 'upload'
                  ? 'Batch analyze reviews for a new restaurant'
                  : 'Create realistic synthetic reviews using AI'}
              </p>
            </div>
            <button
              onClick={onCloseCSV}
              className="w-8 h-8 flex items-center justify-center text-neutral-text-muted hover:text-terracotta transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-8 mb-20 border-b border-neutral-border">
            <button
              onClick={() => setCsvTab('upload')}
              className={`py-12 px-4 font-semibold text-sm transition-colors ${
                csvTab === 'upload'
                  ? 'text-terracotta border-b-2 border-terracotta'
                  : 'text-neutral-text-secondary hover:text-neutral-text'
              }`}
            >
              Upload File
            </button>
            <button
              onClick={() => {
                if (llmDetected) {
                  setCsvTab('generate');
                }
              }}
              className={`py-12 px-4 font-semibold text-sm transition-colors ${
                csvTab === 'generate'
                  ? 'text-terracotta border-b-2 border-terracotta'
                  : llmDetected === false
                    ? 'text-neutral-text-muted cursor-not-allowed opacity-50'
                    : 'text-neutral-text-secondary hover:text-neutral-text'
              }`}
              title={llmDetected === false ? 'Configure LLM in Settings to enable this' : ''}
            >
              Generate AI Reviews
            </button>
          </div>

          {/* Status */}
          <div className="mb-16">
            {/* DeBERTa Backend Status */}
            <div className="flex items-center gap-6 mb-12 p-14 bg-green-bg rounded-lg border border-green-text">
              <div className="w-2 h-2 rounded-full bg-green-text" />
              <span className="text-sm font-semibold text-green-text">
                ✓ Backend detected — using DeBERTa (fast, accurate)
              </span>
            </div>

            {/* LLM Model Status */}
            <div className={`flex items-center gap-6 p-14 rounded-lg border ${
              llmDetected === null
                ? 'bg-neutral-hover border-neutral-border-inactive'
                : llmDetected
                  ? 'bg-green-bg border-green-text'
                  : 'bg-orange-50 border-orange-200'
            }`}>
              {llmDetected === null ? (
                <>
                  <div className="w-2 h-2 rounded-full bg-neutral-text-muted animate-pulse" />
                  <span className="text-sm font-semibold text-neutral-text-muted">
                    Detecting LLM model...
                  </span>
                </>
              ) : llmDetected ? (
                <>
                  <div className="w-2 h-2 rounded-full bg-green-text" />
                  <span className="text-sm font-semibold text-green-text">
                    ✓ LLM model detected — {llmModel}
                  </span>
                </>
              ) : (
                <>
                  <div className="w-2 h-2 rounded-full bg-orange-600" />
                  <span className="text-sm font-semibold text-orange-900">
                    ⚠ LLM model not detected — Configure in Settings
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Upload Tab Content */}
          {csvTab === 'upload' && (
            <>
              {/* Upload Zone */}
              {csvProgress === null && !csvDone && (
            <>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                className="hidden"
                id="csv-input"
              />
              <label
                htmlFor="csv-input"
                className="border-2 border-dashed border-neutral-border-inactive rounded-xl p-32 text-center mb-16 cursor-pointer hover:border-terracotta transition-colors block"
              >
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="mx-auto mb-10 text-neutral-text-secondary"
                >
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                </svg>
                <p className="text-md font-semibold mb-4">
                  {csvFile ? csvFile.name : 'Drop CSV file here or click to browse'}
                </p>
                <p className="text-sm text-neutral-text-secondary mb-3">
                  Required columns: <span className="font-mono bg-neutral-hover px-2 py-1 rounded">restaurant, review, rating, date</span>
                </p>
                <p className="text-xs text-neutral-text-muted">
                  Example: Restaurant Name | "Great food and service" | 5 | MM/DD/YYYY
                </p>
              </label>

              <div className="flex gap-10">
                <a
                  href="/sample_upload.csv"
                  download="sample_upload.csv"
                  className="flex-1 py-12 rounded-xl border border-neutral-border bg-white text-neutral-text font-bold text-md cursor-pointer hover:border-terracotta transition-colors text-center"
                >
                  Download Template
                </a>
                <button
                  onClick={handleCSVUpload}
                  disabled={!csvFile}
                  className="flex-1 py-12 rounded-xl border-none bg-terracotta text-white text-md font-bold cursor-pointer hover:opacity-85 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Upload & Analyze →
                </button>
              </div>
            </>
          )}

              {/* Progress */}
              {csvProgress !== null && csvProgress < 100 && (
                <div className="mb-16 animate-fade-in">
                  <div className="flex justify-between mb-6">
                    <span className="text-sm font-semibold">Processing reviews...</span>
                    <span className="text-sm font-bold text-terracotta">
                      {Math.round(csvProgress)}%
                    </span>
                  </div>
                  <div className="h-2 bg-neutral-hover rounded-sm overflow-hidden">
                    <div
                      className="h-full bg-terracotta rounded-sm transition-all"
                      style={{ width: `${csvProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Results */}
              {csvDone && (
                <div className="animate-fade-in">
                  <div className="flex items-center gap-8 mb-14">
                    <div className="w-24 h-24 rounded-full bg-green-bg flex items-center justify-center">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2D7A2D" strokeWidth="3">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    </div>
                    <span className="text-md font-bold text-green-text">
                      {uploadResults.length > 0 ? `${uploadResults.length} reviews processed successfully` : 'Reviews processed successfully'}
                    </span>
                  </div>

                  {/* Results Table */}
                  {uploadResults.length > 0 && (
                    <div className="border border-neutral-border rounded-xl overflow-hidden mb-14 max-h-72 overflow-y-auto">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="bg-neutral-hover sticky top-0">
                            <th className="text-left p-12 font-semibold text-neutral-text-secondary text-xs uppercase">
                              Review
                            </th>
                            <th className="text-center p-12 font-semibold text-neutral-text-secondary text-xs w-16">
                              Rating
                            </th>
                            <th className="text-center p-12 w-8" />
                          </tr>
                        </thead>
                        <tbody>
                          {uploadResults.map((r: any, i: number) => {
                            const rating = Number(r.rating) || 0;
                            const reviewText = (r.review || '').slice(0, 80) + ((r.review || '').length > 80 ? '…' : '');
                            return (
                              <tr key={i} className="border-t border-neutral-alt-background">
                                <td className="p-12 text-neutral-text-secondary-dark text-xs">{reviewText}</td>
                                <td className="text-center p-12">
                                  <span
                                    className="text-xs font-bold py-4 px-8 rounded-xs"
                                    style={{
                                      background: rating >= 4 ? '#EBF5EB' : rating >= 3 ? '#FFF8E8' : '#FDF0EF',
                                      color: rating >= 4 ? '#2D7A2D' : rating >= 3 ? '#8B7000' : '#B83232',
                                    }}
                                  >
                                    {rating}★
                                  </span>
                                </td>
                                <td className="text-center p-12">
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2D7A2D" strokeWidth="2.5">
                                    <path d="M20 6L9 17l-5-5" />
                                  </svg>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="flex gap-10">
                    <button className="flex-1 py-12 rounded-xl border border-neutral-border bg-white text-neutral-text font-bold text-md cursor-pointer hover:border-terracotta transition-colors">
                      Download Results CSV
                    </button>
                    <button className="flex-1 py-12 rounded-xl border-none bg-terracotta text-white font-bold text-md cursor-pointer hover:opacity-85 transition-opacity">
                      Add to Dashboard
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Generate Tab Content */}
          {csvTab === 'generate' && (
            <>
              {generateProgress === null && generatedReviews.length === 0 && (
                <>
                  <div className="space-y-14 mb-16">
                    <div>
                      <label className="block text-sm font-semibold text-neutral-text mb-6">
                        Restaurant Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., Aretti, Pai, Lavelle"
                        value={restaurantName}
                        onChange={(e) => setRestaurantName(e.target.value)}
                        className="w-full px-12 py-10 border border-neutral-border rounded-lg focus:outline-none focus:border-terracotta"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-neutral-text mb-6">
                        Cuisine Type
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., Italian, Thai, Modern European"
                        value={cuisine}
                        onChange={(e) => setCuisine(e.target.value)}
                        className="w-full px-12 py-10 border border-neutral-border rounded-lg focus:outline-none focus:border-terracotta"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-neutral-text mb-6">
                        Restaurant Description <span className="text-neutral-text-secondary font-normal">(optional)</span>
                      </label>
                      <textarea
                        placeholder="e.g., Fine dining, cozy ambiance, known for fresh ingredients, upscale pricing..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full px-12 py-10 border border-neutral-border rounded-lg focus:outline-none focus:border-terracotta resize-none"
                        rows={3}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-neutral-text mb-6">
                        Number of Reviews
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={reviewCount}
                        onChange={(e) => setReviewCount(parseInt(e.target.value) || 5)}
                        className="w-full px-12 py-10 border border-neutral-border rounded-lg focus:outline-none focus:border-terracotta"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleGenerateReviews}
                    className="w-full py-12 rounded-xl border-none bg-terracotta text-white font-bold text-md cursor-pointer hover:opacity-85 transition-opacity"
                  >
                    Generate Reviews with AI →
                  </button>
                </>
              )}

              {generateProgress !== null && generateProgress < 100 && (
                <div className="mb-16 animate-fade-in">
                  <div className="flex justify-between mb-6">
                    <span className="text-sm font-semibold">Generating reviews...</span>
                    <span className="text-sm font-bold text-terracotta">
                      {Math.round(generateProgress)}%
                    </span>
                  </div>
                  <div className="h-2 bg-neutral-hover rounded-sm overflow-hidden">
                    <div
                      className="h-full bg-terracotta rounded-sm transition-all"
                      style={{ width: `${generateProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {generateProgress === 100 && generatedReviews.length > 0 && (
                <div className="animate-fade-in">
                  <div className="flex items-center gap-8 mb-14">
                    <div className="w-24 h-24 rounded-full bg-green-bg flex items-center justify-center">
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#2D7A2D"
                        strokeWidth="3"
                      >
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    </div>
                    <span className="text-md font-bold text-green-text">
                      {generatedReviews.length} reviews generated successfully
                    </span>
                  </div>

                  <div className="border border-neutral-border rounded-xl overflow-hidden mb-14 max-h-[500px] overflow-y-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-neutral-hover sticky top-0">
                          <th className="text-left p-10 font-semibold text-neutral-text-secondary uppercase">
                            Review
                          </th>
                          <th className="text-center p-10 font-semibold text-neutral-text-secondary w-16">
                            Rating
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {generatedReviews.map((review, i) => (
                          <tr key={i} className="border-t border-neutral-alt-background hover:bg-neutral-hover">
                            <td className="p-10 text-neutral-text-secondary-dark line-clamp-2">
                              {review.review}
                            </td>
                            <td className="text-center p-10">
                              <span className="text-xs font-bold py-2 px-4 rounded-xs"
                                style={{
                                  background: review.rating >= 4 ? '#EBF5EB' : review.rating >= 3 ? '#FFF8E8' : '#FDF0EF',
                                  color: review.rating >= 4 ? '#2D7A2D' : review.rating >= 3 ? '#8B7000' : '#B83232'
                                }}>
                                {review.rating}★
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex gap-10">
                    <button
                      onClick={() => {
                        setGeneratedReviews([]);
                        setGenerateProgress(null);
                      }}
                      className="flex-1 py-12 rounded-xl border border-neutral-border bg-white text-neutral-text font-bold text-md cursor-pointer hover:border-terracotta transition-colors"
                    >
                      Generate More
                    </button>
                    <button
                      onClick={handleUploadGenerated}
                      className="flex-1 py-12 rounded-xl border-none bg-sage text-white font-bold text-md cursor-pointer hover:opacity-85 transition-opacity"
                    >
                      Upload & Analyze →
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ═══ MODEL TRAINING MODAL ═══ */}
      {modalOverlay(
        showTrain,
        onCloseTrain,
        <div className="bg-white rounded-2xl border border-neutral-border w-[620px] max-h-[80vh] overflow-y-auto shadow-2xl p-28">
          <div className="flex items-start justify-between mb-20">
            <div>
              <h2 className="font-display text-2xl font-normal mb-4">Train Custom Model</h2>
              <p className="text-sm text-neutral-text-secondary">
                Fine-tune DeBERTa on your restaurant's review data
              </p>
            </div>
            <button
              onClick={onCloseTrain}
              className="w-8 h-8 flex items-center justify-center text-neutral-text-muted hover:text-terracotta transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Model Status */}
          {trainProgress === null && (
            <>
              <div className={`flex items-center gap-6 mb-16 p-14 rounded-lg border ${
                hasExistingModel
                  ? 'bg-blue-50 border-blue-200'
                  : 'bg-orange-50 border-orange-200'
              }`}>
                <div className={`w-2 h-2 rounded-full ${hasExistingModel ? 'bg-blue-600' : 'bg-orange-600'}`} />
                <span className={`text-sm font-semibold ${hasExistingModel ? 'text-blue-900' : 'text-orange-900'}`}>
                  {hasExistingModel
                    ? '✓ Existing model found — Choose training mode'
                    : 'No existing model — Will download from Hugging Face'}
                </span>
              </div>

              {hasExistingModel && (
                <button
                  onClick={() => onShowEval?.()}
                  className="w-full py-10 mb-16 rounded-lg border border-neutral-border bg-white text-neutral-text font-semibold text-sm cursor-pointer hover:border-terracotta transition-colors"
                >
                  📊 View Model Performance
                </button>
              )}
            </>
          )}

          {/* Upload Zone */}
          {trainProgress === null && (
            <>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => setTrainFile(e.target.files?.[0] || null)}
                className="hidden"
                id="train-csv-input"
              />
              <label
                htmlFor="train-csv-input"
                className="border-2 border-dashed border-neutral-border-inactive rounded-xl p-32 text-center mb-16 cursor-pointer hover:border-terracotta transition-colors block"
              >
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="mx-auto mb-10 text-neutral-text-secondary"
                >
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                </svg>
                <p className="text-md font-semibold mb-4">
                  {trainFile ? trainFile.name : 'Drop training CSV here or click to browse'}
                </p>
                <p className="text-sm text-neutral-text-secondary mb-3">
                  Required columns: <span className="font-mono bg-neutral-hover px-2 py-1 rounded">review, aspect, sentiment</span>
                </p>
                <p className="text-xs text-neutral-text-muted">
                  Example: "Great food" | Food | Positive
                </p>
              </label>

              <div className="flex gap-10 mb-16">
                <a
                  href="/sample_training.csv"
                  download="sample_training.csv"
                  className="flex-1 py-12 rounded-xl border border-neutral-border bg-white text-neutral-text font-bold text-md cursor-pointer hover:border-terracotta transition-colors text-center"
                >
                  Download Template
                </a>
              </div>

              {trainFile && (
                <>
                  {hasExistingModel ? (
                    <>
                      <p className="text-sm text-neutral-text-secondary mb-12">
                        Choose training mode. <strong>Quick</strong> is faster but may cause catastrophic forgetting. <strong>Full</strong> combines all data for better quality.
                      </p>
                      <div className="flex gap-10">
                        <button
                          onClick={() => handleTrain('quick')}
                          className="flex-1 py-12 rounded-xl border-2 border-terracotta bg-white text-terracotta font-bold text-md cursor-pointer hover:bg-terracotta hover:text-white transition-colors"
                        >
                          ⚡ Quick Retrain (2 min)
                        </button>
                        <button
                          onClick={() => handleTrain('full')}
                          className="flex-1 py-12 rounded-xl border-none bg-sage text-white font-bold text-md cursor-pointer hover:opacity-85 transition-opacity"
                        >
                          ✓ Full Retrain (5 min)
                        </button>
                      </div>
                    </>
                  ) : (
                    <button
                      onClick={() => handleTrain('full')}
                      className="w-full py-12 rounded-xl border-none bg-terracotta text-white text-md font-bold cursor-pointer hover:opacity-85 transition-opacity"
                    >
                      Train New Model →
                    </button>
                  )}
                </>
              )}
            </>
          )}

          {/* Training Progress */}
          {trainProgress !== null && (
            <div className="animate-fade-in">
              <div className="flex justify-between mb-6">
                <span className="text-sm font-semibold">
                  {trainProgress >= 100
                    ? '✓ Training complete!'
                    : 'Training in progress...'}
                </span>
                <span
                  className="text-sm font-bold"
                  style={{
                    color: trainProgress >= 100 ? '#2D7A2D' : '#8B7355',
                  }}
                >
                  {Math.min(100, Math.round(trainProgress))}%
                </span>
              </div>
              <div className="h-2 bg-neutral-hover rounded-sm overflow-hidden mb-14">
                <div
                  className="h-full rounded-sm transition-all"
                  style={{
                    width: `${Math.min(100, trainProgress)}%`,
                    background: trainProgress >= 100 ? '#2D7A2D' : '#8B7355',
                  }}
                />
              </div>

              {/* Training Logs */}
              <div className="bg-neutral-text rounded-xl p-16 font-mono text-sm text-sage max-h-60 overflow-y-auto mb-14 leading-relaxed">
                {trainLogs.map((log, i) => (
                  <div
                    key={i}
                    className="animate-fade-in"
                    style={{
                      color: log.includes('✓')
                        ? '#8FBC8F'
                        : log.includes('★')
                          ? '#FFD700'
                          : log.includes('Loss')
                            ? '#87CEEB'
                            : '#9A9A9A',
                    }}
                  >
                    {log}
                  </div>
                ))}
                {trainProgress < 100 && (
                  <div className="text-neutral-text-muted animate-pulse-glow">█</div>
                )}
              </div>

              {/* Results */}
              {trainProgress >= 100 && (
                <div className="animate-fade-in">
                  <div className="p-16 bg-green-bg rounded-xl border border-green-text mb-14">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-md font-bold text-green-text mb-2">
                          New Accuracy: 84.1%
                        </p>
                        <p className="text-sm text-green-text">
                          +1.7% improvement over previous model
                        </p>
                      </div>
                      <div className="font-display text-4xl text-green-text">↑</div>
                    </div>
                  </div>

                  {/* Metrics */}
                  <div className="grid grid-cols-3 gap-8 mb-14">
                    {[
                      { label: 'Precision', value: '0.83', delta: '+0.02' },
                      { label: 'Recall', value: '0.81', delta: '+0.02' },
                      { label: 'F1', value: '0.82', delta: '+0.02' },
                    ].map((m) => (
                      <div
                        key={m.label}
                        className="text-center p-12 bg-neutral-hover rounded-lg"
                      >
                        <div className="text-xs font-bold text-neutral-text-secondary uppercase mb-3">
                          {m.label}
                        </div>
                        <div className="text-2xl font-bold">{m.value}</div>
                        <div className="text-sm text-sage font-bold">{m.delta}</div>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-10">
                    <button className="flex-1 py-12 rounded-xl border border-neutral-border bg-white text-neutral-text font-bold text-md cursor-pointer hover:border-terracotta transition-colors">
                      Export Model
                    </button>
                    <button className="flex-1 py-12 rounded-xl border-none bg-sage text-white font-bold text-md cursor-pointer hover:opacity-85 transition-opacity">
                      Use New Model
                    </button>
                    <button className="py-12 px-16 rounded-xl border border-red-bg bg-red-bg text-red-text font-bold text-md cursor-pointer hover:opacity-85 transition-opacity">
                      Discard
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══ LLM SETTINGS MODAL ═══ */}
      {modalOverlay(
        showSettings,
        onCloseSettings || (() => {}),
        <div className="bg-white rounded-2xl border border-neutral-border w-[560px] max-h-[80vh] overflow-y-auto shadow-2xl p-28">
          <div className="flex items-start justify-between mb-20">
            <div>
              <h2 className="font-display text-2xl font-normal mb-4">LLM Configuration</h2>
              <p className="text-sm text-neutral-text-secondary">
                Configure your language model settings for review generation
              </p>
            </div>
            <button
              onClick={onCloseSettings}
              className="w-8 h-8 flex items-center justify-center text-neutral-text-muted hover:text-terracotta transition-colors"
            >
              ✕
            </button>
          </div>

          <div className="space-y-16 mb-20">
            <div>
              <label className="block text-sm font-semibold text-neutral-text mb-6">
                Model
              </label>
              <input
                type="text"
                placeholder="e.g., ollama/qwen2.5-coder:7b, gpt-4o, claude-opus-4-6"
                value={llmModel}
                onChange={(e) => setLlmModel(e.target.value)}
                className="w-full px-12 py-10 border border-neutral-border rounded-lg focus:outline-none focus:border-terracotta"
              />
              <p className="text-xs text-neutral-text-muted mt-4">
                Format: provider/model or just model name (e.g., ollama/qwen2.5-coder:7b)
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-text mb-6">
                API Key <span className="text-neutral-text-secondary font-normal">(optional)</span>
              </label>
              <input
                type="password"
                placeholder="Leave empty if not required"
                value={llmApiKey}
                onChange={(e) => setLlmApiKey(e.target.value)}
                className="w-full px-12 py-10 border border-neutral-border rounded-lg focus:outline-none focus:border-terracotta"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-text mb-6">
                Base URL
              </label>
              <input
                type="text"
                placeholder="e.g., http://localhost:11434"
                value={llmBaseUrl}
                onChange={(e) => setLlmBaseUrl(e.target.value)}
                className="w-full px-12 py-10 border border-neutral-border rounded-lg focus:outline-none focus:border-terracotta"
              />
              <p className="text-xs text-neutral-text-muted mt-4">
                The endpoint URL where your LLM is running
              </p>
            </div>
          </div>

          {/* Test Button */}
          <div className="mb-20">
            <button
              onClick={handleTestEndpoint}
              disabled={testProgress !== null || !llmModel || !llmBaseUrl}
              className="w-full py-10 rounded-lg border border-neutral-border bg-neutral-hover text-neutral-text font-semibold text-sm cursor-pointer hover:border-terracotta transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {testProgress !== null ? 'Testing connection...' : '🔗 Test Endpoint'}
            </button>
          </div>

          {/* Test Progress */}
          {testProgress !== null && (
            <div className="mb-16 animate-fade-in">
              <div className="flex justify-between mb-6">
                <span className="text-sm font-semibold">Testing endpoint...</span>
                <span className="text-sm font-bold text-terracotta">
                  {Math.round(testProgress)}%
                </span>
              </div>
              <div className="h-2 bg-neutral-hover rounded-sm overflow-hidden">
                <div
                  className="h-full bg-terracotta rounded-sm transition-all"
                  style={{ width: `${testProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Test Result */}
          {testResult && (
            <div
              className={`flex items-center gap-8 mb-16 p-12 rounded-lg border animate-fade-in ${
                testResult.success
                  ? 'bg-green-bg border-green-text'
                  : 'bg-red-bg border-red-bg'
              }`}
            >
              {testResult.success ? (
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#2D7A2D"
                  strokeWidth="3"
                >
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              ) : (
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#B83232"
                  strokeWidth="3"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              )}
              <span
                className={`text-sm font-semibold ${
                  testResult.success ? 'text-green-text' : 'text-red-text'
                }`}
              >
                {testResult.message}
              </span>
            </div>
          )}

          {settingsSaved && (
            <div className="flex items-center gap-8 mb-16 p-12 bg-green-bg rounded-lg border border-green-text animate-fade-in">
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#2D7A2D"
                strokeWidth="3"
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
              <span className="text-sm font-semibold text-green-text">
                Settings saved successfully
              </span>
            </div>
          )}

          <div className="flex gap-10">
            <button
              onClick={onCloseSettings}
              className="flex-1 py-12 rounded-xl border border-neutral-border bg-white text-neutral-text font-bold text-md cursor-pointer hover:border-terracotta transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveSettings}
              className="flex-1 py-12 rounded-xl border-none bg-terracotta text-white font-bold text-md cursor-pointer hover:opacity-85 transition-opacity"
            >
              Save Settings →
            </button>
          </div>
        </div>
      )}
    </>
  );
}
