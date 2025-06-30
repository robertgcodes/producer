import { NextResponse } from 'next/server';
import Parser from 'rss-parser';

const parser = new Parser({
  customFields: {
    item: [
      ['media:content', 'media:content', { keepArray: true }],
      ['media:thumbnail', 'media:thumbnail'],
      ['description', 'description'],
      ['content:encoded', 'content:encoded'],
      ['dc:creator', 'creator'],
      ['author', 'author']
    ]
  }
});

export async function POST(request: Request) {
  try {
    const { url } = await request.json();
    
    if (!url) {
      return NextResponse.json(
        { error: 'RSS feed URL is required' },
        { status: 400 }
      );
    }

    // Fetch and parse the RSS feed with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    let feed;
    try {
      feed = await parser.parseURL(url);
    } catch (parseError) {
      clearTimeout(timeout);
      throw parseError;
    } finally {
      clearTimeout(timeout);
    }
    
    // Extract relevant feed information
    const feedData = {
      title: feed.title || 'Untitled Feed',
      description: feed.description || '',
      link: feed.link || '',
      lastBuildDate: feed.lastBuildDate || new Date().toISOString(),
      items: feed.items.map(item => ({
        title: item.title || 'Untitled',
        link: item.link || '',
        pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
        contentSnippet: item.contentSnippet || item.summary || '',
        content: item['content:encoded'] || item.content || '',
        creator: item.creator || item.author || '',
        categories: item.categories || [],
        guid: item.guid || item.link || '',
        mediaContent: item['media:content'] || [],
        mediaThumbnail: item['media:thumbnail'] || null
      }))
    };

    return NextResponse.json(feedData);
  } catch (error) {
    console.error('Error fetching RSS feed:', error);
    
    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('Status code')) {
        return NextResponse.json(
          { error: 'Failed to fetch RSS feed. The feed URL may be invalid or the server is not responding.' },
          { status: 400 }
        );
      }
      if (error.message.includes('Unexpected token')) {
        return NextResponse.json(
          { error: 'Invalid RSS feed format. The URL may not be pointing to a valid RSS/XML feed.' },
          { status: 400 }
        );
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch or parse RSS feed' },
      { status: 500 }
    );
  }
}