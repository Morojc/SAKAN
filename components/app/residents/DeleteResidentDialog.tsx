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
import { deleteResident } from '@/app/app/residents/actions';
import toast from 'react-hot-toast';

interface DeleteResidentDialogProps {
  open: boolean;
  resident: { id: string; full_name: string; role?: string } | null;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * Delete Resident Dialog Component
 * Confirmation dialog for deleting residents
 */
export default function DeleteResidentDialog({
  open,
  resident,
  onClose,
  onSuccess,
}: DeleteResidentDialogProps) {
  console.log('[DeleteResidentDialog] Dialog', open ? 'opened' : 'closed', 'for resident:', resident?.id);

  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!resident) {
      toast.error('No resident selected');
      return;
    }

    console.log('[DeleteResidentDialog] Deleting resident:', resident.id);
    setDeleting(true);

    try {
      const result = await deleteResident(resident.id);

      if (result.success) {
        console.log('[DeleteResidentDialog] Resident deleted successfully:', resident.id);
        toast.success('Resident deleted successfully');
        onSuccess();
        onClose();
      } else {
        console.error('[DeleteResidentDialog] Error:', result.error);
        toast.error(result.error || 'Failed to delete resident');
      }
    } catch (error: any) {
      console.error('[DeleteResidentDialog] Error deleting resident:', error);
      toast.error(error.message || 'Failed to delete resident');
    } finally {
      setDeleting(false);
    }
  }

  if (!resident) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Delete Resident
          </DialogTitle>
          <DialogDescription>
            {resident.role === 'syndic' 
              ? 'This action cannot be undone. Deleting your syndic account will permanently remove all your data and access to the system.'
              : 'This action cannot be undone. This will permanently delete the resident and all associated data.'}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {resident.role === 'syndic' ? (
                <>
                  <strong>Warning:</strong> You are about to delete your own syndic account. This will permanently remove{' '}
                  <strong>{resident.full_name}</strong> and all associated records, fees, and payment history. 
                  You will lose access to the system.
                </>
              ) : (
                <>
                  Are you sure you want to delete <strong>{resident.full_name}</strong>? This will remove all their
                  records, fees, and payment history.
                </>
              )}
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={deleting}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete Resident'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

