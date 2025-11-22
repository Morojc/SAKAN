'use client';

import { LayoutGrid, Table2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type ViewMode = 'grid' | 'table';

interface ResidentsViewToggleProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

/**
 * View Toggle Component
 * Allows switching between grid and table views
 */
export default function ResidentsViewToggle({
  viewMode,
  onViewModeChange,
}: ResidentsViewToggleProps) {
  return (
    <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
      <Button
        variant={viewMode === 'grid' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onViewModeChange('grid')}
        className={cn(
          'h-8 px-3',
          viewMode === 'grid' && 'bg-background shadow-sm'
        )}
        aria-label="Grid view"
      >
        <LayoutGrid className="h-4 w-4" />
      </Button>
      <Button
        variant={viewMode === 'table' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onViewModeChange('table')}
        className={cn(
          'h-8 px-3',
          viewMode === 'table' && 'bg-background shadow-sm'
        )}
        aria-label="Table view"
      >
        <Table2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

