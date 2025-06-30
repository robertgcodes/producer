import { useEffect, useRef } from 'react';
import { FeedRefreshService } from '@/lib/services/feedRefreshService';

export function useAutoRefreshFeeds(enabled: boolean = true, intervalMinutes: number = 30) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!enabled) return;

    // Initial refresh when component mounts (excluding Twitter feeds)
    FeedRefreshService.refreshNonTwitterFeeds().catch(error => {
      console.error('Failed to auto-refresh feeds:', error);
    });

    // Set up interval for periodic refreshing (excluding Twitter feeds)
    intervalRef.current = setInterval(() => {
      FeedRefreshService.refreshNonTwitterFeeds().catch(error => {
        console.error('Failed to auto-refresh feeds:', error);
      });
    }, intervalMinutes * 60 * 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, intervalMinutes]);
}