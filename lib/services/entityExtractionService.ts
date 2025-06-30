import { ContentItem } from '@/types';

export interface ExtractedEntity {
  id: string;
  name: string;
  type: 'person' | 'place' | 'organization';
  count: number;
}

export class EntityExtractionService {
  // Common patterns for identifying entities
  private static readonly patterns = {
    person: [
      /(?:Mr\.|Mrs\.|Ms\.|Dr\.|Prof\.|Judge|Justice|President|Senator|Rep\.|Representative|Governor|Mayor|Secretary|Director|CEO|Chairman|Officer)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g,
      /[A-Z][a-z]+\s+(?:[A-Z]\.?\s+)?[A-Z][a-z]+/g, // Basic name pattern
    ],
    organization: [
      /(?:Supreme Court|Congress|Senate|House of Representatives|Department of [A-Z][a-z]+|FBI|CIA|NSA|EPA|FDA|CDC|WHO|UN|United Nations|NATO)/g,
      /[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Inc\.|LLC|Corp\.|Corporation|Company|Group|Foundation|Institute|University|College|School|Hospital|Bank|Agency)/g,
    ],
    place: [
      /(?:United States|America|USA|U\.S\.|Washington D\.C\.|New York|California|Texas|Florida|Illinois|Pennsylvania|Ohio|Georgia|North Carolina|Michigan)/g,
      /[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,\s*[A-Z]{2}/g, // City, State pattern
    ]
  };

  // Common words to exclude from entity detection
  private static readonly excludeWords = new Set([
    'The', 'This', 'That', 'These', 'Those', 'What', 'When', 'Where', 'Why', 'How',
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
    'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'
  ]);

  static extractEntitiesFromStories(stories: ContentItem[]): ExtractedEntity[] {
    const entityMap = new Map<string, ExtractedEntity>();

    stories.forEach(story => {
      const text = `${story.title} ${story.description || ''}`;
      
      // Extract persons
      this.patterns.person.forEach(pattern => {
        const matches = text.match(pattern) || [];
        matches.forEach(match => {
          const cleaned = this.cleanEntityName(match);
          if (cleaned && !this.excludeWords.has(cleaned)) {
            const key = `person-${cleaned.toLowerCase()}`;
            if (entityMap.has(key)) {
              entityMap.get(key)!.count++;
            } else {
              entityMap.set(key, {
                id: key,
                name: cleaned,
                type: 'person',
                count: 1
              });
            }
          }
        });
      });

      // Extract organizations
      this.patterns.organization.forEach(pattern => {
        const matches = text.match(pattern) || [];
        matches.forEach(match => {
          const cleaned = this.cleanEntityName(match);
          if (cleaned) {
            const key = `organization-${cleaned.toLowerCase()}`;
            if (entityMap.has(key)) {
              entityMap.get(key)!.count++;
            } else {
              entityMap.set(key, {
                id: key,
                name: cleaned,
                type: 'organization',
                count: 1
              });
            }
          }
        });
      });

      // Extract places
      this.patterns.place.forEach(pattern => {
        const matches = text.match(pattern) || [];
        matches.forEach(match => {
          const cleaned = this.cleanEntityName(match);
          if (cleaned) {
            const key = `place-${cleaned.toLowerCase()}`;
            if (entityMap.has(key)) {
              entityMap.get(key)!.count++;
            } else {
              entityMap.set(key, {
                id: key,
                name: cleaned,
                type: 'place',
                count: 1
              });
            }
          }
        });
      });
    });

    // Sort by count and return
    return Array.from(entityMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 20); // Limit to top 20 entities
  }

  private static cleanEntityName(name: string): string {
    // Remove extra whitespace and trim
    let cleaned = name.replace(/\s+/g, ' ').trim();
    
    // Remove trailing punctuation
    cleaned = cleaned.replace(/[,\.\;:\!]$/, '');
    
    // Check if it's a valid entity (at least 2 characters, not all uppercase)
    if (cleaned.length < 2 || cleaned === cleaned.toUpperCase()) {
      return '';
    }
    
    return cleaned;
  }

  // Enhanced extraction using AI (requires API call)
  static async extractEntitiesWithAI(stories: ContentItem[]): Promise<ExtractedEntity[]> {
    try {
      const response = await fetch('/api/extract-entities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          stories: stories.map(s => ({
            title: s.title,
            description: s.description
          }))
        })
      });

      if (!response.ok) {
        throw new Error('Failed to extract entities');
      }

      const data = await response.json();
      return data.entities;
    } catch (error) {
      console.error('AI entity extraction failed, falling back to pattern matching:', error);
      return this.extractEntitiesFromStories(stories);
    }
  }
}