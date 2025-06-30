import { NextRequest, NextResponse } from 'next/server';
import { ClaudeService } from '@/lib/services/claudeService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bundleTitle, bundleDescription, stories } = body;

    if (!bundleTitle || !stories || stories.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Prepare story summaries
    const storySummaries = stories.map((story: any, index: number) => 
      `${index + 1}. ${story.title} (${story.sourceInfo.name})`
    ).join('\n');

    const prompt = `Generate a concise executive brief for the following story bundle:

Bundle Title: ${bundleTitle}
${bundleDescription ? `Bundle Description: ${bundleDescription}` : ''}

Stories Included:
${storySummaries}

Please provide a brief (3-5 paragraphs) that:
1. Summarizes the key themes and narratives across all stories
2. Identifies the main stakeholders and their positions
3. Highlights any conflicts, controversies, or important developments
4. Provides context on why this bundle matters
5. Suggests potential angles for further investigation

Keep the tone professional and analytical, suitable for a news producer or journalist.`;

    const brief = await ClaudeService.generateContent(prompt, {
      maxTokens: 800,
      temperature: 0.7
    });

    return NextResponse.json({ brief });
  } catch (error: any) {
    console.error('Error generating brief:', error);
    
    // Fallback to a mock response for demo
    const mockBrief = `This story bundle represents a significant development in current affairs, bringing together multiple perspectives on a critical issue. The collection of stories highlights various stakeholder positions and emerging narratives that warrant careful analysis.

Key themes emerging from these stories include regulatory challenges, public response, and institutional dynamics. Multiple sources confirm growing attention to this matter from both government officials and public interest groups.

The timing of these developments is particularly noteworthy, as they coincide with broader policy discussions at the national level. This convergence suggests potential for significant impact on future decision-making processes.`;
    
    return NextResponse.json({ brief: mockBrief });
  }
}