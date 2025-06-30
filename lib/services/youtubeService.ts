import { RSSService } from './rssService';

interface YouTubeChannel {
  channelId: string;
  channelName: string;
  thumbnail?: string;
}

export class YouTubeService {
  // Extract channel ID from various YouTube URL formats
  static extractChannelInfo(url: string): { channelId?: string; username?: string; handle?: string } {
    // Handle different YouTube URL patterns
    const patterns = {
      // Channel ID: youtube.com/channel/UCxxxxxx
      channelId: /youtube\.com\/channel\/([UC][\w-]{21}[AQgw])/i,
      // User/Username: youtube.com/user/username or youtube.com/c/username
      username: /youtube\.com\/(?:user|c)\/([^\/\?]+)/i,
      // Handle: youtube.com/@handle
      handle: /youtube\.com\/@([^\/\?]+)/i,
    };

    for (const [type, pattern] of Object.entries(patterns)) {
      const match = url.match(pattern);
      if (match) {
        return { [type]: match[1] };
      }
    }

    // Check if it's just a channel ID
    if (/^[UC][\w-]{21}[AQgw]$/.test(url)) {
      return { channelId: url };
    }

    // Check if it's a handle without @
    if (url.startsWith('@')) {
      return { handle: url.substring(1) };
    }

    return {};
  }

  // Get RSS feed URL for a YouTube channel
  static async getChannelRSSUrl(input: string): Promise<{ feedUrl: string; channelName?: string; thumbnail?: string }> {
    try {
      // Use our API endpoint to resolve the channel
      const response = await fetch('/api/youtube-channel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ input }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to resolve YouTube channel');
      }

      const data = await response.json();
      return {
        feedUrl: data.feedUrl,
        channelName: data.channelName,
        thumbnail: data.thumbnail,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to resolve YouTube channel');
    }
  }

  // Parse YouTube RSS feed with enhanced metadata
  static async fetchYouTubeFeed(feedUrl: string): Promise<any> {
    const feedData = await RSSService.fetchFeed(feedUrl);
    
    // Enhance feed items with YouTube-specific data
    if (feedData.items) {
      feedData.items = feedData.items.map((item: any) => {
        // Extract video ID from link
        const videoIdMatch = item.link?.match(/[?&]v=([^&]+)/);
        const videoId = videoIdMatch ? videoIdMatch[1] : null;
        
        // Add thumbnail if video ID exists
        if (videoId) {
          item.thumbnail = `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
        }
        
        // Parse media:thumbnail if available
        if (item['media:thumbnail']) {
          item.thumbnail = item['media:thumbnail'].$.url;
        }
        
        return item;
      });
    }
    
    return feedData;
  }
}