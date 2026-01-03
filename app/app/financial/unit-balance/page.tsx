'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, Search, DollarSign, Calendar, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { useI18n } from '@/lib/i18n/client';

interface UnitBalanceData {
  apartment_number: string;
  resident_name: string;
  summary: {
    total_due: number;
    total_paid: number;
    total_outstanding: number;
    credit: number;
    contributions: {
      total_due: number;
      total_paid: number;
      outstanding: number;
    };
    fees: {
      total_due: number;
      total_paid: number;
      outstanding: number;
    };
  };
  outstanding_items: Array<{
    id: number;
    type: 'contribution' | 'fee';
    description: string;
    amount_due: number;
    amount_paid: number;
    outstanding: number;
    due_date: string;
    status: string;
  }>;
  recent_payments: Array<{
    id: number;
    date: string;
    amount: number;
    type: string;
    method: string;
    reference?: string;
  }>;
}

export default function UnitBalancePage() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [residenceId, setResidenceId] = useState(1); // TODO: Get from session
  const [apartmentNumber, setApartmentNumber] = useState('');
  const [balanceData, setBalanceData] = useState<UnitBalanceData | null>(null);
  const [apartments, setApartments] = useState<Array<{ apartment_number: string }>>([]);

  useEffect(() => {
    loadApartments();
  }, []);

  useEffect(() => {
    if (apartmentNumber) {
      loadBalance();
    }
  }, [apartmentNumber]);

  const loadApartments = async () => {
    try {
      const response = await fetch(`/api/contributions/apartments?residenceId=${residenceId}`);
      const result = await response.json();

      if (result.success) {
        setApartments(result.data);
      }
    } catch (error: any) {
      console.error('Error loading apartments:', error);
    }
  };

  const loadBalance = async () => {
    if (!apartmentNumber) return;

    setLoading(true);
    try {
      const params = new URLSearchParams({
        residenceId: residenceId.toString(),
        apartmentNumber,
      });

      const response = await fetch(`/api/financial/unit-balance?${params}`);
      const result = await response.json();

      if (result.success) {
        setBalanceData(result.data);
      } else {
        toast.error(result.error || t('financial.unitBalance.failedToLoadBalance'));
      }
    } catch (error: any) {
      console.error('Error loading balance:', error);
      toast.error(t('financial.unitBalance.failedToLoadBalance'));
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-MA', {
      style: 'currency',
      currency: 'MAD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('financial.unitBalance.title')}</h1>
          <p className="text-muted-foreground mt-1">
            {t('financial.unitBalance.description')}
          </p>
        </div>
      </div>

      {/* Apartment Selector */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="apartment">{t('financial.unitBalance.selectApartment')}</Label>
              <Select value={apartmentNumber} onValueChange={setApartmentNumber}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder={t('financial.unitBalance.selectApartmentPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {apartments.map((apt) => (
                    <SelectItem key={apt.apartment_number} value={apt.apartment_number}>
                      {t('common.apartment')} {apt.apartment_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={loadBalance} disabled={!apartmentNumber || loading}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t('financial.unitBalance.loading')}
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    {t('financial.unitBalance.loadBalance')}
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading && !balanceData ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : balanceData ? (
        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t('financial.unitBalance.totalDue')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {formatCurrency(balanceData.summary.total_due)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t('financial.unitBalance.totalPaid')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(balanceData.summary.total_paid)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t('financial.unitBalance.outstanding')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">
                  {formatCurrency(balanceData.summary.total_outstanding)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t('financial.unitBalance.credit')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {formatCurrency(balanceData.summary.credit)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>{t('financial.unitBalance.contributions')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span>{t('financial.unitBalance.totalDue')}</span>
                  <span className="font-medium">
                    {formatCurrency(balanceData.summary.contributions.total_due)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>{t('financial.unitBalance.totalPaid')}</span>
                  <span className="font-medium text-green-600">
                    {formatCurrency(balanceData.summary.contributions.total_paid)}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t">
                  <span className="font-medium">{t('financial.unitBalance.outstanding')}</span>
                  <span className="font-bold text-yellow-600">
                    {formatCurrency(balanceData.summary.contributions.outstanding)}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('financial.unitBalance.fees')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span>{t('financial.unitBalance.totalDue')}</span>
                  <span className="font-medium">
                    {formatCurrency(balanceData.summary.fees.total_due)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>{t('financial.unitBalance.totalPaid')}</span>
                  <span className="font-medium text-green-600">
                    {formatCurrency(balanceData.summary.fees.total_paid)}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t">
                  <span className="font-medium">{t('financial.unitBalance.outstanding')}</span>
                  <span className="font-bold text-yellow-600">
                    {formatCurrency(balanceData.summary.fees.outstanding)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Outstanding Items */}
          {balanceData.outstanding_items.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t('financial.unitBalance.outstandingItems')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('financial.unitBalance.type')}</TableHead>
                        <TableHead>{t('financial.unitBalance.description')}</TableHead>
                        <TableHead>{t('financial.unitBalance.dueDate')}</TableHead>
                        <TableHead>{t('financial.unitBalance.amountDue')}</TableHead>
                        <TableHead>{t('financial.unitBalance.amountPaid')}</TableHead>
                        <TableHead>{t('financial.unitBalance.outstanding')}</TableHead>
                        <TableHead>{t('financial.unitBalance.status')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {balanceData.outstanding_items.map((item) => (
                        <TableRow key={`${item.type}-${item.id}`}>
                          <TableCell>
                            <Badge
                              variant={item.type === 'contribution' ? 'default' : 'secondary'}
                            >
                              {item.type}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">{item.description}</TableCell>
                          <TableCell>
                            {format(new Date(item.due_date), 'MMM d, yyyy')}
                          </TableCell>
                          <TableCell>{formatCurrency(item.amount_due)}</TableCell>
                          <TableCell className="text-green-600">
                            {formatCurrency(item.amount_paid)}
                          </TableCell>
                          <TableCell className="font-semibold text-yellow-600">
                            {formatCurrency(item.outstanding)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                item.status === 'overdue'
                                  ? 'destructive'
                                  : item.status === 'paid'
                                    ? 'default'
                                    : 'secondary'
                              }
                            >
                              {item.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Payments */}
          {balanceData.recent_payments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t('financial.unitBalance.recentPayments')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('financial.unitBalance.date')}</TableHead>
                        <TableHead>{t('financial.unitBalance.type')}</TableHead>
                        <TableHead>{t('financial.unitBalance.method')}</TableHead>
                        <TableHead>{t('payments.amount')}</TableHead>
                        <TableHead>{t('financial.unitBalance.reference')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {balanceData.recent_payments.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell>
                            {format(new Date(payment.date), 'MMM d, yyyy')}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{payment.type}</Badge>
                          </TableCell>
                          <TableCell className="capitalize">{payment.method}</TableCell>
                          <TableCell className="font-semibold text-green-600">
                            {formatCurrency(payment.amount)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {payment.reference || '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {t('financial.unitBalance.selectApartmentToView')}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
