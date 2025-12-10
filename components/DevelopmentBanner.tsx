'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export function DevelopmentBanner() {
  const [isMobile, setIsMobile] = useState(false);
  const [showDialog, setShowDialog] = useState(false);

  useEffect(() => {
    // Check if mobile on mount and resize
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640); // 640px is Tailwind's sm breakpoint
    };

    // Check on mount
    checkMobile();

    // Check on resize
    window.addEventListener('resize', checkMobile);

    // On mobile, check if dialog was already dismissed
    if (window.innerWidth < 640) {
      const dismissed = localStorage.getItem('dev-dialog-dismissed');
      if (!dismissed) {
        setShowDialog(true);
      }
    }

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleDialogClose = () => {
    setShowDialog(false);
    localStorage.setItem('dev-dialog-dismissed', 'true');
  };

  // Mobile: Show popup dialog
  if (isMobile) {
    return (
      <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <AlertDialogTitle>Site Under Development</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="pt-2">
              This website is currently under active development. Some features may not work correctly or may be unavailable. Please report any issues you encounter.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={handleDialogClose} className="w-full sm:w-auto bg-amber-500 dark:bg-amber-600 border-b border-amber-600 dark:border-amber-700 shadow-md">
              OK, Got it
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  // Desktop: Show banner
  return (
    <div className="fixed top-0 left-0 right-0 z-50 w-full">
      <div className="bg-amber-500 dark:bg-amber-600 border-b border-amber-600 dark:border-amber-700 shadow-md">
        <div className="flex items-center justify-center px-4 py-2 text-sm font-medium text-amber-900 dark:text-amber-50 text-center">
          <AlertTriangle className="h-4 w-4 mr-2 flex-shrink-0" />
          <span>
            ⚠️ Site Under Development - Some features may not work correctly
          </span>
        </div>
      </div>
    </div>
  );
}

