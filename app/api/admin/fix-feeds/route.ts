import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

// Feed URL mappings (same as in the script)
const feedUrlMappings: Record<string, string> = {
  // News Organizations
  'CNN': 'http://rss.cnn.com/rss/cnn_topstories.rss',
  'Fox News': 'https://moxie.foxnews.com/google-publisher/latest.xml',
  'FOX News': 'https://moxie.foxnews.com/google-publisher/latest.xml',
  'The New York Times': 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml',
  'NYT Politics': 'https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml',
  'Washington Post Breaking News': 'https://feeds.washingtonpost.com/rss/politics',
  'Washington Post Breaking National': 'https://feeds.washingtonpost.com/rss/national',
  'Politico': 'https://www.politico.com/rss/politicopicks.xml',
  'The Hill': 'https://thehill.com/news/feed/',
  'The Hill - House': 'https://thehill.com/homenews/house/feed/',
  'The Hill - Senate': 'https://thehill.com/homenews/senate/feed/',
  'The Hill - Administration': 'https://thehill.com/homenews/administration/feed/',
  'MSNBC': 'https://feeds.nbcnews.com/msnbc/public/news',
  'CNBC': 'https://www.cnbc.com/id/100003114/device/rss/rss.html',
  'PBS News Hour': 'https://www.pbs.org/newshour/feeds/rss/headlines',
  'NPR Morning Edition': 'https://feeds.npr.org/3/rss.xml',
  'Morning Edition': 'https://feeds.npr.org/3/rss.xml',
  
  // Conservative Media
  'Breitbart': 'https://feeds.feedburner.com/breitbart',
  'The Daily Wire': 'https://www.dailywire.com/feeds/rss.xml',
  'The Federalist': 'https://thefederalist.com/feed/',
  'The Gateway Pundit': 'https://www.thegatewaypundit.com/feed/',
  'RedState': 'https://redstate.com/feed',
  'Townhall': 'https://townhall.com/tipsheet/feed',
  'Townhall Columnists': 'https://townhall.com/columnists/feed',
  'Hot Air': 'https://hotair.com/feed',
  'The Daily Caller': 'https://dailycaller.com/feed/',
  'Washington Free Beacon': 'https://freebeacon.com/feed/',
  'The Epoch Times': 'https://www.theepochtimes.com/feed',
  'Just The News': 'https://justthenews.com/feed',
  'One America News Network': 'https://www.oann.com/feed/',
  'NewsmaxTV': 'https://www.newsmax.com/rss/Newsfront/1/',
  'Washington Examiner': 'https://www.washingtonexaminer.com/section/news/feed',
  'Twitchy': 'https://twitchy.com/feed/',
  'Twitchy US Politics': 'https://twitchy.com/category/us-politics/feed/',
  'NY Post - News': 'https://nypost.com/news/feed/',
  'NYPost - US News': 'https://nypost.com/us-news/feed/',
  
  // Legal/Court News
  'SCOTUSblog': 'https://www.scotusblog.com/feed/',
  'Above the Law': 'https://abovethelaw.com/feed/',
  'Law & Crime': 'https://lawandcrime.com/feed/',
  'The Volokh Conspiracy': 'https://reason.com/volokh/feed/',
  'Legal Insurrection': 'https://legalinsurrection.com/feed/',
  'Just Security': 'https://www.justsecurity.org/feed/',
  'Jonathan Turley': 'https://jonathanturley.org/feed/',
  'Democracy Docket Cases': 'https://www.democracydocket.com/feed/',
  'Democracy Docket Alerts': 'https://www.democracydocket.com/alerts/feed/',
  'Law Dork with Chris Geidner': 'https://www.lawdork.com/feed',
  'Judiciary News - United States Courts': 'https://www.uscourts.gov/rss/judiciary-news',
  'ABA Journal Top Stories': 'https://www.abajournal.com/news/rss',
  'ABA Supreme Court News': 'https://www.abajournal.com/topics/supreme-court/rss',
  'Law360: Legal Industry': 'https://www.law360.com/rss/legal-industry/headlines.rss',
  'Law360: Immigration': 'https://www.law360.com/immigration/rss',
  
  // Government/Official
  'The White House Newsfeed': 'https://www.whitehouse.gov/feed/',
  'White House': 'https://www.whitehouse.gov/feed/',
  'DOJ Press Releases': 'https://www.justice.gov/feeds/opa/justice-news.xml',
  'FBI News Blog': 'https://www.fbi.gov/feeds/fbi-news-blog-feed',
  'National Security Agency': 'https://www.nsa.gov/RSS-Feeds/RSS-News/',
  'House Floor Today': 'https://www.house.gov/rss/floor-today.xml',
  'Senate Floor Today': 'https://www.senate.gov/general/rss/floor_today.xml',
  'House Most-Viewed Bills': 'https://www.congress.gov/rss/most-viewed-bills.xml',
  'National Press Releases': 'https://www.nationalpress.com/rss/releases',
  
  // Tech
  'TechCrunch': 'https://techcrunch.com/feed/',
  
  // Other
  'Forbes Breaking': 'https://www.forbes.com/real-time/feed2/',
  'HuffPost': 'https://www.huffpost.com/section/front-page/feed',
  'The Free Press': 'https://www.thefp.com/feed',
  'American Civil Liberties Union': 'https://www.aclu.org/feed',
  'Hoover Institution': 'https://www.hoover.org/rss/news.xml',
  'MRCTV.org': 'https://www.mrctv.org/rss',
};

// YouTube channel mappings
const youtubeChannels: Record<string, string> = {
  'Watching the Watchers YouTube Channel': 'https://www.youtube.com/@WatchingTheWatchers',
  'YouTube Fox News': 'https://www.youtube.com/@FoxNews',
  'Homeland Security YouTube': 'https://www.youtube.com/@DHSgov',
  'DHS YouTube': 'https://www.youtube.com/@DHSgov',
  'Charlie Kirk': 'https://www.youtube.com/@RealCharlieKirk',
  'PBD Podcast': 'https://www.youtube.com/@PBDPodcast',
  'MeidasTouch': 'https://www.youtube.com/@MeidasTouch',
  'Officer Tatum': 'https://www.youtube.com/@TheOfficerTatum',
  'Viva Frei': 'https://www.youtube.com/@VivaFrei',
  'Dr. Steve Turley': 'https://www.youtube.com/@DrSteveTurley',
  'Tim Pool': 'https://www.youtube.com/@Timcast',
  'Tucker Carlson': 'https://www.youtube.com/@TuckerCarlson',
  'Timcast IRL': 'https://www.youtube.com/@TimcastIRL',
  'Brian Tyler Cohen': 'https://www.youtube.com/@briantylercohen',
  'Benny Johnson': 'https://www.youtube.com/@bennyjohnson',
  'LegalEagle': 'https://www.youtube.com/@LegalEagle',
  'Megyn Kelly': 'https://www.youtube.com/@MegynKelly',
  'Judicial Watch': 'https://www.youtube.com/@JudicialWatch',
  'Sen. Marsha Blackburn': 'https://www.youtube.com/@SenatorMarshaBlackburn',
  'Rep. Thomas Massie': 'https://www.youtube.com/@RepThomasMassie',
  'Live FoxNow': 'https://www.youtube.com/@livenowfox',
  'Professor Nez': 'https://www.youtube.com/@ProfessorNez',
  'CBS Face the Nation': 'https://www.youtube.com/@FaceTheNation',
  'Andrew Branca': 'https://www.youtube.com/@LawofSelfDefense',
  'Declassified with Julie Kelly': 'https://www.youtube.com/@DeclassifiedwithJulieKelly',
  'Miranda Devine Pod Force One': 'https://www.youtube.com/@nypost',
};

export async function GET(request: Request) {
  try {
    // Check for admin auth (you can add more security here)
    const { searchParams } = new URL(request.url);
    const confirm = searchParams.get('confirm');
    
    if (confirm !== 'yes') {
      return NextResponse.json({
        message: 'This will fix all feeds with broken URLs. Add ?confirm=yes to run.',
        warning: 'Make sure you have a backup of your feeds before running this.'
      });
    }

    // Get all feeds
    const feedsSnapshot = await adminDb.collection('rssFeeds').get();
    const feeds = feedsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Array<{
      id: string;
      title: string;
      url?: string;
      type?: string;
    }>;
    
    let fixedCount = 0;
    let skippedCount = 0;
    const unknownFeeds: string[] = [];
    const fixed: string[] = [];
    
    for (const feed of feeds) {
      if (feed.url === '/api/rss' || !feed.url || feed.url.startsWith('/api/')) {
        // Check if we have a mapping
        let newUrl = feedUrlMappings[feed.title];
        let feedType = feed.type || 'rss';
        
        // Check YouTube channels
        if (!newUrl && youtubeChannels[feed.title]) {
          newUrl = youtubeChannels[feed.title];
          feedType = 'youtube';
        }
        
        if (newUrl) {
          // Handle Google News searches
          if (feed.title.includes('"') && !newUrl) {
            feedType = 'googlenews';
            const query = feed.title.replace(/"/g, '');
            await adminDb.collection('rssFeeds').doc(feed.id).update({
              url: '',
              googleNewsQuery: query,
              type: feedType
            });
            fixed.push(`${feed.title} → Google News: "${query}"`);
            fixedCount++;
            continue;
          }
          
          // Update the feed
          await adminDb.collection('rssFeeds').doc(feed.id).update({
            url: newUrl,
            type: feedType
          });
          
          fixed.push(`${feed.title} → ${newUrl} (${feedType})`);
          fixedCount++;
        } else {
          unknownFeeds.push(feed.title);
        }
      } else {
        skippedCount++;
      }
    }
    
    return NextResponse.json({
      success: true,
      totalFeeds: feeds.length,
      fixed: fixedCount,
      skipped: skippedCount,
      unknownCount: unknownFeeds.length,
      fixedFeeds: fixed,
      unknownFeeds
    });
    
  } catch (error) {
    console.error('Error fixing feeds:', error);
    return NextResponse.json(
      { error: 'Failed to fix feeds', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}