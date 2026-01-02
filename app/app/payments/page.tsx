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
import { Loader2, Search, CheckCircle, XCircle, Eye, Link2, Plus } from 'lucide-react';
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
    try {
      // Load user profile to get role
      const profileResponse = await fetch('/api/current-user-profile');
      const profileResult = await profileResponse.json();
      
      if (profileResult.success && profileResult.data?.role) {
        setUserRole(profileResult.data.role);
        console.log('[Payments] User role:', profileResult.data.role);
      }

      const response = await fetch('/api/user/residence');
      const result = await response.json();

      if (result.success && result.data?.residence_id) {
        setResidenceId(result.data.residence_id);
        console.log('[Payments] Residence ID loaded:', result.data.residence_id);
      } else {
        console.error('[Payments] No residence found:', result);
        // Fallback: Try to get residence from residences table
        const fallbackResponse = await fetch('/api/residences');
        const fallbackResult = await fallbackResponse.json();
        
        if (fallbackResult.success && fallbackResult.data?.length > 0) {
          const firstResidence = fallbackResult.data[0];
          setResidenceId(firstResidence.id);
          console.warn('[Payments] Using fallback residence:', firstResidence);
        } else {
          toast.error('Could not load your residence. Please contact support.');
        }
      }
    } catch (error: any) {
      console.error('[Payments] Error loading residence:', error);
      toast.error('Failed to load residence information');
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
        toast.error(result.error || 'Failed to load payments');
      }
    } catch (error: any) {
      console.error('Error loading payments:', error);
      toast.error('Failed to load payments');
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
        toast.success('Payment verified successfully!');
        loadPayments();
      } else {
        toast.error(result.error || 'Failed to verify payment');
      }
    } catch (error: any) {
      console.error('Error verifying payment:', error);
      toast.error('Failed to verify payment');
    }
  };

  const handleReject = async (id: number) => {
    const reason = prompt('Please enter rejection reason:');
    if (!reason) return;

    try {
      const response = await fetch(`/api/payments/${id}/reject`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejection_reason: reason }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Payment rejected');
        loadPayments();
      } else {
        toast.error(result.error || 'Failed to reject payment');
      }
    } catch (error: any) {
      console.error('Error rejecting payment:', error);
      toast.error('Failed to reject payment');
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
            Verified
          </Badge>
        );
      case 'pending':
        return (
          <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>
        );
      case 'rejected':
        return (
          <Badge className="bg-red-100 text-red-800">
            <XCircle className="w-3 h-3 mr-1" />
            Rejected
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

  if (loading && !residenceId) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Payment Verification</h1>
          <p className="text-muted-foreground mt-1">
            Review and verify resident payments
          </p>
          {/* Debug info - remove in production */}
          {process.env.NODE_ENV === 'development' && (
            <p className="text-xs text-muted-foreground mt-1">
              Debug: ResidenceId={residenceId ? residenceId : 'null'}, Role={userRole || 'loading...'}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!residenceId && (
            <span className="text-sm text-muted-foreground">Loading residence...</span>
          )}
          {residenceId && (
            <Button 
              onClick={() => setShowAddPaymentDialog(true)} 
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Payment
            </Button>
          )}
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Payments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{payments.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending
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
              Verified
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
              Total Amount
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
              <Label htmlFor="search">Search</Label>
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="search"
                  type="text"
                  placeholder="Search by resident, apartment, or reference..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-48">
              <Label htmlFor="status">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="verified">Verified</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payments Table */}
      <Card>
        <CardHeader>
          <CardTitle>Payments ({filteredPayments.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Resident</TableHead>
                  <TableHead>Apartment</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Proof</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="text-center py-12 text-muted-foreground"
                    >
                      No payments found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPayments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>
                        {format(new Date(payment.paid_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="font-medium">
                        {payment.resident_name || 'Unknown'}
                      </TableCell>
                      <TableCell>{payment.apartment_number || 'N/A'}</TableCell>
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
                            No proof
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {payment.status === 'pending' && (
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleVerify(payment.id)}
                              className="bg-green-600 hover:bg-green-700 text-white"
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Verify
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleReject(payment.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <XCircle className="w-4 h-4 mr-1" />
                              Reject
                            </Button>
                          </div>
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
                            Allocate
                          </Button>
                        )}
                        {payment.status === 'rejected' && payment.rejection_reason && (
                          <span className="text-xs text-red-600">
                            {payment.rejection_reason}
                          </span>
                        )}
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
