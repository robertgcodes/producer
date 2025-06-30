interface ClaudeSearchResult {
  id: string;
  title: string;
  url: string;
  summary: string;
  perspective: string; // e.g., "conservative", "liberal", "neutral"
  type: 'article' | 'video' | 'tweet' | 'social' | 'official';
  credibility: 'high' | 'medium' | 'low';
  relevance_score: number;
}

interface ClaudeAnalysis {
  summary: string;
  key_points: string[];
  perspectives: {
    side: string;
    argument: string;
  }[];
  suggested_sources: ClaudeSearchResult[];
  search_queries: string[]; // Suggested search queries for further research
}

export class ClaudeService {
  private static apiKey: string | null = null;
  private static readonly CLAUDE_3_OPUS = 'claude-3-opus-20240229';
  private static readonly CLAUDE_3_5_SONNET = 'claude-3-5-sonnet-20241022'; // Latest advanced model

  static setApiKey(key: string) {
    this.apiKey = key;
  }

  static async analyzeStory(title: string, description?: string): Promise<ClaudeAnalysis> {
    if (!this.apiKey) {
      throw new Error('Claude API key not configured');
    }

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-opus-20240229',
          max_tokens: 2000,
          temperature: 0.3,
          messages: [
            {
              role: 'user',
              content: `As a news research assistant, analyze this story topic and suggest diverse sources:

Title: ${title}
${description ? `Context: ${description}` : ''}

Please provide:
1. A brief summary of the topic
2. Key points to research
3. Different perspectives (with specific arguments from each side)
4. Suggested sources with URLs (if you know specific reliable sources)
5. Search queries to find more information

Focus on:
- Official statements and primary sources
- Diverse political perspectives
- Credible news outlets from different viewpoints
- Relevant video content and social media
- Academic or expert analysis

Format your response as JSON with the following structure:
{
  "summary": "brief summary",
  "key_points": ["point 1", "point 2"],
  "perspectives": [
    {"side": "perspective name", "argument": "their main argument"}
  ],
  "suggested_sources": [
    {
      "title": "source title",
      "url": "URL if known, otherwise empty string",
      "summary": "what this source offers",
      "perspective": "conservative/liberal/neutral/official",
      "type": "article/video/tweet/social/official",
      "credibility": "high/medium/low",
      "relevance_score": 0-100
    }
  ],
  "search_queries": ["query 1", "query 2"]
}`
            }
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`Claude API error: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Parse the JSON response from Claude
      try {
        const content = data.content[0].text;
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const analysis = JSON.parse(jsonMatch[0]);
          
          // Add IDs to suggested sources
          if (analysis.suggested_sources) {
            analysis.suggested_sources = analysis.suggested_sources.map((source: any, index: number) => ({
              ...source,
              id: `claude-${index}`,
              url: source.url || '',
            }));
          }
          
          return analysis;
        }
      } catch (parseError) {
        console.error('Error parsing Claude response:', parseError);
      }

      // Fallback if parsing fails
      return {
        summary: 'Analysis in progress',
        key_points: [],
        perspectives: [],
        suggested_sources: [],
        search_queries: [],
      };
    } catch (error) {
      console.error('Claude analysis error:', error);
      throw error;
    }
  }

  static async generateSearchQueries(bundleTitle: string, bundleDescription?: string): Promise<string[]> {
    try {
      const analysis = await this.analyzeStory(bundleTitle, bundleDescription);
      return analysis.search_queries || [];
    } catch (error) {
      console.error('Error generating search queries:', error);
      // Fallback queries
      return [
        `${bundleTitle} latest news`,
        `${bundleTitle} official statement`,
        `${bundleTitle} analysis`,
        `${bundleTitle} different perspectives`,
      ];
    }
  }

  static async getSuggestedSources(bundleTitle: string, bundleDescription?: string): Promise<ClaudeSearchResult[]> {
    try {
      const analysis = await this.analyzeStory(bundleTitle, bundleDescription);
      return analysis.suggested_sources || [];
    } catch (error) {
      console.error('Error getting suggested sources:', error);
      return [];
    }
  }

  static async generateContent(
    prompt: string, 
    options: {
      model?: 'opus' | 'sonnet';
      maxTokens?: number;
      temperature?: number;
      systemPrompt?: string;
    } = {}
  ): Promise<string> {
    if (!this.apiKey) {
      throw new Error('Claude API key not configured');
    }

    const {
      model = 'sonnet',
      maxTokens = 4000,
      temperature = 0.7,
      systemPrompt
    } = options;

    const modelId = model === 'opus' ? this.CLAUDE_3_OPUS : this.CLAUDE_3_5_SONNET;

    try {
      const messages = [];
      
      if (systemPrompt) {
        messages.push({
          role: 'system',
          content: systemPrompt
        });
      }
      
      messages.push({
        role: 'user',
        content: prompt
      });

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: modelId,
          max_tokens: maxTokens,
          temperature,
          messages,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Claude API error: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      return data.content[0].text;
    } catch (error) {
      console.error('Claude content generation error:', error);
      throw error;
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
      throw new Error('Claude API key not configured');
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
      const response = await this.generateContent(prompt, {
        model: 'sonnet',
        temperature: 0.8,
        maxTokens: 2000
      });

      // Split response into individual titles and clean them
      const titles = response
        .split('\n')
        .map(title => title.trim())
        .filter(title => title.length > 0)
        .filter(title => !title.match(/^\d+\./)) // Remove numbered lists
        .map(title => title.replace(/^["']|["']$/g, '')) // Remove quotes
        .slice(0, count);

      return titles;
    } catch (error) {
      console.error('Error generating titles with Claude:', error);
      throw error;
    }
  }
}