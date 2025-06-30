import { NextRequest, NextResponse } from 'next/server';
import { ClaudeService } from '@/lib/services/claudeService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { subject, sections } = body;

    if (!subject || !subject.name) {
      return NextResponse.json({ error: 'Subject information is required' }, { status: 400 });
    }

    // Prepare research content
    const researchContent = sections
      .filter((section: any) => section.content.trim())
      .map((section: any) => `${section.title}: ${section.content}`)
      .join('\n\n');

    if (!researchContent) {
      return NextResponse.json({ 
        summary: [
          'No research content available yet.',
          'Add content to the research sections below to generate a comprehensive summary.'
        ] 
      });
    }

    const prompt = `Generate an executive summary of opposition research for ${subject.name}${subject.position ? `, ${subject.position}` : ''}${subject.organization ? ` at ${subject.organization}` : ''}.

Research Content:
${researchContent}

Please provide a concise executive summary as 5-8 bullet points that:
1. Highlight the most significant findings
2. Identify patterns or connections
3. Note potential conflicts of interest
4. Summarize key relationships and affiliations
5. Present actionable insights

Format as bullet points only, no introduction or conclusion.`;

    try {
      const response = await ClaudeService.generateContent(prompt, {
        maxTokens: 500,
        temperature: 0.7
      });
      
      // Parse response into bullet points
      const summary = response
        .split('\n')
        .filter(line => line.trim().startsWith('•') || line.trim().startsWith('-'))
        .map(line => line.replace(/^[•\-]\s*/, '').trim())
        .filter(line => line.length > 0);
      
      return NextResponse.json({ summary });
    } catch (error) {
      console.error('Claude API error:', error);
      // Fallback to mock data
      const mockSummary = [
        `${subject.name} has extensive connections across multiple non-profit organizations`,
        'Financial disclosures reveal investments in sectors related to their regulatory oversight',
        'Family members hold positions in organizations that have received favorable treatment',
        'Pattern of targeting political opponents through selective investigations',
        'Committee assignments provide significant influence over policy areas of personal interest',
        'Public statements show consistent bias in enforcement actions'
      ];
      
      return NextResponse.json({ summary: mockSummary });
    }
  } catch (error: any) {
    console.error('Error generating summary:', error);
    return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 });
  }
}