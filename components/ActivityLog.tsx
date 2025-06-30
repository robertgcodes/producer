'use client';

import { useEffect, useRef, useState } from 'react';
import { useActivityLog } from '@/contexts/ActivityLogContext';
import { ActivityMessage } from '@/lib/services/activityLogService';

export function ActivityLog() {
  const { messages, clearMessages } = useActivityLog();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [isExpanded, setIsExpanded] = useState(true);
  
  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (autoScroll && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [messages, autoScroll]);
  
  // Check if user is scrolling
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 10;
    
    setAutoScroll(isAtBottom);
  };
  
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };
  
  const getMessageIcon = (type: ActivityMessage['type']) => {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✗';
      case 'warning':
        return '⚠';
      case 'progress':
        return '◐';
      default:
        return '›';
    }
  };
  
  const getMessageColor = (type: ActivityMessage['type']) => {
    switch (type) {
      case 'success':
        return 'text-green-600 dark:text-green-400';
      case 'error':
        return 'text-red-600 dark:text-red-400';
      case 'warning':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'progress':
        return 'text-blue-600 dark:text-blue-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };
  
  if (!isExpanded) {
    return (
      <div className="fixed bottom-4 right-4 z-50" style={{ width: '320px' }}>
        <button
          onClick={() => setIsExpanded(true)}
          className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex items-center justify-between shadow-lg"
        >
          <span>Activity Log</span>
          <span className="text-xs">({messages.length} messages)</span>
        </button>
      </div>
    );
  }
  
  return (
    <div className="fixed bottom-4 right-4 z-50 bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden" style={{ width: '320px', height: '200px' }}>
      {/* Header */}
      <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h3 className="text-xs font-medium text-gray-700 dark:text-gray-300">Activity Log</h3>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={clearMessages}
              className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              title="Clear messages"
            >
              Clear
            </button>
          )}
          <button
            onClick={() => setIsExpanded(false)}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            title="Minimize"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>
      
      {/* Messages */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="overflow-y-auto p-2 space-y-1"
        style={{ height: 'calc(100% - 36px)' }}
      >
        {messages.length === 0 ? (
          <div className="text-xs text-gray-400 dark:text-gray-500 italic p-2">
            No activity yet...
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className="flex items-start gap-2 text-xs font-mono"
            >
              <span className="text-gray-400 dark:text-gray-500 flex-shrink-0">
                {formatTime(message.timestamp)}
              </span>
              <span className={`flex-shrink-0 ${getMessageColor(message.type)}`}>
                {getMessageIcon(message.type)}
              </span>
              <span className="text-gray-700 dark:text-gray-300 break-words flex-1">
                {message.message}
                {message.metadata?.progress && (
                  <span className="text-gray-500 dark:text-gray-400 ml-1">
                    ({message.metadata.progress.current}/{message.metadata.progress.total})
                  </span>
                )}
              </span>
            </div>
          ))
        )}
      </div>
      
      {/* Auto-scroll indicator */}
      {!autoScroll && messages.length > 0 && (
        <div className="absolute bottom-2 right-2">
          <button
            onClick={() => {
              setAutoScroll(true);
              if (scrollContainerRef.current) {
                scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
              }
            }}
            className="bg-gray-800 dark:bg-gray-700 text-white px-2 py-1 rounded text-xs shadow-md hover:bg-gray-700 dark:hover:bg-gray-600"
          >
            ↓ New messages
          </button>
        </div>
      )}
    </div>
  );
}