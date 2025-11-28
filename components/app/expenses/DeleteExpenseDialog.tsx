'use client';

import { Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Expense } from './ExpensesContent';

interface DeleteExpenseDialogProps {
  open: boolean;
  expense: Expense | null;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * Delete Expense Dialog Component
 * Confirmation dialog for deleting expenses
 */
export default function DeleteExpenseDialog({
  open,
  expense,
  onClose,
  onConfirm,
}: DeleteExpenseDialogProps) {
  console.log('[DeleteExpenseDialog] Dialog', open ? 'opened' : 'closed', 'for expense:', expense?.id);

  if (!expense) return null;

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-MA', {
      style: 'currency',
      currency: 'MAD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Delete Expense
          </DialogTitle>
          <DialogDescription>
            This action cannot be undone. This will permanently delete the expense record.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Are you sure you want to delete this expense?
              <div className="mt-2 space-y-1">
                <p className="font-semibold">{expense.description}</p>
                <p className="text-sm">
                  {expense.category} • {formatCurrency(Number(expense.amount))}
                </p>
              </div>
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm}>
            Delete Expense
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

