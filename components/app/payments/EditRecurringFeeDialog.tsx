'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { format } from 'date-fns';
import { CalendarIcon, Loader2 } from 'lucide-react';
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
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { updateRecurringFee, RecurringFeeSetting } from '@/app/actions/recurring-fees';
import toast from 'react-hot-toast';

interface EditRecurringFeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  setting: RecurringFeeSetting;
}

export default function EditRecurringFeeDialog({
  open,
  onOpenChange,
  onSuccess,
  setting,
}: EditRecurringFeeDialogProps) {
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState(setting.title);
  const [amount, setAmount] = useState(setting.amount);
  const [frequency, setFrequency] = useState(setting.frequency);
  const [nextDueDate, setNextDueDate] = useState(new Date(setting.next_due_date));

  useEffect(() => {
    if (open) {
      setTitle(setting.title);
      setAmount(setting.amount);
      setFrequency(setting.frequency);
      setNextDueDate(new Date(setting.next_due_date));
    }
  }, [open, setting]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!title || !amount || !frequency) {
      toast.error('Please fill all fields');
      return;
    }

    setLoading(true);
    try {
      const result = await updateRecurringFee({
        id: setting.id,
        title,
        amount,
        frequency,
        nextDueDate,
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('Payment rule updated successfully');
        onSuccess();
      }
    } catch (error) {
      toast.error('Failed to update rule');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Payment Rule</DialogTitle>
          <DialogDescription>
            Update the recurring fee structure for all residents.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Fee Title</Label>
            <Input
              id="title"
              placeholder="e.g. Monthly Syndic Fee"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount (MAD)</Label>
            <Input
              id="amount"
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="frequency">Frequency</Label>
            <Select value={frequency} onValueChange={(val) => setFrequency(val as any)}>
              <SelectTrigger>
                <SelectValue placeholder="Select frequency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Next Due Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={'outline'}
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !nextDueDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {nextDueDate ? format(nextDueDate, 'PPP') : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={nextDueDate}
                  onSelect={(date) => date && setNextDueDate(date)}
                  disabled={(date) =>
                    date < new Date(new Date().setHours(0, 0, 0, 0))
                  }
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Rule
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

