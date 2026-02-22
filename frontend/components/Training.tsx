'use client';

import { createPortal } from 'react-dom';

interface TrainingProps {
  show: boolean;
  onClose: () => void;
  trainTab: 'upload' | 'generate' | 'performance';
  setTrainTab: (tab: 'upload' | 'generate' | 'performance') => void;
  trainProgress: number | null;
  trainLogs: string[];
  trainFile: File | null;
  setTrainFile: (file: File | null) => void;
  trainRestaurantName: string;
  setTrainRestaurantName: (name: string) => void;
  trainCuisine: string;
  setTrainCuisine: (cuisine: string) => void;
  trainDescription: string;
  setTrainDescription: (desc: string) => void;
  trainReviewCount: number;
  setTrainReviewCount: (count: number) => void;
  trainGeneratedRows: any[];
  trainGenerateProgress: number | null;
  modelStatus: any;
  hasExistingModel: boolean;
  isProcessing: boolean;
  llmDetected: boolean | null;
  evalData: any;
  dragActive: boolean;
  handleGenerateTrainingData: () => Promise<void>;
  handleUploadGeneratedTraining: (mode: 'quick' | 'full') => Promise<void>;
  handleTrain: (mode: 'quick' | 'full') => Promise<void>;
  handleDrag: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent, setFile: (file: File | null) => void) => void;
  onSetCurrentTask?: (task: string | null) => void;
  backendAvailable?: boolean;
}

export default function Training({
  show,
  onClose,
  trainTab,
  setTrainTab,
  trainProgress,
  trainLogs,
  trainFile,
  setTrainFile,
  trainRestaurantName,
  setTrainRestaurantName,
  trainCuisine,
  setTrainCuisine,
  trainDescription,
  setTrainDescription,
  trainReviewCount,
  setTrainReviewCount,
  trainGeneratedRows,
  trainGenerateProgress,
  modelStatus,
  hasExistingModel,
  isProcessing,
  llmDetected,
  evalData,
  dragActive,
  handleGenerateTrainingData,
  handleUploadGeneratedTraining,
  handleTrain,
  handleDrag,
  handleDrop,
  onSetCurrentTask,
  backendAvailable = true,
}: TrainingProps) {
  if (!show) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200000] flex items-center justify-center bg-black bg-opacity-35"
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()}>
        <div className="bg-white rounded-2xl border border-neutral-border w-[620px] max-h-[80vh] overflow-y-auto shadow-2xl p-28">
          <div className="flex items-start justify-between mb-20">
            <div>
              <h2 className="font-display text-2xl font-normal mb-4">Train Custom Model</h2>
              <p className="text-sm text-neutral-text-secondary">
                Fine-tune DeBERTa on your restaurant's review data
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center text-neutral-text-muted hover:text-terracotta transition-colors cursor-pointer"
            >
              ✕
            </button>
          </div>

          {/* Model Status */}
          {trainProgress === null && (
            <>
              {modelStatus && (
                <div className={`mb-16 p-14 rounded-lg border ${
                  modelStatus.modelExists
                    ? 'bg-blue-50 border-blue-200'
                    : 'bg-orange-50 border-orange-200'
                }`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${
                      modelStatus.modelExists ? 'bg-blue-600' : 'bg-orange-600'
                    }`} />
                    <div>
                      {modelStatus.modelExists ? (
                        <>
                          <p className="text-sm font-semibold text-blue-900">
                            ✓ Model Ready
                          </p>
                          {modelStatus.trainingDataCount > 0 && (
                            <p className="text-xs text-blue-800 mt-1">
                              Trained on {modelStatus.trainingDataCount} examples
                            </p>
                          )}
                          {modelStatus.lastTrained && (
                            <p className="text-xs text-blue-700 mt-0.5">
                              Last updated: {new Date(modelStatus.lastTrained).toLocaleDateString()}
                            </p>
                          )}
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-semibold text-orange-900">
                            📥 Setting up model...
                          </p>
                          <p className="text-xs text-orange-800 mt-1">
                            Model will download from Hugging Face on first training
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Tabs */}
              <div className="flex gap-8 mb-20 border-b border-neutral-border">
                <button
                  onClick={() => setTrainTab('upload')}
                  className={`py-12 px-4 font-semibold text-sm transition-colors ${
                    trainTab === 'upload'
                      ? 'text-terracotta border-b-2 border-terracotta'
                      : 'text-neutral-text-secondary hover:text-neutral-text'
                  }`}
                >
                  Upload Training CSV
                </button>
                <button
                  onClick={() => { if (llmDetected) setTrainTab('generate'); }}
                  className={`py-12 px-4 font-semibold text-sm transition-colors ${
                    trainTab === 'generate'
                      ? 'text-terracotta border-b-2 border-terracotta'
                      : llmDetected === false
                        ? 'text-neutral-text-muted cursor-not-allowed opacity-50'
                        : 'text-neutral-text-secondary hover:text-neutral-text'
                  }`}
                  title={llmDetected === false ? 'Configure LLM in Settings to enable this' : ''}
                >
                  Generate AI Training Data
                </button>
                <button
                  onClick={() => setTrainTab('performance')}
                  className={`py-12 px-4 font-semibold text-sm transition-colors ${
                    trainTab === 'performance'
                      ? 'text-terracotta border-b-2 border-terracotta'
                      : 'text-neutral-text-secondary hover:text-neutral-text'
                  }`}
                >
                  Model Performance
                </button>
              </div>
            </>
          )}

          {/* Upload Tab */}
          {trainProgress === null && trainTab === 'upload' && (
            <>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => setTrainFile(e.target.files?.[0] || null)}
                className="hidden"
                id="train-csv-input"
              />
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={(e) => handleDrop(e, setTrainFile)}
                className={`border-2 border-dashed rounded-xl p-32 text-center mb-16 cursor-pointer transition-colors block ${
                  dragActive
                    ? 'border-terracotta bg-terracotta bg-opacity-5'
                    : 'border-neutral-border-inactive hover:border-terracotta'
                }`}
              >
                <label htmlFor="train-csv-input" className="cursor-pointer block">
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
                    Required columns: <span className="font-mono bg-neutral-hover px-2 py-1 rounded">review, aspect, rating</span>
                  </p>
                  <p className="text-xs text-neutral-text-muted">
                    Example: "Their pasta was sublime" | Taste | 5
                  </p>
                </label>
              </div>

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
                        Choose training mode. <strong>Quick</strong> fine-tunes faster (2 min). <strong>Full</strong> uses all accumulated data for better accuracy (5 min).
                      </p>
                      <div className="flex gap-10">
                        <button
                          onClick={() => handleTrain('quick')}
                          disabled={isProcessing || !backendAvailable}
                          title={!backendAvailable ? 'Backend is required for this feature' : isProcessing ? 'A process is currently running. Please wait for it to finish.' : ''}
                          className="flex-1 py-12 rounded-xl border-2 border-terracotta bg-white text-terracotta font-bold text-md cursor-pointer hover:bg-terracotta hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          ⚡ Quick Fine-tune (2 min)
                        </button>
                        <button
                          onClick={() => handleTrain('full')}
                          disabled={isProcessing || !backendAvailable}
                          title={!backendAvailable ? 'Backend is required for this feature' : isProcessing ? 'A process is currently running. Please wait for it to finish.' : ''}
                          className="flex-1 py-12 rounded-xl border-none bg-sage text-white font-bold text-md cursor-pointer hover:opacity-85 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          ✓ Full Fine-tune (5 min)
                        </button>
                      </div>
                    </>
                  ) : (
                    <button
                      onClick={() => handleTrain('full')}
                      disabled={isProcessing || !backendAvailable}
                      title={!backendAvailable ? 'Backend is required for this feature' : isProcessing ? 'A process is currently running. Please wait for it to finish.' : ''}
                      className="w-full py-12 rounded-xl border-none bg-terracotta text-white text-md font-bold cursor-pointer hover:opacity-85 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Fine-tune Base Model →
                    </button>
                  )}
                </>
              )}
            </>
          )}

          {/* Generate AI Training Data Tab */}
          {trainProgress === null && trainTab === 'generate' && (
            <>
              {trainGenerateProgress === null && trainGeneratedRows.length === 0 && (
                <>
                  <div className="space-y-14 mb-16">
                    <div>
                      <label className="block text-sm font-semibold text-neutral-text mb-6">
                        Restaurant Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., Aretti, Pai, Lavelle"
                        value={trainRestaurantName}
                        onChange={(e) => setTrainRestaurantName(e.target.value)}
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
                        value={trainCuisine}
                        onChange={(e) => setTrainCuisine(e.target.value)}
                        className="w-full px-12 py-10 border border-neutral-border rounded-lg focus:outline-none focus:border-terracotta"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-neutral-text mb-6">
                        Restaurant Description <span className="text-neutral-text-secondary font-normal">(optional)</span>
                      </label>
                      <textarea
                        placeholder="e.g., Fine dining, cozy ambiance, known for fresh pasta..."
                        value={trainDescription}
                        onChange={(e) => setTrainDescription(e.target.value)}
                        className="w-full px-12 py-10 border border-neutral-border rounded-lg focus:outline-none focus:border-terracotta resize-none"
                        rows={3}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-neutral-text mb-6">
                        Number of Reviews to Generate
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={trainReviewCount}
                        onChange={(e) => setTrainReviewCount(parseInt(e.target.value) || 5)}
                        className="w-full px-12 py-10 border border-neutral-border rounded-lg focus:outline-none focus:border-terracotta"
                      />
                      <p className="text-xs text-neutral-text-muted mt-4">
                        Each review covers 2–3 aspects → yields 2–3× as many labeled training rows
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleGenerateTrainingData}
                    disabled={isProcessing || !backendAvailable}
                    title={!backendAvailable ? 'Backend is required for this feature' : isProcessing ? 'A process is currently running. Please wait for it to finish.' : ''}
                    className="w-full py-12 rounded-xl border-none bg-terracotta text-white font-bold text-md cursor-pointer hover:opacity-85 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Generate Training Data with AI →
                  </button>
                </>
              )}

              {trainGenerateProgress !== null && trainGenerateProgress < 100 && (
                <div className="mb-16 animate-fade-in">
                  <div className="flex justify-between mb-6">
                    <span className="text-sm font-semibold">Generating training data...</span>
                    <span className="text-sm font-bold text-terracotta">
                      {Math.round(trainGenerateProgress)}%
                    </span>
                  </div>
                  <div className="h-2 bg-neutral-hover rounded-sm overflow-hidden">
                    <div
                      className="h-full bg-terracotta rounded-sm transition-all"
                      style={{ width: `${trainGenerateProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {trainGenerateProgress === 100 && trainGeneratedRows.length > 0 && (
                <div className="animate-fade-in">
                  <div className="flex items-center gap-8 mb-14">
                    <div className="w-24 h-24 rounded-full bg-green-bg flex items-center justify-center">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2D7A2D" strokeWidth="3">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    </div>
                    <span className="text-md font-bold text-green-text">
                      {trainGeneratedRows.length} labeled training rows generated
                    </span>
                  </div>

                  <div className="border border-neutral-border rounded-xl overflow-hidden mb-14 max-h-[500px] overflow-y-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-neutral-hover sticky top-0">
                          <th className="text-left p-10 font-semibold text-neutral-text-secondary uppercase">Review</th>
                          <th className="text-center p-10 font-semibold text-neutral-text-secondary w-28 uppercase">Aspect</th>
                          <th className="text-center p-10 font-semibold text-neutral-text-secondary w-16 uppercase">Rating</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trainGeneratedRows.map((row, i) => (
                          <tr key={i} className="border-t border-neutral-alt-background hover:bg-neutral-hover">
                            <td className="p-10 text-neutral-text-secondary-dark line-clamp-2">
                              {row.review}
                            </td>
                            <td className="text-center p-10">
                              <span className="text-xs font-semibold py-2 px-4 rounded-xs bg-neutral-hover text-neutral-text">
                                {row.aspect}
                              </span>
                            </td>
                            <td className="text-center p-10">
                              <span
                                className="text-xs font-bold py-2 px-4 rounded-xs"
                                style={{
                                  background: Number(row.rating) >= 4 ? '#EBF5EB' : Number(row.rating) >= 3 ? '#FFF8E8' : '#FDF0EF',
                                  color: Number(row.rating) >= 4 ? '#2D7A2D' : Number(row.rating) >= 3 ? '#8B7000' : '#B83232',
                                }}
                              >
                                {row.rating}★
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex gap-10 mb-10">
                    <button
                      onClick={() => {
                        const csvContent = [
                          'review,aspect,rating',
                          ...trainGeneratedRows.map(
                            (r) => `"${r.review.replace(/"/g, '""')}","${r.aspect}",${r.rating}`
                          ),
                        ].join('\n');
                        const blob = new Blob([csvContent], { type: 'text/csv' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `synthetic_training_${Date.now()}.csv`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                      }}
                      className="flex-1 py-12 rounded-xl border border-neutral-border bg-white text-neutral-text font-bold text-md cursor-pointer hover:border-terracotta transition-colors"
                    >
                      ⬇ Download CSV
                    </button>
                  </div>

                  {hasExistingModel ? (
                    <>
                      <p className="text-sm text-neutral-text-secondary mb-12">
                        Choose training mode. <strong>Quick</strong> fine-tunes faster (2 min). <strong>Full</strong> uses all accumulated data for better accuracy (5 min).
                      </p>
                      <div className="flex gap-10">
                        <button
                          onClick={() => handleUploadGeneratedTraining('quick')}
                          disabled={isProcessing}
                          title={isProcessing ? 'A process is currently running. Please wait for it to finish.' : ''}
                          className="flex-1 py-12 rounded-xl border-2 border-terracotta bg-white text-terracotta font-bold text-md cursor-pointer hover:bg-terracotta hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          ⚡ Quick Fine-tune
                        </button>
                        <button
                          onClick={() => handleUploadGeneratedTraining('full')}
                          disabled={isProcessing}
                          title={isProcessing ? 'A process is currently running. Please wait for it to finish.' : ''}
                          className="flex-1 py-12 rounded-xl border-none bg-sage text-white font-bold text-md cursor-pointer hover:opacity-85 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          ✓ Full Fine-tune
                        </button>
                      </div>
                    </>
                  ) : (
                    <button
                      onClick={() => handleUploadGeneratedTraining('full')}
                      disabled={isProcessing}
                      title={isProcessing ? 'A process is currently running. Please wait for it to finish.' : ''}
                      className="w-full py-12 rounded-xl border-none bg-terracotta text-white text-md font-bold cursor-pointer hover:opacity-85 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Fine-tune Base Model →
                    </button>
                  )}
                </div>
              )}
            </>
          )}

          {/* Model Performance Tab */}
          {trainProgress === null && trainTab === 'performance' && (
            <div className="animate-fade-in">
              {/* Metrics Grid */}
              <div className="grid grid-cols-4 gap-10 mb-20">
                {[
                  { label: 'Accuracy', value: evalData ? `${(evalData.accuracy * 100).toFixed(1)}%` : '—' },
                  { label: 'Precision', value: evalData ? evalData.precision.toFixed(2) : '—' },
                  { label: 'Recall', value: evalData ? evalData.recall.toFixed(2) : '—' },
                  { label: 'Weighted F1', value: evalData ? evalData.f1.toFixed(2) : '—' },
                ].map((m) => (
                  <div key={m.label} className="text-center p-14 bg-neutral-hover rounded-xl">
                    <div className="text-xs font-semibold text-neutral-text-secondary uppercase tracking-wide mb-4">
                      {m.label}
                    </div>
                    <div className="font-display text-2xl text-neutral-text">{m.value}</div>
                  </div>
                ))}
              </div>

              {/* Per-Aspect F1 Scores */}
              <h4 className="text-base font-semibold mb-12">Per-Aspect F1 Scores</h4>
              {evalData ? (
                Object.entries(evalData.per_aspect).map(([name, aspect]: any) => (
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
                ))
              ) : (
                <p className="text-sm text-neutral-text-secondary mb-12">No evaluation data available. Train a model to see performance metrics.</p>
              )}

              {/* Aspect Discovery Recall */}
              <div className="mt-16 p-16 bg-neutral-hover rounded-xl flex justify-between">
                <span className="text-sm text-neutral-text-muted">Aspect Discovery Recall</span>
                <span className="font-display text-2xl text-sage">
                  {evalData ? `${(evalData.aspect_discovery_recall * 100).toFixed(1)}%` : '—'}
                </span>
              </div>
            </div>
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
      </div>
    </div>,
    document.body
  );
}
