'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useI18n } from '@/lib/i18n/client';

interface Fee {
  id: number;
  user_id: string;
  residence_id: number;
  title: string;
  description?: string;
  amount: number;
  due_date: string;
  status: 'unpaid' | 'paid' | 'overdue' | 'cancelled';
  fee_type?: string;
  reason?: string;
  apartment_number?: string;
  profiles?: {
    full_name: string;
  };
}

interface EditFeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  fee: Fee | null;
}

export default function EditFeeDialog({
  open,
  onOpenChange,
  onSuccess,
  fee,
}: EditFeeDialogProps) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [title, setTitle] = useState('');
  const [reason, setReason] = useState('');

  // Initialize form when fee changes
  useEffect(() => {
    if (fee && open) {
      setTitle(fee.title || '');
      setReason(fee.reason || '');
    }
  }, [fee, open]);

  const handleSubmit = async () => {
    if (!fee) {
      toast.error('Fee data is missing');
      return;
    }

    // Validation
    if (!title.trim()) {
      toast.error('Please enter a fee title');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`/api/fees/${fee.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          reason: reason.trim() || null,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Fee updated successfully!');
        // Reset form
        setTitle('');
        setReason('');
        onSuccess();
        onOpenChange(false);
      } else {
        toast.error(result.error || 'Failed to update fee');
      }
    } catch (error: any) {
      console.error('[EditFeeDialog] Error updating fee:', error);
      toast.error(error?.message || 'Failed to update fee. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!fee) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Fee</DialogTitle>
          <DialogDescription>
            Update fee title or reason for {fee.profiles?.full_name || 'resident'} - Apt. {fee.apartment_number || 'N/A'}
            <br />
            <span className="text-xs text-muted-foreground mt-1 block">
              Note: Only title and reason can be updated. Other fields are locked to maintain financial integrity.
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Title */}
          <div className="grid gap-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Parking violation fine"
              required
            />
          </div>

          {/* Reason */}
          <div className="grid gap-2">
            <Label htmlFor="reason">Reason</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Optional reason for the fee"
              rows={3}
            />
          </div>

          {/* Read-only fields display */}
          <div className="border-t pt-4 space-y-3">
            <p className="text-sm font-medium text-muted-foreground mb-2">Read-only Information</p>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <Label className="text-muted-foreground">Amount</Label>
                <p className="font-medium">{fee.amount} MAD</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Due Date</Label>
                <p className="font-medium">{fee.due_date ? new Date(fee.due_date).toLocaleDateString() : 'N/A'}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Status</Label>
                <p className="font-medium capitalize">{fee.status || 'N/A'}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Fee Type</Label>
                <p className="font-medium capitalize">{fee.fee_type || 'N/A'}</p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={submitting || loading}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Updating...
              </>
            ) : (
              'Update Fee'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

