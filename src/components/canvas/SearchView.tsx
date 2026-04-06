'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import { searchNarrative } from '@/lib/search';
import type { SearchQuery } from '@/types/narrative';

export function SearchView() {
  const { state, dispatch } = useStore();
  const [query, setQuery] = useState('');
  const [searchResult, setSearchResult] = useState<SearchQuery | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const narrative = state.activeNarrative;
  const resolvedKeys = state.resolvedEntryKeys;

  const handleSearch = async () => {
    if (!narrative || !resolvedKeys || query.trim().length === 0) return;

    setIsSearching(true);
    setError(null);

    try {
      const result = await searchNarrative(narrative, resolvedKeys, query.trim());
      setSearchResult(result);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Search failed';
      setError(errorMsg);
    } finally {
      setIsSearching(false);
    }
  };

  const handleResultClick = (sceneId: string) => {
    const sceneIndex = resolvedKeys.indexOf(sceneId);
    if (sceneIndex >= 0) {
      dispatch({ type: 'SET_SCENE_INDEX', index: sceneIndex });
    }
  };

  const formatSimilarity = (score: number) => {
    return `${(score * 100).toFixed(1)}%`;
  };

  return (
    <div className="flex flex-col h-full bg-bg-base">
      {/* Search Input */}
      <div className="px-4 py-3 border-b border-border bg-bg-surface/40">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !isSearching) handleSearch();
            }}
            placeholder="Search propositions, beats, and scenes..."
            className="flex-1 px-3 py-2 bg-bg-base border border-border rounded text-sm text-text-default placeholder:text-text-dim focus:outline-none focus:ring-1 focus:ring-accent"
            disabled={isSearching}
          />
          <button
            onClick={handleSearch}
            disabled={isSearching || query.trim().length === 0}
            className="px-4 py-2 bg-accent text-white rounded text-sm font-medium hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </div>
        {error && (
          <p className="mt-2 text-xs text-red-400">{error}</p>
        )}
      </div>

      {/* Results */}
      {searchResult && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Top Results Cards */}
          {(searchResult.topArc || searchResult.topScene || searchResult.topBeat) && (
            <div className="grid grid-cols-3 gap-3">
              {searchResult.topArc && narrative && (
                <div className="p-3 bg-bg-surface border border-border rounded">
                  <div className="text-[10px] uppercase tracking-wide text-text-dim mb-1">Top Arc</div>
                  <div className="text-sm font-medium text-text-default mb-1">
                    {narrative.arcs[searchResult.topArc.arcId]?.name ?? 'Unknown Arc'}
                  </div>
                  <div className="text-xs text-accent">
                    {formatSimilarity(searchResult.topArc.avgSimilarity)} match
                  </div>
                </div>
              )}
              {searchResult.topScene && narrative && (
                <button
                  onClick={() => handleResultClick(searchResult.topScene!.sceneId)}
                  className="p-3 bg-bg-surface border border-border rounded text-left hover:border-accent/50 transition-colors"
                >
                  <div className="text-[10px] uppercase tracking-wide text-text-dim mb-1">Top Scene</div>
                  <div className="text-sm font-medium text-text-default mb-1 line-clamp-2">
                    {narrative.scenes[searchResult.topScene.sceneId]?.summary ?? 'Unknown Scene'}
                  </div>
                  <div className="text-xs text-accent">
                    {formatSimilarity(searchResult.topScene.similarity)} match
                  </div>
                </button>
              )}
              {searchResult.topBeat && narrative && (
                <button
                  onClick={() => handleResultClick(searchResult.topBeat!.sceneId)}
                  className="p-3 bg-bg-surface border border-border rounded text-left hover:border-accent/50 transition-colors"
                >
                  <div className="text-[10px] uppercase tracking-wide text-text-dim mb-1">Top Beat</div>
                  <div className="text-sm font-medium text-text-default mb-1">
                    Beat {searchResult.topBeat.beatIndex + 1} in Scene
                  </div>
                  <div className="text-xs text-accent">
                    {formatSimilarity(searchResult.topBeat.similarity)} match
                  </div>
                </button>
              )}
            </div>
          )}

          {/* Timeline Heatmap */}
          {searchResult.timeline.length > 0 && (
            <div className="p-4 bg-bg-surface border border-border rounded">
              <div className="text-xs font-medium text-text-dim uppercase tracking-wide mb-3">
                Timeline Heatmap
              </div>
              <div className="flex items-end gap-[2px] h-20">
                {searchResult.timeline.map((point, i) => {
                  const height = Math.max(4, point.maxSimilarity * 100);
                  const opacity = 0.3 + point.maxSimilarity * 0.7;
                  return (
                    <button
                      key={i}
                      onClick={() => handleResultClick(resolvedKeys[point.sceneIndex])}
                      className="flex-1 bg-accent hover:bg-accent/80 transition-all rounded-sm"
                      style={{
                        height: `${height}%`,
                        opacity,
                      }}
                      title={`Scene ${point.sceneIndex + 1}: ${formatSimilarity(point.maxSimilarity)}`}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Results List */}
          {searchResult.results.length > 0 ? (
            <div>
              <div className="text-xs font-medium text-text-dim uppercase tracking-wide mb-2">
                Results ({searchResult.results.length})
              </div>
              <div className="space-y-2">
                {searchResult.results.map((result) => (
                  <button
                    key={result.id}
                    onClick={() => handleResultClick(result.sceneId)}
                    className="w-full p-3 bg-bg-surface border border-border rounded text-left hover:border-accent/50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="inline-block px-2 py-0.5 text-[10px] uppercase tracking-wide rounded bg-accent/10 text-accent font-medium">
                        {result.type}
                      </span>
                      <span className="text-xs text-accent font-mono">
                        {formatSimilarity(result.similarity)}
                      </span>
                    </div>
                    <div className="text-sm text-text-default mb-1">
                      {result.content}
                    </div>
                    <div className="text-xs text-text-dim">
                      {result.context}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-text-dim italic">
                No results found. Try a different search query.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!searchResult && !isSearching && (
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <svg className="w-16 h-16 text-text-dim/30 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <p className="text-sm text-text-dim mb-2">Semantic Search</p>
          <p className="text-xs text-text-dim/60 text-center max-w-xs">
            Search your narrative using natural language. Find propositions, beats, and scenes by meaning, not just keywords.
          </p>
        </div>
      )}
    </div>
  );
}
