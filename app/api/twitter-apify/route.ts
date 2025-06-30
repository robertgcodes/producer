import { NextRequest, NextResponse } from 'next/server';

// Apify Twitter scraper configuration
const APIFY_API_URL = 'https://api.apify.com/v2';
// Using kaitoeasyapi's Twitter scraper (pay per result, cheapest option)
const TWITTER_SCRAPER_ACTOR_ID = 'kaitoeasyapi/twitter-x-data-tweet-scraper-pay-per-result-cheapest';

interface ApifyTweetData {
  id: string;
  text: string;
  created_at: string;
  user: {
    id: string;
    name: string;
    username: string;
    profile_image_url?: string;
  };
  public_metrics?: {
    retweet_count: number;
    reply_count: number;
    like_count: number;
    quote_count: number;
  };
  entities?: any;
  media?: Array<{
    type: string;
    url: string;
    width?: number;
    height?: number;
  }>;
}

async function runApifyActor(input: any) {
  const apiToken = process.env.APIFY_TOKEN || process.env.APIFY_API_TOKEN;
  if (!apiToken) {
    throw new Error('APIFY_TOKEN not configured');
  }

  // Start the actor run
  const runResponse = await fetch(
    `${APIFY_API_URL}/acts/${TWITTER_SCRAPER_ACTOR_ID}/runs`,
    {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiToken}`
      },
      body: JSON.stringify(input),
    }
  );

  if (!runResponse.ok) {
    const error = await runResponse.text();
    throw new Error(`Failed to start Apify actor: ${error}`);
  }

  const run = await runResponse.json();
  const runId = run.data.id;

  // Wait for the run to complete (with timeout)
  const maxWaitTime = 60000; // 60 seconds
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitTime) {
    const statusResponse = await fetch(
      `${APIFY_API_URL}/actor-runs/${runId}`,
      {
        headers: {
          'Authorization': `Bearer ${apiToken}`
        }
      }
    );
    
    if (!statusResponse.ok) {
      throw new Error('Failed to check run status');
    }
    
    const status = await statusResponse.json();
    
    if (status.data.status === 'SUCCEEDED') {
      // Get the results
      const resultsResponse = await fetch(
        `${APIFY_API_URL}/actor-runs/${runId}/dataset/items`,
        {
          headers: {
            'Authorization': `Bearer ${apiToken}`
          }
        }
      );
      
      if (!resultsResponse.ok) {
        throw new Error('Failed to fetch results');
      }
      
      return await resultsResponse.json();
    } else if (status.data.status === 'FAILED' || status.data.status === 'ABORTED') {
      throw new Error(`Actor run ${status.data.status}: ${status.data.statusMessage}`);
    }
    
    // Wait 2 seconds before checking again
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  throw new Error('Timeout waiting for Apify actor to complete');
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');
    const count = parseInt(searchParams.get('count') || '20');
    
    if (!username) {
      return NextResponse.json(
        { error: 'Username required' },
        { status: 400 }
      );
    }
    
    // Clean username (remove @ if present)
    const cleanUsername = username.replace('@', '');
    
    // Run Apify actor to get tweets
    // Using kaitoeasyapi format for user timeline
    const apifyInput = {
      profiles: [cleanUsername],
      tweetsDesired: count,
      includeReplies: false,
      includeRetweets: false
    };
    
    console.log('Apify input for user timeline:', apifyInput);
    
    const results = await runApifyActor(apifyInput);
    console.log('Apify raw results:', results);
    
    // Format tweets to match our existing structure
    // The kaitoeasyapi actor returns results in a specific format
    const tweets = Array.isArray(results) ? results : [];
    const formattedTweets = tweets.map((tweet: any) => {
      const media = [];
      
      // Handle media from kaitoeasyapi format
      if (tweet.images && Array.isArray(tweet.images)) {
        tweet.images.forEach((imageUrl: string) => {
          media.push({
            type: 'photo',
            url: imageUrl,
          });
        });
      }
      
      if (tweet.video && tweet.video.url) {
        media.push({
          type: 'video',
          url: tweet.video.preview || tweet.video.url,
          width: tweet.video.width,
          height: tweet.video.height,
        });
      }
      
      // Handle legacy formats just in case
      if (tweet.photos && Array.isArray(tweet.photos)) {
        tweet.photos.forEach((photo: any) => {
          media.push({
            type: 'photo',
            url: photo.url || photo,
            width: photo.width,
            height: photo.height,
          });
        });
      }
      
      if (tweet.videos && Array.isArray(tweet.videos)) {
        tweet.videos.forEach((video: any) => {
          media.push({
            type: 'video',
            url: video.preview || video.url || video,
            width: video.width,
            height: video.height,
          });
        });
      }
      
      // Extract media from tweet - Legacy Apify format
      if (!media.length && tweet.media?.photos) {
        tweet.media.photos.forEach((photo: any) => {
          media.push({
            type: 'photo',
            url: photo.url,
            width: photo.width,
            height: photo.height,
          });
        });
      }
      
      if (!media.length && tweet.media?.videos) {
        tweet.media.videos.forEach((video: any) => {
          media.push({
            type: 'video',
            url: video.preview || video.url,
            width: video.width,
            height: video.height,
          });
        });
      }
      
      // Alternative media extraction for different Apify formats
      if (!media.length && tweet.extendedEntities?.media) {
        tweet.extendedEntities.media.forEach((m: any) => {
          media.push({
            type: m.type,
            url: m.media_url_https || m.media_url,
            width: m.sizes?.large?.w,
            height: m.sizes?.large?.h,
          });
        });
      }
      
      // Handle kaitoeasyapi's specific ID format
      const tweetId = tweet.id || tweet.tweetId || tweet.conversationId || tweet.rest_id || String(Date.now() + Math.random());
      
      return {
        id: tweetId,
        text: tweet.text || tweet.full_text || tweet.tweetText || tweet.fullText || tweet.fullRawText || '',
        createdAt: tweet.createdAt || tweet.created_at || tweet.time || tweet.date || tweet.timestamp || new Date().toISOString(),
        metrics: {
          retweet_count: tweet.retweetCount || tweet.retweet_count || tweet.retweets || tweet.retweetsCount || 0,
          reply_count: tweet.replyCount || tweet.reply_count || tweet.replies || tweet.repliesCount || 0,
          like_count: tweet.likeCount || tweet.favorite_count || tweet.likes || tweet.likesCount || 0,
          quote_count: tweet.quoteCount || tweet.quote_count || tweet.quotes || tweet.quotesCount || 0,
        },
        url: tweet.url || tweet.tweetUrl || tweet.link || `https://twitter.com/${tweet.username || tweet.author?.username || cleanUsername}/status/${tweetId}`,
        entities: tweet.entities || {},
        media: media,
      };
    });
    
    return NextResponse.json({
      tweets: formattedTweets,
      username: cleanUsername,
    });
    
  } catch (error: any) {
    console.error('Apify Twitter API error:', error);
    
    // Check if it's an Apify configuration error
    if (error.message.includes('APIFY_TOKEN')) {
      return NextResponse.json(
        { error: 'Apify API not configured. Please add APIFY_TOKEN to your environment variables.' },
        { status: 500 }
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
    const { username, searchQuery } = body;
    
    if (!username && !searchQuery) {
      return NextResponse.json(
        { error: 'Username or searchQuery required' },
        { status: 400 }
      );
    }
    
    // For search queries, use kaitoeasyapi format
    if (searchQuery) {
      const apifyInput = {
        queries: [searchQuery],
        tweetsDesired: 50,
        includeReplies: false,
        includeRetweets: false
      };
      
      const results = await runApifyActor(apifyInput);
      
      // Format tweets (same format as timeline tweets)
      const tweets = Array.isArray(results) ? results : [];
      const formattedTweets = tweets.map((tweet: any) => {
        const media = [];
        
        // Handle media from kaitoeasyapi format
        if (tweet.images && Array.isArray(tweet.images)) {
          tweet.images.forEach((imageUrl: string) => {
            media.push({
              type: 'photo',
              url: imageUrl,
            });
          });
        }
        
        if (tweet.video && tweet.video.url) {
          media.push({
            type: 'video',
            url: tweet.video.preview || tweet.video.url,
            width: tweet.video.width,
            height: tweet.video.height,
          });
        }
        
        // Handle legacy formats
        if (tweet.media?.photos) {
          tweet.media.photos.forEach((photo: any) => {
            media.push({
              type: 'photo',
              url: photo.url,
              width: photo.width,
              height: photo.height,
            });
          });
        }
        
        if (tweet.media?.videos) {
          tweet.media.videos.forEach((video: any) => {
            media.push({
              type: 'video',
              url: video.preview || video.url,
              width: video.width,
              height: video.height,
            });
          });
        }
        
        // Alternative media extraction
        if (!media.length && tweet.extendedEntities?.media) {
          tweet.extendedEntities.media.forEach((m: any) => {
            media.push({
              type: m.type,
              url: m.media_url_https || m.media_url,
              width: m.sizes?.large?.w,
              height: m.sizes?.large?.h,
            });
          });
        }
        
        const tweetId = tweet.id || tweet.tweetId || tweet.conversationId || String(Date.now() + Math.random());
        
        return {
          id: tweetId,
          text: tweet.text || tweet.full_text || tweet.tweetText || tweet.fullText || tweet.fullRawText || '',
          createdAt: tweet.createdAt || tweet.created_at || tweet.time || tweet.date || tweet.timestamp || new Date().toISOString(),
          metrics: {
            retweet_count: tweet.retweetCount || tweet.retweet_count || tweet.retweets || tweet.retweetsCount || 0,
            reply_count: tweet.replyCount || tweet.reply_count || tweet.replies || tweet.repliesCount || 0,
            like_count: tweet.likeCount || tweet.favorite_count || tweet.likes || tweet.likesCount || 0,
            quote_count: tweet.quoteCount || tweet.quote_count || tweet.quotes || tweet.quotesCount || 0,
          },
          url: tweet.url || tweet.tweetUrl || tweet.link || `https://twitter.com/${tweet.username || tweet.author?.username || 'i'}/status/${tweetId}`,
          entities: tweet.entities || {},
          media: media,
        };
      });
      
      return NextResponse.json({
        tweets: formattedTweets,
        source: 'search',
        query: searchQuery,
      });
    }
    
    // Regular username timeline fetch
    return GET(request);
    
  } catch (error: any) {
    console.error('Apify Twitter API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch tweets' },
      { status: 500 }
    );
  }
}