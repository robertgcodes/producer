import { NextRequest, NextResponse } from 'next/server';
import { Anthropic } from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY || '',
});

export async function POST(request: NextRequest) {
  try {
    const { stories } = await request.json();

    if (!stories || stories.length === 0) {
      return NextResponse.json({ error: 'No stories provided' }, { status: 400 });
    }

    // Prepare story text for analysis
    const storyText = stories.map((story: any, index: number) => 
      `Story ${index + 1}: ${story.title}\n${story.description || ''}`
    ).join('\n\n');

    const prompt = `Extract all important people, places, and organizations mentioned in these news stories. Focus on:
- Political figures (presidents, judges, senators, etc.)
- Government bodies (Supreme Court, Congress, agencies, etc.)
- Organizations and companies
- Geographic locations
- Other key entities

For each entity, identify:
1. The entity name
2. The type (person, place, or organization)
3. How many times it appears across all stories

Return the results as a JSON array with this format:
[
  {
    "name": "Entity Name",
    "type": "person|place|organization",
    "count": number
  }
]

Stories to analyze:
${storyText}`;

    const response = await anthropic.messages.create({
      model: 'claude-3-sonnet-20241022',
      max_tokens: 1000,
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

    // Parse the JSON response
    let entities = [];
    try {
      // Extract JSON from the response
      const jsonMatch = content.text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        entities = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      // Fall back to empty array if parsing fails
      entities = [];
    }

    // Transform to match our interface
    const extractedEntities = entities.map((entity: any, index: number) => ({
      id: `${entity.type}-${entity.name.toLowerCase().replace(/\s+/g, '-')}`,
      name: entity.name,
      type: entity.type,
      count: entity.count || 1
    }));

    return NextResponse.json({ entities: extractedEntities });
  } catch (error) {
    console.error('Error extracting entities:', error);
    return NextResponse.json(
      { error: 'Failed to extract entities' },
      { status: 500 }
    );
  }
}