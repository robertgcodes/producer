'use client';

import { useState, useEffect } from 'react';
import { Bundle, ContentItem } from '@/types';
import { ImageSearchService, ImageResult } from '@/lib/services/imageSearchService';
import { EntityExtractionService, ExtractedEntity } from '@/lib/services/entityExtractionService';
import { toast } from 'sonner';

interface ImagesTabProps {
  bundle: Bundle;
  stories: ContentItem[];
}

export function ImagesTab({ bundle, stories }: ImagesTabProps) {
  const [extractedImages, setExtractedImages] = useState<Map<string, ImageResult[]>>(new Map());
  const [extractedEntities, setExtractedEntities] = useState<ExtractedEntity[]>([]);
  const [entityImages, setEntityImages] = useState<Map<string, ImageResult[]>>(new Map());
  const [isLoading, setIsLoading] = useState<Map<string, boolean>>(new Map());
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Extract entities from stories on mount
  useEffect(() => {
    if (stories.length > 0) {
      const entities = EntityExtractionService.extractEntitiesFromStories(stories);
      setExtractedEntities(entities);
    }
  }, [stories]);

  // Extract images from story content
  const extractImagesFromStory = async (story: ContentItem) => {
    setIsLoading(prev => new Map(prev).set(story.id, true));
    
    try {
      // For now, we'll simulate image extraction
      // In a real implementation, this would parse the story content
      const mockImages: ImageResult[] = [
        {
          url: story.thumbnail || `https://via.placeholder.com/800x600?text=${encodeURIComponent(story.title)}`,
          thumbnailUrl: story.thumbnail || `https://via.placeholder.com/200x150?text=${encodeURIComponent(story.title)}`,
          title: `${story.title} - Main Image`,
          source: story.sourceInfo.name,
          width: 800,
          height: 600
        }
      ];
      
      setExtractedImages(prev => new Map(prev).set(story.id, mockImages));
      toast.success(`Found ${mockImages.length} images in story`);
    } catch (error) {
      console.error('Error extracting images:', error);
      toast.error('Failed to extract images');
    } finally {
      setIsLoading(prev => {
        const next = new Map(prev);
        next.delete(story.id);
        return next;
      });
    }
  };

  // Search images for entity
  const searchImagesForEntity = async (entity: ExtractedEntity) => {
    setIsLoading(prev => new Map(prev).set(entity.id, true));
    
    try {
      const images = await ImageSearchService.searchImages(entity.name, {
        imageType: entity.type === 'person' ? 'Person' : undefined,
        count: 20
      });
      setEntityImages(prev => new Map(prev).set(entity.id, images));
      toast.success(`Found ${images.length} images for ${entity.name}`);
    } catch (error) {
      console.error('Error searching images:', error);
      toast.error('Failed to search images');
    } finally {
      setIsLoading(prev => {
        const next = new Map(prev);
        next.delete(entity.id);
        return next;
      });
    }
  };

  // Toggle image selection
  const toggleImageSelection = (imageUrl: string) => {
    setSelectedImages(prev => {
      const next = new Set(prev);
      if (next.has(imageUrl)) {
        next.delete(imageUrl);
      } else {
        next.add(imageUrl);
      }
      return next;
    });
  };

  // Download selected images
  const downloadSelectedImages = async () => {
    if (selectedImages.size === 0) {
      toast.error('No images selected');
      return;
    }

    for (const imageUrl of selectedImages) {
      try {
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = imageUrl.split('/').pop() || 'image.jpg';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } catch (error) {
        console.error('Error downloading image:', error);
      }
    }
    
    toast.success(`Downloaded ${selectedImages.size} images`);
    setSelectedImages(new Set());
  };

  // Get all images for display
  const getAllImages = () => {
    const allImages: { source: string; images: ImageResult[] }[] = [];
    
    // Story images
    extractedImages.forEach((images, storyId) => {
      const story = stories.find(s => s.id === storyId);
      if (story) {
        allImages.push({
          source: story.title,
          images
        });
      }
    });
    
    // Entity images
    entityImages.forEach((images, entityId) => {
      const entity = extractedEntities.find(e => e.id === entityId);
      if (entity) {
        allImages.push({
          source: entity.name,
          images
        });
      }
    });
    
    return allImages;
  };

  return (
    <div className="h-full overflow-y-auto bg-gray-50 dark:bg-gray-950">
      <div className="max-w-7xl mx-auto p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Images</h1>
            <div className="flex items-center gap-4">
              {selectedImages.size > 0 && (
                <button
                  onClick={downloadSelectedImages}
                  className="btn-primary flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download Selected ({selectedImages.size})
                </button>
              )}
              
              <div className="flex items-center gap-2 bg-white dark:bg-gray-900 rounded-lg p-1 shadow-sm">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded ${viewMode === 'grid' ? 'bg-gray-100 dark:bg-gray-800' : ''}`}
                  title="Grid view"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded ${viewMode === 'list' ? 'bg-gray-100 dark:bg-gray-800' : ''}`}
                  title="List view"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Story Images Section */}
        <div className="mb-12">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Images from Stories</h2>
          
          {stories.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">No stories in bundle yet</p>
          ) : (
            <div className="space-y-4">
              {stories.map(story => (
                <div key={story.id} className="bg-white dark:bg-gray-900 rounded-xl p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 dark:text-white truncate">{story.title}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{story.sourceInfo.name}</p>
                    </div>
                    <button
                      onClick={() => extractImagesFromStory(story)}
                      disabled={isLoading.get(story.id)}
                      className="btn-secondary text-sm flex items-center gap-2"
                    >
                      {isLoading.get(story.id) ? (
                        <>
                          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Extracting...
                        </>
                      ) : (
                        'Extract Images'
                      )}
                    </button>
                  </div>
                  
                  {extractedImages.has(story.id) && (
                    <div className={viewMode === 'grid' ? 'grid grid-cols-3 gap-4' : 'space-y-4'}>
                      {extractedImages.get(story.id)!.map((image, idx) => (
                        <div key={idx} className="relative group">
                          <img
                            src={image.thumbnailUrl || image.url}
                            alt={image.title}
                            className="w-full h-48 object-cover rounded-lg cursor-pointer"
                            onClick={() => toggleImageSelection(image.url)}
                          />
                          <div className={`absolute inset-0 rounded-lg transition-opacity ${
                            selectedImages.has(image.url) 
                              ? 'bg-brand-600 bg-opacity-30' 
                              : 'bg-black bg-opacity-0 group-hover:bg-opacity-20'
                          }`}>
                            <input
                              type="checkbox"
                              checked={selectedImages.has(image.url)}
                              onChange={() => toggleImageSelection(image.url)}
                              className="absolute top-2 left-2 w-5 h-5"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Entity Images Section */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Search Images by Entity</h2>
          
          {extractedEntities.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">No entities extracted from stories yet</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {extractedEntities.slice(0, 9).map(entity => (
                <div key={entity.id} className="bg-white dark:bg-gray-900 rounded-xl p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        entity.type === 'person' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' :
                        entity.type === 'organization' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                        entity.type === 'location' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' :
                        'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                      }`}>
                        {entity.type}
                      </span>
                      <h4 className="font-medium text-gray-900 dark:text-white text-sm">{entity.name}</h4>
                    </div>
                    <button
                      onClick={() => searchImagesForEntity(entity)}
                      disabled={isLoading.get(entity.id)}
                      className="p-1.5 text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
                      title="Search images"
                    >
                      {isLoading.get(entity.id) ? (
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      )}
                    </button>
                  </div>
                  
                  {entityImages.has(entity.id) && (
                    <div className="grid grid-cols-2 gap-2">
                      {entityImages.get(entity.id)!.slice(0, 4).map((image, idx) => (
                        <div key={idx} className="relative group">
                          <img
                            src={image.thumbnailUrl || image.url}
                            alt={image.title}
                            className="w-full h-24 object-cover rounded cursor-pointer"
                            onClick={() => toggleImageSelection(image.url)}
                          />
                          <div className={`absolute inset-0 rounded transition-opacity ${
                            selectedImages.has(image.url) 
                              ? 'bg-brand-600 bg-opacity-30' 
                              : 'bg-black bg-opacity-0 group-hover:bg-opacity-20'
                          }`}>
                            <input
                              type="checkbox"
                              checked={selectedImages.has(image.url)}
                              onChange={() => toggleImageSelection(image.url)}
                              className="absolute top-1 left-1 w-4 h-4"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}