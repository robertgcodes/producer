import { NextRequest, NextResponse } from 'next/server';
import { Anthropic } from '@anthropic-ai/sdk';

export async function POST(request: NextRequest) {
  try {
    const { stories, bundleDescription, customInstructions } = await request.json();

    // Check if API key is configured
    if (!process.env.CLAUDE_API_KEY) {
      return NextResponse.json(
        { error: 'Claude API key not configured. Please add CLAUDE_API_KEY to your environment variables.' },
        { status: 500 }
      );
    }

    const anthropic = new Anthropic({
      apiKey: process.env.CLAUDE_API_KEY,
    });

    if (!stories || stories.length === 0) {
      return NextResponse.json({ error: 'No stories provided' }, { status: 400 });
    }

    // Prepare story context
    const storyContext = stories.map((story: any, index: number) => 
      `${index + 1}. ${story.title}\n   Source: ${story.sourceInfo?.name || 'Unknown'}`
    ).join('\n\n');

    // Get custom instructions from user settings or use default
    const instructions = customInstructions || `Generate compelling, attention-grabbing titles that:
- Are concise and impactful (5-10 words max)
- Capture the essence of the story bundle
- Use active voice and strong verbs
- Appeal to the target audience
- Are suitable for video thumbnails or social media`;

    const prompt = `You are a professional headline writer for digital media. Generate 5 compelling titles for a story bundle.

Bundle Description: ${bundleDescription || 'News story bundle'}

Stories in this bundle:
${storyContext}

Custom Style Instructions:
${instructions}

Generate 5 different title options that capture the essence of these stories. Make each title unique and compelling. Return only the titles, one per line, without numbers or bullet points.`;

    const response = await anthropic.messages.create({
      model: 'claude-3-sonnet-20241022',
      max_tokens: 200,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response format');
    }

    // Parse titles from response
    const titles = content.text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && line.length < 100) // Basic validation
      .slice(0, 5); // Ensure we have at most 5 titles

    return NextResponse.json({ titles });
  } catch (error: any) {
    console.error('Error generating titles:', error);
    
    // Return more detailed error for debugging
    const errorMessage = error.response?.data?.error?.message || error.message || 'Failed to generate titles';
    const errorDetails = {
      error: errorMessage,
      type: error.name,
      details: error.response?.data || {}
    };
    
    return NextResponse.json(errorDetails, { status: 500 });
  }
}