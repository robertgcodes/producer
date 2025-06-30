'use client';

import { useState, useEffect } from 'react';
import { Bundle, ContentItem } from '@/types';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { generateSocialContent } from '@/lib/services/socialContentGenerator';
import { toast } from 'sonner';

interface InspirationViewProps {
  bundles: Bundle[];
  bundleStories: Record<string, ContentItem[]>;
}

interface SocialContent {
  platform: 'youtube' | 'x' | 'instagram' | 'substack' | 'blog';
  title?: string;
  content: string;
  hashtags?: string[];
  imagePrompt?: string;
}

export function InspirationView({ bundles, bundleStories }: InspirationViewProps) {
  const [selectedBundle, setSelectedBundle] = useState<string | null>(null);
  const [generatedContent, setGeneratedContent] = useState<SocialContent[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [contentTone, setContentTone] = useState<'professional' | 'casual' | 'humorous'>('professional');
  const [targetAudience, setTargetAudience] = useState<'general' | 'tech' | 'business' | 'youth'>('general');

  const handleGenerateContent = async () => {
    if (!selectedBundle) {
      toast.error('Please select a bundle first');
      return;
    }

    setIsGenerating(true);
    try {
      const bundle = bundles.find(b => b.id === selectedBundle);
      const stories = bundleStories[selectedBundle] || [];
      
      if (!bundle || stories.length === 0) {
        toast.error('No stories found in the selected bundle');
        return;
      }

      // For now, generate sample content
      // In a real implementation, this would call an AI service
      const sampleContent: SocialContent[] = [
        {
          platform: 'youtube',
          title: `${bundle.title}: Everything You Need to Know`,
          content: `Breaking down the latest developments in ${bundle.title}. In this video, we cover ${stories.length} key stories that are shaping this narrative...`,
          hashtags: ['news', 'trending', bundle.title.replace(/\s+/g, '').toLowerCase()],
        },
        {
          platform: 'x',
          content: `🚨 THREAD: ${bundle.title}\n\n1/ ${stories[0]?.title || 'Major development'}\n\n2/ Here's what we know so far...\n\n3/ Why this matters...`,
          hashtags: ['BreakingNews', 'Thread'],
        },
        {
          platform: 'instagram',
          content: `Swipe to learn about ${bundle.title} 👉\n\nSlide 1: The headline\nSlide 2: Key facts\nSlide 3: What experts say\nSlide 4: What's next\n\nFollow for more news updates!`,
          hashtags: ['news', 'currentevents', 'infographic'],
          imagePrompt: `Modern, clean infographic design showing ${bundle.title} with bold typography and data visualization`,
        },
        {
          platform: 'substack',
          title: `Deep Dive: ${bundle.title}`,
          content: `Today we're examining the implications of ${bundle.title}. This story has been developing over the past few days, and there are several angles worth exploring...\n\nKey Points:\n• ${stories[0]?.title}\n• Impact on the industry\n• What comes next`,
        },
        {
          platform: 'blog',
          title: `Analysis: ${bundle.title} - A Comprehensive Overview`,
          content: `## Introduction\n\n${bundle.title} has captured attention across media outlets. In this analysis, we'll break down the key components and examine the broader implications.\n\n## Background\n\n[Context and history]\n\n## Current Developments\n\n[Latest updates from sources]\n\n## Expert Opinion\n\n[Analysis and commentary]\n\n## Conclusion\n\n[Summary and outlook]`,
        },
      ];

      setGeneratedContent(sampleContent);
      toast.success('Content generated successfully!');
    } catch (error) {
      console.error('Error generating content:', error);
      toast.error('Failed to generate content');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success('Copied to clipboard!');
  };

  const platformIcons = {
    youtube: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
      </svg>
    ),
    x: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    ),
    instagram: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zM5.838 12a6.162 6.162 0 1112.324 0 6.162 6.162 0 01-12.324 0zM12 16a4 4 0 110-8 4 4 0 010 8zm4.965-10.405a1.44 1.44 0 112.881.001 1.44 1.44 0 01-2.881-.001z"/>
      </svg>
    ),
    substack: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M22.539 8.242H1.46V5.406h21.08v2.836zM1.46 10.812V24L12 18.11 22.54 24V10.812H1.46zM22.54 0H1.46v2.836h21.08V0z"/>
      </svg>
    ),
    blog: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
      </svg>
    ),
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Inspiration Hub</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Generate social media content based on your news bundles</p>
      </div>

      {/* Content Settings */}
      <div className="bg-white dark:bg-gray-900 rounded-xl p-6 mb-8">
        <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Content Settings</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Bundle Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select Bundle
            </label>
            <select
              value={selectedBundle || ''}
              onChange={(e) => setSelectedBundle(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white"
            >
              <option value="">Choose a bundle...</option>
              {bundles.map((bundle) => (
                <option key={bundle.id} value={bundle.id}>
                  {bundle.title} ({bundleStories[bundle.id]?.length || 0} stories)
                </option>
              ))}
            </select>
          </div>

          {/* Tone Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Content Tone
            </label>
            <select
              value={contentTone}
              onChange={(e) => setContentTone(e.target.value as any)}
              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white"
            >
              <option value="professional">Professional</option>
              <option value="casual">Casual</option>
              <option value="humorous">Humorous</option>
            </select>
          </div>

          {/* Audience Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Target Audience
            </label>
            <select
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value as any)}
              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white"
            >
              <option value="general">General</option>
              <option value="tech">Tech Savvy</option>
              <option value="business">Business</option>
              <option value="youth">Youth</option>
            </select>
          </div>
        </div>

        <button
          onClick={handleGenerateContent}
          disabled={!selectedBundle || isGenerating}
          className="mt-6 btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGenerating ? (
            <>
              <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Generating...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Generate Content
            </>
          )}
        </button>
      </div>

      {/* Generated Content */}
      {generatedContent.length > 0 && (
        <div className="space-y-6">
          {generatedContent.map((content, index) => (
            <div key={index} className="bg-white dark:bg-gray-900 rounded-xl p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    content.platform === 'youtube' ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' :
                    content.platform === 'x' ? 'bg-black dark:bg-white text-white dark:text-black' :
                    content.platform === 'instagram' ? 'bg-gradient-to-br from-purple-600 to-pink-600 text-white' :
                    content.platform === 'substack' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400' :
                    'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                  }`}>
                    {platformIcons[content.platform]}
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white capitalize">{content.platform}</h3>
                    {content.title && (
                      <p className="text-sm text-gray-500 dark:text-gray-400">{content.title}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => copyToClipboard(content.title ? `${content.title}\n\n${content.content}` : content.content)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                  title="Copy to clipboard"
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-4">
                <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-sans">
                  {content.content}
                </pre>
              </div>

              {content.hashtags && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {content.hashtags.map((tag, idx) => (
                    <span key={idx} className="text-sm text-blue-600 dark:text-blue-400">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {content.imagePrompt && (
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3">
                  <p className="text-sm text-purple-700 dark:text-purple-300">
                    <span className="font-medium">Image Prompt:</span> {content.imagePrompt}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {generatedContent.length === 0 && !isGenerating && (
        <div className="bg-white dark:bg-gray-900 rounded-xl p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No content generated yet</h3>
          <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
            Select a bundle and click "Generate Content" to create social media posts, video titles, and more
          </p>
        </div>
      )}
    </div>
  );
}