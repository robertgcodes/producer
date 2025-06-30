'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { activityLog, ActivityMessage } from '@/lib/services/activityLogService';

interface ActivityLogContextType {
  messages: ActivityMessage[];
  clearMessages: () => void;
}

const ActivityLogContext = createContext<ActivityLogContextType | undefined>(undefined);

export function ActivityLogProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ActivityMessage[]>(activityLog.getMessages());
  
  useEffect(() => {
    // Subscribe to new messages
    const handleMessage = (message: ActivityMessage) => {
      setMessages(prevMessages => [...prevMessages, message].slice(-500)); // Keep last 500
    };
    
    const handleClear = () => {
      setMessages([]);
    };
    
    activityLog.on('message', handleMessage);
    activityLog.on('clear', handleClear);
    
    return () => {
      activityLog.off('message', handleMessage);
      activityLog.off('clear', handleClear);
    };
  }, []);
  
  const clearMessages = () => {
    activityLog.clear();
  };
  
  return (
    <ActivityLogContext.Provider value={{ messages, clearMessages }}>
      {children}
    </ActivityLogContext.Provider>
  );
}

export function useActivityLog() {
  const context = useContext(ActivityLogContext);
  if (context === undefined) {
    throw new Error('useActivityLog must be used within an ActivityLogProvider');
  }
  return context;
}