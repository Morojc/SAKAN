'use client';

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
import { Incident } from './IncidentsContent';

interface DeleteIncidentDialogProps {
  open: boolean;
  incident: Incident | null;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * Delete Incident Dialog Component
 * Confirmation dialog for deleting incidents
 */
export default function DeleteIncidentDialog({
  open,
  incident,
  onClose,
  onConfirm,
}: DeleteIncidentDialogProps) {
  console.log('[DeleteIncidentDialog] Dialog', open ? 'opened' : 'closed', 'for incident:', incident?.id);

  if (!incident) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Delete Incident
          </DialogTitle>
          <DialogDescription>
            This action cannot be undone. This will permanently delete the incident record.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Are you sure you want to delete this incident?
              <div className="mt-2 space-y-1">
                <p className="font-semibold">{incident.title}</p>
                <p className="text-sm">
                  #{incident.id} • {incident.status}
                </p>
              </div>
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm}>
            Delete Incident
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

