import { NextRequest, NextResponse } from 'next/server';
import { getTemplateByType } from '@/lib/research/templates';
import { getDefaultPrompt } from '@/components/settings/PromptTemplateManager';

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';

export async function POST(request: NextRequest) {
  try {
    const { blockType, subject, customPrompt, bundleContext } = await request.json();

    if (!PERPLEXITY_API_KEY) {
      console.error('PERPLEXITY_API_KEY not configured');
      return NextResponse.json(
        { error: 'Research service not configured' },
        { status: 500 }
      );
    }

    // Get the template and construct the prompt
    const template = getTemplateByType(blockType);
    if (!template) {
      return NextResponse.json(
        { error: 'Invalid research block type' },
        { status: 400 }
      );
    }

    // Build the research prompt - check for custom prompt, then custom default, then template default
    const customDefaultPrompt = getDefaultPrompt(blockType);
    const basePrompt = customPrompt || customDefaultPrompt || template.defaultPrompt;
    const contextualPrompt = `
Context: This research is for a bundle titled "${bundleContext.title}" ${
      bundleContext.description ? `about: ${bundleContext.description}` : ''
    }

${basePrompt}

Subject Details:
${Object.entries(subject)
  .filter(([key, value]) => value && key !== 'name')
  .map(([key, value]) => `- ${key}: ${value}`)
  .join('\n')}

Please provide comprehensive research in a structured format with:
1. A summary of key findings (3-5 bullet points)
2. Detailed sections covering different aspects
3. Include sources and citations where possible
4. Focus on factual, verifiable information

Research Subject: ${subject.name}`;

    // Call Perplexity API
    const response = await fetch(PERPLEXITY_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'pplx-70b-online', // Using their online model for web search
        messages: [
          {
            role: 'system',
            content: 'You are a professional researcher providing detailed, factual research reports. Always cite sources and focus on verifiable information.'
          },
          {
            role: 'user',
            content: contextualPrompt
          }
        ],
        temperature: 0.2, // Lower temperature for more factual responses
        max_tokens: 2000,
        return_citations: true,
        return_images: false,
        search_recency_filter: 'month' // Focus on recent information
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Perplexity API error:', response.status, errorText);
      
      // Check for specific error types
      if (response.status === 401) {
        throw new Error('Invalid API key');
      } else if (response.status === 429) {
        throw new Error('Rate limit exceeded');
      }
      
      throw new Error(`Research request failed: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;
    const citations = data.citations || [];

    // Parse the AI response into structured format
    const research = parseResearchResponse(aiResponse, citations);

    return NextResponse.json({ research });
  } catch (error) {
    console.error('Research error:', error);
    return NextResponse.json(
      { error: 'Failed to conduct research' },
      { status: 500 }
    );
  }
}

function parseResearchResponse(content: string, citations: any[]) {
  // This is a simple parser - you might want to make it more sophisticated
  const lines = content.split('\n').filter(line => line.trim());
  
  // Extract summary points
  const summaryStart = lines.findIndex(line => 
    line.toLowerCase().includes('summary') || 
    line.toLowerCase().includes('key findings')
  );
  
  const summary: string[] = [];
  if (summaryStart !== -1) {
    let i = summaryStart + 1;
    while (i < lines.length && (lines[i].startsWith('-') || lines[i].startsWith('•') || lines[i].match(/^\d+\./))) {
      summary.push(lines[i].replace(/^[-•]\s*|\d+\.\s*/, '').trim());
      i++;
    }
  }

  // Extract sections
  const sections: any[] = [];
  const sectionHeaders = lines.filter(line => 
    line.match(/^#+\s/) || // Markdown headers
    line.match(/^[A-Z][^.!?]*:$/) || // Title case followed by colon
    line.match(/^\d+\.\s+[A-Z]/) // Numbered sections
  );

  for (let i = 0; i < sectionHeaders.length; i++) {
    const headerIndex = lines.indexOf(sectionHeaders[i]);
    const nextHeaderIndex = i + 1 < sectionHeaders.length 
      ? lines.indexOf(sectionHeaders[i + 1]) 
      : lines.length;
    
    const sectionTitle = sectionHeaders[i]
      .replace(/^#+\s*/, '')
      .replace(/:$/, '')
      .replace(/^\d+\.\s*/, '');
    
    const sectionContent = lines
      .slice(headerIndex + 1, nextHeaderIndex)
      .filter(line => !line.match(/^[-•]\s*|\d+\.\s*/)) // Filter out bullet points
      .join('\n')
      .trim();
    
    if (sectionContent && !sectionTitle.toLowerCase().includes('summary')) {
      sections.push({
        id: sectionTitle.toLowerCase().replace(/\s+/g, '-'),
        title: sectionTitle,
        content: sectionContent,
        sources: extractSources(sectionContent, citations)
      });
    }
  }

  // If no sections were parsed, create a general section
  if (sections.length === 0 && content.trim()) {
    sections.push({
      id: 'general',
      title: 'Research Findings',
      content: content,
      sources: citations.slice(0, 5).map(cit => ({
        title: cit.title || 'Source',
        url: cit.url || '#',
        publishedDate: cit.published_date
      }))
    });
  }

  return {
    summary: summary.length > 0 ? summary : ['Research completed successfully'],
    sections,
    metadata: {
      searchQueries: [], // Perplexity doesn't expose search queries
      totalSources: citations.length,
      confidence: citations.length > 5 ? 'high' : citations.length > 2 ? 'medium' : 'low'
    }
  };
}

function extractSources(content: string, citations: any[]) {
  // Look for citation markers like [1], [2], etc. in the content
  const citationMatches = content.match(/\[\d+\]/g) || [];
  const citedIndices = citationMatches
    .map(match => parseInt(match.replace(/\[|\]/g, '')) - 1)
    .filter(index => index >= 0 && index < citations.length);
  
  const uniqueIndices = [...new Set(citedIndices)];
  
  return uniqueIndices.map(index => ({
    title: citations[index].title || 'Source',
    url: citations[index].url || '#',
    publishedDate: citations[index].published_date
  }));
}