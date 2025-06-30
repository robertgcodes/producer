# Removed Stories Feature

## Overview

This feature prevents stories that have been manually removed from a bundle from reappearing when feeds are refreshed. Once a user removes a story from a bundle, it stays removed even after refreshing feeds or clearing the cache.

## How It Works

### 1. Story Removal Tracking
When a user removes a story from a bundle, the system:
- Records the story URL and bundle ID in the `removedStories` collection
- Tracks who removed it and when
- Creates a unique document ID: `{bundleId}_{storyId}`

### 2. Feed Refresh Filtering
During feed refresh, the system:
- Checks each matching story against the removed stories list
- Skips any stories that have been previously removed from that bundle
- Logs when stories are filtered out

### 3. Cache Filtering
When loading cached stories, the system:
- Retrieves the list of removed stories for the bundle
- Filters them out of the cached results
- Updates the local cache with the filtered results

## Implementation Details

### Services Updated

1. **BundleItemsService** (`lib/services/bundleItemsService.ts`)
   - Added import for `RemovedStoriesService`
   - Updated `processFeedItemForBundles` to check if stories are removed before adding

2. **BundleSearchService** (`lib/services/bundleSearchService.ts`)
   - Added import for `RemovedStoriesService`
   - Updated `getSuggestedStoriesForBundle` to filter removed stories from search results
   - Updated `getCachedStories` to filter removed stories from cached results

### Key Methods

- `RemovedStoriesService.isRemoved(storyUrl, bundleId)` - Check if a story is removed
- `RemovedStoriesService.getRemovedStoriesForBundle(bundleId)` - Get all removed story URLs
- `RemovedStoriesService.markAsRemoved(...)` - Mark a story as removed
- `RemovedStoriesService.restoreStory(...)` - Restore a removed story

## Usage

When a user removes a story from a bundle (via the UI), the system should call:

```typescript
await RemovedStoriesService.markAsRemoved(
  storyId,
  bundleId,
  userId,
  storyUrl
);
```

The story will then be automatically filtered out during:
- Feed refreshes
- Cache loading
- Story suggestions

## Testing

A test script is provided at `scripts/test-removed-stories.ts` to verify the functionality.

## Future Enhancements

1. Add a "Show Removed Stories" toggle in the UI
2. Add bulk restore functionality
3. Add automatic cleanup of old removed stories (e.g., after 30 days)
4. Add metrics on how many stories are filtered per bundle