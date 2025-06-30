import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY || '',
});

export async function POST(request: NextRequest) {
  try {
    const { text, prompt, type } = await request.json();
    
    if (!text || !prompt) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Limit text length to avoid token limits
    const truncatedText = text.slice(0, 30000);
    
    const systemPrompt = `You are a document analysis assistant. Analyze the provided document text and extract the requested information. Provide your response in JSON format.`;
    
    const message = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1000,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `${prompt}\n\nDocument text:\n${truncatedText}`
        }
      ],
    });
    
    // Parse the response
    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
    
    try {
      // Try to parse as JSON
      const jsonStart = responseText.indexOf('{');
      const jsonEnd = responseText.lastIndexOf('}') + 1;
      
      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        const jsonStr = responseText.slice(jsonStart, jsonEnd);
        const result = JSON.parse(jsonStr);
        
        return NextResponse.json(result);
      } else {
        // Fallback: structure the response
        return NextResponse.json({
          type,
          analysis: responseText,
          title: responseText.split('\n')[0]?.slice(0, 60) || 'Document Analysis',
          summary: responseText.slice(0, 200),
        });
      }
    } catch (parseError) {
      // If JSON parsing fails, return structured response
      return NextResponse.json({
        type,
        analysis: responseText,
        title: 'Document Analysis',
        summary: responseText.slice(0, 200),
      });
    }
    
  } catch (error: any) {
    console.error('Document analysis error:', error);
    
    if (error.message?.includes('api_key')) {
      return NextResponse.json(
        { error: 'Claude API key not configured' },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || 'Analysis failed' },
      { status: 500 }
    );
  }
}