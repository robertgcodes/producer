import { GoogleGenerativeAI } from '@google/generative-ai';

export class GeminiService {
  private static apiKey: string | null = null;
  private static genAI: GoogleGenerativeAI | null = null;

  static setApiKey(key: string) {
    this.apiKey = key;
    this.genAI = new GoogleGenerativeAI(key);
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
    if (!this.genAI) {
      throw new Error('Gemini API key not configured');
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
      // Use Gemini 1.5 Flash for best results
      const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Split response into individual titles and clean them
      const titles = text
        .split('\n')
        .map(title => title.trim())
        .filter(title => title.length > 0)
        .filter(title => !title.match(/^\d+\./)) // Remove numbered lists
        .map(title => title.replace(/^["']|["']$/g, '')) // Remove quotes
        .slice(0, count);

      return titles;
    } catch (error) {
      console.error('Error generating titles with Gemini:', error);
      throw error;
    }
  }

  static async generateContent(prompt: string): Promise<string> {
    if (!this.genAI) {
      throw new Error('Gemini API key not configured');
    }

    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('Gemini content generation error:', error);
      throw error;
    }
  }
}