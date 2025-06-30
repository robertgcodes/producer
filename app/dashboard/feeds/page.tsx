'use client';

import { RSSFeedsView } from '@/components/dashboard/RSSFeedsView';

export default function FeedsPage() {
  return (
    <main className="h-[calc(100vh-4rem)] bg-gray-50 dark:bg-gray-950 overflow-y-auto">
      <div className="max-w-7xl mx-auto p-8">
        <RSSFeedsView />
      </div>
    </main>
  );
}