'use client';

import { useState } from 'react';
import { DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { AlertTriangle } from 'lucide-react';

interface TermsAndConditionsDialogProps {
  onAccept: () => void;
  onCancel: () => void;
}

export default function TermsAndConditionsDialog({ onAccept, onCancel }: TermsAndConditionsDialogProps) {
  const [accepted, setAccepted] = useState(false);

  return (
    <div className="space-y-6">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-red-600">
          <AlertTriangle className="h-5 w-5" />
          Important Information
        </DialogTitle>
        <DialogDescription>
          Please read the following conditions carefully before proceeding.
        </DialogDescription>
      </DialogHeader>

      <div className="bg-muted/50 p-4 rounded-lg text-sm space-y-3 border border-muted">
        <p>
          You are about to initiate a process to transfer your syndic responsibilities to another resident.
        </p>
        <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
          <li>
            You will need to select a replacement resident from your building.
          </li>
          <li>
            A unique access code will be generated for the replacement resident.
          </li>
          <li>
            Once the replacement resident uses the code, all your syndic data (residence management, fees, payments, etc.) will be transferred to him/her.
          </li>
          <li>
            <strong>All your active payments and subscriptions will be canceled immediately.</strong>
          </li>
          <li>
            You will have the option to either permanently delete your account or change your role to a regular resident.
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
          I have read and accept these conditions
        </Label>
      </div>

      <DialogFooter className="gap-2 sm:gap-0">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button 
          onClick={onAccept} 
          disabled={!accepted}
          className="bg-red-600 hover:bg-red-700 text-white"
        >
          Continue
        </Button>
      </DialogFooter>
    </div>
  );
}

