'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState<'paid' | 'unpaid' | 'overdue' | 'cancelled'>('unpaid');
  const [feeType, setFeeType] = useState('one_time');
  const [reason, setReason] = useState('');

  // Initialize form when fee changes
  useEffect(() => {
    if (fee && open) {
      setTitle(fee.title || '');
      setDescription(fee.description || '');
      setAmount(fee.amount?.toString() || '');
      setDueDate(fee.due_date ? fee.due_date.split('T')[0] : '');
      setStatus(fee.status || 'unpaid');
      setFeeType(fee.fee_type || 'one_time');
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
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    if (!dueDate) {
      toast.error('Please select a due date');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`/api/fees/${fee.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          amount: parseFloat(amount),
          due_date: dueDate,
          status,
          fee_type: feeType,
          reason: reason.trim() || null,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Fee updated successfully!');
        // Reset form
        setTitle('');
        setDescription('');
        setAmount('');
        setDueDate('');
        setStatus('unpaid');
        setFeeType('one_time');
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
            Update fee details for {fee.profiles?.full_name || 'resident'} - Apt. {fee.apartment_number || 'N/A'}
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

          {/* Description */}
          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={3}
            />
          </div>

          {/* Amount */}
          <div className="grid gap-2">
            <Label htmlFor="amount">Amount (MAD) *</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              required
            />
          </div>

          {/* Due Date */}
          <div className="grid gap-2">
            <Label htmlFor="dueDate">Due Date *</Label>
            <Input
              id="dueDate"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
            />
          </div>

          {/* Fee Type */}
          <div className="grid gap-2">
            <Label htmlFor="feeType">Fee Type</Label>
            <Select value={feeType} onValueChange={setFeeType}>
              <SelectTrigger id="feeType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="one_time">One-time</SelectItem>
                <SelectItem value="fine">Fine</SelectItem>
                <SelectItem value="special">Special</SelectItem>
                <SelectItem value="deposit">Deposit</SelectItem>
                <SelectItem value="utility">Utility</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div className="grid gap-2">
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={(value: any) => setStatus(value)}>
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unpaid">Unpaid</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Reason */}
          <div className="grid gap-2">
            <Label htmlFor="reason">Reason</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Optional reason for the fee"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || loading}>
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

