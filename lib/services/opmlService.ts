export interface OPMLFeed {
  title: string;
  xmlUrl: string;
  htmlUrl?: string;
  category?: string;
  description?: string;
  type?: string;
}

export class OPMLService {
  /**
   * Parse OPML content and extract feed information
   */
  static parseOPML(opmlContent: string): OPMLFeed[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(opmlContent, 'text/xml');
    const feeds: OPMLFeed[] = [];
    
    // Check for parse errors
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      throw new Error('Invalid OPML file format');
    }
    
    // Find all outline elements with xmlUrl
    const outlines = doc.querySelectorAll('outline[xmlUrl]');
    
    outlines.forEach(outline => {
      const xmlUrl = outline.getAttribute('xmlUrl');
      const title = outline.getAttribute('title') || outline.getAttribute('text') || 'Untitled Feed';
      const htmlUrl = outline.getAttribute('htmlUrl') || undefined;
      const type = outline.getAttribute('type') || undefined;
      const description = outline.getAttribute('description') || undefined;
      
      // Try to get category from parent outline
      let category = outline.getAttribute('category');
      if (!category) {
        const parent = outline.parentElement;
        if (parent && parent.tagName === 'outline' && !parent.hasAttribute('xmlUrl')) {
          category = parent.getAttribute('title') || parent.getAttribute('text');
        }
      }
      
      if (xmlUrl) {
        feeds.push({
          title,
          xmlUrl,
          htmlUrl,
          category: category || 'General',
          description,
          type: type || 'rss'
        });
      }
    });
    
    return feeds;
  }
  
  /**
   * Validate that a file is OPML
   */
  static isValidOPML(content: string): boolean {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(content, 'text/xml');
      
      // Check for parse errors
      if (doc.querySelector('parsererror')) {
        return false;
      }
      
      // Check for OPML root element
      const opmlElement = doc.querySelector('opml');
      return !!opmlElement;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Extract unique categories from feeds
   */
  static extractCategories(feeds: OPMLFeed[]): string[] {
    const categories = new Set<string>();
    feeds.forEach(feed => {
      if (feed.category) {
        categories.add(feed.category);
      }
    });
    return Array.from(categories).sort();
  }
  
  /**
   * Group feeds by category
   */
  static groupByCategory(feeds: OPMLFeed[]): Record<string, OPMLFeed[]> {
    const grouped: Record<string, OPMLFeed[]> = {};
    
    feeds.forEach(feed => {
      const category = feed.category || 'General';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(feed);
    });
    
    return grouped;
  }
}