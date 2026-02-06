'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Project, PhotoMetadata, ProcessingResult } from '../lib/types';
import { getAllProjects, getProjectPhotos, getSessionProcessingResult } from '../lib/db';
import { getTypeConfig } from '../lib/projectTypeConfig';

interface SearchResult {
  type: 'project' | 'photo';
  projectId: string;
  projectName: string;
  photoId?: string;
  reasoning: string;
  relevance: 'high' | 'medium' | 'low';
}

interface SearchResponse {
  results: SearchResult[];
  interpretation: string;
}

export default function SearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectPhotos, setProjectPhotos] = useState<Map<string, PhotoMetadata[]>>(new Map());
  const inputRef = useRef<HTMLInputElement>(null);

  // Load projects and photos on mount
  useEffect(() => {
    loadData();
  }, []);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const loadData = async () => {
    const allProjects = await getAllProjects();
    setProjects(allProjects);

    // Load photos for each project (limited to first 10 for performance)
    const photosMap = new Map<string, PhotoMetadata[]>();
    for (const project of allProjects.slice(0, 20)) {
      const photos = await getProjectPhotos(project.id);
      photosMap.set(project.id, photos);
    }
    setProjectPhotos(photosMap);
  };

  const handleSearch = async () => {
    if (!query.trim()) return;

    setIsSearching(true);
    setError(null);
    setResults(null);

    try {
      // Build project summaries for Claude
      const projectSummaries = projects.map(p => {
        const typeConfig = getTypeConfig(p.projectType);
        const photos = projectPhotos.get(p.id) || [];

        // Get GPS summary from photos
        const gpsLocations = photos
          .filter(photo => photo.gps)
          .map(photo => ({
            lat: photo.gps!.latitude.toFixed(4),
            lng: photo.gps!.longitude.toFixed(4),
          }));

        return {
          id: p.id,
          name: p.name,
          type: p.projectType,
          typeLabel: typeConfig?.label || p.projectType,
          lead: p.lead,
          notes: p.notes,
          photoCount: p.photoCount,
          audioCount: p.audioCount,
          createdAt: p.createdAt,
          modifiedAt: p.modifiedAt,
          processingStage: p.processingStage,
          gpsLocations: gpsLocations.slice(0, 5), // Limit GPS data
        };
      });

      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query.trim(),
          projects: projectSummaries,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Search failed');
      }

      const data: SearchResponse = await response.json();
      setResults(data);
    } catch (err: any) {
      setError(err.message || 'Search failed. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const navigateToResult = (result: SearchResult) => {
    if (result.photoId) {
      router.push(`/project/${result.projectId}/photo/${result.photoId}`);
    } else {
      router.push(`/project/${result.projectId}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-gray-900 to-black text-white overflow-y-scroll" style={{ WebkitOverflowScrolling: 'touch' }}>
      {/* Header */}
      <div className="sticky top-0 z-30 bg-gray-900/80 backdrop-blur-lg border-b border-white/10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => router.push('/')}
            className="p-2 -ml-2 hover:bg-white/10 rounded-lg transition-colors"
            aria-label="Go back"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-bold">Search</h1>
        </div>
      </div>

      {/* Search Input */}
      <div className="max-w-2xl mx-auto px-8 py-6">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Search projects... (e.g., 'unfinished in San Pedro')"
            className="w-full px-4 py-3 pr-12 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
          <button
            onClick={handleSearch}
            disabled={isSearching || !query.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-white disabled:opacity-50 transition-colors"
          >
            {isSearching ? (
              <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
          </button>
        </div>

        {/* Example queries */}
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="text-gray-500 text-sm">Try:</span>
          {['unprocessed', 'last week', 'home inventory', 'with photos'].map((example) => (
            <button
              key={example}
              onClick={() => {
                setQuery(example);
                // Auto-search after setting
                setTimeout(() => handleSearch(), 100);
              }}
              className="px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-400 text-sm rounded-lg transition-colors"
            >
              {example}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="max-w-2xl mx-auto px-8">
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-red-300 text-sm">
            {error}
          </div>
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="max-w-2xl mx-auto px-8 pb-8">
          {/* Interpretation */}
          <div className="mb-4 text-gray-400 text-sm">
            {results.interpretation}
          </div>

          {results.results.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p>No matching projects found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {results.results.map((result, index) => {
                const project = projects.find(p => p.id === result.projectId);
                const typeConfig = project ? getTypeConfig(project.projectType) : null;

                return (
                  <button
                    key={`${result.projectId}-${result.photoId || index}`}
                    onClick={() => navigateToResult(result)}
                    className="w-full text-left bg-gray-800 hover:bg-gray-750 border border-gray-700 rounded-xl p-4 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div className="w-10 h-10 bg-gray-700 rounded-lg flex items-center justify-center text-xl flex-shrink-0">
                        {typeConfig?.icon || '📁'}
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* Title */}
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white truncate">
                            {result.projectName}
                          </span>
                          {result.type === 'photo' && (
                            <span className="px-1.5 py-0.5 bg-blue-600/30 text-blue-400 text-xs rounded">
                              Photo
                            </span>
                          )}
                          <span className={`px-1.5 py-0.5 text-xs rounded ${
                            result.relevance === 'high' ? 'bg-green-600/30 text-green-400' :
                            result.relevance === 'medium' ? 'bg-yellow-600/30 text-yellow-400' :
                            'bg-gray-600/30 text-gray-400'
                          }`}>
                            {result.relevance}
                          </span>
                        </div>

                        {/* Reasoning */}
                        <p className="text-gray-400 text-sm mt-1 line-clamp-2">
                          {result.reasoning}
                        </p>

                        {/* Meta */}
                        {project && (
                          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                            <span>{project.photoCount} photos</span>
                            <span>{project.audioCount} audio</span>
                            {project.processingStage && (
                              <span className="capitalize">{project.processingStage}</span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Arrow */}
                      <svg className="w-5 h-5 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Initial state */}
      {!results && !isSearching && !error && (
        <div className="max-w-2xl mx-auto px-8 text-center py-12">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p className="text-gray-400">
            Search across all your projects using natural language
          </p>
          <p className="text-gray-500 text-sm mt-2">
            Find projects by location, status, type, date, or content
          </p>
        </div>
      )}
    </div>
  );
}
