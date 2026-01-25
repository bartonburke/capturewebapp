'use client';

import { useState } from 'react';
import Link from 'next/link';

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
}

interface SearchResponse {
  success: boolean;
  results: SearchResult[];
  cypherQuery: string;
  executionTimeMs: number;
  error?: string;
}

const EXAMPLE_QUERIES = [
  'all photos',
  'photos with AOCs',
  'photos showing staining or water damage',
  'environmental concerns',
  'photos with medium or high REC potential',
  'photos showing pipes or drains',
];

export default function GraphSearchPage() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    setError(null);
    setQuery(searchQuery);

    try {
      const res = await fetch('/api/graph/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery }),
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

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'medium':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'low':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getRecPotentialColor = (recPotential: string) => {
    switch (recPotential) {
      case 'high':
        return 'text-red-600';
      case 'medium':
        return 'text-orange-600';
      case 'low':
        return 'text-green-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 overflow-auto" style={{ position: 'relative' }}>
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Graph Search</h1>
              <p className="text-sm text-gray-500">Natural language search over photo graph</p>
            </div>
            <Link
              href="/"
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Back to Projects
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Search Form */}
        <form onSubmit={handleSubmit} className="mb-6">
          <div className="flex gap-3">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask a question about your photos..."
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </form>

        {/* Example Queries */}
        <div className="mb-8">
          <p className="text-sm text-gray-500 mb-2">Try these examples:</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_QUERIES.map((example) => (
              <button
                key={example}
                onClick={() => handleSearch(example)}
                disabled={loading}
                className="px-3 py-1.5 text-sm text-gray-700 bg-white border border-gray-200 rounded-full hover:bg-gray-50 hover:border-gray-300 disabled:opacity-50"
              >
                {example}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Results */}
        {response && (
          <div>
            {/* Stats */}
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Found <span className="font-semibold">{response.results.length}</span> photos in{' '}
                <span className="font-semibold">{response.executionTimeMs}ms</span>
              </p>
            </div>

            {/* Cypher Query */}
            <div className="mb-6 p-3 bg-gray-800 text-gray-100 rounded-lg font-mono text-sm overflow-x-auto">
              <span className="text-gray-400">Generated Cypher: </span>
              {response.cypherQuery}
            </div>

            {/* Photo Grid */}
            {response.results.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                No photos found matching your query
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {response.results.map((result) => (
                  <div
                    key={result.photo.id}
                    className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow"
                  >
                    {/* Photo placeholder (actual images would need to be served) */}
                    <div className="aspect-video bg-gray-200 flex items-center justify-center">
                      <div className="text-center p-4">
                        <svg
                          className="w-12 h-12 text-gray-400 mx-auto mb-2"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                        <p className="text-xs text-gray-500 break-all">
                          {result.photo.id.split('-').slice(-1)[0]}
                        </p>
                      </div>
                    </div>

                    <div className="p-4">
                      {/* REC Potential Badge */}
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className={`text-xs font-medium ${getRecPotentialColor(
                            result.photo.recPotential
                          )}`}
                        >
                          REC: {result.photo.recPotential}
                        </span>
                        {result.photo.location && (
                          <span className="text-xs text-gray-400">
                            {result.photo.location.latitude.toFixed(4)},{' '}
                            {result.photo.location.longitude.toFixed(4)}
                          </span>
                        )}
                      </div>

                      {/* Description */}
                      <p className="text-sm text-gray-700 line-clamp-3 mb-3">
                        {result.photo.vlmDescription}
                      </p>

                      {/* Entities */}
                      {result.entities.length > 0 && (
                        <div className="space-y-2">
                          {result.entities.map((entity, idx) => (
                            <div
                              key={idx}
                              className={`px-2 py-1 rounded border text-xs ${getSeverityColor(
                                entity.severity
                              )}`}
                            >
                              <span className="font-medium">{entity.entityType}</span>
                              <span className="text-gray-500 ml-1">({entity.severity})</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {!response && !error && !loading && (
          <div className="text-center py-16">
            <svg
              className="w-16 h-16 text-gray-300 mx-auto mb-4"
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
            <h2 className="text-xl font-medium text-gray-600 mb-2">Search your photo graph</h2>
            <p className="text-gray-500">
              Ask questions in natural language to find relevant photos and entities
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
