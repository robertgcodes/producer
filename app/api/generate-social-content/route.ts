import { NextRequest, NextResponse } from 'next/server';
import { ClaudeService } from '@/lib/services/claudeService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bundleTitle, bundleDescription, stories, aiModel, contentType } = body;

    if (!bundleTitle || !stories || stories.length === 0 || !contentType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Prepare story context
    const storyContext = stories.map((story: any) => 
      `- ${story.title} (${story.sourceInfo.name})`
    ).join('\n');

    let prompt = '';
    let examples = [];

    switch (contentType) {
      case 'tweets':
        prompt = `Generate 5 engaging tweets about this news bundle:

Bundle: ${bundleTitle}
${bundleDescription ? `Context: ${bundleDescription}` : ''}

Key Stories:
${storyContext}

Requirements:
- Each tweet should be under 280 characters
- Include relevant hashtags
- Mix of informative, analytical, and engagement-driving tweets
- Professional journalistic tone
- Focus on different angles from the stories`;

        examples = [
          "BREAKING: New developments in the ongoing story about [topic]. Multiple sources confirm [key detail]. Full coverage: [link] #News #Breaking",
          "Analysis: What today's [topic] news means for [stakeholder group]. Three key takeaways from our investigation: [thread] 🧵",
          "JUST IN: [Official/Source] responds to [development]: \"[quote or paraphrase]\" - More updates as this story develops #[Topic]"
        ];
        break;

      case 'instagram':
        prompt = `Generate 5 Instagram carousel post ideas for this news bundle:

Bundle: ${bundleTitle}
${bundleDescription ? `Context: ${bundleDescription}` : ''}

Key Stories:
${storyContext}

Requirements:
- Each idea should include:
  - Compelling hook for slide 1
  - 3-5 key points for body slides
  - Call-to-action for final slide
- Visual and engaging language
- Educational yet accessible tone
- Focus on shareable insights`;

        examples = [
          "Slide 1: \"What you need to know about [topic] 👇\"\nSlide 2-4: Key facts and timeline\nSlide 5: \"Follow for more breaking news updates\"",
          "Slide 1: \"The [topic] story explained in 60 seconds ⏱️\"\nSlide 2-5: Simple breakdown of complex issue\nSlide 6: \"Share this with someone who needs to know\"",
          "Slide 1: \"[Number] things that happened with [topic] today 📰\"\nSlide 2-6: Numbered list with context\nSlide 7: \"What did we miss? Comment below\""
        ];
        break;

      default:
        return NextResponse.json({ error: 'Invalid content type' }, { status: 400 });
    }

    // In production, this would use the specified AI model
    // For now, use Claude or return mock data
    try {
      if (aiModel === 'claude') {
        const response = await ClaudeService.generateContent(prompt, {
          maxTokens: 1000,
          temperature: 0.8
        });
        
        // Parse response into array
        const content = response.split('\n').filter(line => line.trim().length > 0);
        return NextResponse.json({ [contentType]: content });
      }
    } catch (error) {
      console.error('AI generation error:', error);
    }

    // Return mock data based on model
    const mockContent = {
      claude: contentType === 'tweets' ? [
        `🚨 ${bundleTitle}: New developments reveal significant implications for policy makers. Our analysis shows three critical factors at play. Thread below 🧵`,
        `Key stakeholders respond to ${bundleTitle.toLowerCase()} developments. "This changes everything," says leading expert. Full coverage: [link] #Breaking`,
        `ANALYSIS: Why ${bundleTitle.toLowerCase()} matters more than you think. Our investigation uncovered surprising connections. Read more: [link]`
      ] : [
        `Slide 1: "${bundleTitle} - What You Need to Know 📱"\nSlides 2-4: Timeline of events with key quotes\nSlide 5: "Swipe up for full story"`,
        `Slide 1: "Breaking: ${bundleTitle} Explained ⚡"\nSlides 2-5: Visual breakdown of complex issue\nSlide 6: "Follow @yournews for updates"`,
        `Slide 1: "The ${bundleTitle} Story in 5 Facts 📊"\nSlides 2-6: Numbered facts with context\nSlide 7: "Share if this surprised you"`
      ],
      chatgpt: contentType === 'tweets' ? [
        `📰 ${bundleTitle} Update: Multiple sources confirm new developments in ongoing story. Here's what we know so far: [link] #NewsUpdate`,
        `Thread: ${bundleTitle} explained. 1/ Recent events have highlighted important questions about [topic]. Let's break it down...`,
        `NOW: ${bundleTitle} continues to develop. Key points: ✓ [Point 1] ✓ [Point 2] ✓ [Point 3] Full coverage: [link]`
      ] : [
        `Slide 1: "${bundleTitle}: A Visual Summary 🎯"\nSlides 2-5: Infographic-style breakdown\nSlide 6: "Save this post for later"`,
        `Slide 1: "Everything about ${bundleTitle} in one post 📖"\nSlides 2-6: Comprehensive overview\nSlide 7: "Questions? Drop them below"`,
        `Slide 1: "${bundleTitle} - The Complete Timeline ⏰"\nSlides 2-7: Chronological events\nSlide 8: "Follow for daily news updates"`
      ],
      grok: contentType === 'tweets' ? [
        `${bundleTitle}: The story that everyone's talking about. But here's what they're missing... [contrarian take] [link] 🤔`,
        `Unpopular opinion: The ${bundleTitle.toLowerCase()} coverage is missing the real story. Here's what actually matters: [thread]`,
        `${bundleTitle} decoded: Strip away the noise and here's what remains. Spoiler: It's not what you think. [link] 🎯`
      ] : [
        `Slide 1: "${bundleTitle} - The Take No One's Sharing 🔥"\nSlides 2-5: Contrarian analysis\nSlide 6: "Agree? Disagree? Let's discuss"`,
        `Slide 1: "Why ${bundleTitle} Is More Complex Than It Seems 🧩"\nSlides 2-6: Nuanced breakdown\nSlide 7: "What's your take?"`,
        `Slide 1: "${bundleTitle}: Read Between the Lines 📖"\nSlides 2-5: Hidden angles and implications\nSlide 6: "Follow for unfiltered analysis"`
      ]
    };

    const selectedContent = mockContent[aiModel as keyof typeof mockContent] || mockContent.claude;
    return NextResponse.json({ [contentType]: selectedContent });

  } catch (error: any) {
    console.error('Error generating social content:', error);
    return NextResponse.json({ error: 'Failed to generate content' }, { status: 500 });
  }
}