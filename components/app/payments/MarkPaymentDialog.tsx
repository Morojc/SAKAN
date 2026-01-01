'use client';

import { useState, useEffect } from 'react';
import { Loader2, CreditCard, Calendar, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { getUnpaidFeesForResident, markMultipleFeesPaid } from '@/app/actions/recurring-fees';
import toast from 'react-hot-toast';

interface MarkPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  residents: Array<{
    id: string;
    full_name: string;
    apartment_number?: string;
  }>;
  onSuccess: () => void;
}

export default function MarkPaymentDialog({
  open,
  onOpenChange,
  residents,
  onSuccess,
}: MarkPaymentDialogProps) {
  const [selectedResidentId, setSelectedResidentId] = useState<string>('');
  const [unpaidFees, setUnpaidFees] = useState<any[]>([]);
  const [selectedFeeIds, setSelectedFeeIds] = useState<number[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'check' | 'transfer'>('cash');
  const [loading, setLoading] = useState(false);
  const [loadingFees, setLoadingFees] = useState(false);

  // Fetch unpaid fees when resident is selected
  useEffect(() => {
    if (selectedResidentId) {
      fetchUnpaidFees(selectedResidentId);
    } else {
      setUnpaidFees([]);
      setSelectedFeeIds([]);
    }
  }, [selectedResidentId]);

  const fetchUnpaidFees = async (residentId: string) => {
    setLoadingFees(true);
    try {
      const result = await getUnpaidFeesForResident(residentId);
      if (result.data) {
        setUnpaidFees(result.data);
      } else if (result.error) {
        toast.error(result.error);
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to load unpaid fees');
    } finally {
      setLoadingFees(false);
    }
  };

  const handleFeeToggle = (feeId: number) => {
    setSelectedFeeIds((prev) =>
      prev.includes(feeId)
        ? prev.filter((id) => id !== feeId)
        : [...prev, feeId]
    );
  };

  const handleSelectAll = () => {
    if (selectedFeeIds.length === unpaidFees.length) {
      setSelectedFeeIds([]);
    } else {
      setSelectedFeeIds(unpaidFees.map((fee) => fee.id));
    }
  };

  const getTotalAmount = () => {
    return unpaidFees
      .filter((fee) => selectedFeeIds.includes(fee.id))
      .reduce((sum, fee) => sum + Number(fee.amount), 0);
  };

  const handleSubmit = async () => {
    if (selectedFeeIds.length === 0) {
      toast.error('Please select at least one fee to mark as paid');
      return;
    }

    setLoading(true);
    try {
      const result = await markMultipleFeesPaid({
        feeIds: selectedFeeIds,
        paymentMethod,
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Successfully marked ${selectedFeeIds.length} fee(s) as paid`);
        onSuccess();
        onOpenChange(false);
        // Reset state
        setSelectedResidentId('');
        setSelectedFeeIds([]);
        setUnpaidFees([]);
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to process payment');
    } finally {
      setLoading(false);
    }
  };

  const selectedResident = residents.find((r) => r.id === selectedResidentId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Mark Payment</DialogTitle>
          <DialogDescription>
            Select a resident and choose which fees to mark as paid
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 overflow-auto flex-1">
          {/* Resident Selection */}
          <div className="space-y-2">
            <Label htmlFor="resident">Select Resident</Label>
            <Select value={selectedResidentId} onValueChange={setSelectedResidentId}>
              <SelectTrigger id="resident">
                <SelectValue placeholder="Choose a resident..." />
              </SelectTrigger>
              <SelectContent>
                {residents.map((resident) => (
                  <SelectItem key={resident.id} value={resident.id}>
                    {resident.full_name}
                    {resident.apartment_number && ` - Apt ${resident.apartment_number}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Unpaid Fees List */}
          {selectedResidentId && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label>Select Fees to Mark as Paid</Label>
                {unpaidFees.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleSelectAll}
                  >
                    {selectedFeeIds.length === unpaidFees.length ? 'Deselect All' : 'Select All'}
                  </Button>
                )}
              </div>

              {loadingFees ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : unpaidFees.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border rounded-lg">
                  <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No unpaid fees for this resident</p>
                </div>
              ) : (
                <div className="space-y-2 border rounded-lg p-4 max-h-64 overflow-y-auto">
                  {unpaidFees.map((fee) => (
                    <div
                      key={fee.id}
                      className={`flex items-start space-x-3 p-3 rounded-lg border transition-colors ${
                        selectedFeeIds.includes(fee.id)
                          ? 'bg-blue-50 border-blue-200'
                          : 'hover:bg-muted/50'
                      }`}
                    >
                      <Checkbox
                        id={`fee-${fee.id}`}
                        checked={selectedFeeIds.includes(fee.id)}
                        onCheckedChange={() => handleFeeToggle(fee.id)}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <label
                          htmlFor={`fee-${fee.id}`}
                          className="block cursor-pointer"
                        >
                          <div className="font-medium text-sm">{fee.title}</div>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            Due: {new Date(fee.due_date).toLocaleDateString()}
                            {new Date(fee.due_date) < new Date() && (
                              <Badge variant="destructive" className="text-[10px] px-1 py-0">
                                Overdue
                              </Badge>
                            )}
                          </div>
                        </label>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-sm">{fee.amount} MAD</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Total Amount */}
              {selectedFeeIds.length > 0 && (
                <div className="flex justify-between items-center p-4 bg-muted rounded-lg">
                  <span className="font-medium">Total Amount</span>
                  <span className="text-xl font-bold text-blue-600">
                    {getTotalAmount()} MAD
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Payment Method */}
          {selectedFeeIds.length > 0 && (
            <div className="space-y-3">
              <Label>Payment Method</Label>
              <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as any)}>
                <div className="flex items-center space-x-2 border rounded-lg p-3">
                  <RadioGroupItem value="cash" id="cash" />
                  <Label htmlFor="cash" className="cursor-pointer flex-1">
                    <div className="font-medium">Cash</div>
                    <div className="text-xs text-muted-foreground">Payment in cash</div>
                  </Label>
                  <CreditCard className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex items-center space-x-2 border rounded-lg p-3">
                  <RadioGroupItem value="check" id="check" />
                  <Label htmlFor="check" className="cursor-pointer flex-1">
                    <div className="font-medium">Check</div>
                    <div className="text-xs text-muted-foreground">Payment by check</div>
                  </Label>
                  <FileText className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex items-center space-x-2 border rounded-lg p-3">
                  <RadioGroupItem value="transfer" id="transfer" />
                  <Label htmlFor="transfer" className="cursor-pointer flex-1">
                    <div className="font-medium">Bank Transfer</div>
                    <div className="text-xs text-muted-foreground">Direct bank transfer</div>
                  </Label>
                  <CreditCard className="h-5 w-5 text-muted-foreground" />
                </div>
              </RadioGroup>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || selectedFeeIds.length === 0}
            className="text-white bg-blue-500 hover:bg-blue-600"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Mark as Paid {selectedFeeIds.length > 0 && `(${selectedFeeIds.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

