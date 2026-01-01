'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
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
import { createRecurringFee } from '@/app/actions/recurring-fees';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/hooks/useAuth';

const formSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters'),
  amount: z.number().positive('Amount must be positive'),
  coveragePeriodValue: z.number().min(1, 'Coverage value must be at least 1'),
  coveragePeriodType: z.enum(['week', 'month', 'year']),
  startDate: z.date(),
  isActive: z.boolean(),
  reminderEnabled: z.boolean(),
  reminderDaysBefore: z.number().min(0, 'Must be 0 or more days').max(30, 'Maximum 30 days'),
});

interface AddRecurringFeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export default function AddRecurringFeeDialog({
  open,
  onOpenChange,
  onSuccess,
}: AddRecurringFeeDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: 'Syndic Fee',
      amount: 0,
      coveragePeriodValue: 1,
      coveragePeriodType: 'month',
      startDate: new Date(),
      isActive: true,
      reminderEnabled: true,
      reminderDaysBefore: 3,
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!user?.residenceId) {
      toast.error('Residence ID not found');
      return;
    }

    setLoading(true);
    try {
      const result = await createRecurringFee({
        title: values.title,
        amount: values.amount,
        startDate: values.startDate,
        coveragePeriodValue: values.coveragePeriodValue,
        coveragePeriodType: values.coveragePeriodType,
        isActive: values.isActive,
        reminderEnabled: values.reminderEnabled,
        reminderDaysBefore: values.reminderDaysBefore,
        residenceId: parseInt(user.residenceId),
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('Payment rule created successfully');
        form.reset();
        onSuccess();
      }
    } catch (error) {
      toast.error('Failed to create rule');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create Payment Rule</DialogTitle>
          <DialogDescription>
            Set up a recurring fee structure for all residents.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fee Title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Monthly Syndic Fee" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount (MAD)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="0.00" 
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="coveragePeriodType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Coverage Period Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select period type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="week">Weekly</SelectItem>
                      <SelectItem value="month">Monthly</SelectItem>
                      <SelectItem value="year">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="coveragePeriodValue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Coverage Duration</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="1" 
                      min="1"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    How many weeks/months/years does one payment cover? (e.g., 3 months = payment covers 3 months)
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="startDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Start Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={'outline'}
                          className={cn(
                            'w-full pl-3 text-left font-normal',
                            !field.value && 'text-muted-foreground'
                          )}
                        >
                          {field.value ? (
                            format(field.value, 'PPP')
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) =>
                          date < new Date(new Date().setHours(0, 0, 0, 0))
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Active Status</FormLabel>
                    <p className="text-sm text-muted-foreground">
                      Enable this rule to start generating payments
                    </p>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reminderEnabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Email Reminders</FormLabel>
                    <p className="text-sm text-muted-foreground">
                      Send automatic payment reminders to residents
                    </p>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reminderDaysBefore"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reminder Days Before Due Date</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="3" 
                      min="0"
                      max="30"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 3)}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    Send reminder email X days before the payment is due (0-30 days)
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" disabled={loading} className="text-white bg-blue-500 hover:bg-blue-600">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Rule
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

