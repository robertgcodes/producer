import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { TwitterApi } from 'twitter-api-v2';

// Twitter API v2 client
let twitterClient: TwitterApi | null = null;

// Initialize Twitter client with API keys from environment
function getTwitterClient() {
  if (!twitterClient) {
    const bearerToken = process.env.TWITTER_BEARER_TOKEN;
    if (!bearerToken) {
      throw new Error('Twitter Bearer Token not configured');
    }
    twitterClient = new TwitterApi(bearerToken);
  }
  return twitterClient;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');
    const userId = searchParams.get('userId');
    const count = parseInt(searchParams.get('count') || '10');
    
    if (!username && !userId) {
      return NextResponse.json(
        { error: 'Username or userId required' },
        { status: 400 }
      );
    }
    
    const client = getTwitterClient();
    const readOnlyClient = client.readOnly;
    
    // Get user ID if only username provided
    let targetUserId = userId;
    if (!targetUserId && username) {
      const user = await readOnlyClient.v2.userByUsername(username);
      if (!user.data) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }
      targetUserId = user.data.id;
    }
    
    // Get user's tweets with media
    const tweets = await readOnlyClient.v2.userTimeline(targetUserId!, {
      max_results: Math.min(count, 100),
      'tweet.fields': ['created_at', 'author_id', 'public_metrics', 'entities', 'referenced_tweets', 'attachments'],
      'media.fields': ['url', 'preview_image_url', 'type', 'width', 'height', 'alt_text'],
      'expansions': ['attachments.media_keys'],
      exclude: ['retweets', 'replies'],
    });
    
    // Get media map
    const mediaMap = new Map();
    tweets.includes?.media?.forEach(media => {
      mediaMap.set(media.media_key, media);
    });
    
    // Format tweets for our app
    const formattedTweets = tweets.data.data?.map(tweet => {
      // Get media for this tweet
      const tweetMedia = tweet.attachments?.media_keys?.map(key => mediaMap.get(key)).filter(Boolean) || [];
      
      return {
        id: tweet.id,
        text: tweet.text,
        createdAt: tweet.created_at,
        metrics: tweet.public_metrics,
        url: `https://twitter.com/i/web/status/${tweet.id}`,
        entities: tweet.entities,
        media: tweetMedia.map(m => ({
          type: m.type,
          url: m.url || m.preview_image_url,
          width: m.width,
          height: m.height,
          altText: m.alt_text
        }))
      };
    }) || [];
    
    return NextResponse.json({
      tweets: formattedTweets,
      username: username || targetUserId,
    });
    
  } catch (error: any) {
    console.error('Twitter API error:', error);
    
    if (error.code === 429) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || 'Failed to fetch tweets' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, listId } = body;
    
    if (!username && !listId) {
      return NextResponse.json(
        { error: 'Username or listId required' },
        { status: 400 }
      );
    }
    
    const client = getTwitterClient();
    const readOnlyClient = client.readOnly;
    
    if (listId) {
      // Get tweets from a list
      const listTweets = await readOnlyClient.v2.listTweets(listId, {
        max_results: 100,
        'tweet.fields': ['created_at', 'author_id', 'public_metrics', 'entities', 'attachments'],
        'media.fields': ['url', 'preview_image_url', 'type', 'width', 'height', 'alt_text'],
        'expansions': ['attachments.media_keys'],
      });
      
      // Get media map
      const mediaMap = new Map();
      listTweets.includes?.media?.forEach(media => {
        mediaMap.set(media.media_key, media);
      });
      
      // Format tweets with media
      const formattedTweets = listTweets.data.data?.map(tweet => {
        const tweetMedia = tweet.attachments?.media_keys?.map(key => mediaMap.get(key)).filter(Boolean) || [];
        
        return {
          id: tweet.id,
          text: tweet.text,
          createdAt: tweet.created_at,
          metrics: tweet.public_metrics,
          url: `https://twitter.com/i/web/status/${tweet.id}`,
          entities: tweet.entities,
          media: tweetMedia.map(m => ({
            type: m.type,
            url: m.url || m.preview_image_url,
            width: m.width,
            height: m.height,
            altText: m.alt_text
          }))
        };
      }) || [];
      
      return NextResponse.json({
        tweets: formattedTweets,
        source: 'list',
        listId,
      });
    }
    
    // Search for tweets by keyword/hashtag
    if (username.startsWith('#') || username.startsWith('@')) {
      const searchQuery = username;
      const searchResults = await readOnlyClient.v2.search(searchQuery, {
        max_results: 100,
        'tweet.fields': ['created_at', 'author_id', 'public_metrics', 'entities', 'attachments'],
        'media.fields': ['url', 'preview_image_url', 'type', 'width', 'height', 'alt_text'],
        'expansions': ['attachments.media_keys'],
      });
      
      // Get media map
      const mediaMap = new Map();
      searchResults.includes?.media?.forEach(media => {
        mediaMap.set(media.media_key, media);
      });
      
      // Format tweets with media
      const formattedTweets = searchResults.data.data?.map(tweet => {
        const tweetMedia = tweet.attachments?.media_keys?.map(key => mediaMap.get(key)).filter(Boolean) || [];
        
        return {
          id: tweet.id,
          text: tweet.text,
          createdAt: tweet.created_at,
          metrics: tweet.public_metrics,
          url: `https://twitter.com/i/web/status/${tweet.id}`,
          entities: tweet.entities,
          media: tweetMedia.map(m => ({
            type: m.type,
            url: m.url || m.preview_image_url,
            width: m.width,
            height: m.height,
            altText: m.alt_text
          }))
        };
      }) || [];
      
      return NextResponse.json({
        tweets: formattedTweets,
        source: 'search',
        query: searchQuery,
      });
    }
    
    return NextResponse.json(
      { error: 'Invalid request format' },
      { status: 400 }
    );
    
  } catch (error: any) {
    console.error('Twitter API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch tweets' },
      { status: 500 }
    );
  }
}