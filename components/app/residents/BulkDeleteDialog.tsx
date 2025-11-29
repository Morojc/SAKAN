'use client';

import { useState } from 'react';
import { Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { bulkDeleteResidents } from '@/app/app/residents/actions';
import toast from 'react-hot-toast';

interface BulkDeleteDialogProps {
  open: boolean;
  residentIds: string[];
  residentNames: string[];
  onClose: () => void;
  onSuccess: (deletedIds: string[]) => void;
}

/**
 * Bulk Delete Residents Dialog Component
 * Confirmation dialog for deleting multiple residents at once
 */
export default function BulkDeleteDialog({
  open,
  residentIds,
  residentNames,
  onClose,
  onSuccess,
}: BulkDeleteDialogProps) {
  console.log('[BulkDeleteDialog] Dialog', open ? 'opened' : 'closed', 'for', residentIds.length, 'residents');

  const [deleting, setDeleting] = useState(false);

  async function handleBulkDelete() {
    if (!residentIds || residentIds.length === 0) {
      toast.error('No residents selected');
      return;
    }

    console.log('[BulkDeleteDialog] Deleting residents:', residentIds);
    setDeleting(true);

    try {
      const result = await bulkDeleteResidents(residentIds);

      if (result.success) {
        console.log('[BulkDeleteDialog] Residents deleted successfully');
        toast.success(result.message || `Successfully deleted ${residentIds.length} resident(s)`);
        
        // Return the successfully deleted IDs
        const deletedIds = result.results?.success || residentIds;
        onSuccess(deletedIds);
        onClose();
      } else {
        console.error('[BulkDeleteDialog] Error:', result.error);
        
        // Show partial success message if some were deleted
        if (result.results && result.results.success.length > 0) {
          toast.error(
            `Partially completed: ${result.results.success.length} deleted, ${result.results.failed.length} failed`
          );
          onSuccess(result.results.success);
          onClose();
        } else {
          toast.error(result.error || 'Failed to delete residents');
        }
      }
    } catch (error: any) {
      console.error('[BulkDeleteDialog] Error deleting residents:', error);
      toast.error(error.message || 'Failed to delete residents');
    } finally {
      setDeleting(false);
    }
  }

  if (residentIds.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Delete {residentIds.length} Resident{residentIds.length > 1 ? 's' : ''}
          </DialogTitle>
          <DialogDescription>
            This action cannot be undone. This will permanently delete the selected residents and all associated data.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Warning:</strong> You are about to delete {residentIds.length} resident{residentIds.length > 1 ? 's' : ''}. 
              This will permanently remove all their records, fees, and payment history.
            </AlertDescription>
          </Alert>

          {residentNames.length > 0 && (
            <div className="max-h-48 overflow-y-auto border rounded-lg p-3 bg-muted/50">
              <p className="text-sm font-medium mb-2">Selected residents:</p>
              <ul className="space-y-1">
                {residentNames.slice(0, 10).map((name, index) => (
                  <li key={index} className="text-sm text-muted-foreground">
                    • {name}
                  </li>
                ))}
                {residentNames.length > 10 && (
                  <li className="text-sm text-muted-foreground italic">
                    ... and {residentNames.length - 10} more
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={deleting}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={handleBulkDelete} disabled={deleting}>
            {deleting ? 'Deleting...' : `Delete ${residentIds.length} Resident${residentIds.length > 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

