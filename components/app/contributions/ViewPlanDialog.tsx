'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { useI18n } from '@/lib/i18n/client';
import type { ContributionPlan } from '@/types/financial.types';

interface ViewPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: ContributionPlan | null;
}

export default function ViewPlanDialog({
  open,
  onOpenChange,
  plan,
}: ViewPlanDialogProps) {
  const { t } = useI18n();

  if (!plan) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-MA', {
      style: 'currency',
      currency: 'MAD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getPeriodLabel = (type: string) => {
    const labels: Record<string, string> = {
      monthly: 'Monthly',
      quarterly: 'Quarterly',
      semi_annual: 'Semi-Annual',
      annual: 'Annual',
    };
    return labels[type] || type;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Contribution Plan Details</DialogTitle>
          <DialogDescription>
            View complete details for plan: {plan.plan_name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">Basic Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Plan Name</p>
                <p className="text-base font-semibold">{plan.plan_name}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Status</p>
                <div className="mt-1">
                  {plan.is_active ? (
                    <Badge className="bg-green-100 text-green-800">Active</Badge>
                  ) : (
                    <Badge variant="secondary">Inactive</Badge>
                  )}
                </div>
              </div>
              {plan.description && (
                <div className="col-span-2">
                  <p className="text-sm font-medium text-muted-foreground">Description</p>
                  <p className="text-base">{plan.description}</p>
                </div>
              )}
            </div>
          </div>

          {/* Financial Details */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="text-lg font-semibold border-b pb-2">Financial Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Amount Per Period</p>
                <p className="text-base font-semibold">{formatCurrency(plan.amount_per_period)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Period Type</p>
                <p className="text-base font-semibold">{getPeriodLabel(plan.period_type)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Applies To</p>
                <p className="text-base font-semibold">
                  {plan.applies_to_all_apartments ? 'All Apartments' : 'Selected Apartments'}
                </p>
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="text-lg font-semibold border-b pb-2">Dates & Schedule</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Start Date</p>
                <p className="text-base">{format(new Date(plan.start_date), 'PPP')}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">End Date</p>
                <p className="text-base">
                  {plan.end_date ? format(new Date(plan.end_date), 'PPP') : 'No end date'}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Generation Day</p>
                <p className="text-base">Day {plan.generation_day} of period</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Due Day</p>
                <p className="text-base">Day {plan.due_day} of period</p>
              </div>
            </div>
          </div>

          {/* Automation Settings */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="text-lg font-semibold border-b pb-2">Automation Settings</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Auto Generate</p>
                <div className="mt-1">
                  {plan.auto_generate ? (
                    <Badge variant="outline" className="text-blue-600">Enabled</Badge>
                  ) : (
                    <Badge variant="outline">Disabled</Badge>
                  )}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Reminder Enabled</p>
                <div className="mt-1">
                  {plan.reminder_enabled ? (
                    <Badge variant="outline" className="text-blue-600">Enabled</Badge>
                  ) : (
                    <Badge variant="outline">Disabled</Badge>
                  )}
                </div>
              </div>
              {plan.reminder_enabled && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Reminder Days Before</p>
                  <p className="text-base">{plan.reminder_days_before} days before due date</p>
                </div>
              )}
            </div>
          </div>

          {/* Late Fee Settings */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="text-lg font-semibold border-b pb-2">Late Fee Settings</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Late Fee Enabled</p>
                <div className="mt-1">
                  {plan.late_fee_enabled ? (
                    <Badge variant="outline" className="text-orange-600">Enabled</Badge>
                  ) : (
                    <Badge variant="outline">Disabled</Badge>
                  )}
                </div>
              </div>
              {plan.late_fee_enabled && (
                <>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Late Fee Amount</p>
                    <p className="text-base font-semibold">{formatCurrency(plan.late_fee_amount)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Days After Due Date</p>
                    <p className="text-base">{plan.late_fee_days_after} days</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Metadata */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="text-lg font-semibold border-b pb-2">Metadata</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Created At</p>
                <p className="text-base">{format(new Date(plan.created_at), 'PPP p')}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Last Updated</p>
                <p className="text-base">{format(new Date(plan.updated_at), 'PPP p')}</p>
              </div>
              <div className="col-span-2">
                <p className="text-sm font-medium text-muted-foreground">Plan ID</p>
                <p className="text-sm font-mono text-muted-foreground">#{plan.id}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.close')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

