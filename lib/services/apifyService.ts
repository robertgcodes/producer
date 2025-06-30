export interface ApifyImageResult {
  imageUrl: string;
  thumbnailUrl: string;
  title: string;
  source: string;
  width: number;
  height: number;
  pageUrl?: string;
}

export interface ApifyTweetResult {
  id: string;
  text: string;
  author: {
    username: string;
    name: string;
    verified: boolean;
  };
  createdAt: string;
  metrics: {
    likes: number;
    retweets: number;
    replies: number;
  };
  url: string;
}

export class ApifyService {
  private static readonly API_BASE = 'https://api.apify.com/v2';
  // Using the user's own actors from their Apify account
  private static readonly GOOGLE_IMAGES_ACTOR = 'tnudF2IxzORPhg4r8'; // google-images-scraper
  private static readonly TWITTER_SCRAPER_ACTOR = 'u6ppkMWAx2E2MpEuF'; // twitter-scraper

  static async searchImages(query: string, options?: {
    maxImages?: number;
    safeSearch?: boolean;
    countryCode?: string;
  }): Promise<ApifyImageResult[]> {
    const token = process.env.APIFY_TOKEN;
    if (!token) {
      throw new Error('Apify token not configured');
    }

    const actorInput = {
      queries: [query],
      maxImagesPerQuery: options?.maxImages || 6,
      mobileResults: false,
      countryCode: options?.countryCode || 'US',
      languageCode: 'en',
      safeSearch: options?.safeSearch !== false,
      domainCountryCodeTop: 'com'
    };

    const response = await fetch(`${this.API_BASE}/acts/${this.GOOGLE_IMAGES_ACTOR}/run-sync`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(actorInput),
    });

    if (!response.ok) {
      throw new Error(`Apify API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    return data.map((item: any) => ({
      imageUrl: item.imageUrl || item.originalImageUrl,
      thumbnailUrl: item.thumbnailUrl || item.imageUrl,
      title: item.title || item.alt || `${query} image`,
      source: item.source || (item.pageUrl ? new URL(item.pageUrl).hostname.replace('www.', '') : 'Unknown'),
      width: item.width || 800,
      height: item.height || 600,
      pageUrl: item.pageUrl
    }));
  }

  static async searchTweets(query: string, options?: {
    maxTweets?: number;
    lang?: string;
    includeReplies?: boolean;
  }): Promise<ApifyTweetResult[]> {
    const token = process.env.APIFY_TOKEN;
    if (!token) {
      throw new Error('Apify token not configured');
    }

    const actorInput = {
      searchTerms: [query],
      maxTweets: options?.maxTweets || 20,
      searchMode: 'live'
    };

    const response = await fetch(`${this.API_BASE}/acts/${this.TWITTER_SCRAPER_ACTOR}/run-sync`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(actorInput),
    });

    if (!response.ok) {
      throw new Error(`Apify Twitter API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    return data.map((tweet: any) => ({
      id: tweet.id,
      text: tweet.text,
      author: {
        username: tweet.author?.userName || '',
        name: tweet.author?.name || '',
        verified: tweet.author?.isVerified || false
      },
      createdAt: tweet.createdAt,
      metrics: {
        likes: tweet.likeCount || 0,
        retweets: tweet.retweetCount || 0,
        replies: tweet.replyCount || 0
      },
      url: tweet.url || `https://twitter.com/${tweet.author?.userName}/status/${tweet.id}`
    }));
  }

  // Future: Add more Apify actors for Instagram, LinkedIn, news sites, etc.
  static async scrapeNewsArticles(query: string) {
    // TODO: Implement news scraping with Apify
  }

  static async scrapeInstagramPosts(query: string) {
    // TODO: Implement Instagram scraping with Apify
  }
}