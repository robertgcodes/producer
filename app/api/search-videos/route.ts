import { NextRequest, NextResponse } from 'next/server';

interface VideoResult {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  url: string;
  platform: 'youtube' | 'twitter' | 'vimeo' | 'tiktok';
  duration?: string;
  author: {
    name: string;
    url?: string;
  };
  publishedAt: string;
  viewCount?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, platform, bundleContext } = body;

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    // In a real implementation, this would search YouTube, Twitter, etc.
    // For now, return mock data
    const mockVideos: VideoResult[] = [
      {
        id: `yt-${Date.now()}-1`,
        title: `${query} - Latest Updates and Analysis`,
        description: `Comprehensive coverage of ${query} with expert commentary and in-depth analysis of recent developments.`,
        thumbnailUrl: `https://via.placeholder.com/320x180?text=${encodeURIComponent(query)}`,
        url: `https://youtube.com/watch?v=${Math.random().toString(36).substr(2, 9)}`,
        platform: 'youtube',
        duration: '15:42',
        author: {
          name: 'News Network',
          url: 'https://youtube.com/@newschannel'
        },
        publishedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
        viewCount: Math.floor(Math.random() * 1000000)
      },
      {
        id: `tw-${Date.now()}-2`,
        title: `Breaking: ${query}`,
        description: `JUST IN: New developments regarding ${query}. Thread below with updates...`,
        thumbnailUrl: `https://via.placeholder.com/320x180?text=Breaking+News`,
        url: `https://twitter.com/user/status/${Math.floor(Math.random() * 1000000000000)}`,
        platform: 'twitter',
        author: {
          name: '@journalisthandle'
        },
        publishedAt: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString(),
        viewCount: Math.floor(Math.random() * 100000)
      },
      {
        id: `yt-${Date.now()}-3`,
        title: `${query} Explained: What You Need to Know`,
        description: `Everything you need to know about ${query} in under 10 minutes. Clear, concise explanation of the key facts.`,
        thumbnailUrl: `https://via.placeholder.com/320x180?text=Explainer`,
        url: `https://youtube.com/watch?v=${Math.random().toString(36).substr(2, 9)}`,
        platform: 'youtube',
        duration: '8:23',
        author: {
          name: 'Explainer Channel',
          url: 'https://youtube.com/@explainer'
        },
        publishedAt: new Date(Date.now() - Math.random() * 3 * 24 * 60 * 60 * 1000).toISOString(),
        viewCount: Math.floor(Math.random() * 500000)
      }
    ];

    // Filter by platform if specified
    let videos = mockVideos;
    if (platform && platform !== 'all') {
      videos = videos.filter(v => v.platform === platform);
    }

    // Add more variety based on query
    if (query.toLowerCase().includes('trump') || query.toLowerCase().includes('biden')) {
      videos.push({
        id: `yt-${Date.now()}-4`,
        title: `${query} Press Conference - Full Coverage`,
        description: `Watch the complete press conference with live commentary and fact-checking.`,
        thumbnailUrl: `https://via.placeholder.com/320x180?text=Press+Conference`,
        url: `https://youtube.com/watch?v=${Math.random().toString(36).substr(2, 9)}`,
        platform: 'youtube',
        duration: '45:12',
        author: {
          name: 'C-SPAN',
          url: 'https://youtube.com/@cspan'
        },
        publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        viewCount: Math.floor(Math.random() * 2000000)
      });
    }

    return NextResponse.json({ videos });
  } catch (error: any) {
    console.error('Error searching videos:', error);
    return NextResponse.json({ error: 'Failed to search videos' }, { status: 500 });
  }
}