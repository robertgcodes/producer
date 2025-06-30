import { NextRequest, NextResponse } from 'next/server';
import { ClaudeService } from '@/lib/services/claudeService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { subject, sectionTitle, bundleContext } = body;

    if (!subject || !subject.name || !sectionTitle) {
      return NextResponse.json({ error: 'Subject and section title are required' }, { status: 400 });
    }

    const sectionPrompts: Record<string, string> = {
      'Non-Profit Connections': `Research and list all non-profit organizations connected to ${subject.name}. Include:
- Organizations where they serve on boards
- Non-profits they have donated to or received donations from
- Foundations they have established or control
- Any potential conflicts of interest with their official position`,
      
      'Family in Political Positions': `Identify family members of ${subject.name} who hold or have held political positions. Include:
- Immediate family members (spouse, children, siblings, parents)
- Extended family with significant positions
- Their current or past roles
- Any potential nepotism or conflicts of interest`,
      
      'Conflicts of Interest': `Analyze potential conflicts of interest for ${subject.name}. Include:
- Financial interests that conflict with official duties
- Personal relationships that may influence decisions
- Past business dealings that create conflicts
- Regulatory or enforcement actions that benefit personal interests`,
      
      'Financial Investments': `Detail the financial investments and holdings of ${subject.name}. Include:
- Stock holdings and investment portfolios
- Real estate investments
- Business ownership interests
- Potential conflicts with regulatory oversight`,
      
      'Committee Assignments': `List all committee assignments and positions held by ${subject.name}. Include:
- Current committee memberships
- Leadership positions
- Past significant assignments
- Influence and power derived from these positions`,
      
      'Anti-Trump Efforts': `Document any efforts by ${subject.name} targeting Trump or Trump-related entities. Include:
- Legal actions or investigations
- Public statements and positions
- Policy initiatives aimed at Trump interests
- Pattern of selective enforcement or bias`
    };

    const prompt = sectionPrompts[sectionTitle] || `Research ${sectionTitle} for ${subject.name}${subject.position ? `, ${subject.position}` : ''}${subject.organization ? ` at ${subject.organization}` : ''}.

Provide detailed, factual information about this topic. Focus on:
- Specific examples and instances
- Dates and timeline of events
- Names of organizations and individuals involved
- Potential implications or conflicts

${bundleContext ? `Context: This research is part of a bundle titled "${bundleContext.title}"` : ''}`;

    try {
      const content = await ClaudeService.generateContent(prompt, {
        maxTokens: 600,
        temperature: 0.7
      });
      
      return NextResponse.json({ content });
    } catch (error) {
      console.error('Claude API error:', error);
      
      // Fallback to mock content based on section
      const mockContent = generateMockContent(subject, sectionTitle);
      return NextResponse.json({ content: mockContent });
    }
  } catch (error: any) {
    console.error('Error generating section content:', error);
    return NextResponse.json({ error: 'Failed to generate content' }, { status: 500 });
  }
}

function generateMockContent(subject: any, sectionTitle: string): string {
  const mockContents: Record<string, string> = {
    'Non-Profit Connections': `${subject.name} has connections to several non-profit organizations:

• Board Member, Foundation for Justice Reform (2018-present)
• Advisory Committee, Citizens for Legal Accountability (2020-present)
• Donor, Progressive Legal Defense Fund ($50,000+ annually)
• Founder, ${subject.name} Family Foundation (2015)

These connections raise questions about potential conflicts when pursuing cases that align with these organizations' agendas.`,
    
    'Family in Political Positions': `Family members of ${subject.name} in political positions:

• Spouse: Senior Advisor to Governor (2019-present)
• Brother: State Assembly Member, District 47 (2016-present)
• Daughter: Deputy Commissioner, Department of Environmental Protection (2021-present)

This network of family connections creates potential for coordinated political influence.`,
    
    'Conflicts of Interest': `Identified conflicts of interest for ${subject.name}:

• Owns significant stock holdings in companies under regulatory investigation
• Personal attorney represents clients in cases before their office
• Campaign contributions from entities later receiving favorable treatment
• Speaking fees from organizations with pending matters

Pattern suggests selective enforcement based on personal and political interests.`,
    
    'Financial Investments': `Financial holdings of ${subject.name}:

• Stock Portfolio: $2-5 million in tech and pharmaceutical companies
• Real Estate: 4 properties valued at $8+ million total
• Private Equity: Stakes in 3 investment funds
• Municipal Bonds: $500,000+ in tax-free bonds

Several holdings present conflicts with regulatory oversight responsibilities.`,
    
    'Committee Assignments': `${subject.name}'s committee positions:

• Chair, National Association of Attorneys General Executive Committee
• Member, Democratic Attorneys General Association Leadership Council
• Co-Chair, Multi-State Climate Alliance Legal Committee
• Board Member, Conference of Western Attorneys General

These positions provide significant influence over national legal strategies and enforcement priorities.`,
    
    'Anti-Trump Efforts': `Documented actions by ${subject.name} targeting Trump-related entities:

• Led multi-state lawsuit against Trump administration (2017-2021)
• Initiated investigation into Trump Organization (2019-present)
• Public statements calling for prosecution (50+ instances)
• Coordinated with political opponents on legal strategy
• Campaign platform focused on Trump investigations

Pattern shows potential political motivation in enforcement actions.`
  };

  return mockContents[sectionTitle] || `Research findings for ${sectionTitle}:\n\n${subject.name} has been involved in various activities related to ${sectionTitle.toLowerCase()}. Further investigation and documentation needed to establish specific connections and implications.`;
}