'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus } from 'lucide-react';
import { createFee } from '@/app/app/residents/fee-actions';
import toast from 'react-hot-toast';
import { useI18n } from '@/lib/i18n/client';

interface AddFeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  residenceId: number;
}

export default function AddFeeDialog({
  open,
  onOpenChange,
  onSuccess,
  residenceId,
}: AddFeeDialogProps) {
  const { t } = useI18n();
  const [residents, setResidents] = useState<Array<{ id: string; name: string; apartment: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [selectedResident, setSelectedResident] = useState('');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState<'paid' | 'unpaid' | 'overdue'>('unpaid');

  // Fetch residents when dialog opens
  useEffect(() => {
    if (open) {
      fetchResidents();
    }
  }, [open]);

  const fetchResidents = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/contributions/apartments?residenceId=${residenceId}`);
      if (response.ok) {
        const data = await response.json();
        setResidents(
          data.apartments.map((apt: any) => ({
            id: apt.id,
            name: apt.resident_name,
            apartment: apt.apartment_number,
          }))
        );
      }
    } catch (error) {
      console.error('Error fetching residents:', error);
      toast.error('Failed to load residents');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (!selectedResident) {
      toast.error('Please select a resident');
      return;
    }
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

    const result = await createFee({
      user_id: selectedResident,
      residence_id: residenceId,
      title: title.trim(),
      amount: parseFloat(amount),
      due_date: dueDate,
      status,
    });

    setSubmitting(false);

    if (result.success) {
      toast.success('Fee created successfully!');
      // Reset form
      setSelectedResident('');
      setTitle('');
      setAmount('');
      setDueDate('');
      setStatus('unpaid');
      onSuccess();
      onOpenChange(false);
    } else {
      toast.error(result.error || 'Failed to create fee');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('fees.addNewFee')}</DialogTitle>
          <DialogDescription>
            Create a new fee for a resident in your residence
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Resident Selection */}
          <div>
            <Label htmlFor="resident">{t('contributions.resident')} *</Label>
            <Select value={selectedResident} onValueChange={setSelectedResident} disabled={loading}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder={loading ? 'Loading residents...' : 'Select a resident'} />
              </SelectTrigger>
              <SelectContent>
                {residents.map((resident) => (
                  <SelectItem key={resident.id} value={resident.id}>
                    Apt {resident.apartment} - {resident.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Fee Title */}
          <div>
            <Label htmlFor="title">{t('fees.feeTitle')} *</Label>
            <Input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Monthly Maintenance"
              className="mt-2"
            />
          </div>

          {/* Amount */}
          <div>
            <Label htmlFor="amount">{t('contributions.amount')} *</Label>
            <Input
              id="amount"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="mt-2"
            />
          </div>

          {/* Due Date */}
          <div>
            <Label htmlFor="dueDate">{t('residents.dueDate')} *</Label>
            <Input
              id="dueDate"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="mt-2"
            />
          </div>

          {/* Status */}
          <div>
            <Label htmlFor="status">{t('contributions.status')}</Label>
            <Select value={status} onValueChange={(val: 'paid' | 'unpaid' | 'overdue') => setStatus(val)}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unpaid">{t('fees.unpaid')}</SelectItem>
                <SelectItem value="paid">{t('fees.paid')}</SelectItem>
                <SelectItem value="overdue">{t('fees.overdue')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {t('contributions.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || loading} className="bg-blue-600 hover:bg-blue-700 text-white">
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                Create Fee
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

