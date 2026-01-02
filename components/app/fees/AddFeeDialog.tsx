'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus } from 'lucide-react';
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
    if (open && residenceId) {
      fetchResidents();
    }
  }, [open, residenceId]);

  const fetchResidents = async () => {
    if (!residenceId) {
      console.error('[AddFeeDialog] No residenceId provided');
      toast.error('Residence ID is missing');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/contributions/apartments?residenceId=${residenceId}`);
      const result = await response.json();
      
      if (response.ok && result.success) {
        // Handle standardized API response format { success: true, data: [...] }
        const apartmentsData = result.data || [];

        if (apartmentsData && apartmentsData.length > 0) {
          const mappedResidents = apartmentsData.map((apt: any) => ({
            id: apt.resident_id || apt.residentId, // Handle both formats
            name: apt.resident_name || apt.residentName || 'Unknown',
            apartment: apt.apartment_number || apt.number || 'N/A',
          }));
          setResidents(mappedResidents);
        } else {
          setResidents([]);
          console.warn('[AddFeeDialog] No apartments found for residence:', residenceId);
        }
      } else {
        const errorMsg = result.error || 'Failed to load residents';
        console.error('[AddFeeDialog] API error:', errorMsg);
        toast.error(errorMsg);
        setResidents([]);
      }
    } catch (error: any) {
      console.error('[AddFeeDialog] Error fetching residents:', error);
      toast.error(error?.message || 'Failed to load residents');
      setResidents([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (!residenceId) {
      toast.error('Residence ID is missing. Please refresh the page.');
      return;
    }
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

    try {
      const response = await fetch('/api/fees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: selectedResident,
          residence_id: residenceId,
          title: title.trim(),
          amount: parseFloat(amount),
          due_date: dueDate,
          status,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();

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
    } catch (error: any) {
      console.error('[AddFeeDialog] Error creating fee:', error);
      toast.error(error?.message || 'Failed to create fee. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Don't render if residenceId is missing
  if (!residenceId) {
    return null;
  }

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
                {residents.length === 0 ? (
                  <SelectItem value="" disabled>
                    {loading ? 'Loading residents...' : 'No residents available'}
                  </SelectItem>
                ) : (
                  residents.map((resident) => (
                    <SelectItem key={resident.id} value={resident.id}>
                      Apt {resident.apartment} - {resident.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {residents.length === 0 && !loading && (
              <p className="text-xs text-red-600 mt-1">
                ⚠️ No residents found. Please add residents to your residence first.
              </p>
            )}
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
