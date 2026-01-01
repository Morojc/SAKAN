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
import { Switch } from '@/components/ui/switch';
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
  const [coveragePeriodType, setCoveragePeriodType] = useState(setting.coverage_period_type);
  const [coveragePeriodValue, setCoveragePeriodValue] = useState(setting.coverage_period_value);
  const [nextDueDate, setNextDueDate] = useState(new Date(setting.next_due_date));
  const [isActive, setIsActive] = useState(setting.is_active);
  const [reminderEnabled, setReminderEnabled] = useState(setting.reminder_enabled);
  const [reminderDaysBefore, setReminderDaysBefore] = useState(setting.reminder_days_before);

  useEffect(() => {
    if (open) {
      setTitle(setting.title);
      setAmount(setting.amount);
      setCoveragePeriodType(setting.coverage_period_type);
      setCoveragePeriodValue(setting.coverage_period_value);
      setNextDueDate(new Date(setting.next_due_date));
      setIsActive(setting.is_active);
      setReminderEnabled(setting.reminder_enabled);
      setReminderDaysBefore(setting.reminder_days_before);
    }
  }, [open, setting]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!title || !amount || !coveragePeriodType) {
      toast.error('Please fill all fields');
      return;
    }

    setLoading(true);
    try {
      const result = await updateRecurringFee({
        id: setting.id,
        title,
        amount,
        coveragePeriodType,
        coveragePeriodValue,
        nextDueDate,
        isActive,
        reminderEnabled,
        reminderDaysBefore,
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
            <Label htmlFor="coveragePeriodType">Coverage Period Type</Label>
            <Select value={coveragePeriodType} onValueChange={(val) => setCoveragePeriodType(val as any)}>
              <SelectTrigger>
                <SelectValue placeholder="Select period type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Weekly</SelectItem>
                <SelectItem value="month">Monthly</SelectItem>
                <SelectItem value="year">Yearly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="coveragePeriodValue">Coverage Duration</Label>
            <Input
              id="coveragePeriodValue"
              type="number"
              placeholder="1"
              min="1"
              value={coveragePeriodValue}
              onChange={(e) => setCoveragePeriodValue(parseInt(e.target.value) || 1)}
              required
            />
            <p className="text-xs text-muted-foreground">
              How many weeks/months/years does one payment cover?
            </p>
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

          <div className="flex flex-row items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label className="text-base">Active Status</Label>
              <p className="text-sm text-muted-foreground">
                Enable this rule to generate payments
              </p>
            </div>
            <Switch
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>

          <div className="flex flex-row items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label className="text-base">Email Reminders</Label>
              <p className="text-sm text-muted-foreground">
                Send automatic payment reminders to residents
              </p>
            </div>
            <Switch
              checked={reminderEnabled}
              onCheckedChange={setReminderEnabled}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reminderDaysBefore">Reminder Days Before Due Date</Label>
            <Input
              id="reminderDaysBefore"
              type="number"
              placeholder="3"
              min="0"
              max="30"
              value={reminderDaysBefore}
              onChange={(e) => setReminderDaysBefore(parseInt(e.target.value) || 3)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Send reminder email X days before the payment is due (0-30 days)
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="text-white bg-blue-500 hover:bg-blue-600">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Rule
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

