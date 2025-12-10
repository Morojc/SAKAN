'use client';

import { AlertTriangle } from 'lucide-react';

export function DevelopmentBanner() {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 w-full">
      <div className="bg-amber-500 dark:bg-amber-600 border-b border-amber-600 dark:border-amber-700 shadow-md">
        <div className="flex items-center justify-center px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium text-amber-900 dark:text-amber-50 text-center">
          <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 flex-shrink-0" />
          <span className="whitespace-normal break-words">
            ⚠️ Site Under Development - Some features may not work correctly
          </span>
        </div>
      </div>
    </div>
  );
}

