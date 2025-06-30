# Firestore Index Configuration

The application requires the following composite indexes to be created in Firestore:

## Required Indexes

### 1. ContentItems Collection Index
This index is needed for querying content items by bundleId and sorting by order.

**Collection:** `contentItems`  
**Fields:**
- `bundleId` (Ascending)
- `order` (Ascending)

You can manually create the index in the Firebase Console:
1. Go to Firebase Console > Firestore Database > Indexes
2. Click "Create Index"
3. Collection ID: `contentItems`
4. Add fields:
   - Field path: `bundleId`, Order: Ascending
   - Field path: `order`, Order: Ascending
5. Query scope: Collection
6. Click "Create"

## Other Required Indexes

### 2. FeedItems Collection Index
For querying feed items by feedId and sorting by publication date.

**Collection:** `feedItems`  
**Fields:**
- `feedId` (Ascending)
- `pubDate` (Descending)

### 3. BundleFiles Collection Index
For querying files by bundleId and sorting by order.

**Collection:** `bundleFiles`  
**Fields:**
- `bundleId` (Ascending)
- `order` (Ascending)

### 4. StoryChunks Collection Index
For querying story chunks by bundleId and chunk index.

**Collection:** `storyChunks`  
**Fields:**
- `bundleId` (Ascending)
- `chunkIndex` (Ascending)

### 5. FeedStories Collection Indexes
For the permanent feed story storage:

**Collection:** `feedStories`  
**Index 1 - By Feed:**
- `feedId` (Ascending)
- `pubDate` (Descending)

**Index 2 - By Feed Type:**
- `feedType` (Ascending)
- `pubDate` (Descending)

**Index 3 - For Cleanup:**
- `firstSeenAt` (Ascending)

## Deploy Indexes Using Firebase CLI

You can deploy all indexes at once using:

```bash
firebase deploy --only firestore:indexes
```

## Note
These indexes may take a few minutes to build after creation. The errors will disappear once the indexes are ready.