'use client';

import { useState } from 'react';
import { DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { ShieldAlert, UserMinus, UserCog } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ActionSelectionDialogProps {
  onSelect: (action: 'delete_account' | 'change_role') => void;
  onCancel: () => void;
}

export default function ActionSelectionDialog({ onSelect, onCancel }: ActionSelectionDialogProps) {
  const [selectedAction, setSelectedAction] = useState<'delete_account' | 'change_role' | null>(null);

  return (
    <div className="space-y-6">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-orange-600" />
          Choose Action
        </DialogTitle>
        <DialogDescription>
          Decide what should happen to your account after transferring data.
        </DialogDescription>
      </DialogHeader>

      <RadioGroup 
        value={selectedAction || ''} 
        onValueChange={(val) => setSelectedAction(val as 'delete_account' | 'change_role')}
        className="space-y-4"
      >
        <div className={cn(
          "flex items-start space-x-3 space-y-0 rounded-md border p-4 hover:bg-muted/50 transition-colors cursor-pointer",
          selectedAction === 'change_role' ? "border-primary bg-primary/5" : "border-muted"
        )}>
          <RadioGroupItem value="change_role" id="change_role" className="mt-1" />
          <div className="grid gap-1.5 leading-none">
            <Label htmlFor="change_role" className="font-semibold cursor-pointer flex items-center gap-2">
              <UserCog className="h-4 w-4" />
              Change Role to Resident
            </Label>
            <p className="text-sm text-muted-foreground">
              Transfer syndic responsibilities but keep your account. You will become a regular resident in this residence.
            </p>
            <p className="text-xs text-orange-600 mt-1 font-medium">
              All your active subscriptions will be canceled.
            </p>
          </div>
        </div>

        <div className={cn(
          "flex items-start space-x-3 space-y-0 rounded-md border p-4 hover:bg-muted/50 transition-colors cursor-pointer",
          selectedAction === 'delete_account' ? "border-red-500 bg-red-50" : "border-muted"
        )}>
          <RadioGroupItem value="delete_account" id="delete_account" className="mt-1 text-red-600 border-red-600" />
          <div className="grid gap-1.5 leading-none">
            <Label htmlFor="delete_account" className="font-semibold cursor-pointer text-red-600 flex items-center gap-2">
              <UserMinus className="h-4 w-4" />
              Remove Account Immediately
            </Label>
            <p className="text-sm text-muted-foreground">
              Transfer syndic responsibilities and permanently delete your account and all personal data.
            </p>
            <p className="text-xs text-red-600 mt-1 font-medium">
              This action cannot be undone.
            </p>
          </div>
        </div>
      </RadioGroup>

      <DialogFooter className="gap-2 sm:gap-0">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button 
          onClick={() => selectedAction && onSelect(selectedAction)} 
          disabled={!selectedAction}
          variant={selectedAction === 'delete_account' ? "destructive" : "default"}
        >
          Continue
        </Button>
      </DialogFooter>
    </div>
  );
}

