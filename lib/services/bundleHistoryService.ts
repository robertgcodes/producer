import { collection, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Bundle } from '@/types';

export interface BundleHistory {
  title: string;
  description?: string;
  createdAt: Date;
  contentCount: number;
  tags?: string[];
}

export class BundleHistoryService {
  /**
   * Fetches the last N bundles for a user to analyze patterns
   */
  static async fetchRecentBundles(
    userId: string, 
    projectId?: string,
    maxBundles: number = 100
  ): Promise<BundleHistory[]> {
    try {
      let q = query(
        collection(db, 'bundles'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(maxBundles)
      );

      // If projectId is provided, filter by project
      if (projectId) {
        q = query(
          collection(db, 'bundles'),
          where('userId', '==', userId),
          where('projectId', '==', projectId),
          orderBy('createdAt', 'desc'),
          limit(maxBundles)
        );
      }

      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => {
        const data = doc.data() as Bundle;
        const createdAtField = data.createdAt as any;
        const createdAt = createdAtField?.toDate ? createdAtField.toDate() : new Date(createdAtField);
        return {
          title: data.title,
          description: data.description,
          createdAt,
          contentCount: data.contentItems?.length || 0,
          tags: data.tags
        };
      });
    } catch (error) {
      console.error('Error fetching bundle history:', error);
      return [];
    }
  }

  /**
   * Analyzes bundle history to extract patterns and preferences
   */
  static analyzeTitlePatterns(bundles: BundleHistory[]): {
    commonWords: string[];
    averageLength: number;
    capitalizedPercentage: number;
    emojiUsage: boolean;
    punctuationPatterns: string[];
  } {
    if (!bundles.length) {
      return {
        commonWords: [],
        averageLength: 0,
        capitalizedPercentage: 0,
        emojiUsage: false,
        punctuationPatterns: []
      };
    }

    const titles = bundles.map(b => b.title);
    const words: { [key: string]: number } = {};
    let totalLength = 0;
    let capitalizedCount = 0;
    let emojiCount = 0;
    const punctuation: { [key: string]: number } = {};

    titles.forEach(title => {
      totalLength += title.length;
      
      // Check if title is mostly capitalized
      const capitalLetters = (title.match(/[A-Z]/g) || []).length;
      if (capitalLetters / title.length > 0.5) {
        capitalizedCount++;
      }

      // Check for emojis
      if (/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]/u.test(title)) {
        emojiCount++;
      }

      // Extract words
      const titleWords = title.toLowerCase().match(/\b\w+\b/g) || [];
      titleWords.forEach(word => {
        if (word.length > 3) { // Ignore short words
          words[word] = (words[word] || 0) + 1;
        }
      });

      // Analyze punctuation
      const punctMarks = title.match(/[!?:|\-—]/g) || [];
      punctMarks.forEach(mark => {
        punctuation[mark] = (punctuation[mark] || 0) + 1;
      });
    });

    // Get most common words
    const commonWords = Object.entries(words)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word);

    // Get common punctuation patterns
    const punctuationPatterns = Object.entries(punctuation)
      .sort(([, a], [, b]) => b - a)
      .map(([mark]) => mark);

    return {
      commonWords,
      averageLength: Math.round(totalLength / titles.length),
      capitalizedPercentage: Math.round((capitalizedCount / titles.length) * 100),
      emojiUsage: emojiCount > titles.length * 0.2,
      punctuationPatterns
    };
  }

  /**
   * Formats bundle history for AI prompt
   */
  static formatForAIPrompt(bundles: BundleHistory[], maxExamples: number = 20): string {
    const examples = bundles.slice(0, maxExamples);
    const analysis = this.analyzeTitlePatterns(bundles);
    
    let prompt = `Here are ${examples.length} recent video titles from this channel:\n\n`;
    
    examples.forEach((bundle, index) => {
      prompt += `${index + 1}. "${bundle.title}"`;
      if (bundle.description) {
        prompt += ` - ${bundle.description.substring(0, 100)}...`;
      }
      prompt += '\n';
    });

    prompt += `\nTitle Pattern Analysis:\n`;
    prompt += `- Average title length: ${analysis.averageLength} characters\n`;
    prompt += `- ${analysis.capitalizedPercentage}% use heavy capitalization\n`;
    prompt += `- Common words: ${analysis.commonWords.join(', ')}\n`;
    prompt += `- Emoji usage: ${analysis.emojiUsage ? 'Yes' : 'No'}\n`;
    if (analysis.punctuationPatterns.length) {
      prompt += `- Common punctuation: ${analysis.punctuationPatterns.join(', ')}\n`;
    }

    return prompt;
  }
}