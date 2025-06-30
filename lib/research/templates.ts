import { ResearchBlockTemplate } from '@/types';

export const researchBlockTemplates: ResearchBlockTemplate[] = [
  {
    type: 'bio',
    name: 'Biography',
    description: 'Comprehensive biographical information and personal details',
    icon: 'user-circle',
    defaultPrompt: `Research and provide comprehensive biographical information for the subject including:
- Full legal name and any aliases
- Date and place of birth
- Current and past occupations with dates
- Educational background (schools, degrees, years)
- Religious affiliation and level of practice
- Political party registrations and affiliations
- Marital history (current status, spouse name, previous marriages)
- Children (names, ages, occupations if adult)
- Parents and siblings information
- Military service record
- Professional licenses and certifications
- Awards and honors received
- Published works or patents
- Club memberships and affiliations
- Residences (current and significant past)
- Net worth and financial status
- Health issues (if publicly known)
- Hobbies and personal interests
Focus on verified, publicly available information with sources.`,
    fields: [
      { id: 'name', label: 'Full Name', type: 'text', required: true },
      { id: 'photoUrl', label: 'Photo URL', type: 'text' },
      { id: 'dob', label: 'Date of Birth', type: 'text' },
      { id: 'birthplace', label: 'Birthplace', type: 'text' },
      { id: 'occupation', label: 'Current Occupation', type: 'text' },
      { id: 'pastProfessions', label: 'Past Professions', type: 'textarea' },
      { id: 'education', label: 'Education', type: 'textarea' },
      { id: 'religion', label: 'Religion', type: 'text' },
      { id: 'politicalParty', label: 'Political Party', type: 'text' },
      { id: 'politicalAffiliations', label: 'Political Affiliations', type: 'textarea' },
      { id: 'marriageStatus', label: 'Marriage Status', type: 'text' },
      { id: 'spouse', label: 'Spouse Name', type: 'text' },
      { id: 'children', label: 'Children', type: 'textarea' },
      { id: 'parents', label: 'Parents', type: 'textarea' },
      { id: 'siblings', label: 'Siblings', type: 'textarea' },
      { id: 'militaryService', label: 'Military Service', type: 'text' },
      { id: 'netWorth', label: 'Net Worth', type: 'text' },
      { id: 'residence', label: 'Current Residence', type: 'text' },
      { id: 'awards', label: 'Awards & Honors', type: 'textarea' },
      { id: 'memberships', label: 'Memberships & Affiliations', type: 'textarea' },
      { id: 'notes', label: 'Additional Notes', type: 'textarea' }
    ]
  },
  {
    type: 'judge',
    name: 'Judge',
    description: 'Research judicial background, rulings, and affiliations',
    icon: 'gavel',
    defaultPrompt: `Research the following judge comprehensively:
- Educational background and legal career
- Notable rulings and judicial philosophy
- Political affiliations and appointment history
- Conflicts of interest or controversies
- Reversal rates and appellate history
- Bar associations and professional memberships`,
    fields: [
      { id: 'name', label: 'Judge Name', type: 'text', required: true },
      { id: 'court', label: 'Court', type: 'text', placeholder: 'e.g., Southern District of NY' },
      { id: 'appointedBy', label: 'Appointed By', type: 'text' },
      { id: 'yearAppointed', label: 'Year Appointed', type: 'text' }
    ]
  },
  {
    type: 'politician',
    name: 'Politician',
    description: 'Research political background, positions, and controversies',
    icon: 'building',
    defaultPrompt: `Research the following politician thoroughly:
- Current position and political history
- Policy positions and voting record
- Campaign finance and major donors
- Conflicts of interest and financial disclosures
- Family members in political positions
- Controversies and scandals
- Committee assignments and leadership roles`,
    fields: [
      { id: 'name', label: 'Name', type: 'text', required: true },
      { id: 'position', label: 'Current Position', type: 'text' },
      { id: 'party', label: 'Party Affiliation', type: 'select', options: [
        { value: 'democrat', label: 'Democrat' },
        { value: 'republican', label: 'Republican' },
        { value: 'independent', label: 'Independent' },
        { value: 'other', label: 'Other' }
      ]},
      { id: 'state', label: 'State/District', type: 'text' }
    ]
  },
  {
    type: 'prosecutor',
    name: 'Prosecutor',
    description: 'Research prosecutorial background and case history',
    icon: 'scales',
    defaultPrompt: `Research the following prosecutor:
- Professional background and career progression
- Notable cases prosecuted
- Conviction rates and sentencing patterns
- Political affiliations and appointments
- Controversies or misconduct allegations
- Relationships with law enforcement
- Public statements and policy positions`,
    fields: [
      { id: 'name', label: 'Prosecutor Name', type: 'text', required: true },
      { id: 'office', label: 'Office', type: 'text', placeholder: 'e.g., District Attorney' },
      { id: 'jurisdiction', label: 'Jurisdiction', type: 'text' }
    ]
  },
  {
    type: 'defense_attorney',
    name: 'Defense Attorney',
    description: 'Research defense attorney background and cases',
    icon: 'briefcase',
    defaultPrompt: `Research the following defense attorney:
- Educational and professional background
- Notable cases defended
- Areas of specialization
- Success rates and notable victories
- Bar admissions and disciplinary history
- Media presence and public statements
- Connections to other legal figures`,
    fields: [
      { id: 'name', label: 'Attorney Name', type: 'text', required: true },
      { id: 'firm', label: 'Law Firm', type: 'text' },
      { id: 'barNumber', label: 'Bar Number', type: 'text' }
    ]
  },
  {
    type: 'criminal_defendant',
    name: 'Criminal Defendant',
    description: 'Research defendant background and criminal history',
    icon: 'user-x',
    defaultPrompt: `Research the following criminal defendant:
- Personal background and history
- Current charges and allegations
- Criminal history and prior convictions
- Known associates and connections
- Financial background
- Media coverage and public perception
- Family and personal relationships`,
    fields: [
      { id: 'name', label: 'Defendant Name', type: 'text', required: true },
      { id: 'charges', label: 'Current Charges', type: 'textarea' },
      { id: 'caseNumber', label: 'Case Number', type: 'text' }
    ]
  },
  {
    type: 'nonprofit',
    name: 'Non-Profit Organization',
    description: 'Research non-profit funding, leadership, and activities',
    icon: 'heart',
    defaultPrompt: `Research the following non-profit organization:
- Mission statement and activities
- Leadership and board members
- Funding sources and major donors
- Financial disclosures (990 forms)
- Political connections and lobbying
- Controversies or investigations
- Affiliated organizations
- Grant recipients and partnerships`,
    fields: [
      { id: 'name', label: 'Organization Name', type: 'text', required: true },
      { id: 'ein', label: 'EIN', type: 'text', placeholder: 'Tax ID Number' },
      { id: 'type', label: 'Type', type: 'select', options: [
        { value: '501c3', label: '501(c)(3)' },
        { value: '501c4', label: '501(c)(4)' },
        { value: 'other', label: 'Other' }
      ]}
    ]
  },
  {
    type: 'federal_agency',
    name: 'Federal Agency',
    description: 'Research agency leadership, policies, and controversies',
    icon: 'flag',
    defaultPrompt: `Research the following federal agency:
- Current leadership and key personnel
- Recent policy changes and initiatives
- Budget and funding allocation
- Controversies and investigations
- Relationships with other agencies
- Congressional oversight and hearings
- Major contracts and contractors`,
    fields: [
      { id: 'name', label: 'Agency Name', type: 'text', required: true },
      { id: 'director', label: 'Current Director', type: 'text' },
      { id: 'department', label: 'Parent Department', type: 'text' }
    ]
  },
  {
    type: 'institution',
    name: 'Institution',
    description: 'Research institutional background and connections',
    icon: 'building-2',
    defaultPrompt: `Research the following institution:
- History and founding
- Leadership and governance
- Funding and financial status
- Notable affiliations and partnerships
- Controversies and legal issues
- Political connections
- Major initiatives and programs`,
    fields: [
      { id: 'name', label: 'Institution Name', type: 'text', required: true },
      { id: 'type', label: 'Type', type: 'select', options: [
        { value: 'university', label: 'University' },
        { value: 'think_tank', label: 'Think Tank' },
        { value: 'foundation', label: 'Foundation' },
        { value: 'other', label: 'Other' }
      ]},
      { id: 'location', label: 'Location', type: 'text' }
    ]
  },
  {
    type: 'related_persons',
    name: 'Related Persons',
    description: 'Research family members and close associates',
    icon: 'users',
    defaultPrompt: `Research the following related persons:
- Relationship to main subject
- Professional background and positions
- Financial connections and shared interests
- Political affiliations and activities
- Business partnerships
- Legal issues or controversies
- Public statements and social media presence`,
    fields: [
      { id: 'name', label: 'Person Name', type: 'text', required: true },
      { id: 'relationship', label: 'Relationship', type: 'text', placeholder: 'e.g., Spouse, Business Partner' },
      { id: 'primarySubject', label: 'Related To', type: 'text' }
    ]
  },
  {
    type: 'custom',
    name: 'Custom Research',
    description: 'Create a custom research block with your own parameters',
    icon: 'plus-circle',
    defaultPrompt: `Conduct comprehensive research based on the custom parameters provided.`,
    fields: [
      { id: 'name', label: 'Subject Name', type: 'text', required: true },
      { id: 'researchFocus', label: 'Research Focus', type: 'textarea', placeholder: 'What specific aspects should be researched?' }
    ]
  }
];

export function getTemplateByType(type: string): ResearchBlockTemplate | undefined {
  return researchBlockTemplates.find(t => t.type === type);
}

export function getDefaultPromptForType(type: string): string {
  const template = getTemplateByType(type);
  return template?.defaultPrompt || '';
}