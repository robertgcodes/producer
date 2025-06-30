import { NextRequest, NextResponse } from 'next/server';

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;

// Wikipedia search - get full article content
async function searchWikipedia(name: string): Promise<any> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    // Search for the person
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&list=search&srsearch=${encodeURIComponent(name)}&srlimit=1&origin=*`;
    const searchResponse = await fetch(searchUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    const searchData = await searchResponse.json();
    
    if (!searchData.query?.search?.length) return null;
    
    // Get the full page content
    const pageTitle = searchData.query.search[0].title;
    const contentUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts|pageimages&exintro=false&explaintext=true&titles=${encodeURIComponent(pageTitle)}&piprop=original&origin=*`;
    
    const contentResponse = await fetch(contentUrl);
    const contentData = await contentResponse.json();
    
    const pages = contentData.query?.pages;
    if (!pages) return null;
    
    const pageId = Object.keys(pages)[0];
    const page = pages[pageId];
    
    return {
      title: page.title,
      extract: page.extract, // Full article text
      imageUrl: page.original?.source,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title)}`
    };
  } catch (error) {
    console.error('Wikipedia search error:', error);
    return null;
  }
}

// Use Claude to interpret Wikipedia content
async function interpretWithClaude(wikiData: any, name: string): Promise<any> {
  if (!CLAUDE_API_KEY) {
    console.error('CLAUDE_API_KEY not configured');
    return null;
  }

  const wikipediaText = wikiData.extract || '';
  
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 4000,
        temperature: 0,
        messages: [{
          role: 'user',
          content: `I need you to extract comprehensive biographical information about ${name} from this Wikipedia article. 

Wikipedia content:
${wikipediaText.substring(0, 12000)}

Please extract and return ONLY a JSON object with these exact fields. Be thorough and detailed in your extraction. If information is not found in the text, use "Not Available" as the value. Include as much detail as possible from the Wikipedia text.

Required JSON format:
{
  "dob": "Extract exact birth date in format: Month DD, YYYY",
  "birthplace": "Extract full birthplace including city, state/province, and country",
  "occupation": "Current primary occupation or position with full title and organization",
  "pastProfessions": "List ALL previous positions/jobs with dates, organizations, and roles. Format as bullet points with years",
  "education": "List ALL educational history including high school if mentioned, colleges, degrees (BA/BS/MA/MS/PhD/JD etc), majors, graduation years, honors, and any other educational achievements",
  "religion": "Religious affiliation and level of practice if mentioned",
  "politicalParty": "Political party membership with dates of affiliation changes if applicable",
  "politicalAffiliations": "All political groups, endorsements, campaign contributions, political appointments, and ideological leanings",
  "marriageStatus": "Current marital status with date of current status (e.g., 'Married since 2010')",
  "spouse": "Full name of current spouse and any previous spouses with marriage dates",
  "children": "Number of children and their full names, ages/birth years, and any notable information about them",
  "parents": "Full names of both parents, their occupations if mentioned, and any relevant background",
  "siblings": "Full names of all siblings, their occupations, and relationship details",
  "militaryService": "Complete military service record including branch, dates of service, final rank, units, deployments, combat experience, and any commendations",
  "netWorth": "Estimated net worth, income sources, major assets, and financial disclosures if available",
  "residence": "Current residence with as much detail as available (city, state, neighborhood, type of residence)",
  "awards": "List ALL awards, honors, honorary degrees, and recognitions with dates and awarding organizations. Include both professional and civic honors",
  "memberships": "List ALL professional associations, social clubs, corporate boards, advisory positions, think tanks, and other affiliations with dates",
  "notes": "5-7 interesting, notable, or controversial facts about the person including hobbies, interests, controversies, health issues, books authored, famous quotes, or other distinguishing information"
}

Be extremely thorough - extract every piece of biographical information available in the text. Return ONLY the JSON object, no other text.`
        }]
      })
    });

    if (!response.ok) {
      console.error('Claude API error:', response.status);
      return null;
    }

    const data = await response.json();
    const content = data.content[0].text;
    
    // Extract JSON from Claude's response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    return null;
  } catch (error) {
    console.error('Claude interpretation error:', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, existingData } = await request.json();

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    console.log('Fetching Wikipedia data for:', name);
    
    // Step 1: Get Wikipedia data
    const wikiData = await searchWikipedia(name);
    
    if (!wikiData) {
      console.log('No Wikipedia data found for:', name);
      return NextResponse.json(generateEmptyData());
    }
    
    console.log('Wikipedia data fetched, sending to Claude for interpretation...');
    
    // Step 2: Send to Claude for interpretation
    const claudeData = await interpretWithClaude(wikiData, name);
    
    if (!claudeData) {
      console.log('Claude interpretation failed, returning empty data');
      return NextResponse.json({
        ...generateEmptyData(),
        photoUrl: wikiData.imageUrl || null,
        notes: 'Wikipedia page found but could not extract structured data. Please fill manually.'
      });
    }
    
    // Step 3: Combine Claude's interpretation with Wikipedia image and URL
    const bioData = {
      ...claudeData,
      photoUrl: wikiData.imageUrl || null,
      wikipediaUrl: wikiData.url || null
    };
    
    // Ensure all fields have values
    const requiredFields = [
      'dob', 'birthplace', 'occupation', 'pastProfessions', 'education',
      'religion', 'politicalParty', 'politicalAffiliations', 'marriageStatus',
      'spouse', 'children', 'parents', 'siblings', 'militaryService',
      'netWorth', 'residence', 'awards', 'memberships', 'notes'
    ];
    
    for (const field of requiredFields) {
      if (!bioData[field] || bioData[field] === '') {
        bioData[field] = 'Not Available';
      }
    }

    console.log('Successfully extracted biographical data for:', name);
    return NextResponse.json(bioData);

  } catch (error) {
    console.error('Bio fill error:', error);
    return NextResponse.json(generateEmptyData(), { status: 200 });
  }
}

function generateEmptyData() {
  return {
    dob: 'Not Available',
    birthplace: 'Not Available',
    occupation: 'Not Available',
    pastProfessions: 'Not Available',
    education: 'Not Available',
    religion: 'Not Available',
    politicalParty: 'Not Available',
    politicalAffiliations: 'Not Available',
    marriageStatus: 'Not Available',
    spouse: 'Not Available',
    children: 'Not Available',
    parents: 'Not Available',
    siblings: 'Not Available',
    militaryService: 'Not Available',
    netWorth: 'Not Available',
    residence: 'Not Available',
    awards: 'Not Available',
    memberships: 'Not Available',
    notes: 'No data found. Please enter information manually.'
  };
}