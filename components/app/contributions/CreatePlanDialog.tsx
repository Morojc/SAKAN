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
import { useI18n } from '@/lib/i18n/client';
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
  const { t } = useI18n();
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
      toast.error(t('contributions.plans.planNameRequired'));
      return;
    }
    if (formData.amount_per_period <= 0) {
      toast.error(t('contributions.plans.validAmountRequired'));
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
        toast.success(t('contributions.plans.planCreatedSuccess'));
        onSuccess();
      } else {
        toast.error(result.error || t('contributions.plans.failedToCreatePlan'));
      }
    } catch (error: any) {
      console.error('Error creating plan:', error);
      toast.error(t('contributions.plans.failedToCreatePlan'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('contributions.plans.createPlanTitle')}</DialogTitle>
          <DialogDescription>
            {t('contributions.plans.createPlanDescription')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Plan Name */}
          <div>
            <Label htmlFor="plan_name">{t('contributions.plans.planNameLabel')}</Label>
            <Input
              id="plan_name"
              value={formData.plan_name}
              onChange={(e) => setFormData({ ...formData, plan_name: e.target.value })}
              placeholder={t('contributions.plans.planNamePlaceholder')}
              className="mt-2"
            />
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description">{t('contributions.plans.descriptionLabel')}</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder={t('contributions.plans.descriptionPlaceholder')}
              className="mt-2"
              rows={2}
            />
          </div>

          {/* Amount and Period */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="amount">{t('contributions.plans.amountPerPeriod')}</Label>
              <Input
                id="amount"
                type="number"
                min="0"
                step="0.01"
                value={formData.amount_per_period}
                onChange={(e) => setFormData({ ...formData, amount_per_period: parseFloat(e.target.value) || 0 })}
                placeholder={t('contributions.plans.amountPlaceholder')}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="period_type">{t('contributions.plans.periodType')}</Label>
              <Select
                value={formData.period_type}
                onValueChange={(value: any) => setFormData({ ...formData, period_type: value })}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">{t('contributions.plans.monthly')}</SelectItem>
                  <SelectItem value="quarterly">{t('contributions.plans.quarterly')}</SelectItem>
                  <SelectItem value="semi_annual">{t('contributions.plans.semiAnnual')}</SelectItem>
                  <SelectItem value="annual">{t('contributions.plans.annual')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Start Date */}
          <div>
            <Label htmlFor="start_date">{t('contributions.plans.startDateLabel')}</Label>
            <Input
              id="start_date"
              type="date"
              value={formData.start_date}
              onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {t('contributions.plans.startDateTip')}
            </p>
          </div>

          {/* Generation Settings - Coming Soon */}
          <div className="space-y-3 p-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 opacity-60">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm">{t('contributions.plans.generationSettings')}</h4>
              <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">{t('contributions.plans.comingSoon')}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('contributions.plans.generationSettingsDesc')}
            </p>
          </div>

          {/* Late Fee Settings - Coming Soon */}
          <div className="space-y-3 p-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 opacity-60">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm">{t('contributions.plans.lateFeeSettings')}</h4>
              <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">{t('contributions.plans.comingSoon')}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('contributions.plans.lateFeeSettingsDesc')}
            </p>
          </div>

          {/* Reminder Settings - Coming Soon */}
          <div className="space-y-3 p-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 opacity-60">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm">{t('contributions.plans.reminderSettings')}</h4>
              <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">{t('contributions.plans.comingSoon')}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('contributions.plans.reminderSettingsDesc')}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting} className="bg-blue-600 hover:bg-blue-700 text-white">
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t('contributions.plans.creating')}
              </>
            ) : (
              t('contributions.plans.createPlanButton')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
