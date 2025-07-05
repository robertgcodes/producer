import { ClaudeService } from './claudeService';

export class AIService {
  static async generateStatuteAnalysis(context: string, prompt: string): Promise<string> {
    try {
      const fullPrompt = `${prompt}\n\nContext:\n${context}`;
      const response = await ClaudeService.generateResponse(fullPrompt);
      return response;
    } catch (error) {
      console.error('Error generating statute analysis:', error);
      throw new Error('Failed to generate statute analysis');
    }
  }
}