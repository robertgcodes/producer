import { NextRequest, NextResponse } from 'next/server';
import Parser from 'rss-parser';

const parser = new Parser();

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    const language = searchParams.get('hl') || 'en-US';
    const country = searchParams.get('gl') || 'US';
    const when = searchParams.get('when') || '7d';

    if (!query) {
      return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
    }

    // Build Google News RSS URL
    const baseUrl = 'https://news.google.com/rss/search';
    const params = new URLSearchParams({
      q: query,
      hl: language,
      gl: country,
      ceid: `${country}:${language.split('-')[0]}`
    });

    if (when !== 'all') {
      params.append('when', when);
    }

    const url = `${baseUrl}?${params}`;
    
    // Fetch and parse the RSS feed
    const feed = await parser.parseURL(url);
    
    // Process and clean up the items
    const items = feed.items.map(item => {
      // Extract source from title (Google News format: "Title - Source")
      let cleanTitle = item.title || '';
      let source = 'Google News';
      
      const titleParts = cleanTitle.split(' - ');
      if (titleParts.length > 1) {
        source = titleParts[titleParts.length - 1];
        cleanTitle = titleParts.slice(0, -1).join(' - ');
      }
      
      return {
        title: cleanTitle,
        link: item.link || '',
        pubDate: item.pubDate,
        contentSnippet: item.contentSnippet || item.content || '',
        source: source,
        guid: item.guid || item.link
      };
    });

    return NextResponse.json({ items });
  } catch (error) {
    console.error('Error fetching Google News:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Google News', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}