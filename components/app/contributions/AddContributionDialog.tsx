'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface AddContributionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  residenceId: number;
  apartments: Array<{ number: string; residentName: string; residentId: string }>;
}

export default function AddContributionDialog({
  open,
  onOpenChange,
  onSuccess,
  residenceId,
  apartments,
}: AddContributionDialogProps) {
  const [selectedApartment, setSelectedApartment] = useState('');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState<'paid' | 'unpaid'>('unpaid');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const handleSubmit = async () => {
    // Validation
    if (!selectedApartment) {
      toast.error('Please select an apartment');
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setSubmitting(true);

    try {
      const selectedApt = apartments.find(apt => apt.number === selectedApartment);
      if (!selectedApt) {
        toast.error('Apartment not found');
        setSubmitting(false);
        return;
      }

      const response = await fetch('/api/contributions/add-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          residenceId,
          userId: selectedApt.residentId,
          apartmentNumber: selectedApartment,
          month,
          year,
          amount: parseFloat(amount),
          status,
          paymentMethod: status === 'paid' ? paymentMethod : null,
          paymentDate: status === 'paid' ? paymentDate : null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || 'Failed to add contribution');
        setSubmitting(false);
        return;
      }

      toast.success('Contribution added successfully!');
      
      // Reset form
      setSelectedApartment('');
      setMonth(new Date().getMonth() + 1);
      setYear(new Date().getFullYear());
      setAmount('');
      setStatus('unpaid');
      setPaymentMethod('cash');
      setPaymentDate(new Date().toISOString().split('T')[0]);
      
      setSubmitting(false);
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error adding contribution:', error);
      toast.error('Failed to add contribution');
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Contribution Manually</DialogTitle>
          <DialogDescription>
            Add a single contribution record for an apartment and month
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Apartment Selection */}
          <div>
            <Label htmlFor="apartment">Apartment *</Label>
            <Select value={selectedApartment} onValueChange={setSelectedApartment}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Select apartment" />
              </SelectTrigger>
              <SelectContent>
                {apartments.map((apt) => (
                  <SelectItem key={apt.number} value={apt.number}>
                    Apt {apt.number} - {apt.residentName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Month & Year */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="month">Month *</Label>
              <Select value={month.toString()} onValueChange={(val) => setMonth(parseInt(val))}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthNames.map((name, index) => (
                    <SelectItem key={index} value={(index + 1).toString()}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="year">Year *</Label>
              <Input
                id="year"
                type="number"
                min={2020}
                max={2100}
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value))}
                className="mt-2"
              />
            </div>
          </div>

          {/* Amount */}
          <div>
            <Label htmlFor="amount">Amount (MAD) *</Label>
            <Input
              id="amount"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g., 150"
              className="mt-2"
            />
          </div>

          {/* Payment Status */}
          <div>
            <Label htmlFor="status">Payment Status *</Label>
            <Select value={status} onValueChange={(val: 'paid' | 'unpaid') => setStatus(val)}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unpaid">Unpaid</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Payment Details (only if paid) */}
          {status === 'paid' && (
            <>
              <div>
                <Label htmlFor="paymentMethod">Payment Method</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="transfer">Bank Transfer</SelectItem>
                    <SelectItem value="check">Check</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="paymentDate">Payment Date</Label>
                <Input
                  id="paymentDate"
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="mt-2"
                />
              </div>
            </>
          )}

          {/* Summary */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="font-medium text-blue-900 mb-2">Summary:</p>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Apartment: {selectedApartment || 'Not selected'}</li>
              <li>• Period: {monthNames[month - 1]} {year}</li>
              <li>• Amount: {amount ? `${amount} MAD` : 'Not set'}</li>
              <li>• Status: {status === 'paid' ? '✅ Paid' : '⏳ Unpaid'}</li>
              {status === 'paid' && (
                <>
                  <li>• Payment method: {paymentMethod}</li>
                  <li>• Payment date: {paymentDate}</li>
                </>
              )}
            </ul>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Add Contribution
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

