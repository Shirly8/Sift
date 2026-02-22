'use client';

import { createPortal } from 'react-dom';

interface SettingsProps {
  show: boolean;
  onClose: () => void;
  llmModel: string;
  setLlmModel: (model: string) => void;
  llmApiKey: string;
  setLlmApiKey: (key: string) => void;
  llmBaseUrl: string;
  setLlmBaseUrl: (url: string) => void;
  settingsSaved: boolean;
  testProgress: number | null;
  testResult: { success: boolean; message: string } | null;
  handleSaveSettings: () => Promise<void>;
  handleTestEndpoint: () => Promise<void>;
  backendAvailable?: boolean;
}

export default function Settings({
  show,
  onClose,
  llmModel,
  setLlmModel,
  llmApiKey,
  setLlmApiKey,
  llmBaseUrl,
  setLlmBaseUrl,
  settingsSaved,
  testProgress,
  testResult,
  handleSaveSettings,
  handleTestEndpoint,
  backendAvailable = true,
}: SettingsProps) {
  if (!show) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200000] flex items-center justify-center bg-black bg-opacity-35"
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()}>
        <div className="bg-white rounded-2xl border border-neutral-border w-[560px] max-h-[80vh] overflow-y-auto shadow-2xl p-28">
          <div className="flex items-start justify-between mb-20">
            <div>
              <h2 className="font-display text-2xl font-normal mb-4">LLM Configuration</h2>
              <p className="text-sm text-neutral-text-secondary">
                Configure your language model settings for review generation
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center text-neutral-text-muted hover:text-terracotta transition-colors cursor-pointer"
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
              disabled={testProgress !== null || !llmModel || !llmBaseUrl || !backendAvailable}
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
              onClick={onClose}
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
      </div>
    </div>,
    document.body
  );
}
