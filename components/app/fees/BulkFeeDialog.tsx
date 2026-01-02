'use client';

import { useState, useEffect } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import type { FeeType } from '@/types/financial.types';

interface BulkFeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  residenceId: number;
}

/**
 * Bulk Fee Creation Dialog (US-03)
 * Create exceptional fees for multiple apartments
 */
export default function BulkFeeDialog({
  open,
  onOpenChange,
  onSuccess,
  residenceId,
}: BulkFeeDialogProps) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [apartments, setApartments] = useState<Array<{ number: string; selected: boolean }>>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [feeType, setFeeType] = useState<FeeType>('one_time');
  const [totalAmount, setTotalAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open) {
      loadApartments();
      // Set default due date to 30 days from now
      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() + 30);
      setDueDate(defaultDate.toISOString().split('T')[0]);
    } else {
      resetForm();
    }
  }, [open]);

  const loadApartments = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/contributions/apartments?residenceId=${residenceId}`);
      const result = await response.json();

      if (result.success) {
        const apts = result.data.map((apt: any) => ({
          number: apt.apartment_number,
          selected: false,
        }));
        setApartments(apts);
      } else {
        toast.error(result.error || 'Failed to load apartments');
      }
    } catch (error: any) {
      console.error('Error loading apartments:', error);
      toast.error('Failed to load apartments');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleApartment = (index: number) => {
    setApartments((prev) =>
      prev.map((apt, i) => (i === index ? { ...apt, selected: !apt.selected } : apt))
    );
  };

  const handleSelectAll = () => {
    const allSelected = apartments.every((apt) => apt.selected);
    setApartments((prev) => prev.map((apt) => ({ ...apt, selected: !allSelected })));
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setFeeType('one_time');
    setTotalAmount('');
    setDueDate('');
    setReason('');
    setApartments((prev) => prev.map((apt) => ({ ...apt, selected: false })));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const selectedApts = apartments.filter((apt) => apt.selected);
    if (selectedApts.length === 0) {
      toast.error('Please select at least one apartment');
      return;
    }

    if (!title || !totalAmount || !dueDate) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/fees/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          residence_id: residenceId,
          apartment_numbers: selectedApts.map((apt) => apt.number),
          title,
          description,
          fee_type: feeType,
          amount: parseFloat(totalAmount),
          due_date: dueDate,
          reason,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success(`Successfully created ${result.data.count} fees`);
        resetForm();
        onSuccess();
        onOpenChange(false);
      } else {
        toast.error(result.error || 'Failed to create fees');
      }
    } catch (error: any) {
      console.error('Error creating bulk fees:', error);
      toast.error('Failed to create fees');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedCount = apartments.filter((apt) => apt.selected).length;
  const amountPerApartment =
    selectedCount > 0 && totalAmount ? (parseFloat(totalAmount) / selectedCount).toFixed(2) : '0';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Create Bulk Fee (Exceptional Fund Call)</DialogTitle>
          <DialogDescription>
            Create a one-time fee for multiple apartments. The total amount will be divided equally
            among selected apartments.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-auto">
          <div className="grid gap-4 py-4">
            {/* Title */}
            <div className="grid gap-2">
              <Label htmlFor="title">
                Title * <span className="text-xs text-muted-foreground">(e.g., "Building Repairs")</span>
              </Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Fee title"
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
                placeholder="Optional description of the fee"
                rows={3}
              />
            </div>

            {/* Fee Type */}
            <div className="grid gap-2">
              <Label htmlFor="feeType">Fee Type</Label>
              <Select value={feeType} onValueChange={(value) => setFeeType(value as FeeType)}>
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

            {/* Total Amount */}
            <div className="grid gap-2">
              <Label htmlFor="totalAmount">
                Total Amount (MAD) * <span className="text-xs text-muted-foreground">(Will be divided equally)</span>
              </Label>
              <Input
                id="totalAmount"
                type="number"
                step="0.01"
                min="0"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                placeholder="0.00"
                required
              />
              {selectedCount > 0 && totalAmount && (
                <p className="text-xs text-muted-foreground">
                  {amountPerApartment} MAD per apartment ({selectedCount} selected)
                </p>
              )}
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

            {/* Reason */}
            <div className="grid gap-2">
              <Label htmlFor="reason">Reason</Label>
              <Input
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Optional reason for this fee"
              />
            </div>

            {/* Apartment Selection */}
            <div className="grid gap-2">
              <div className="flex justify-between items-center">
                <Label>Select Apartments *</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAll}
                  disabled={loading}
                >
                  {apartments.every((apt) => apt.selected) ? 'Deselect All' : 'Select All'}
                </Button>
              </div>
              {loading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">Loading apartments...</span>
                </div>
              ) : (
                <div className="border rounded-lg p-3 max-h-60 overflow-y-auto">
                  <div className="grid grid-cols-3 gap-2">
                    {apartments.map((apt, index) => (
                      <div
                        key={apt.number}
                        className="flex items-center space-x-2 p-2 rounded hover:bg-muted/50"
                      >
                        <Checkbox
                          id={`apt-${apt.number}`}
                          checked={apt.selected}
                          onCheckedChange={() => handleToggleApartment(index)}
                        />
                        <Label
                          htmlFor={`apt-${apt.number}`}
                          className="text-sm cursor-pointer flex-1"
                        >
                          Apt. {apt.number}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selectedCount > 0 && (
                <p className="text-xs text-muted-foreground">
                  {selectedCount} apartment{selectedCount !== 1 ? 's' : ''} selected
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || loading || selectedCount === 0}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {submitting ? 'Creating...' : `Create ${selectedCount} Fee${selectedCount !== 1 ? 's' : ''}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

