'use client';

import { useState, useCallback } from 'react';

interface ImportResult {
  success: boolean;
  sessionId: string;
  outputPath: string;
  summary: {
    projectName: string;
    projectType: string;
    photoCount: number;
    hasTranscript: boolean;
    hasAudio: boolean;
    processingStage: string;
  };
  error?: string;
}

export default function ImportPage() {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setError(null);
    setResult(null);

    const files = e.dataTransfer.files;
    if (files.length === 0) return;

    const file = files[0];
    if (!file.name.endsWith('.zip')) {
      setError('Please drop a .zip file');
      return;
    }

    await uploadFile(file);
  }, []);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (!file.name.endsWith('.zip')) {
      setError('Please select a .zip file');
      return;
    }

    setError(null);
    setResult(null);
    await uploadFile(file);
  }, []);

  const uploadFile = async (file: File) => {
    setIsUploading(true);

    try {
      // Extract session ID from filename or generate one
      const sessionId = file.name
        .replace('.zip', '')
        .replace(/^site-visit-\d{4}-\d{2}-\d{2}-/, '')
        .slice(0, 50) || `import-${Date.now()}`;

      const formData = new FormData();
      formData.append('file', file);
      formData.append('sessionId', sessionId);

      const response = await fetch('/api/v1/capture/import', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setResult(data);
      } else {
        setError(data.error || 'Import failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Import Evidence Package</h1>
        <p className="text-gray-600 mb-6">
          Drop a Portable Evidence Package (.zip) to import it into the working directory.
        </p>

        {/* Drop zone */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`
            border-2 border-dashed rounded-lg p-12 text-center transition-colors
            ${isDragging
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 bg-white hover:border-gray-400'}
            ${isUploading ? 'opacity-50 pointer-events-none' : ''}
          `}
        >
          {isUploading ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-gray-600">Importing...</p>
            </div>
          ) : (
            <>
              <div className="text-4xl mb-4">📦</div>
              <p className="text-gray-700 font-medium mb-2">
                Drag & drop your evidence package here
              </p>
              <p className="text-gray-500 text-sm mb-4">or</p>
              <label className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition-colors">
                Choose File
                <input
                  type="file"
                  accept=".zip"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>
            </>
          )}
        </div>

        {/* Error message */}
        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Success result */}
        {result && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <h2 className="font-semibold text-green-800 mb-2">✓ Import Successful</h2>
            <dl className="text-sm text-green-700 space-y-1">
              <div className="flex justify-between">
                <dt>Project:</dt>
                <dd className="font-medium">{result.summary.projectName}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Type:</dt>
                <dd>{result.summary.projectType}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Photos:</dt>
                <dd>{result.summary.photoCount}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Audio:</dt>
                <dd>{result.summary.hasAudio ? 'Yes' : 'No'}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Transcript:</dt>
                <dd>{result.summary.hasTranscript ? 'Yes' : 'No'}</dd>
              </div>
              <div className="flex justify-between border-t border-green-300 pt-2 mt-2">
                <dt>Output Path:</dt>
                <dd className="font-mono text-xs">{result.outputPath}</dd>
              </div>
            </dl>
          </div>
        )}

        {/* Instructions */}
        <div className="mt-8 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-medium text-gray-800 mb-2">After Import</h3>
          <p className="text-sm text-gray-600 mb-2">
            The session will be available at:
          </p>
          <code className="block text-xs bg-gray-200 p-2 rounded font-mono">
            evidence/sessions/&#123;sessionId&#125;/SESSION_SUMMARY.md
          </code>
          <p className="text-sm text-gray-600 mt-3">
            Claude Code will automatically have access to the imported session data.
          </p>
        </div>
      </div>
    </div>
  );
}
