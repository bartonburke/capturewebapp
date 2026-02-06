'use client';

import { useState, Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import MapPlaceholder from '../components/MapPlaceholder';
import SearchResultCard from '../components/SearchResultCard';

interface SearchResult {
  photo: {
    id: string;
    imageUrl: string;
    timestamp: string;
    location: { latitude: number; longitude: number } | null;
    vlmDescription: string;
    recPotential: string;
  };
  entities: Array<{
    entityType: string;
    description: string;
    severity: string;
  }>;
  locations?: Array<{
    name: string;
    level: string;
  }>;
}

interface SearchResponse {
  success: boolean;
  results: SearchResult[];
  cypherQuery: string;
  executionTimeMs: number;
  error?: string;
}

const DEFAULT_QUERIES = [
  'all photos',
  'photos from today',
  'photos near this location',
  'high severity findings',
  'photos with entities',
  'most recent session',
];

const INVENTORY_QUERIES = [
  'all photos',
  'what rooms have been captured?',
  'items in the kitchen',
  'where is the drill?',
  'show me the garage',
  'what\'s in the closet?',
];

function GraphSearchContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sessionId');
  const projectType = searchParams.get('projectType');

  const exampleQueries = projectType === 'home-inventory' ? INVENTORY_QUERIES : DEFAULT_QUERIES;

  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCypher, setShowCypher] = useState(false);

  const handleSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    setError(null);
    setQuery(searchQuery);

    try {
      const res = await fetch('/api/graph/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          sessionId: sessionId || undefined,
          projectType: projectType || undefined,
        }),
      });

      const data: SearchResponse = await res.json();

      if (!data.success) {
        setError(data.error || 'Search failed');
        setResponse(null);
      } else {
        setResponse(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setResponse(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(query);
  };

  // Count photos with GPS data
  const gpsStats = useMemo(() => {
    if (!response) return { total: 0, withGps: 0 };
    const total = response.results.length;
    const withGps = response.results.filter((r) => r.photo.location !== null).length;
    return { total, withGps };
  }, [response]);

  return (
    <div className="h-screen flex flex-col bg-gray-900 text-white overflow-hidden">
      {/* Header - compact */}
      <header className="flex-shrink-0 bg-gray-900 border-b border-gray-800 px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-semibold">
              {sessionId ? 'Project Search' : 'Graph Search'}
            </h1>
            {sessionId && (
              <p className="text-xs text-gray-500">
                Session {sessionId.slice(0, 8)}...
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {sessionId && (
              <Link
                href="/graph"
                className="text-sm text-purple-400 hover:text-purple-300"
              >
                All Photos
              </Link>
            )}
            <Link
              href="/"
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              Projects
            </Link>
          </div>
        </div>

        {/* Search Form */}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask a question about your photos..."
            className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm flex-shrink-0"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              </span>
            ) : (
              'Search'
            )}
          </button>
        </form>
      </header>

      {/* Main content area - split view when results, examples when empty */}
      {!response && !error && !loading ? (
        /* Empty State */
        <div className="flex-1 overflow-auto scrollable-y">
          <div className="px-4 py-6">
            {/* Example queries */}
            <p className="text-sm text-gray-400 mb-3">Try these examples:</p>
            <div className="flex flex-wrap gap-2 mb-8">
              {exampleQueries.map((example) => (
                <button
                  key={example}
                  onClick={() => handleSearch(example)}
                  disabled={loading}
                  className="px-3 py-1.5 text-sm text-gray-300 bg-gray-800 border border-gray-700 rounded-full hover:bg-gray-700 hover:border-gray-600 disabled:opacity-50"
                >
                  {example}
                </button>
              ))}
            </div>

            {/* Empty state illustration */}
            <div className="text-center py-12">
              <svg
                className="w-16 h-16 text-gray-700 mx-auto mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <h2 className="text-lg font-medium text-gray-400 mb-2">
                Search your photo graph
              </h2>
              <p className="text-gray-500 text-sm">
                Ask questions in natural language to find relevant photos
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* Results View - Split Layout */
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Error */}
          {error && (
            <div className="flex-shrink-0 mx-4 mt-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}

          {response && (
            <>
              {/* Map placeholder - compact */}
              <div className="flex-shrink-0 h-[20vh] min-h-[100px] border-b border-gray-800">
                <MapPlaceholder
                  photoCount={gpsStats.total}
                  gpsCount={gpsStats.withGps}
                  compact
                />
              </div>

              {/* Results header */}
              <div className="flex-shrink-0 px-4 py-2 bg-gray-900 border-b border-gray-800 flex items-center justify-between">
                <p className="text-sm text-gray-400">
                  <span className="text-white font-medium">{response.results.length}</span> photos
                  <span className="text-gray-600 mx-2">·</span>
                  <span className="text-gray-500">{response.executionTimeMs}ms</span>
                </p>
                <button
                  onClick={() => setShowCypher(!showCypher)}
                  className="text-xs text-gray-500 hover:text-gray-400"
                >
                  {showCypher ? 'Hide' : 'Show'} Cypher
                </button>
              </div>

              {/* Cypher query (collapsible) */}
              {showCypher && (
                <div className="flex-shrink-0 px-4 py-2 bg-gray-800 border-b border-gray-700">
                  <code className="text-xs text-green-400 font-mono break-all">
                    {response.cypherQuery}
                  </code>
                </div>
              )}

              {/* Results list - scrollable */}
              <div className="flex-1 overflow-auto scrollable-y">
                {response.results.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    No photos found matching your query
                  </div>
                ) : (
                  <div className="p-4 space-y-3">
                    {response.results.map((result) => (
                      <SearchResultCard
                        key={result.photo.id}
                        photoId={result.photo.id}
                        imageUrl={result.photo.imageUrl}
                        vlmDescription={result.photo.vlmDescription}
                        recPotential={result.photo.recPotential}
                        location={result.photo.location}
                        entities={result.entities}
                        timestamp={result.photo.timestamp}
                        projectType={projectType || undefined}
                        locations={result.locations}
                      />
                    ))}
                  </div>
                )}

                {/* Bottom safe area */}
                <div className="h-6" />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function GraphSearchPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen bg-gray-900 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500" />
        </div>
      }
    >
      <GraphSearchContent />
    </Suspense>
  );
}
