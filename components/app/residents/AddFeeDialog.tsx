'use client';

import { useState, useEffect } from 'react';
import { DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Fee } from './ResidentsContent';
import { createFee } from '@/app/app/residents/fee-actions';
import { getResidences } from '@/app/app/residents/actions';
import toast from 'react-hot-toast';

interface AddFeeDialogProps {
  open: boolean;
  residentId: string;
  onClose: () => void;
  onSuccess: (fee: Fee) => void;
}

/**
 * Add Fee Dialog Component
 * Form for adding fees to residents with validation
 */
export default function AddFeeDialog({
  open,
  residentId,
  onClose,
  onSuccess,
}: AddFeeDialogProps) {
  console.log('[AddFeeDialog] Dialog', open ? 'opened' : 'closed', 'for resident:', residentId);

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [residences, setResidences] = useState<{ id: number; name: string; address: string; city: string }[]>([]);

  // Form state
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState<'unpaid' | 'paid' | 'overdue'>('unpaid');
  const [residenceId, setResidenceId] = useState<string>('');

  // Validation errors
  const [errors, setErrors] = useState<{
    title?: string;
    amount?: string;
    dueDate?: string;
    residenceId?: string;
  }>({});

  // Fetch residences when dialog opens
  useEffect(() => {
    if (open) {
      console.log('[AddFeeDialog] Dialog opened, fetching residences');
      fetchResidences();
      resetForm();
    }
  }, [open]);

  async function fetchResidences() {
    setLoading(true);
    try {
      const result = await getResidences();
      if (result.success) {
        console.log('[AddFeeDialog] Residences fetched:', result.residences.length);
        setResidences(result.residences);
      } else {
        console.error('[AddFeeDialog] Error fetching residences');
        toast.error('Failed to load residences');
      }
    } catch (error: any) {
      console.error('[AddFeeDialog] Error fetching residences:', error);
      toast.error(error.message || 'Failed to load residences');
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setTitle('');
    setAmount('');
    // Set default due date to 30 days from now
    const defaultDueDate = new Date();
    defaultDueDate.setDate(defaultDueDate.getDate() + 30);
    setDueDate(defaultDueDate.toISOString().split('T')[0]);
    setStatus('unpaid');
    setResidenceId('');
    setErrors({});
  }

  function validateForm(): boolean {
    const newErrors: typeof errors = {};

    // Title validation
    if (!title.trim()) {
      newErrors.title = 'Fee title is required';
    } else if (title.trim().length < 3) {
      newErrors.title = 'Fee title must be at least 3 characters';
    }

    // Amount validation
    if (!amount.trim()) {
      newErrors.amount = 'Amount is required';
    } else {
      const amountNum = Number(amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        newErrors.amount = 'Amount must be a positive number';
      }
    }

    // Due date validation
    if (!dueDate) {
      newErrors.dueDate = 'Due date is required';
    } else {
      const date = new Date(dueDate);
      if (isNaN(date.getTime())) {
        newErrors.dueDate = 'Invalid date format';
      }
    }

    // Residence validation
    if (!residenceId) {
      newErrors.residenceId = 'Residence is required';
    }

    setErrors(newErrors);
    console.log('[AddFeeDialog] Validation errors:', newErrors);

    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    console.log('[AddFeeDialog] Submitting form');

    // Validate form
    if (!validateForm()) {
      console.log('[AddFeeDialog] Form validation failed');
      toast.error('Please fix the errors in the form');
      return;
    }

    setSubmitting(true);

    try {
      const result = await createFee({
        user_id: residentId,
        residence_id: Number(residenceId),
        title: title.trim(),
        amount: Number(amount),
        due_date: dueDate,
        status,
      });

      if (result.success && result.fee) {
        console.log('[AddFeeDialog] Fee created:', result.fee);

        // Transform to Fee format
        const newFee: Fee = {
          id: result.fee.id,
          user_id: result.fee.user_id,
          title: result.fee.title,
          amount: Number(result.fee.amount),
          due_date: result.fee.due_date,
          status: result.fee.status,
          created_at: result.fee.created_at,
        };

        toast.success('Fee added successfully!');
        resetForm();
        onSuccess(newFee);
        onClose();
      } else {
        console.error('[AddFeeDialog] Error:', result.error);
        toast.error(result.error || 'Failed to create fee');
      }
    } catch (error: any) {
      console.error('[AddFeeDialog] Error creating fee:', error);
      toast.error(error.message || 'Failed to create fee');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Add New Fee
          </DialogTitle>
          <DialogDescription>
            Create a new fee for this resident. The fee will be tracked until payment is received.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* Title */}
            <div className="grid gap-2">
              <Label htmlFor="fee-title">
                Fee Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="fee-title"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (errors.title) {
                    setErrors({ ...errors, title: undefined });
                  }
                }}
                placeholder="e.g., Monthly Fee - March 2024"
                aria-invalid={!!errors.title}
                aria-describedby={errors.title ? 'fee-title-error' : undefined}
                className={errors.title ? 'border-destructive' : ''}
              />
              {errors.title && (
                <p id="fee-title-error" className="text-sm text-destructive" role="alert">
                  {errors.title}
                </p>
              )}
            </div>

            {/* Amount */}
            <div className="grid gap-2">
              <Label htmlFor="fee-amount">
                Amount (MAD) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="fee-amount"
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  if (errors.amount) {
                    setErrors({ ...errors, amount: undefined });
                  }
                }}
                placeholder="0.00"
                aria-invalid={!!errors.amount}
                aria-describedby={errors.amount ? 'fee-amount-error' : undefined}
                className={errors.amount ? 'border-destructive' : ''}
              />
              {errors.amount && (
                <p id="fee-amount-error" className="text-sm text-destructive" role="alert">
                  {errors.amount}
                </p>
              )}
            </div>

            {/* Due Date */}
            <div className="grid gap-2">
              <Label htmlFor="fee-dueDate">
                Due Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="fee-dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => {
                  setDueDate(e.target.value);
                  if (errors.dueDate) {
                    setErrors({ ...errors, dueDate: undefined });
                  }
                }}
                aria-invalid={!!errors.dueDate}
                aria-describedby={errors.dueDate ? 'fee-dueDate-error' : undefined}
                className={errors.dueDate ? 'border-destructive' : ''}
              />
              {errors.dueDate && (
                <p id="fee-dueDate-error" className="text-sm text-destructive" role="alert">
                  {errors.dueDate}
                </p>
              )}
            </div>

            {/* Residence */}
            <div className="grid gap-2">
              <Label htmlFor="fee-residenceId">
                Residence <span className="text-destructive">*</span>
              </Label>
              <Select
                value={residenceId}
                onValueChange={(value: string) => {
                  setResidenceId(value);
                  if (errors.residenceId) {
                    setErrors({ ...errors, residenceId: undefined });
                  }
                }}
                disabled={loading}
              >
                <SelectTrigger
                  id="fee-residenceId"
                  aria-invalid={!!errors.residenceId}
                  aria-describedby={errors.residenceId ? 'fee-residenceId-error' : undefined}
                  className={errors.residenceId ? 'border-destructive' : ''}
                >
                  <SelectValue placeholder={loading ? 'Loading residences...' : 'Select residence'} />
                </SelectTrigger>
                <SelectContent>
                  {residences.map((residence) => (
                    <SelectItem key={residence.id} value={residence.id.toString()}>
                      {residence.name} - {residence.address}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.residenceId && (
                <p id="fee-residenceId-error" className="text-sm text-destructive" role="alert">
                  {errors.residenceId}
                </p>
              )}
            </div>

            {/* Status */}
            <div className="grid gap-2">
              <Label htmlFor="fee-status">
                Status <span className="text-destructive">*</span>
              </Label>
              <Select value={status} onValueChange={(value: 'unpaid' | 'paid' | 'overdue') => setStatus(value)}>
                <SelectTrigger id="fee-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || loading} className={`w-1/2 shadow-lg transition-all font-semibold ${'bg-gray-900 hover:bg-gray-800 text-white shadow-gray-900/10' }`}>
              {submitting ? 'Adding...' : 'Add Fee'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
