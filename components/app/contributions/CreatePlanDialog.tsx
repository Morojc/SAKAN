'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import type { CreateContributionPlanDTO } from '@/types/financial.types';

interface CreatePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  residenceId: number;
}

export default function CreatePlanDialog({
  open,
  onOpenChange,
  onSuccess,
  residenceId,
}: CreatePlanDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  
  // Default start date to the 1st of the current month
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1, 12);
  const defaultStartDate = firstOfMonth.toISOString().split('T')[0];

  const [formData, setFormData] = useState<CreateContributionPlanDTO>({
    residence_id: residenceId,
    plan_name: '',
    description: '',
    amount_per_period: 0,
    period_type: 'monthly',
    start_date: defaultStartDate,
    applies_to_all_apartments: true,
    // Disabled features - set defaults but won't be used
    auto_generate: false,
    generation_day: 1,
    due_day: 5,
    late_fee_enabled: false,
    late_fee_amount: 0,
    late_fee_days_after: 7,
    reminder_enabled: false,
    reminder_days_before: 3,
  });

  const handleSubmit = async () => {
    // Validation
    if (!formData.plan_name.trim()) {
      toast.error('Please enter a plan name');
      return;
    }
    if (formData.amount_per_period <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/contributions/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Contribution plan created successfully!');
        onSuccess();
      } else {
        toast.error(result.error || 'Failed to create plan');
      }
    } catch (error: any) {
      console.error('Error creating plan:', error);
      toast.error('Failed to create plan');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Contribution Plan</DialogTitle>
          <DialogDescription>
            Set up a recurring contribution plan for your residence
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Plan Name */}
          <div>
            <Label htmlFor="plan_name">Plan Name *</Label>
            <Input
              id="plan_name"
              value={formData.plan_name}
              onChange={(e) => setFormData({ ...formData, plan_name: e.target.value })}
              placeholder="e.g., Monthly Syndic Fee"
              className="mt-2"
            />
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Optional description"
              className="mt-2"
              rows={2}
            />
          </div>

          {/* Amount and Period */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="amount">Amount per Period *</Label>
              <Input
                id="amount"
                type="number"
                min="0"
                step="0.01"
                value={formData.amount_per_period}
                onChange={(e) => setFormData({ ...formData, amount_per_period: parseFloat(e.target.value) || 0 })}
                placeholder="200.00"
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="period_type">Period Type *</Label>
              <Select
                value={formData.period_type}
                onValueChange={(value: any) => setFormData({ ...formData, period_type: value })}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="semi_annual">Semi-Annual</SelectItem>
                  <SelectItem value="annual">Annual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Start Date */}
          <div>
            <Label htmlFor="start_date">Start Date *</Label>
            <Input
              id="start_date"
              type="date"
              value={formData.start_date}
              onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Tip: Set this to the 1st of the month to include the full month.
            </p>
          </div>

          {/* Generation Settings - Coming Soon */}
          <div className="space-y-3 p-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 opacity-60">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm">Generation Settings</h4>
              <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">Coming Soon</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Automatic contribution generation and scheduling will be available in a future update.
            </p>
          </div>

          {/* Late Fee Settings - Coming Soon */}
          <div className="space-y-3 p-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 opacity-60">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm">Late Fee Settings</h4>
              <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">Coming Soon</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Automatic late fee calculation and application will be available in a future update.
            </p>
          </div>

          {/* Reminder Settings - Coming Soon */}
          <div className="space-y-3 p-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 opacity-60">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm">Reminder Settings</h4>
              <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">Coming Soon</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Automated email reminders will be available in a future update.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting} className="bg-blue-600 hover:bg-blue-700 text-white">
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Plan'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
