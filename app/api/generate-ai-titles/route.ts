import { NextRequest, NextResponse } from 'next/server';
import { ClaudeService } from '@/lib/services/claudeService';
import { GeminiService } from '@/lib/services/geminiService';
import { PerplexityService } from '@/lib/services/perplexityService';
import { BundleHistoryService } from '@/lib/services/bundleHistoryService';

export async function POST(req: NextRequest) {
  try {
    // For now, we'll get userId from the request body
    // In production, this should use proper authentication

    const body = await req.json();
    const {
      bundleId,
      bundleTitle,
      bundleDescription,
      stories,
      projectId,
      model = 'claude',
      userSettings = {},
      apiKey,
      userId
    } = body;

    if (!bundleTitle) {
      return NextResponse.json({ error: 'Bundle title is required' }, { status: 400 });
    }

    // Fetch historical bundle data if userId is provided
    let historicalTitlesPrompt = '';
    if (userId) {
      try {
        const recentBundles = await BundleHistoryService.fetchRecentBundles(userId, projectId, 100);
        if (recentBundles.length > 0) {
          historicalTitlesPrompt = BundleHistoryService.formatForAIPrompt(recentBundles);
        }
      } catch (error) {
        console.error('Error fetching bundle history:', error);
        // Continue without historical data
      }
    }

    // Prepare bundle info
    const bundleInfo = {
      title: bundleTitle,
      description: bundleDescription,
      stories: stories || []
    };

    // Generate titles based on selected model
    let titles: string[] = [];

    switch (model.toLowerCase()) {
      case 'claude':
        // Check for environment variable first, then fall back to user-provided key
        const claudeKey = process.env.CLAUDE_API_KEY || apiKey;
        if (!claudeKey) {
          return NextResponse.json({ error: 'Claude API key required' }, { status: 400 });
        }
        ClaudeService.setApiKey(claudeKey);
        titles = await ClaudeService.generateTitles(
          bundleInfo,
          userSettings,
          historicalTitlesPrompt,
          20
        );
        break;

      case 'gemini':
        // Check for environment variable first, then fall back to user-provided key
        const geminiKey = process.env.GEMINI_API_KEY || apiKey;
        if (!geminiKey) {
          return NextResponse.json({ error: 'Gemini API key required' }, { status: 400 });
        }
        GeminiService.setApiKey(geminiKey);
        titles = await GeminiService.generateTitles(
          bundleInfo,
          userSettings,
          historicalTitlesPrompt,
          20
        );
        break;

      case 'chatgpt':
        // Use Perplexity for ChatGPT slot temporarily
        const perplexityKey = process.env.PERPLEXITY_API_KEY || apiKey;
        if (!perplexityKey) {
          return NextResponse.json({ error: 'Perplexity API key required' }, { status: 400 });
        }
        PerplexityService.setApiKey(perplexityKey);
        titles = await PerplexityService.generateTitles(
          bundleInfo,
          userSettings,
          historicalTitlesPrompt,
          20
        );
        break;

      case 'grok':
        // Temporarily use Gemini for the 'grok' model
        const grokGeminiKey = process.env.GEMINI_API_KEY || apiKey;
        if (!grokGeminiKey) {
          return NextResponse.json({ error: 'Gemini API key required' }, { status: 400 });
        }
        GeminiService.setApiKey(grokGeminiKey);
        titles = await GeminiService.generateTitles(
          bundleInfo,
          userSettings,
          historicalTitlesPrompt,
          20
        );
        break;

      default:
        return NextResponse.json({ error: 'Invalid model specified' }, { status: 400 });
    }

    // Return generated titles
    return NextResponse.json({
      titles,
      model,
      count: titles.length
    });

  } catch (error) {
    console.error('Error generating AI titles:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate titles' },
      { status: 500 }
    );
  }
}