import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  let query = 'Unknown';
  let entityType = 'person';
  
  try {
    const body = await request.json();
    query = body.query || 'Unknown';
    entityType = body.entityType || 'person';

    console.log('Image search request:', { query, entityType });

    if (!query || query === 'Unknown') {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    // Try Apify Google Images scraper for fresh, relevant images
    const apifyToken = process.env.APIFY_TOKEN;
    
    if (apifyToken) {
      console.log('Using Apify Google Images scraper');
      try {
        // Start the Google Images scraper
        const actorInput = {
          queries: [query],
          maxImagesPerQuery: 6,
          mobileResults: false,
          countryCode: 'US',
          languageCode: 'en',
          safeSearch: true,
          domainCountryCodeTop: 'com'
        };

        const runResponse = await fetch('https://api.apify.com/v2/acts/hooli/google-images-scraper/run-sync', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apifyToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(actorInput),
        });

        if (runResponse.ok) {
          const runData = await runResponse.json();
          
          if (runData && runData.length > 0) {
            const images = runData.slice(0, 6).map((item: any) => ({
              url: item.imageUrl || item.originalImageUrl,
              thumbnailUrl: item.thumbnailUrl || item.imageUrl,
              title: item.title || item.alt || `${query} image`,
              source: item.source || new URL(item.pageUrl || '').hostname.replace('www.', ''),
              width: item.width || 800,
              height: item.height || 600
            }));
            
            console.log(`Found ${images.length} images from Apify`);
            return NextResponse.json({ images });
          }
        }
      } catch (error) {
        console.error('Apify API error:', error);
      }
    }

    // Fallback to enhanced placeholder images with variety
    console.log('Using enhanced placeholder images');
    const images = generateEnhancedPlaceholders(query, entityType);

    return NextResponse.json({ images });
  } catch (error: any) {
    console.error('Error searching images:', error);
    
    // Always return placeholder images instead of an error
    return NextResponse.json({ 
      images: generatePlaceholderImages(query, entityType) 
    });
  }
}

function extractImageUrls(text: string): string[] {
  const imageExtensions = /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i;
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^\[\]`]+/gi;
  
  const urls = text.match(urlRegex) || [];
  return urls.filter(url => imageExtensions.test(url));
}

function generatePlaceholderImages(query: string, entityType?: string): any[] {
  return generateEnhancedPlaceholders(query, entityType);
}

function generateEnhancedPlaceholders(query: string, entityType?: string): any[] {
  const colors = ['4F46E5', '7C3AED', 'DC2626', '059669', 'D97706', '0891B2'];
  const variations = entityType === 'person' 
    ? [
        `${query}`,
        `${query} Portrait`,
        `${query} Official`,
        `${query} Speaking`,
        `${query} Profile`,
        `${query} Headshot`
      ]
    : entityType === 'organization'
    ? [
        `${query}`,
        `${query} Logo`,
        `${query} HQ`,
        `${query} Office`,
        `${query} Building`,
        `${query} Brand`
      ]
    : [
        `${query}`,
        `${query} View`,
        `${query} Map`,
        `${query} Aerial`,
        `${query} Street`,
        `${query} Scene`
      ];
  
  return variations.slice(0, 6).map((description, i) => {
    const color = colors[i % colors.length];
    const size = i % 2 === 0 ? '800x600' : '600x800'; // Mix of landscape and portrait
    const thumbSize = i % 2 === 0 ? '200x150' : '150x200';
    
    return {
      url: `https://via.placeholder.com/${size}/${color}/FFFFFF?text=${encodeURIComponent(description)}`,
      thumbnailUrl: `https://via.placeholder.com/${thumbSize}/${color}/FFFFFF?text=${encodeURIComponent(description)}`,
      title: description,
      source: 'Generated',
      width: parseInt(size.split('x')[0]),
      height: parseInt(size.split('x')[1])
    };
  });
}