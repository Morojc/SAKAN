'use client';

import { useState } from 'react';
import { DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { AlertTriangle } from 'lucide-react';
import { useI18n } from '@/lib/i18n/client';

interface TermsAndConditionsDialogProps {
  onAccept: () => void;
  onCancel: () => void;
}

export default function TermsAndConditionsDialog({ onAccept, onCancel }: TermsAndConditionsDialogProps) {
  const { t } = useI18n();
  const [accepted, setAccepted] = useState(false);

  return (
    <div className="space-y-6">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-red-600">
          <AlertTriangle className="h-5 w-5" />
          {t('profile.importantInformation')}
        </DialogTitle>
        <DialogDescription>
          {t('profile.readConditionsCarefully')}
        </DialogDescription>
      </DialogHeader>

      <div className="bg-muted/50 p-4 rounded-lg text-sm space-y-3 border border-muted">
        <p>
          {t('profile.aboutToPermanentlyDelete')}
        </p>
        <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
          <li>
            <strong>{t('profile.allPaymentsSubscriptionsCancelled')}</strong>
          </li>
          <li>
            {t('profile.accountAndDataPermanentlyDeleted')}
          </li>
          <li>
            {t('profile.allDataIncludingResidence')}
          </li>
          <li>
            <strong>{t('profile.actionCannotBeUndone')}</strong>
          </li>
        </ul>
      </div>

      <div className="flex items-center space-x-2 pt-2">
        <Checkbox 
          id="terms" 
          checked={accepted} 
          onCheckedChange={(checked) => setAccepted(checked as boolean)} 
          className="border-red-600 data-[state=checked]:bg-red-600 data-[state=checked]:text-white"
        />
        <Label htmlFor="terms" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
          {t('profile.readAndAcceptConditions')}
        </Label>
      </div>

      <DialogFooter className="gap-2 sm:gap-0">
        <Button variant="outline" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button 
          onClick={onAccept} 
          disabled={!accepted}
          className="bg-red-600 hover:bg-red-700 text-white"
        >
          {t('profile.continue')}
        </Button>
      </DialogFooter>
    </div>
  );
}

