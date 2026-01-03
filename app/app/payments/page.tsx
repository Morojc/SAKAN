'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Search, CheckCircle, XCircle, Eye, Link2, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useI18n } from '@/lib/i18n/client';
import type { Payment } from '@/types/financial.types';
import { format } from 'date-fns';
import AllocatePaymentDialog from '@/components/app/payments/AllocatePaymentDialog';
import AddPaymentDialog from '@/components/app/payments/AddPaymentDialog';

export default function PaymentsPage() {
  const { t } = useI18n();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [residenceId, setResidenceId] = useState<number | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [showAllocateDialog, setShowAllocateDialog] = useState(false);
  const [showAddPaymentDialog, setShowAddPaymentDialog] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);

  useEffect(() => {
    loadUserResidence();
  }, []);

  useEffect(() => {
    if (residenceId) {
      loadPayments();
    }
  }, [statusFilter, residenceId]);

  const loadUserResidence = async () => {
    setLoading(true);
    try {
      // Load user profile to get role
      const profileResponse = await fetch('/api/current-user-profile');
      const profileResult = await profileResponse.json();
      
      if (profileResult.success && profileResult.data?.role) {
        setUserRole(profileResult.data.role);
        if (process.env.NODE_ENV === 'development') {
          console.log('[Payments] User role:', profileResult.data.role);
        }
      } else {
        // Set a default or handle missing role - don't block the page
        console.warn('[Payments] Could not load user role, defaulting to resident');
        setUserRole('resident'); // Default fallback to prevent infinite loading
      }

      const response = await fetch('/api/user/residence');
      const result = await response.json();

      if (result.success && result.data?.residence_id) {
        setResidenceId(result.data.residence_id);
        if (process.env.NODE_ENV === 'development') {
          console.log('[Payments] Residence ID loaded:', result.data.residence_id);
        }
      } else {
        console.error('[Payments] No residence found:', result);
        // Fallback: Try to get residence from residences table
        try {
          const fallbackResponse = await fetch('/api/residences');
          const fallbackResult = await fallbackResponse.json();
          
          if (fallbackResult.success && fallbackResult.data?.length > 0) {
            const firstResidence = fallbackResult.data[0];
            setResidenceId(firstResidence.id);
            if (process.env.NODE_ENV === 'development') {
              console.warn('[Payments] Using fallback residence:', firstResidence);
            }
          } else {
            console.warn('[Payments] No fallback residence found');
            // Don't show error toast here, just log it
          }
        } catch (fallbackError) {
          console.error('[Payments] Fallback residence fetch failed:', fallbackError);
        }
      }
    } catch (error: any) {
      console.error('[Payments] Error loading residence:', error);
      toast.error(t('payments.failedToLoadResidence'));
    } finally {
      setLoading(false);
    }
  };

  const loadPayments = async () => {
    if (!residenceId) return;
    
    setLoading(true);
    try {
      const response = await fetch(
        `/api/payments?residenceId=${residenceId}&status=${statusFilter}`
      );
      const result = await response.json();

      if (result.success) {
        setPayments(result.data || []);
      } else {
        toast.error(result.error || t('payments.failedToLoadPayments'));
      }
    } catch (error: any) {
      console.error('Error loading payments:', error);
      toast.error(t('payments.failedToLoadPayments'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (id: number) => {
    try {
      const response = await fetch(`/api/payments/${id}/verify`, {
        method: 'PUT',
      });

      const result = await response.json();

      if (result.success) {
        toast.success(t('payments.paymentVerifiedSuccess'));
        loadPayments();
      } else {
        toast.error(result.error || t('payments.failedToVerifyPayment'));
      }
    } catch (error: any) {
      console.error('Error verifying payment:', error);
      toast.error(t('payments.failedToVerifyPayment'));
    }
  };

  const handleReject = async (id: number) => {
    const reason = prompt(t('payments.rejectionReasonPrompt'));
    if (!reason) return;

    try {
      const response = await fetch(`/api/payments/${id}/reject`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejection_reason: reason }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success(t('payments.paymentRejected'));
        loadPayments();
      } else {
        toast.error(result.error || t('payments.failedToRejectPayment'));
      }
    } catch (error: any) {
      console.error('Error rejecting payment:', error);
      toast.error(t('payments.failedToRejectPayment'));
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t('payments.deletePaymentConfirm'))) {
      return;
    }

    try {
      const response = await fetch(`/api/payments/${id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        toast.success(t('payments.paymentDeletedSuccess'));
        loadPayments();
      } else {
        toast.error(result.error || t('payments.failedToDeletePayment'));
      }
    } catch (error: any) {
      console.error('Error deleting payment:', error);
      toast.error(t('payments.failedToDeletePayment'));
    }
  };

  const filteredPayments = payments.filter((payment) => {
    const matchesSearch =
      payment.resident_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.apartment_number?.includes(searchTerm) ||
      payment.reference_number?.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesSearch;
  });

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
      case 'verified':
        return (
          <Badge className="bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            {t('payments.verified')}
          </Badge>
        );
      case 'pending':
        return (
          <Badge className="bg-yellow-100 text-yellow-800">{t('payments.pending')}</Badge>
        );
      case 'rejected':
        return (
          <Badge className="bg-red-100 text-red-800">
            <XCircle className="w-3 h-3 mr-1" />
            {t('payments.rejected')}
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getPaymentTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      contribution: 'bg-blue-100 text-blue-800',
      fee: 'bg-purple-100 text-purple-800',
      fine: 'bg-red-100 text-red-800',
      deposit: 'bg-green-100 text-green-800',
    };
    return (
      <Badge className={colors[type] || 'bg-gray-100 text-gray-800'}>
        {type}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!residenceId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <p className="text-lg text-muted-foreground">{t('payments.noResidenceFound')}</p>
        <p className="text-sm text-muted-foreground">{t('payments.contactSupport')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('payments.verificationTitle')}</h1>
          <p className="text-muted-foreground mt-1">
            {t('payments.verificationDescription')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {residenceId && (userRole === 'syndic' || userRole === 'guard') && (
            <Button 
              onClick={() => setShowAddPaymentDialog(true)} 
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              {t('payments.addPayment')}
            </Button>
          )}
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('payments.totalPayments')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{payments.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('payments.pending')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {payments.filter((p) => p.status === 'pending').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('payments.verified')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {payments.filter((p) => p.status === 'verified').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('payments.totalAmount')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(
                payments.reduce((sum, p) => sum + p.amount, 0)
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label htmlFor="search">{t('common.search')}</Label>
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="search"
                  type="text"
                  placeholder={t('payments.searchPlaceholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-48">
              <Label htmlFor="status">{t('payments.status')}</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">{t('payments.pending')}</SelectItem>
                  <SelectItem value="verified">{t('payments.verified')}</SelectItem>
                  <SelectItem value="rejected">{t('payments.rejected')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payments Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t('payments.title')} ({filteredPayments.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('payments.date')}</TableHead>
                  <TableHead>{t('payments.resident')}</TableHead>
                  <TableHead>{t('payments.apartment')}</TableHead>
                  <TableHead>{t('payments.type')}</TableHead>
                  <TableHead>{t('payments.amount')}</TableHead>
                  <TableHead>{t('payments.method')}</TableHead>
                  <TableHead>{t('payments.status')}</TableHead>
                  <TableHead>{t('payments.proof')}</TableHead>
                  <TableHead className="text-right">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="text-center py-12 text-muted-foreground"
                    >
                      {t('payments.noPaymentsFound')}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPayments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>
                        {format(new Date(payment.paid_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="font-medium">
                        {payment.resident_name || t('common.unknown')}
                      </TableCell>
                      <TableCell>{payment.apartment_number || t('common.na')}</TableCell>
                      <TableCell>{getPaymentTypeBadge(payment.payment_type)}</TableCell>
                      <TableCell className="font-semibold">
                        {formatCurrency(payment.amount)}
                      </TableCell>
                      <TableCell className="capitalize">
                        {payment.method.replace('_', ' ')}
                      </TableCell>
                      <TableCell>{getStatusBadge(payment.status)}</TableCell>
                      <TableCell>
                        {payment.proof_url ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(payment.proof_url, '_blank')}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            {t('payments.noProof')}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {payment.status === 'pending' && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handleVerify(payment.id)}
                                className="bg-green-600 hover:bg-green-700 text-white"
                              >
                                <CheckCircle className="w-4 h-4 mr-1" />
                                {t('payments.verify')}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleReject(payment.id)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <XCircle className="w-4 h-4 mr-1" />
                                {t('payments.reject')}
                              </Button>
                            </>
                          )}
                          {payment.status === 'verified' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedPayment(payment);
                                setShowAllocateDialog(true);
                              }}
                              className="text-blue-600 hover:text-blue-700"
                            >
                              <Link2 className="w-4 h-4 mr-1" />
                              {t('payments.allocate')}
                            </Button>
                          )}
                          {payment.status === 'rejected' && payment.rejection_reason && (
                            <span className="text-xs text-red-600">
                              {payment.rejection_reason}
                            </span>
                          )}
                          {/* Delete button - only for syndics */}
                          {userRole && userRole === 'syndic' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(payment.id)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add Payment Dialog */}
      <AddPaymentDialog
        open={showAddPaymentDialog}
        onOpenChange={setShowAddPaymentDialog}
        onSuccess={() => {
          loadPayments();
          setShowAddPaymentDialog(false);
        }}
      />

      {/* Allocate Payment Dialog */}
      <AllocatePaymentDialog
        open={showAllocateDialog}
        onOpenChange={setShowAllocateDialog}
        payment={selectedPayment}
        onSuccess={() => {
          loadPayments();
          setShowAllocateDialog(false);
        }}
      />
    </div>
  );
}
