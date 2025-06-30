interface FeedItem {
  title: string;
  contentSnippet?: string;
  categories?: string[];
  feedCategory?: string;
  feedTitle?: string;
  pubDate?: string;
}

interface TitleTemplate {
  template: string;
  requiresNumber?: boolean;
  requiresTopic?: boolean;
}

// YouTube title templates based on popular formats
const TITLE_TEMPLATES: TitleTemplate[] = [
  { template: "BREAKING: {topic} - What This Means for You!", requiresTopic: true },
  { template: "{number} Things About {topic} Nobody's Talking About", requiresNumber: true, requiresTopic: true },
  { template: "The Truth About {topic} (This Changes Everything)", requiresTopic: true },
  { template: "Why {topic} Is More Important Than You Think", requiresTopic: true },
  { template: "{topic}: My Honest Reaction & Analysis", requiresTopic: true },
  { template: "Is {topic} The Biggest Story of {year}?", requiresTopic: true },
  { template: "The {topic} Situation Just Got Worse...", requiresTopic: true },
  { template: "Everything Wrong With The {topic} Coverage", requiresTopic: true },
  { template: "{number} Shocking Facts About {topic}", requiresNumber: true, requiresTopic: true },
  { template: "The Real Reason Behind {topic}", requiresTopic: true },
  { template: "{topic} Explained in {number} Minutes", requiresTopic: true, requiresNumber: true },
  { template: "What The Media Won't Tell You About {topic}", requiresTopic: true },
];

// Common topics and their variations
const TOPIC_CLUSTERS = {
  'technology': ['tech', 'ai', 'artificial intelligence', 'software', 'hardware', 'silicon valley', 'startup'],
  'politics': ['election', 'government', 'congress', 'senate', 'president', 'policy', 'legislation'],
  'economy': ['market', 'stock', 'inflation', 'recession', 'fed', 'economy', 'financial', 'crypto', 'bitcoin'],
  'climate': ['climate', 'environment', 'global warming', 'sustainability', 'renewable', 'carbon'],
  'health': ['health', 'covid', 'vaccine', 'medical', 'healthcare', 'mental health', 'wellness'],
  'entertainment': ['movie', 'tv', 'celebrity', 'music', 'streaming', 'hollywood', 'award'],
  'sports': ['nfl', 'nba', 'mlb', 'soccer', 'olympics', 'championship', 'athlete'],
  'business': ['company', 'ceo', 'merger', 'acquisition', 'startup', 'ipo', 'earnings'],
};

// Extract main topics from feed items
function extractTopics(items: FeedItem[]): Map<string, number> {
  const topicCounts = new Map<string, number>();
  
  items.forEach(item => {
    const text = `${item.title} ${item.contentSnippet || ''} ${item.categories?.join(' ') || ''} ${item.feedCategory || ''}`.toLowerCase();
    
    // Check for topic clusters
    Object.entries(TOPIC_CLUSTERS).forEach(([mainTopic, keywords]) => {
      keywords.forEach(keyword => {
        if (text.includes(keyword)) {
          topicCounts.set(mainTopic, (topicCounts.get(mainTopic) || 0) + 1);
        }
      });
    });
    
    // Extract proper nouns and significant phrases
    const words = item.title.split(/\s+/);
    words.forEach((word, index) => {
      // Check for capitalized words (potential topics)
      if (word.length > 3 && /^[A-Z]/.test(word)) {
        const topic = word.replace(/[^\w\s]/g, '');
        if (topic) {
          topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
        }
      }
      
      // Check for two-word phrases
      if (index < words.length - 1) {
        const phrase = `${word} ${words[index + 1]}`;
        if (/^[A-Z]/.test(word) && /^[A-Z]/.test(words[index + 1])) {
          topicCounts.set(phrase, (topicCounts.get(phrase) || 0) + 0.5);
        }
      }
    });
  });
  
  return topicCounts;
}

// Find trending or breaking topics
function identifyTrendingTopics(items: FeedItem[]): string[] {
  const recentItems = items.filter(item => {
    const pubDate = new Date(item.pubDate || 0);
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return pubDate > dayAgo;
  });
  
  const topicCounts = extractTopics(recentItems);
  
  // Sort topics by frequency
  const sortedTopics = Array.from(topicCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([topic]) => topic);
  
  return sortedTopics;
}

// Generate title based on template and topic
function generateTitleFromTemplate(template: TitleTemplate, topic: string): string {
  let title = template.template;
  
  // Replace topic
  if (template.requiresTopic) {
    // Capitalize topic properly
    const formattedTopic = topic.split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
    title = title.replace('{topic}', formattedTopic);
  }
  
  // Replace number
  if (template.requiresNumber) {
    const numbers = [3, 5, 7, 10];
    const randomNumber = numbers[Math.floor(Math.random() * numbers.length)];
    title = title.replace('{number}', randomNumber.toString());
  }
  
  // Replace year
  title = title.replace('{year}', new Date().getFullYear().toString());
  
  return title;
}

// Main function to analyze feeds and generate titles
export async function analyzeFeedsAndGenerateTitles(items: FeedItem[]): Promise<string[]> {
  const titles: string[] = [];
  
  // Identify trending topics
  const trendingTopics = identifyTrendingTopics(items);
  
  // Group related stories
  const storyGroups = new Map<string, FeedItem[]>();
  
  items.forEach(item => {
    // Simple grouping by matching keywords
    let grouped = false;
    for (const [topic, group] of storyGroups.entries()) {
      if (item.title.toLowerCase().includes(topic.toLowerCase())) {
        group.push(item);
        grouped = true;
        break;
      }
    }
    
    if (!grouped && trendingTopics.length > 0) {
      // Try to match with trending topics
      for (const topic of trendingTopics) {
        if (item.title.toLowerCase().includes(topic.toLowerCase())) {
          if (!storyGroups.has(topic)) {
            storyGroups.set(topic, []);
          }
          storyGroups.get(topic)!.push(item);
          grouped = true;
          break;
        }
      }
    }
  });
  
  // Generate titles for trending topics
  const usedTemplates = new Set<number>();
  
  trendingTopics.slice(0, 5).forEach(topic => {
    let templateIndex;
    do {
      templateIndex = Math.floor(Math.random() * TITLE_TEMPLATES.length);
    } while (usedTemplates.has(templateIndex) && usedTemplates.size < TITLE_TEMPLATES.length);
    
    usedTemplates.add(templateIndex);
    const template = TITLE_TEMPLATES[templateIndex];
    const title = generateTitleFromTemplate(template, topic);
    titles.push(title);
  });
  
  // Generate some compilation/roundup titles
  if (storyGroups.size > 3) {
    titles.push(`This Week's Biggest Stories: ${Array.from(storyGroups.keys()).slice(0, 3).join(', ')}`);
  }
  
  if (items.some(item => item.title.toLowerCase().includes('breaking'))) {
    titles.push("Reacting to Today's Breaking News LIVE");
  }
  
  // Add a general news roundup title
  const date = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  titles.push(`${date} News Roundup: Everything You Need to Know`);
  
  // If we have AI API key in the future, we can enhance this with actual AI generation
  // For now, return the algorithmic titles
  return titles.slice(0, 8); // Return up to 8 titles
}

// Function to generate titles with AI (when API key is available)
export async function generateTitlesWithAI(
  items: FeedItem[], 
  apiKey?: string
): Promise<string[]> {
  if (!apiKey) {
    // Fallback to algorithmic generation
    return analyzeFeedsAndGenerateTitles(items);
  }
  
  // TODO: Implement OpenAI API integration when API key is provided
  // This would analyze the feed items and generate more sophisticated titles
  
  return analyzeFeedsAndGenerateTitles(items);
}