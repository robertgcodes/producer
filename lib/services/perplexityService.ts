interface PerplexitySearchResult {
  id: string;
  title: string;
  url: string;
  snippet: string;
  source: string;
  publishedDate?: string;
}

interface PerplexityResponse {
  answer: string;
  sources: PerplexitySearchResult[];
  related_questions?: string[];
}

export class PerplexityService {
  private static apiKey: string | null = null;

  static setApiKey(key: string) {
    this.apiKey = key;
  }

  static async search(query: string, focusAreas?: string[]): Promise<PerplexityResponse> {
    if (!this.apiKey) {
      throw new Error('Perplexity API key not configured');
    }

    try {
      // Build enhanced query with focus areas
      let enhancedQuery = query;
      if (focusAreas && focusAreas.length > 0) {
        enhancedQuery += ` focus on: ${focusAreas.join(', ')}`;
      }

      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.1-sonar-small-128k-online', // Using online model for real-time web search
          messages: [
            {
              role: 'system',
              content: 'You are a news research assistant. Find diverse perspectives, official statements, and credible sources. Include URLs when available.'
            },
            {
              role: 'user',
              content: enhancedQuery
            }
          ],
          temperature: 0.2,
          max_tokens: 2000,
          return_citations: true,
          return_related_questions: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`Perplexity API error: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Parse the response to extract sources and answer
      return this.parsePerplexityResponse(data);
    } catch (error) {
      console.error('Perplexity search error:', error);
      throw error;
    }
  }

  private static parsePerplexityResponse(data: any): PerplexityResponse {
    // Extract answer text
    const answer = data.choices?.[0]?.message?.content || '';
    
    // Extract sources from citations
    const sources: PerplexitySearchResult[] = [];
    if (data.citations) {
      data.citations.forEach((citation: any, index: number) => {
        sources.push({
          id: `pplx-${index}`,
          title: citation.title || 'Untitled',
          url: citation.url || '',
          snippet: citation.snippet || '',
          source: new URL(citation.url || '').hostname.replace('www.', ''),
          publishedDate: citation.published_date,
        });
      });
    }

    // Extract related questions
    const related_questions = data.related_questions || [];

    return {
      answer,
      sources,
      related_questions,
    };
  }

  static async searchCustomQuery(query: string): Promise<string> {
    const response = await fetch('https://api.perplexity.ai/v1/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-sonar-large-128k-online',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful research assistant. Provide comprehensive analysis based on the query.'
          },
          {
            role: 'user',
            content: query
          }
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Perplexity API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  static async searchForBundle(bundleTitle: string, bundleDescription?: string): Promise<PerplexitySearchResult[]> {
    try {
      const query = bundleDescription 
        ? `${bundleTitle} - ${bundleDescription}` 
        : bundleTitle;
      
      const focusAreas = [
        'latest news',
        'official statements',
        'diverse perspectives',
        'primary sources',
        'video content',
        'social media reactions'
      ];

      const response = await this.search(query, focusAreas);
      return response.sources;
    } catch (error) {
      console.error('Error searching Perplexity for bundle:', error);
      return [];
    }
  }

  static async generateTitles(
    bundleInfo: {
      title: string;
      description?: string;
      stories?: Array<{ title: string; description?: string }>;
    },
    userSettings: {
      instructions?: string;
      sampleTitles?: string[];
    },
    historicalTitles?: string,
    count: number = 20
  ): Promise<string[]> {
    if (!this.apiKey) {
      throw new Error('Perplexity API key not configured');
    }

    let prompt = `Generate ${count} compelling YouTube video titles based on the specific news stories below. These titles should reflect the actual content of the stories, not generic titles about the topic.\n\n`;
    
    if (bundleInfo.stories && bundleInfo.stories.length > 0) {
      prompt += `Stories to base titles on:\n`;
      bundleInfo.stories.forEach((story, idx) => {
        prompt += `\nStory ${idx + 1}: ${story.title}`;
        if (story.description) {
          prompt += `\nSummary: ${story.description}`;
        }
        prompt += '\n';
      });
      prompt += '\n';
    } else {
      // Fallback if no stories
      prompt += `Bundle Topic: ${bundleInfo.title}\n`;
      if (bundleInfo.description) {
        prompt += `Bundle Description: ${bundleInfo.description}\n`;
      }
    }

    if (historicalTitles) {
      prompt += `\n${historicalTitles}\n`;
    }

    if (userSettings.instructions) {
      prompt += `\nTitle Writing Instructions:\n${userSettings.instructions}\n`;
    }

    if (userSettings.sampleTitles && userSettings.sampleTitles.length > 0) {
      prompt += `\nExample titles in the preferred style:\n`;
      userSettings.sampleTitles.forEach((title, idx) => {
        prompt += `${idx + 1}. "${title}"\n`;
      });
    }

    prompt += `\nGenerate ${count} engaging titles that:
- Are based on the ACTUAL STORIES provided above
- Reflect the specific events, people, and details in the stories
- Follow the style and patterns shown in the examples
- Are optimized for YouTube engagement
- Create curiosity and urgency
- Are between 50-70 characters when possible
- Use the writing instructions provided

IMPORTANT: Each title should be about the specific news stories provided, not generic titles about the overall topic.

Return ONLY the titles, one per line, without numbers or quotation marks.`;

    try {
      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.1-sonar-large-128k-online',
          messages: [
            {
              role: 'system',
              content: 'You are an expert YouTube title generator. Create engaging, clickable titles based on the news content provided.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.8,
          max_tokens: 2000,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Perplexity API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const responseText = data.choices[0].message.content;

      // Split response into individual titles and clean them
      const titles = responseText
        .split('\n')
        .map(title => title.trim())
        .filter(title => title.length > 0)
        .filter(title => !title.match(/^\d+\./)) // Remove numbered lists
        .map(title => title.replace(/^["']|["']$/g, '')) // Remove quotes
        .slice(0, count);

      return titles;
    } catch (error) {
      console.error('Error generating titles with Perplexity:', error);
      throw error;
    }
  }
}