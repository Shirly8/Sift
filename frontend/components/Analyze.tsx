'use client';

import { useState } from 'react';

interface AnalyzeProps {
  show: boolean;
  onClose: () => void;
  csvProgress: number | null;
  csvDone: boolean;
  csvFile: File | null;
  setCsvFile: (file: File | null) => void;
  uploadResults: any[];
  generatedReviews: any[];
  generateProgress: number | null;
  generateFileName: string;
  restaurantName: string;
  setRestaurantName: (name: string) => void;
  cuisine: string;
  setCuisine: (cuisine: string) => void;
  description: string;
  setDescription: (desc: string) => void;
  reviewCount: number;
  setReviewCount: (count: number) => void;
  isProcessing: boolean;
  llmDetected: boolean | null;
  dragActive: boolean;
  handleCSVUpload: () => Promise<void>;
  handleGenerateReviews: () => Promise<void>;
  handleUploadGenerated: () => Promise<void>;
  handleDrag: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent, setFile: (file: File | null) => void) => void;
  onSetCurrentTask?: (task: string | null) => void;
  backendAvailable?: boolean;
}

export default function Analyze({
  show,
  onClose,
  csvProgress,
  csvDone,
  csvFile,
  setCsvFile,
  uploadResults,
  generatedReviews,
  generateProgress,
  generateFileName,
  restaurantName,
  setRestaurantName,
  cuisine,
  setCuisine,
  description,
  setDescription,
  reviewCount,
  setReviewCount,
  isProcessing,
  llmDetected,
  dragActive,
  handleCSVUpload,
  handleGenerateReviews,
  handleUploadGenerated,
  handleDrag,
  handleDrop,
  onSetCurrentTask,
  backendAvailable = true,
}: AnalyzeProps) {
  if (!show) return null;

  const { createPortal } = require('react-dom');
  const [csvTab, setCsvTab] = useState<'upload' | 'generate'>('upload');

  return createPortal(
    <div
      className="fixed inset-0 z-[200000] flex items-center justify-center bg-black bg-opacity-35"
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()}>
        <div className="bg-white rounded-2xl border border-neutral-border w-[660px] max-h-[80vh] overflow-y-auto shadow-2xl p-28">
          <div className="flex items-start justify-between mb-20">
            <div>
              <h2 className="font-display text-2xl font-normal mb-4">
                {csvFile || generateProgress !== null || generatedReviews.length > 0
                  ? csvDone || (generateProgress === 100 && generatedReviews.length > 0 && csvProgress === null)
                    ? 'Upload CSV'
                    : 'Analyze Reviews'
                  : 'Upload CSV'}
              </h2>
              <p className="text-sm text-neutral-text-secondary">
                {generatedReviews.length === 0 || csvDone
                  ? 'Batch analyze reviews for a new restaurant'
                  : 'Create realistic synthetic reviews using AI'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center text-neutral-text-muted hover:text-terracotta transition-colors cursor-pointer"
            >
              ✕
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-8 mb-20 border-b border-neutral-border">
            <button
              onClick={() => {
                setCsvTab('upload');
                setRestaurantName('');
                setCuisine('');
                setDescription('');
              }}
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
                  setCsvFile(null);
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
            <div className="flex items-center gap-6 mb-12 p-14 bg-green-bg rounded-lg border border-green-text">
              <div className="w-2 h-2 rounded-full bg-green-text" />
              <span className="text-sm font-semibold text-green-text">
                ✓ Backend detected — using DeBERTa (fast, accurate)
              </span>
            </div>

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
                    ✓ LLM model detected
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
              {csvProgress === null && !csvDone && (
                <>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="csv-input"
                  />
                  <div
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={(e) => handleDrop(e, setCsvFile)}
                    className={`border-2 border-dashed rounded-xl p-32 text-center mb-16 cursor-pointer transition-colors block ${
                      dragActive
                        ? 'border-terracotta bg-terracotta bg-opacity-5'
                        : 'border-neutral-border-inactive hover:border-terracotta'
                    }`}
                  >
                    <label htmlFor="csv-input" className="cursor-pointer block">
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
                  </div>

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
                      disabled={!csvFile || isProcessing || !backendAvailable}
                      title={!backendAvailable ? 'Backend is required for this feature' : isProcessing ? 'A process is currently running. Please wait for it to finish.' : !csvFile ? 'Please select a CSV file first' : ''}
                      className="flex-1 py-12 rounded-xl border-none bg-terracotta text-white text-md font-bold cursor-pointer hover:opacity-85 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Upload & Analyze →
                    </button>
                  </div>
                </>
              )}

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
                    <button
                      onClick={() => {
                        const csvContent = [
                          'restaurant,review,rating,date',
                          ...uploadResults.map(
                            (r) =>
                              `"${r.restaurant}","${r.review.replace(/"/g, '""')}",${r.rating},"${r.date}"`
                          ),
                        ].join('\n');
                        const blob = new Blob([csvContent], { type: 'text/csv' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `upload_results_${Date.now()}.csv`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                      }}
                      disabled={isProcessing}
                      className="flex-1 py-12 rounded-xl border border-neutral-border bg-white text-neutral-text font-bold text-md cursor-pointer hover:border-terracotta transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      ⬇ Download Results CSV
                    </button>
                    <button
                      onClick={async () => {
                        // Trigger export to refresh restaurants.json and generate dashboard data
                        try {
                          const response = await fetch('/api/export', { method: 'POST' });
                          if (!response.ok) {
                            alert('Failed to export dashboard data');
                          }
                        } catch (error) {
                          console.error('Export error:', error);
                        }

                        // Wait a moment for export to complete, then close
                        setTimeout(() => {
                          onClose();
                          // Reload the page to refresh the restaurant list
                          window.location.reload();
                        }, 2000);
                      }}
                      disabled={isProcessing}
                      className="flex-1 py-12 rounded-xl border-none bg-terracotta text-white font-bold text-md cursor-pointer hover:opacity-85 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      ✓ Added to Dashboard
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
                    disabled={isProcessing || !backendAvailable}
                    title={!backendAvailable ? 'Backend is required for this feature' : isProcessing ? 'A process is currently running. Please wait for it to finish.' : ''}
                    className="w-full py-12 rounded-xl border-none bg-terracotta text-white font-bold text-md cursor-pointer hover:opacity-85 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
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
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2D7A2D" strokeWidth="3">
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
                        const csvContent = [
                          'restaurant,review,rating,date',
                          ...generatedReviews.map(
                            (r) =>
                              `"${r.restaurant}","${r.review.replace(/"/g, '""')}",${r.rating},"${r.date}"`
                          ),
                        ].join('\n');
                        const blob = new Blob([csvContent], { type: 'text/csv' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = generateFileName || `synthetic_reviews_${Date.now()}.csv`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                      }}
                      disabled={isProcessing}
                      className="flex-1 py-12 rounded-xl border border-neutral-border bg-white text-neutral-text font-bold text-md cursor-pointer hover:border-terracotta transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      ⬇ Download CSV
                    </button>
                    <button
                      onClick={handleUploadGenerated}
                      disabled={isProcessing || !backendAvailable}
                      title={!backendAvailable ? 'Backend is required for this feature' : isProcessing ? 'A process is currently running. Please wait for it to finish.' : ''}
                      className="flex-1 py-12 rounded-xl border-none bg-sage text-white font-bold text-md cursor-pointer hover:opacity-85 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Upload & Analyze →
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
