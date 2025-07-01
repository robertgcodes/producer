import { BundleFile } from '@/types';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { cleanFirestoreData } from '@/lib/utils/firebaseHelpers';
import { activityLog } from './activityLogService';

interface AnalysisPrompt {
  type: 'legal' | 'opposition' | 'summary' | 'custom' | 'timeline' | 'entities' | 'financial';
  prompt: string;
}

const ANALYSIS_PROMPTS: Record<string, AnalysisPrompt> = {
  summary: {
    type: 'summary',
    prompt: `Analyze this document and provide:
1. A concise title (max 60 characters)
2. A brief summary (2-3 sentences)
3. Key points or findings
4. Document type and purpose`
  },
  
  legal: {
    type: 'legal',
    prompt: `Analyze this legal document and extract:
1. Document type (brief, motion, order, etc.)
2. Case name and number
3. Court name and jurisdiction
4. Judge name (if mentioned)
5. Filing date
6. Parties involved (plaintiff, defendant, etc.)
7. Key legal issues or claims
8. Relief sought or ruling made
9. Important deadlines or dates
10. Brief summary of legal significance`
  },
  
  opposition: {
    type: 'opposition',
    prompt: `Analyze this document for opposition research and provide:
1. Key individuals mentioned and their roles
2. Organizations or institutions involved
3. Controversial statements or positions
4. Financial information or conflicts of interest
5. Timeline of significant events
6. Potential weaknesses or vulnerabilities
7. Supporting evidence or documentation referenced
8. Strategic implications`
  },
  
  timeline: {
    type: 'timeline',
    prompt: `Extract all dates and time-related information from this document and create a chronological timeline including:
1. All specific dates mentioned
2. Deadlines and due dates
3. Historical events referenced
4. Duration of events or processes
5. Sequence of actions or events
6. Future dates or scheduled events
Format as a chronological list with dates and descriptions.`
  },
  
  entities: {
    type: 'entities',
    prompt: `Identify and categorize all entities mentioned in this document:
1. People (full names, titles, roles)
2. Organizations (companies, agencies, institutions)
3. Locations (cities, states, countries, addresses)
4. Legal entities (courts, law firms, government bodies)
5. Financial entities (banks, funds, amounts)
6. Products or services mentioned
7. Key relationships between entities`
  },
  
  financial: {
    type: 'financial',
    prompt: `Extract all financial information from this document including:
1. Dollar amounts and currencies
2. Financial transactions
3. Assets and liabilities
4. Income and expenses
5. Financial institutions mentioned
6. Investment details
7. Tax implications
8. Financial risks or obligations`
  }
};

export class DocumentAnalysisService {
  static async analyzeDocument(
    fileId: string,
    extractedText: string,
    analysisType: keyof typeof ANALYSIS_PROMPTS | string = 'summary',
    customPrompt?: string
  ): Promise<void> {
    try {
      activityLog.info(`Starting ${analysisType} analysis for document ${fileId}`);
      
      let finalPrompt: string;
      let type: string;
      
      if (customPrompt) {
        // Use custom prompt
        finalPrompt = customPrompt;
        type = 'custom';
      } else {
        // Use predefined prompt
        const prompt = ANALYSIS_PROMPTS[analysisType as keyof typeof ANALYSIS_PROMPTS];
        if (!prompt) {
          throw new Error(`Unknown analysis type: ${analysisType}`);
        }
        finalPrompt = prompt.prompt;
        type = analysisType;
      }
      
      // Call AI service (Claude API)
      const response = await fetch('/api/analyze-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: extractedText,
          prompt: finalPrompt,
          type: type
        }),
      });
      
      if (!response.ok) {
        throw new Error('Analysis failed');
      }
      
      const result = await response.json();
      
      // Update file document with analysis results
      const updates: Partial<BundleFile> = {};
      
      // Handle different analysis types
      if (analysisType === 'summary') {
        updates.aiTitle = result.title;
        updates.aiSummary = result.summary;
      }
      
      if (analysisType === 'legal' && result.metadata) {
        updates.metadata = {
          ...updates.metadata,
          documentType: result.metadata.documentType,
          caseName: result.metadata.caseName,
          caseNumber: result.metadata.caseNumber,
          court: result.metadata.court,
          judge: result.metadata.judge,
          plaintiff: result.metadata.plaintiff,
          defendant: result.metadata.defendant,
          filingDate: result.metadata.filingDate ? new Date(result.metadata.filingDate) : undefined,
        };
      }
      
      // Store analysis results
      if (!updates.analyses) {
        updates.analyses = {};
      }
      
      updates.analyses[analysisType] = {
        type: analysisType,
        result: JSON.stringify(result),
        createdAt: new Date(),
      };
      
      await updateDoc(doc(db, 'bundleFiles', fileId), cleanFirestoreData(updates));
      
      activityLog.success(`Document analysis complete: ${analysisType}`);
      
    } catch (error) {
      console.error('Document analysis error:', error);
      activityLog.error(`Failed to analyze document: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
  
  static async extractLegalMetadata(text: string): Promise<any> {
    // Simple regex-based extraction as fallback
    const metadata: any = {};
    
    // Case name patterns
    const caseNameMatch = text.match(/(?:IN THE MATTER OF|(?:[\w\s,]+)\s+v\.\s+(?:[\w\s,]+))/i);
    if (caseNameMatch) {
      metadata.caseName = caseNameMatch[0].trim();
    }
    
    // Case number patterns
    const caseNumberMatch = text.match(/(?:Case\s+No\.|No\.|Case:|Docket\s+No\.)\s*([\w-]+)/i);
    if (caseNumberMatch) {
      metadata.caseNumber = caseNumberMatch[1];
    }
    
    // Court patterns
    const courtMatch = text.match(/(?:UNITED STATES|U\.S\.|STATE OF|SUPERIOR COURT|DISTRICT COURT|SUPREME COURT|COURT OF APPEALS)[\s\w,]+(?:DISTRICT|DIVISION|COUNTY)?/i);
    if (courtMatch) {
      metadata.court = courtMatch[0].trim();
    }
    
    // Judge patterns
    const judgeMatch = text.match(/(?:Hon\.|Honorable|Judge|Justice)\s+([\w\s.]+)(?:,\s*(?:Judge|Justice|Magistrate))?/i);
    if (judgeMatch) {
      metadata.judge = judgeMatch[1].trim();
    }
    
    return metadata;
  }
}