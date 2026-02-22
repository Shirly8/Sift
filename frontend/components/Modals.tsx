'use client';

import { useState, useEffect } from 'react';
import Analyze from './Analyze';
import Training from './Training';
import Settings from './Settings';

interface ModalsProps {
  showCSV: boolean;
  showTrain: boolean;
  showSettings?: boolean;
  onCloseCSV: () => void;
  onCloseTrain: () => void;
  onCloseSettings?: () => void;
  onSetCurrentTask?: (task: string | null) => void;
  backendAvailable?: boolean;
}

export default function Modals({
  showCSV,
  showTrain,
  showSettings = false,
  onCloseCSV,
  onCloseTrain,
  onCloseSettings,
  onSetCurrentTask,
  backendAvailable = true,
}: ModalsProps) {
  // CSV Upload State
  const [csvProgress, setCsvProgress] = useState<number | null>(null);
  const [csvDone, setCsvDone] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [uploadResults, setUploadResults] = useState<any[]>([]);
  const [generatedReviews, setGeneratedReviews] = useState<any[]>([]);
  const [generateProgress, setGenerateProgress] = useState<number | null>(null);
  const [generateFileName, setGenerateFileName] = useState<string>('');
  const [restaurantName, setRestaurantName] = useState('');
  const [cuisine, setCuisine] = useState('');
  const [description, setDescription] = useState('');
  const [reviewCount, setReviewCount] = useState(5);

  // Training State
  const [trainTab, setTrainTab] = useState<'upload' | 'generate' | 'performance'>('upload');
  const [trainProgress, setTrainProgress] = useState<number | null>(null);
  const [trainLogs, setTrainLogs] = useState<string[]>([]);
  const [trainFile, setTrainFile] = useState<File | null>(null);
  const [trainRestaurantName, setTrainRestaurantName] = useState('');
  const [trainCuisine, setTrainCuisine] = useState('');
  const [trainDescription, setTrainDescription] = useState('');
  const [trainReviewCount, setTrainReviewCount] = useState(5);
  const [trainGeneratedRows, setTrainGeneratedRows] = useState<any[]>([]);
  const [trainGenerateProgress, setTrainGenerateProgress] = useState<number | null>(null);
  const [modelStatus, setModelStatus] = useState<any>(null);
  const [hasExistingModel, setHasExistingModel] = useState(false);

  // Settings State
  const [llmModel, setLlmModel] = useState('');
  const [llmApiKey, setLlmApiKey] = useState('');
  const [llmBaseUrl, setLlmBaseUrl] = useState('http://localhost:11434');
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [testProgress, setTestProgress] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Global state
  const [mounted, setMounted] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [evalData, setEvalData] = useState<any>(null);
  const [llmDetected, setLlmDetected] = useState<boolean | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    fetch('/data/evaluation_results.json')
      .then((res) => res.json())
      .then((data) => setEvalData(data))
      .catch((err) => console.error('Failed to load evaluation data:', err));
  }, []);

  // Fetch model status
  const fetchModelStatus = async () => {
    try {
      const res = await fetch('/api/check-model-status');
      const data = await res.json();
      setModelStatus(data);
      setHasExistingModel(
        data.baseModelExists || data.finetunedModelExists
      );
    } catch (error) {
      console.error('Failed to fetch model status:', error);
      setModelStatus(null);
      setHasExistingModel(false);
    }
  };

  useEffect(() => {
    fetchModelStatus();
  }, []);

  useEffect(() => {
    const checkLlmAvailability = async () => {
      try {
        const settingsRes = await fetch('/api/settings');
        const settings = await settingsRes.json();
        const baseUrl = settings.llmBaseUrl || 'http://localhost:11434';
        const response = await fetch(`${baseUrl}/api/tags`, {
          method: 'GET',
          signal: AbortSignal.timeout(3000),
        });
        setLlmDetected(response.ok);
      } catch (error) {
        setLlmDetected(false);
      }
    };

    if (showCSV || showTrain) {
      checkLlmAvailability();
    }
  }, [showCSV, showTrain]);

  // Handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent, setFile: (file: File | null) => void) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      const file = files[0];
      if (file.name.endsWith('.csv')) {
        setFile(file);
      } else {
        alert('Please drop a CSV file');
      }
    }
  };

  const handleCSVUpload = async () => {
    if (!csvFile || isProcessing) return;

    setCsvProgress(0);
    setCsvDone(false);
    setIsProcessing(true);
    onSetCurrentTask?.('Analyzing reviews...');

    let progressInterval: NodeJS.Timeout | null = null;

    try {
      const formData = new FormData();
      formData.append('file', csvFile);
      formData.append('restaurantName', csvFile.name.replace('.csv', ''));

      progressInterval = setInterval(() => {
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

      if (progressInterval) clearInterval(progressInterval);

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
      if (progressInterval) clearInterval(progressInterval);
      alert(`Upload error: ${error}`);
      setCsvProgress(null);
    } finally {
      setIsProcessing(false);
      onSetCurrentTask?.(null);
    }
  };

  const handleGenerateReviews = async () => {
    if (!restaurantName || !cuisine) {
      alert('Please enter restaurant name and cuisine');
      return;
    }

    setGenerateProgress(0);
    setIsProcessing(true);
    onSetCurrentTask?.('Generating synthetic reviews...');
    let progressInterval: NodeJS.Timeout | null = null;

    try {
      progressInterval = setInterval(() => {
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

      if (progressInterval) clearInterval(progressInterval);

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
      if (progressInterval) clearInterval(progressInterval);
      alert(`Generation error: ${error}`);
      setGenerateProgress(null);
    } finally {
      setIsProcessing(false);
      onSetCurrentTask?.(null);
    }
  };

  const handleUploadGenerated = async () => {
    if (!generateFileName || generatedReviews.length === 0 || isProcessing) return;

    setCsvProgress(0);
    setIsProcessing(true);
    onSetCurrentTask?.('Analyzing generated reviews...');

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
      } else {
        const error = await response.json();
        alert(`Upload failed: ${error.error}`);
        setCsvProgress(null);
      }
    } catch (error) {
      alert(`Upload error: ${error}`);
      setCsvProgress(null);
    } finally {
      setIsProcessing(false);
      onSetCurrentTask?.(null);
    }
  };

  const handleGenerateTrainingData = async () => {
    if (!trainRestaurantName || !trainCuisine) {
      alert('Please enter restaurant name and cuisine');
      return;
    }

    setTrainGenerateProgress(0);
    setTrainGeneratedRows([]);
    setIsProcessing(true);
    onSetCurrentTask?.('Generating training data...');
    let progressInterval: NodeJS.Timeout | null = null;

    try {
      progressInterval = setInterval(() => {
        setTrainGenerateProgress((p) => {
          if (p === null) return 0;
          return Math.min(95, p + Math.random() * 10 + 3);
        });
      }, 300);

      const response = await fetch('/api/generate-training', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantName: trainRestaurantName,
          cuisine: trainCuisine,
          description: trainDescription || undefined,
          count: trainReviewCount,
        }),
      });

      if (progressInterval) clearInterval(progressInterval);

      if (response.ok) {
        const data = await response.json();
        setTrainGeneratedRows(data.rows);
        setTrainGenerateProgress(100);
      } else {
        const error = await response.json();
        alert(`Generation failed: ${error.error}`);
        setTrainGenerateProgress(null);
      }
    } catch (error) {
      if (progressInterval) clearInterval(progressInterval);
      alert(`Generation error: ${error}`);
      setTrainGenerateProgress(null);
    } finally {
      setIsProcessing(false);
      onSetCurrentTask?.(null);
    }
  };

  const handleUploadGeneratedTraining = async (mode: 'quick' | 'full') => {
    if (trainGeneratedRows.length === 0 || isProcessing) return;

    const csvContent = [
      'review,aspect,rating',
      ...trainGeneratedRows.map(
        (r) => `"${r.review.replace(/"/g, '""')}","${r.aspect}",${r.rating}`
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const file = new File([blob], 'synthetic_training.csv', { type: 'text/csv' });

    setTrainGeneratedRows([]);
    setTrainGenerateProgress(null);
    setTrainTab('upload');
    setTrainFile(file);
    await handleTrain(mode, file);
  };

  const handleTrain = async (mode: 'quick' | 'full', fileOverride?: File) => {
    const file = fileOverride ?? trainFile;
    if (!file || isProcessing) return;

    setTrainProgress(0);
    setTrainLogs([]);
    setIsProcessing(true);
    onSetCurrentTask?.(`Training model (${mode} mode)...`);

    try {
      const formData = new FormData();
      formData.append('file', file);
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
    } finally {
      setIsProcessing(false);
      onSetCurrentTask?.(null);
      // Refresh model status after training completes
      await fetchModelStatus();
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

  if (!mounted) return null;

  return (
    <>
      <Analyze
        show={showCSV}
        onClose={onCloseCSV}
        csvProgress={csvProgress}
        csvDone={csvDone}
        csvFile={csvFile}
        setCsvFile={setCsvFile}
        uploadResults={uploadResults}
        generatedReviews={generatedReviews}
        generateProgress={generateProgress}
        generateFileName={generateFileName}
        restaurantName={restaurantName}
        setRestaurantName={setRestaurantName}
        cuisine={cuisine}
        setCuisine={setCuisine}
        description={description}
        setDescription={setDescription}
        reviewCount={reviewCount}
        setReviewCount={setReviewCount}
        isProcessing={isProcessing}
        llmDetected={llmDetected}
        dragActive={dragActive}
        handleCSVUpload={handleCSVUpload}
        handleGenerateReviews={handleGenerateReviews}
        handleUploadGenerated={handleUploadGenerated}
        handleDrag={handleDrag}
        handleDrop={handleDrop}
        onSetCurrentTask={onSetCurrentTask}
        backendAvailable={backendAvailable}
      />

      <Training
        show={showTrain}
        onClose={onCloseTrain}
        trainTab={trainTab}
        setTrainTab={setTrainTab}
        trainProgress={trainProgress}
        trainLogs={trainLogs}
        trainFile={trainFile}
        setTrainFile={setTrainFile}
        trainRestaurantName={trainRestaurantName}
        setTrainRestaurantName={setTrainRestaurantName}
        trainCuisine={trainCuisine}
        setTrainCuisine={setTrainCuisine}
        trainDescription={trainDescription}
        setTrainDescription={setTrainDescription}
        trainReviewCount={trainReviewCount}
        setTrainReviewCount={setTrainReviewCount}
        trainGeneratedRows={trainGeneratedRows}
        trainGenerateProgress={trainGenerateProgress}
        modelStatus={modelStatus}
        hasExistingModel={hasExistingModel}
        isProcessing={isProcessing}
        llmDetected={llmDetected}
        evalData={evalData}
        dragActive={dragActive}
        handleGenerateTrainingData={handleGenerateTrainingData}
        handleUploadGeneratedTraining={handleUploadGeneratedTraining}
        handleTrain={handleTrain}
        handleDrag={handleDrag}
        handleDrop={handleDrop}
        onSetCurrentTask={onSetCurrentTask}
        backendAvailable={backendAvailable}
      />

      <Settings
        show={showSettings}
        onClose={onCloseSettings || (() => {})}
        llmModel={llmModel}
        setLlmModel={setLlmModel}
        llmApiKey={llmApiKey}
        setLlmApiKey={setLlmApiKey}
        llmBaseUrl={llmBaseUrl}
        setLlmBaseUrl={setLlmBaseUrl}
        settingsSaved={settingsSaved}
        testProgress={testProgress}
        testResult={testResult}
        handleSaveSettings={handleSaveSettings}
        handleTestEndpoint={handleTestEndpoint}
        backendAvailable={backendAvailable}
      />
    </>
  );
}
