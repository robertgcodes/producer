import { NextRequest, NextResponse } from 'next/server';
import { PerplexityService } from '@/lib/services/perplexityService';
import { ClaudeService } from '@/lib/services/claudeService';

export async function POST(request: NextRequest) {
  try {
    const { bundleTitle, bundleDescription, service, query, stories } = await request.json();

    // If query is provided, use it as a custom query for Perplexity
    if (query) {
      const perplexityKey = process.env.PERPLEXITY_API_KEY;
      if (!perplexityKey) {
        return NextResponse.json(
          { error: 'Perplexity API key not configured. Please add PERPLEXITY_API_KEY to your environment variables.' },
          { status: 500 }
        );
      }

      PerplexityService.setApiKey(perplexityKey);
      
      // Enhance query with context from bundle and stories
      const contextualQuery = `${query}\n\nContext: ${bundleTitle}\n${bundleDescription || ''}\n\nRelated stories: ${stories?.map((s: any) => s.title).join(', ') || ''}`;
      
      const results = await PerplexityService.searchCustomQuery(contextualQuery);
      
      return NextResponse.json({ 
        service: 'perplexity',
        perplexity: { result: results }
      });
    }

    if (!bundleTitle) {
      return NextResponse.json(
        { error: 'Bundle title is required' },
        { status: 400 }
      );
    }

    // Get API keys from environment variables
    const perplexityKey = process.env.PERPLEXITY_API_KEY;
    const claudeKey = process.env.CLAUDE_API_KEY;

    if (service === 'perplexity') {
      if (!perplexityKey) {
        return NextResponse.json(
          { error: 'Perplexity API key not configured. Please add PERPLEXITY_API_KEY to your environment variables.' },
          { status: 500 }
        );
      }

      PerplexityService.setApiKey(perplexityKey);
      const results = await PerplexityService.searchForBundle(bundleTitle, bundleDescription);
      
      return NextResponse.json({ 
        service: 'perplexity',
        results 
      });
    } else if (service === 'claude') {
      if (!claudeKey) {
        return NextResponse.json(
          { error: 'Claude API key not configured. Please add CLAUDE_API_KEY to your environment variables.' },
          { status: 500 }
        );
      }

      ClaudeService.setApiKey(claudeKey);
      const analysis = await ClaudeService.analyzeStory(bundleTitle, bundleDescription);
      
      return NextResponse.json({ 
        service: 'claude',
        analysis 
      });
    } else if (service === 'both') {
      const results: any = {
        perplexity: null,
        claude: null,
        errors: []
      };

      // Try Perplexity
      if (perplexityKey) {
        try {
          PerplexityService.setApiKey(perplexityKey);
          results.perplexity = await PerplexityService.searchForBundle(bundleTitle, bundleDescription);
        } catch (error) {
          results.errors.push({ service: 'perplexity', error: 'Failed to search with Perplexity' });
        }
      } else {
        results.errors.push({ service: 'perplexity', error: 'API key not configured' });
      }

      // Try Claude
      if (claudeKey) {
        try {
          ClaudeService.setApiKey(claudeKey);
          results.claude = await ClaudeService.analyzeStory(bundleTitle, bundleDescription);
        } catch (error) {
          results.errors.push({ service: 'claude', error: 'Failed to analyze with Claude' });
        }
      } else {
        results.errors.push({ service: 'claude', error: 'API key not configured' });
      }

      return NextResponse.json(results);
    } else {
      return NextResponse.json(
        { error: 'Invalid service. Use "perplexity", "claude", or "both"' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('AI research error:', error);
    return NextResponse.json(
      { error: 'Failed to perform AI research' },
      { status: 500 }
    );
  }
}