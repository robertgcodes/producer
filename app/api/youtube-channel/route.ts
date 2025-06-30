import { NextRequest, NextResponse } from 'next/server';
import Parser from 'rss-parser';

const parser = new Parser();

export async function POST(request: NextRequest) {
  try {
    const { input } = await request.json();
    
    if (!input) {
      return NextResponse.json(
        { error: 'YouTube channel input is required' },
        { status: 400 }
      );
    }

    // Clean the input
    let searchQuery = input.trim();
    
    // Remove @ symbol if present
    if (searchQuery.startsWith('@')) {
      searchQuery = searchQuery.substring(1);
    }
    
    // If it's already a channel ID, use it directly
    if (/^[UC][\w-]{21}[AQgw]$/.test(searchQuery)) {
      return NextResponse.json({
        channelId: searchQuery,
        feedUrl: `https://www.youtube.com/feeds/videos.xml?channel_id=${searchQuery}`,
      });
    }

    // Log for debugging
    console.log('YouTube resolver: Processing input:', input);
    console.log('YouTube resolver: Clean query:', searchQuery);
    
    // Extract from URL if provided
    if (input.includes('youtube.com/')) {
      const patterns = [
        /youtube\.com\/channel\/([UC][\w-]{21}[AQgw])/i,
        /youtube\.com\/@([^\/\?]+)/i,
        /youtube\.com\/user\/([^\/\?]+)/i,
        /youtube\.com\/c\/([^\/\?]+)/i,
      ];
      
      for (const pattern of patterns) {
        const match = input.match(pattern);
        if (match) {
          if (pattern.toString().includes('channel')) {
            // Direct channel ID
            console.log('Found channel ID in URL:', match[1]);
            return NextResponse.json({
              channelId: match[1],
              feedUrl: `https://www.youtube.com/feeds/videos.xml?channel_id=${match[1]}`,
            });
          } else {
            // Extract handle/username from URL
            searchQuery = match[1];
            console.log('Extracted from URL:', searchQuery);
            break;
          }
        }
      }
    }

    // Strategy 1: Try common RSS feed patterns
    const feedPatterns = [
      // Modern handle format
      { 
        url: `https://www.youtube.com/@${searchQuery}`,
        type: 'handle' 
      },
      // Legacy user format
      { 
        url: `https://www.youtube.com/feeds/videos.xml?user=${searchQuery}`,
        type: 'user_feed' 
      },
      // Channel format
      { 
        url: `https://www.youtube.com/c/${searchQuery}`,
        type: 'channel' 
      },
      // Direct user page
      { 
        url: `https://www.youtube.com/user/${searchQuery}`,
        type: 'user' 
      },
    ];

    for (const pattern of feedPatterns) {
      try {
        if (pattern.type === 'user_feed') {
          // Try to parse the RSS feed directly
          const feed = await parser.parseURL(pattern.url);
          if (feed && feed.items && feed.items.length > 0) {
            // Extract channel ID from feed item links
            const firstItem = feed.items[0];
            if (firstItem.link) {
              const channelMatch = firstItem.link.match(/channel\/([UC][\w-]{21}[AQgw])/);
              if (channelMatch) {
                return NextResponse.json({
                  channelId: channelMatch[1],
                  channelName: feed.title,
                  feedUrl: `https://www.youtube.com/feeds/videos.xml?channel_id=${channelMatch[1]}`,
                });
              }
            }
            
            // If we can't extract channel ID, at least the feed works
            return NextResponse.json({
              channelName: feed.title,
              feedUrl: pattern.url,
            });
          }
        } else {
          // For other types, fetch the page directly
          console.log('Trying URL:', pattern.url);
          const pageResponse = await fetch(pattern.url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.5',
              'Cache-Control': 'no-cache',
            },
            redirect: 'follow',
          });
          
          if (pageResponse.ok) {
            const html = await pageResponse.text();
            
            // Log a snippet for debugging
            console.log('Got response, HTML length:', html.length);
            
            // Look for channel ID in various places
            const patterns = [
              /"channelId":"([UC][\w-]{21}[AQgw])"/,
              /\/channel\/([UC][\w-]{21}[AQgw])/,
              /"browseId":"([UC][\w-]{21}[AQgw])"/,
              /"externalId":"([UC][\w-]{21}[AQgw])"/,
              /"externalChannelId":"([UC][\w-]{21}[AQgw])"/,
              /<link rel="canonical" href="[^"]*\/channel\/([UC][\w-]{21}[AQgw])"/,
              /<meta itemprop="channelId" content="([UC][\w-]{21}[AQgw])"/,
              /data-channel-external-id="([UC][\w-]{21}[AQgw])"/,
            ];
            
            for (const pattern of patterns) {
              const match = html.match(pattern);
              if (match) {
                const channelId = match[1];
                console.log('Found channel ID with pattern:', pattern, channelId);
                
                // Try to get channel name
                const nameMatch = html.match(/<meta property="og:title" content="([^"]+)">/) ||
                                 html.match(/<title>([^<]+)<\/title>/) ||
                                 html.match(/"title":"([^"]+)"/);
                
                return NextResponse.json({
                  channelId,
                  channelName: nameMatch ? nameMatch[1].replace(' - YouTube', '') : null,
                  feedUrl: `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`,
                });
              }
            }
            
            // If no channel ID found, log for debugging
            console.log('No channel ID found in HTML');
            
            // Try one more strategy: look for RSS alternate link
            const rssMatch = html.match(/<link rel="alternate" type="application\/rss\+xml" [^>]*href="([^"]+)"/); 
            if (rssMatch) {
              console.log('Found RSS link:', rssMatch[1]);
              return NextResponse.json({
                feedUrl: rssMatch[1],
              });
            }
          } else {
            console.log('Page response not OK:', pageResponse.status, pageResponse.statusText);
          }
        }
      } catch (error) {
        console.log(`Failed to try pattern ${pattern.url}:`, error);
        continue;
      }
    }

    // Strategy 2: Try to construct feed URL directly and test it
    // Sometimes YouTube accepts the handle directly in the feed URL
    try {
      const testFeedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${searchQuery}`;
      const feed = await parser.parseURL(testFeedUrl);
      
      if (feed && feed.items && feed.items.length > 0) {
        return NextResponse.json({
          channelName: feed.title,
          feedUrl: testFeedUrl,
        });
      }
    } catch (error) {
      console.log('Direct channel_id feed failed:', error);
    }
    
    // Strategy 3: If it looks like a handle, we can provide instructions
    // Since YouTube's handle system is relatively new, some channels might need manual resolution
    if (input.includes('@') || searchQuery.match(/^[a-zA-Z0-9_-]+$/)) {
      // Provide a manual workaround
      return NextResponse.json(
        { 
          error: `Could not automatically resolve YouTube channel "${input}".\n\n` +
                  `To add this channel manually:\n` +
                  `1. Go to ${input.includes('youtube.com') ? input : `https://www.youtube.com/@${searchQuery}`}\n` +
                  `2. Click on the channel name/avatar to go to their main page\n` +
                  `3. Right-click and "View Page Source"\n` +
                  `4. Search for "channelId" or "UC" in the source\n` +
                  `5. Copy the channel ID (starts with UC)\n` +
                  `6. Paste it here instead of the @handle\n\n` +
                  `Common issue: Some newer channels only have handles and haven't been assigned traditional channel IDs yet.`
        },
        { status: 404 }
      );
    }

    // If all strategies fail, provide helpful error message
    return NextResponse.json(
      { 
        error: `Could not find YouTube channel for "${input}". Please try:\n` +
                `1. Copy the full channel URL from YouTube\n` +
                `2. Use the channel ID (starts with UC)\n` +
                `3. Try without the @ symbol\n` +
                `4. Some channels may not have RSS feeds enabled` 
      },
      { status: 404 }
    );
  } catch (error) {
    console.error('Error resolving YouTube channel:', error);
    return NextResponse.json(
      { error: 'Failed to resolve YouTube channel' },
      { status: 500 }
    );
  }
}