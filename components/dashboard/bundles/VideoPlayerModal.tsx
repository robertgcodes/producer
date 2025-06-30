'use client';

import { useState } from 'react';
import { BundleVideo } from '@/types/video';

interface VideoPlayerModalProps {
  video: BundleVideo;
  isOpen: boolean;
  onClose: () => void;
}

export function VideoPlayerModal({ video, isOpen, onClose }: VideoPlayerModalProps) {
  const [isPlaying, setIsPlaying] = useState(true);

  if (!isOpen) return null;

  const renderVideoPlayer = () => {
    if (video.type === 'youtube' && video.youtubeId) {
      return (
        <div className="relative pt-[56.25%]">
          <iframe
            className="absolute inset-0 w-full h-full"
            src={`https://www.youtube.com/embed/${video.youtubeId}?autoplay=${isPlaying ? '1' : '0'}`}
            title={video.title}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      );
    }

    return (
      <video
        className="w-full max-h-[70vh]"
        controls
        autoPlay={isPlaying}
        src={video.url}
      >
        Your browser does not support the video tag.
      </video>
    );
  };

  return (
    <div 
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-gray-900 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {video.title}
            </h2>
            {video.description && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {video.description}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Video Player */}
        <div className="bg-black">
          {renderVideoPlayer()}
        </div>

        {/* Footer with metadata */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
            <div>
              Uploaded {new Date(video.uploadedAt).toLocaleDateString()}
            </div>
            {video.metadata?.size && (
              <div>
                {(video.metadata.size / (1024 * 1024)).toFixed(2)} MB
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}