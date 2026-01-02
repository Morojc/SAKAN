'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, CheckCircle2, Loader2, Calendar } from 'lucide-react';
import { createRecurringFee } from '@/app/actions/recurring-fees';
import toast from 'react-hot-toast';
import { useI18n } from '@/lib/i18n/client';

export default function FreshStartSetupPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [amount, setAmount] = useState('');
  const [startMonth, setStartMonth] = useState(new Date().getMonth() + 1);
  const [startYear, setStartYear] = useState(new Date().getFullYear());
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reminderDays, setReminderDays] = useState(7);
  const [creating, setCreating] = useState(false);

  const handleSetup = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid contribution amount');
      return;
    }

    setCreating(true);

    // TODO: Get residence ID from session
    const residenceId = 1;

    const startDate = new Date(startYear, startMonth - 1, 1);

    const result = await createRecurringFee({
      title: 'Monthly Contribution',
      amount: parseFloat(amount),
      startDate,
      residenceId,
      coveragePeriodValue: 1,
      coveragePeriodType: 'month',
      isActive: true,
      reminderDaysBefore: reminderDays,
      reminderEnabled,
    });

    setCreating(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success('Monthly contributions configured successfully!');
    router.push('/app/contributions');
  };

  const monthNames = [
    t('contributions.january'), t('contributions.february'), t('contributions.march'),
    t('contributions.april'), t('contributions.may'), t('contributions.june'),
    t('contributions.july'), t('contributions.august'), t('contributions.september'),
    t('contributions.october'), t('contributions.november'), t('contributions.december')
  ];

  return (
    <div className="space-y-6 max-w-2xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">{t('contributions.configureMonthlyContributions')}</h1>
          <p className="text-muted-foreground mt-1">
            {t('contributions.configureDescription')}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            {t('contributions.monthlyContributionSettings')}
          </CardTitle>
          <CardDescription>
            {t('contributions.settingsApplyAll')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Monthly Amount */}
          <div>
            <Label htmlFor="amount">{t('contributions.monthlyContributionAmount')}</Label>
            <Input
              id="amount"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={t('contributions.amountPlaceholder')}
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              This amount will be charged to each resident every month
            </p>
          </div>

          {/* Start Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="startMonth">Start Month</Label>
              <select
                id="startMonth"
                value={startMonth}
                onChange={(e) => setStartMonth(parseInt(e.target.value))}
                className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-md"
              >
                {monthNames.map((month, index) => (
                  <option key={index} value={index + 1}>
                    {month}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="startYear">Start Year</Label>
              <Input
                id="startYear"
                type="number"
                min={new Date().getFullYear() - 1}
                max={new Date().getFullYear() + 1}
                value={startYear}
                onChange={(e) => setStartYear(parseInt(e.target.value))}
                className="mt-2"
              />
            </div>
          </div>

          {/* Payment Reminders */}
          <div className="space-y-4 border-t pt-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>{t('contributions.emailReminders')}</Label>
                <p className="text-xs text-muted-foreground">
                  {t('contributions.emailRemindersDesc')}
                </p>
              </div>
              <Switch
                checked={reminderEnabled}
                onCheckedChange={setReminderEnabled}
              />
            </div>

            {reminderEnabled && (
              <div>
                <Label htmlFor="reminderDays">{t('contributions.reminderDay')}</Label>
                <Input
                  id="reminderDays"
                  type="number"
                  min="1"
                  max="30"
                  value={reminderDays}
                  onChange={(e) => setReminderDays(parseInt(e.target.value))}
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {t('contributions.reminderDayDesc')}
                </p>
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="font-medium text-blue-900 mb-2">{t('contributions.summary')}</p>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• {t('contributions.amount')}: {amount ? `${amount} MAD` : 'Not set'}</li>
              <li>• {monthNames[startMonth - 1]} {startYear}</li>
              <li>• {reminderEnabled ? `${reminderDays} {t('contributions.email Reminders')}` : t('contributions.emailRemindersDesc')}</li>
              <li>• {t('contributions.afterSetup1')}</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => router.back()}>
              {t('contributions.cancel')}
            </Button>
            <Button onClick={handleSetup} disabled={creating || !amount} className="bg-green-600 hover:bg-green-700 text-white">
              {creating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t('contributions.settingUp')}
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  {t('contributions.completeSetup')}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Info Box */}
      <Card className="bg-gray-50">
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            <strong>What happens next?</strong>
            <br />
            After completing this setup, the system will:
          </p>
          <ul className="text-sm text-muted-foreground mt-2 space-y-1">
            <li>• Generate fees for all verified residents starting from {monthNames[startMonth - 1]} {startYear}</li>
            <li>• Automatically create fees each month going forward</li>
            <li>• Send payment reminders (if enabled)</li>
            <li>• Track payment status for each resident</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

