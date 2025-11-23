'use client';

import { DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Copy, Check, Mail, KeyRound } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'react-hot-toast';

interface AccessCodeDisplayProps {
  code: string;
  replacementEmail: string;
  actionType: 'delete_account' | 'change_role';
  onClose: () => void;
}

export default function AccessCodeDisplay({ code, replacementEmail, actionType, onClose }: AccessCodeDisplayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success('Access code copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-green-600">
          <KeyRound className="h-5 w-5" />
          Access Code Generated
        </DialogTitle>
        <DialogDescription>
          The replacement process has been initiated.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center space-y-2">
          <p className="text-sm text-green-800 font-medium">
            Share this code with the replacement resident:
          </p>
          <div className="flex items-center justify-center gap-2">
            <code className="text-3xl font-mono font-bold tracking-wider text-green-900 bg-white px-4 py-2 rounded border border-green-100 shadow-sm">
              {code}
            </code>
            <Button size="icon" variant="ghost" onClick={handleCopy} className="h-10 w-10 text-green-700 hover:text-green-900 hover:bg-green-100">
              {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        <div className="text-sm space-y-3 bg-muted/30 p-4 rounded-lg">
          <h4 className="font-semibold flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Instructions sent to {replacementEmail}
          </h4>
          <ol className="list-decimal pl-5 space-y-2 text-muted-foreground">
            <li>Ask the replacement resident to go to the Sign In page.</li>
            <li>Enter the access code above in the "Access Code" field.</li>
            <li>Sign in with their Google account ({replacementEmail}).</li>
            <li>
              {actionType === 'delete_account' 
                ? "Once they sign in, your account will be permanently deleted."
                : "Once they sign in, your role will change to 'Resident'."}
            </li>
          </ol>
        </div>

        <p className="text-xs text-center text-muted-foreground italic">
          Note: The code expires in 7 days.
        </p>
      </div>

      <DialogFooter>
        <Button onClick={onClose} className="w-full sm:w-auto">
          Close
        </Button>
      </DialogFooter>
    </div>
  );
}

