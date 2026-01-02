'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { useI18n } from '@/lib/i18n/client';

interface Fee {
  id: number;
  user_id: string;
  residence_id: number;
  title: string;
  amount: number;
  due_date: string;
  status: 'unpaid' | 'paid' | 'overdue';
  created_at: string;
  apartment_number?: string;
  profiles?: {
    full_name: string;
  };
}

interface ViewFeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fee: Fee | null;
}

export default function ViewFeeDialog({
  open,
  onOpenChange,
  fee,
}: ViewFeeDialogProps) {
  const { t } = useI18n();

  if (!fee) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-MA', {
      style: 'currency',
      currency: 'MAD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-100 text-green-800">{t('fees.paid')}</Badge>;
      case 'unpaid':
        return <Badge className="bg-yellow-100 text-yellow-800">{t('fees.unpaid')}</Badge>;
      case 'overdue':
        return <Badge className="bg-red-100 text-red-800">{t('fees.overdue')}</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('fees.feeTitle')}: {fee.title}</DialogTitle>
          <DialogDescription>
            {t('fees.view')} fee details
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t('contributions.resident')}</p>
              <p className="text-base font-semibold">{fee.profiles?.full_name || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t('contributions.apartment')}</p>
              <p className="text-base font-semibold">{fee.apartment_number || 'N/A'}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t('contributions.amount')}</p>
              <p className="text-base font-semibold">{formatCurrency(fee.amount)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t('contributions.status')}</p>
              <div className="mt-1">{getStatusBadge(fee.status)}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t('residents.dueDate')}</p>
              <p className="text-base">{format(new Date(fee.due_date), 'PPP')}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t('fees.createdAt')}</p>
              <p className="text-base">{format(new Date(fee.created_at), 'PPP')}</p>
            </div>
          </div>

          <div className="border-t pt-4">
            <p className="text-sm font-medium text-muted-foreground mb-2">Fee ID</p>
            <p className="text-sm font-mono text-muted-foreground">#{fee.id}</p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.close')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

