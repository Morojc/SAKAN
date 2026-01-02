'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Loader2, Edit, Trash2, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useI18n } from '@/lib/i18n/client';
import type { ContributionPlan } from '@/types/financial.types';
import CreatePlanDialog from '@/components/app/contributions/CreatePlanDialog';

export default function ContributionPlansPage() {
  const { t } = useI18n();
  const [plans, setPlans] = useState<ContributionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [residenceId, setResidenceId] = useState<number | null>(null);

  useEffect(() => {
    loadUserResidence();
  }, []);

  useEffect(() => {
    if (residenceId) {
      loadPlans();
    }
  }, [residenceId]);

  const loadUserResidence = async () => {
    try {
      const response = await fetch('/api/user/residence');
      const result = await response.json();

      if (result.success && result.data?.residence_id) {
        setResidenceId(result.data.residence_id);
      } else {
        console.error('No residence found:', result.error);
        // Fallback: Try to get residence from residences table
        const fallbackResponse = await fetch('/api/residences');
        const fallbackResult = await fallbackResponse.json();
        
        if (fallbackResult.success && fallbackResult.data?.length > 0) {
          const firstResidence = fallbackResult.data[0];
          setResidenceId(firstResidence.id);
          toast.error(`Using residence: ${firstResidence.name}. Please link your profile to a residence.`);
        } else {
          toast.error('Could not load your residence. Please contact support.');
        }
      }
    } catch (error: any) {
      console.error('Error loading residence:', error);
      toast.error('Failed to load residence information');
    }
  };

  const loadPlans = async () => {
    if (!residenceId) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/contributions/plans?residenceId=${residenceId}`);
      const result = await response.json();

      if (result.success) {
        setPlans(result.data || []);
      } else {
        toast.error(result.error || 'Failed to load plans');
      }
    } catch (error: any) {
      console.error('Error loading plans:', error);
      toast.error('Failed to load plans');
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async (id: number) => {
    try {
      const response = await fetch(`/api/contributions/plans/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: true }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Plan activated successfully');
        loadPlans();
      } else {
        toast.error(result.error || 'Failed to activate plan');
      }
    } catch (error: any) {
      console.error('Error activating plan:', error);
      toast.error('Failed to activate plan');
    }
  };

  const handleDeactivate = async (id: number) => {
    try {
      const response = await fetch(`/api/contributions/plans/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: false }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Plan deactivated successfully');
        loadPlans();
      } else {
        toast.error(result.error || 'Failed to deactivate plan');
      }
    } catch (error: any) {
      console.error('Error deactivating plan:', error);
      toast.error('Failed to deactivate plan');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this plan?')) {
      return;
    }

    try {
      const response = await fetch(`/api/contributions/plans/${id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Plan deleted successfully');
        loadPlans();
      } else {
        toast.error(result.error || 'Failed to delete plan');
      }
    } catch (error: any) {
      console.error('Error deleting plan:', error);
      toast.error('Failed to delete plan');
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

  const getPeriodLabel = (type: string) => {
    const labels: Record<string, string> = {
      monthly: 'Monthly',
      quarterly: 'Quarterly',
      semi_annual: 'Semi-Annual',
      annual: 'Annual',
    };
    return labels[type] || type;
  };

  if (loading) {
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
          <h1 className="text-3xl font-bold">Contribution Plans</h1>
          <p className="text-muted-foreground mt-1">
            Manage recurring contribution rules for your residence
          </p>
        </div>
        <Button 
          onClick={() => setShowCreateDialog(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Plan
        </Button>
      </div>

      {/* Plans List */}
      <Card>
        <CardHeader>
          <CardTitle>All Plans ({plans.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {plans.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No contribution plans yet.</p>
              <p className="text-sm mt-2">Create your first plan to start managing contributions.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plan Name</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Auto Generate</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell className="font-medium">
                      {plan.plan_name}
                      {plan.description && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {plan.description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="font-semibold">
                      {formatCurrency(plan.amount_per_period)}
                    </TableCell>
                    <TableCell>{getPeriodLabel(plan.period_type)}</TableCell>
                    <TableCell>
                      {new Date(plan.start_date).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {plan.is_active ? (
                        <Badge className="bg-green-100 text-green-800">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <XCircle className="w-3 h-3 mr-1" />
                          Inactive
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {plan.auto_generate ? (
                        <Badge variant="outline" className="text-blue-600">
                          Yes
                        </Badge>
                      ) : (
                        <Badge variant="outline">No</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {plan.is_active ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeactivate(plan.id)}
                          >
                            Deactivate
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleActivate(plan.id)}
                            className="text-green-600 hover:text-green-700"
                          >
                            Activate
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(plan.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Plan Dialog */}
      {residenceId && (
        <CreatePlanDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onSuccess={() => {
            loadPlans();
            setShowCreateDialog(false);
          }}
          residenceId={residenceId}
        />
      )}
    </div>
  );
}

