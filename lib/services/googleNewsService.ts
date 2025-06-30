interface GoogleNewsItem {
  title: string;
  link: string;
  pubDate?: string;
  contentSnippet?: string;
  source?: string;
  guid?: string;
}

export class GoogleNewsService {

  /**
   * Build Google News RSS URL from search query
   */
  static buildGoogleNewsUrl(query: string, options?: {
    language?: string;
    country?: string;
    when?: '1h' | '1d' | '7d' | '30d';
  }): string {
    const baseUrl = 'https://news.google.com/rss/search';
    const params = new URLSearchParams();
    
    // Clean and format the query
    const cleanQuery = query.trim().replace(/\s+/g, '+');
    params.append('q', cleanQuery);
    
    // Set language and country
    params.append('hl', options?.language || 'en-US');
    params.append('gl', options?.country || 'US');
    params.append('ceid', `${options?.country || 'US'}:${options?.language?.split('-')[0] || 'en'}`);
    
    // Add time filter if specified
    if (options?.when) {
      params.append('when', options.when);
    }
    
    return `${baseUrl}?${params.toString()}`;
  }

  /**
   * Search Google News and return parsed results
   */
  static async searchNews(query: string, options?: {
    language?: string;
    country?: string;
    when?: '1h' | '1d' | '7d' | '30d';
    maxResults?: number;
  }): Promise<GoogleNewsItem[]> {
    try {
      // Use the API route to avoid CORS issues
      const params = new URLSearchParams({
        q: query,
        hl: options?.language || 'en-US',
        gl: options?.country || 'US',
        when: options?.when || '7d'
      });
      
      const apiUrl = `/api/google-news?${params}`;
      console.log('Fetching Google News from API:', apiUrl);
      
      const response = await fetch(apiUrl);
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Google News API error:', response.status, errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Apply maxResults limit if specified
      const items = data.items || [];
      const maxResults = options?.maxResults || 20;
      return items.slice(0, maxResults);
    } catch (error) {
      console.error('Error fetching Google News:', error);
      throw new Error(`Failed to fetch Google News: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get feed data in standard format for storage
   */
  static async getGoogleNewsFeed(query: string, options?: {
    when?: '1h' | '1d' | '7d' | '30d';
  }) {
    const items = await this.searchNews(query, options);
    
    return {
      title: `Google News: ${query}`,
      description: `Google News search results for "${query}"`,
      link: this.buildGoogleNewsUrl(query, options),
      lastBuildDate: new Date().toISOString(),
      items: items.map(item => ({
        title: item.title,
        link: item.link,
        pubDate: item.pubDate,
        contentSnippet: item.contentSnippet,
        categories: [item.source || 'Google News'],
        guid: item.guid
      }))
    };
  }

  /**
   * Convert freshness filter days to Google News time parameter
   */
  static daysToGoogleWhen(days: number): '1h' | '1d' | '7d' | '30d' | undefined {
    if (days <= 1) return '1d';
    if (days <= 7) return '7d';
    if (days <= 30) return '30d';
    return undefined; // No filter for > 30 days
  }
}