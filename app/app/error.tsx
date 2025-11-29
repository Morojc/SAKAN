'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, Home, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n/client';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();
  
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('App error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="rounded-full bg-red-100 p-4">
            <AlertCircle className="h-12 w-12 text-red-600" />
          </div>
        </div>
        
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">
            {t('error.title')}
          </h1>
          <p className="text-gray-600">
            {t('error.description')}
          </p>
          {error.digest && (
            <p className="text-xs text-gray-500 mt-2">
              Error ID: {error.digest}
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            onClick={reset}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            {t('error.tryAgain')}
          </Button>
          <Button
            variant="outline"
            asChild
            className="flex items-center gap-2"
          >
            <Link href="/app">
              <Home className="h-4 w-4" />
              {t('error.goToDashboard')}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

