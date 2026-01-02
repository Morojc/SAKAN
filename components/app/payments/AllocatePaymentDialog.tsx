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
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Loader2, DollarSign, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Payment } from '@/types/financial.types';

interface OutstandingItem {
  id: number;
  type: 'contribution' | 'fee';
  description: string;
  amount_due: number;
  amount_paid: number;
  outstanding: number;
  due_date: string;
  status: string;
}

interface AllocatePaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: Payment | null;
  onSuccess: () => void;
}

/**
 * Payment Allocation Dialog (US-06)
 * Allows syndic to allocate a verified payment to one or more outstanding contributions/fees
 */
export default function AllocatePaymentDialog({
  open,
  onOpenChange,
  payment,
  onSuccess,
}: AllocatePaymentDialogProps) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [outstandingItems, setOutstandingItems] = useState<OutstandingItem[]>([]);
  const [selectedAllocations, setSelectedAllocations] = useState<Record<number, number>>({});
  const [autoAllocate, setAutoAllocate] = useState(false);

  useEffect(() => {
    if (open && payment) {
      loadOutstandingItems();
    } else {
      setOutstandingItems([]);
      setSelectedAllocations({});
      setAutoAllocate(false);
    }
  }, [open, payment]);

  const loadOutstandingItems = async () => {
    if (!payment) return;

    setLoading(true);
    try {
      const params = new URLSearchParams({
        residenceId: payment.residence_id.toString(),
        userId: payment.user_id,
      });
      if (payment.apartment_number) {
        params.append('apartmentNumber', payment.apartment_number);
      }

      const response = await fetch(`/api/payments/outstanding?${params}`);
      const result = await response.json();

      if (result.success) {
        const items: OutstandingItem[] = [
          ...result.data.contributions.map((c: any) => ({
            id: c.id,
            type: 'contribution' as const,
            description: c.period,
            amount_due: c.amount_due,
            amount_paid: c.amount_paid,
            outstanding: c.outstanding,
            due_date: c.due_date,
            status: c.status,
          })),
          ...result.data.fees.map((f: any) => ({
            id: f.id,
            type: 'fee' as const,
            description: f.title,
            amount_due: f.amount,
            amount_paid: 0,
            outstanding: f.outstanding,
            due_date: f.due_date,
            status: f.status,
          })),
        ];
        setOutstandingItems(items);
      } else {
        toast.error(result.error || 'Failed to load outstanding items');
      }
    } catch (error: any) {
      console.error('Error loading outstanding items:', error);
      toast.error('Failed to load outstanding items');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleItem = (itemId: number, outstanding: number) => {
    setSelectedAllocations((prev) => {
      if (prev[itemId]) {
        const newAllocations = { ...prev };
        delete newAllocations[itemId];
        return newAllocations;
      } else {
        return { ...prev, [itemId]: outstanding };
      }
    });
  };

  const handleAmountChange = (itemId: number, amount: number, maxAmount: number) => {
    const clampedAmount = Math.min(Math.max(0, amount), maxAmount);
    setSelectedAllocations((prev) => ({
      ...prev,
      [itemId]: clampedAmount,
    }));
  };

  const handleAutoAllocate = () => {
    if (!payment) return;

    const allocations: Record<number, number> = {};
    let remaining = payment.amount;

    // Allocate to items in order (oldest first)
    const sortedItems = [...outstandingItems].sort(
      (a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
    );

    for (const item of sortedItems) {
      if (remaining <= 0) break;
      const allocation = Math.min(item.outstanding, remaining);
      allocations[item.id] = allocation;
      remaining -= allocation;
    }

    setSelectedAllocations(allocations);
    setAutoAllocate(true);
  };

  const getTotalAllocated = () => {
    return Object.values(selectedAllocations).reduce((sum, amount) => sum + amount, 0);
  };

  const getRemainingCredit = () => {
    if (!payment) return 0;
    return payment.amount - getTotalAllocated();
  };

  const handleSubmit = async () => {
    if (!payment) return;

    const allocations = Object.entries(selectedAllocations).map(([id, amount]) => ({
      type: outstandingItems.find((item) => item.id === parseInt(id))?.type || 'contribution',
      id: parseInt(id),
      amount: amount,
    }));

    if (allocations.length === 0) {
      toast.error('Please select at least one item to allocate');
      return;
    }

    const totalAllocated = getTotalAllocated();
    if (totalAllocated > payment.amount) {
      toast.error('Total allocation cannot exceed payment amount');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/payments/allocate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_id: payment.id,
          allocations,
        }),
      });

      const result = await response.json();

      if (result.success) {
        const credit = result.data.remaining_credit;
        if (credit > 0) {
          toast.success(`Payment allocated! Credit: ${credit.toFixed(2)} MAD`);
        } else {
          toast.success('Payment allocated successfully!');
        }
        onSuccess();
        onOpenChange(false);
      } else {
        toast.error(result.error || 'Failed to allocate payment');
      }
    } catch (error: any) {
      console.error('Error allocating payment:', error);
      toast.error('Failed to allocate payment');
    } finally {
      setSubmitting(false);
    }
  };

  if (!payment) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Allocate Payment</DialogTitle>
          <DialogDescription>
            Allocate payment of {payment.amount} MAD to outstanding contributions or fees
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4">
          {/* Payment Summary */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-muted-foreground">Payment Amount</p>
                <p className="text-2xl font-bold text-blue-600">{payment.amount} MAD</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Resident</p>
                <p className="font-medium">{payment.resident_name || 'Unknown'}</p>
                {payment.apartment_number && (
                  <p className="text-sm text-muted-foreground">Apt. {payment.apartment_number}</p>
                )}
              </div>
            </div>
          </div>

          {/* Auto-allocate button */}
          {outstandingItems.length > 0 && (
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAutoAllocate}
                disabled={loading}
              >
                Auto-allocate (Oldest First)
              </Button>
            </div>
          )}

          {/* Outstanding Items */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Loading outstanding items...</span>
            </div>
          ) : outstandingItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No outstanding contributions or fees found
            </div>
          ) : (
            <div className="space-y-2 border rounded-lg p-3 max-h-96 overflow-y-auto">
              {outstandingItems.map((item) => {
                const isSelected = selectedAllocations[item.id] !== undefined;
                const allocatedAmount = selectedAllocations[item.id] || 0;

                return (
                  <div
                    key={`${item.type}-${item.id}`}
                    className={`p-3 rounded-lg border transition-colors ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : 'hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => handleToggleItem(item.id, item.outstanding)}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge
                            variant={item.type === 'contribution' ? 'default' : 'secondary'}
                          >
                            {item.type}
                          </Badge>
                          <span className="font-medium text-sm">{item.description}</span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Due: {new Date(item.due_date).toLocaleDateString()}
                          </div>
                          <div>
                            Outstanding: <span className="font-medium">{item.outstanding} MAD</span>
                          </div>
                        </div>
                        {isSelected && (
                          <div className="mt-2">
                            <Label htmlFor={`amount-${item.id}`} className="text-xs">
                              Allocation Amount
                            </Label>
                            <Input
                              id={`amount-${item.id}`}
                              type="number"
                              step="0.01"
                              min="0"
                              max={item.outstanding}
                              value={allocatedAmount}
                              onChange={(e) =>
                                handleAmountChange(
                                  item.id,
                                  parseFloat(e.target.value) || 0,
                                  item.outstanding
                                )
                              }
                              className="mt-1"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                              Max: {item.outstanding} MAD
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Allocation Summary */}
          {Object.keys(selectedAllocations).length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium">Total Allocated</span>
                <span className="text-xl font-bold text-green-600">
                  {getTotalAllocated().toFixed(2)} MAD
                </span>
              </div>
              {getRemainingCredit() > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Remaining Credit</span>
                  <span className="font-medium text-green-700">
                    {getRemainingCredit().toFixed(2)} MAD
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || loading || Object.keys(selectedAllocations).length === 0}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {submitting ? 'Allocating...' : 'Allocate Payment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

