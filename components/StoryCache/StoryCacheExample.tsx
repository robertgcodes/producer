import React from 'react';
import { useStoryCache } from '@/hooks/useStoryCache';
import { CachedStory } from '@/types/storyCache';

interface StoryCacheExampleProps {
  bundleId: string;
  searchTerms: string[];
  selectedFeedIds: string[];
}

export function StoryCacheExample({ 
  bundleId, 
  searchTerms, 
  selectedFeedIds 
}: StoryCacheExampleProps) {
  const {
    cache,
    stories,
    loading,
    error,
    isStale,
    hasMore,
    refreshCache,
    loadMoreStories,
    clearCache,
    getFilteredStories,
  } = useStoryCache({
    bundleId,
    autoRefresh: true,
    refreshInterval: 3600000, // 1 hour
  });

  const handleRefresh = async () => {
    await refreshCache({
      bundleId,
      searchTerms,
      selectedFeedIds,
      deduplication: 'url',
      enrichWithAI: true,
    });
  };

  const renderStory = (story: CachedStory) => (
    <div key={story.id} className="border rounded-lg p-4 mb-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="font-semibold text-lg mb-1">
            <a href={story.url} target="_blank" rel="noopener noreferrer" 
               className="hover:underline">
              {story.title}
            </a>
          </h3>
          
          {story.description && (
            <p className="text-gray-600 text-sm mb-2">{story.description}</p>
          )}
          
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span>{story.sourceName}</span>
            {story.publishedAt && (
              <span>{new Date(story.publishedAt).toLocaleDateString()}</span>
            )}
          </div>

          {story.metadata && (
            <div className="mt-2">
              {story.metadata.author && (
                <p className="text-sm text-gray-600">
                  By: {story.metadata.author}
                </p>
              )}
              {story.metadata.categories && story.metadata.categories.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {story.metadata.categories.map((category, idx) => (
                    <span key={idx} className="px-2 py-1 bg-gray-100 rounded text-xs">
                      {category}
                    </span>
                  ))}
                </div>
              )}
              {story.metadata.duration && story.sourceType === 'video' && (
                <p className="text-sm text-gray-600 mt-1">
                  Duration: {story.metadata.duration}
                </p>
              )}
            </div>
          )}
        </div>
        
        {story.thumbnail && (
          <img 
            src={story.thumbnail} 
            alt={story.title}
            className="w-24 h-24 object-cover rounded ml-4"
          />
        )}
      </div>
      
      {story.relevanceScore && (
        <div className="mt-2 text-xs text-gray-500">
          Relevance Score: {story.relevanceScore.toFixed(2)}
        </div>
      )}
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Cache Status */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h2 className="text-xl font-semibold mb-2">Cache Status</h2>
        
        {cache && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Total Stories:</span>
              <p className="font-semibold">{cache.metadata.totalStoryCount}</p>
            </div>
            <div>
              <span className="text-gray-600">Last Refresh:</span>
              <p className="font-semibold">
                {new Date(cache.lastRefreshTime).toLocaleString()}
              </p>
            </div>
            <div>
              <span className="text-gray-600">Status:</span>
              <p className={`font-semibold ${
                isStale ? 'text-yellow-600' : 'text-green-600'
              }`}>
                {isStale ? 'Stale' : 'Fresh'}
              </p>
            </div>
            <div>
              <span className="text-gray-600">Sources:</span>
              <p className="font-semibold">
                {Object.keys(cache.summary.sourceDistribution).length}
              </p>
            </div>
          </div>
        )}

        <div className="flex gap-2 mt-4">
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? 'Refreshing...' : 'Refresh Cache'}
          </button>
          <button
            onClick={clearCache}
            disabled={loading}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
          >
            Clear Cache
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 text-red-800 rounded-lg">
          Error: {error}
        </div>
      )}

      {/* Top Sources */}
      {cache && cache.summary.topSources.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">Top Sources</h3>
          <div className="flex flex-wrap gap-2">
            {cache.summary.topSources.map((source) => (
              <button
                key={source.name}
                onClick={() => {
                  const filtered = getFilteredStories({ source: source.name });
                  console.log(`Stories from ${source.name}:`, filtered);
                }}
                className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
              >
                {source.name} ({source.count})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Stories List */}
      <div>
        <h3 className="text-lg font-semibold mb-4">
          Stories ({stories.length} loaded)
        </h3>
        
        {stories.length === 0 && !loading && (
          <p className="text-gray-500 text-center py-8">
            No stories in cache. Click "Refresh Cache" to fetch stories.
          </p>
        )}

        {stories.map(renderStory)}

        {hasMore && (
          <button
            onClick={loadMoreStories}
            disabled={loading}
            className="w-full py-3 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Load More Stories'}
          </button>
        )}
      </div>
    </div>
  );
}