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
import { Plus, Loader2, Edit, Trash2, CheckCircle, XCircle, ArrowLeft, Eye } from 'lucide-react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useI18n } from '@/lib/i18n/client';
import type { ContributionPlan } from '@/types/financial.types';
import CreatePlanDialog from '@/components/app/contributions/CreatePlanDialog';
import ViewPlanDialog from '@/components/app/contributions/ViewPlanDialog';

export default function ContributionPlansPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [plans, setPlans] = useState<ContributionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<ContributionPlan | null>(null);
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
          toast.error(t('contributions.plans.usingResidence', { name: firstResidence.name }));
        } else {
          toast.error(t('contributions.plans.couldNotLoadResidence'));
        }
      }
    } catch (error: any) {
      console.error('Error loading residence:', error);
      toast.error(t('contributions.plans.failedToLoadResidence'));
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
        toast.error(result.error || t('contributions.plans.failedToLoadPlans'));
      }
    } catch (error: any) {
      console.error('Error loading plans:', error);
      toast.error(t('contributions.plans.failedToLoadPlans'));
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
        toast.success(t('contributions.plans.planActivatedSuccess'));
        loadPlans();
      } else {
        toast.error(result.error || t('contributions.plans.failedToActivatePlan'));
      }
    } catch (error: any) {
      console.error('Error activating plan:', error);
      toast.error(t('contributions.plans.failedToActivatePlan'));
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
        toast.success(t('contributions.plans.planDeactivatedSuccess'));
        loadPlans();
      } else {
        toast.error(result.error || t('contributions.plans.failedToDeactivatePlan'));
      }
    } catch (error: any) {
      console.error('Error deactivating plan:', error);
      toast.error(t('contributions.plans.failedToDeactivatePlan'));
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t('contributions.plans.deletePlanConfirm'))) {
      return;
    }

    try {
      const response = await fetch(`/api/contributions/plans/${id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        toast.success(t('contributions.plans.planDeletedSuccess'));
        loadPlans();
      } else {
        toast.error(result.error || t('contributions.plans.failedToDeletePlan'));
      }
    } catch (error: any) {
      console.error('Error deleting plan:', error);
      toast.error(t('contributions.plans.failedToDeletePlan'));
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
      monthly: t('contributions.plans.monthly'),
      quarterly: t('contributions.plans.quarterly'),
      semi_annual: t('contributions.plans.semiAnnual'),
      annual: t('contributions.plans.annual'),
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
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => router.push('/app/contributions')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('contributions.plans.backToContributions')}
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{t('contributions.plans.title')}</h1>
            <p className="text-muted-foreground mt-1">
              {t('contributions.plans.managePlans')}
            </p>
          </div>
        </div>
        <Button 
          onClick={() => setShowCreateDialog(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          {t('contributions.plans.createPlan')}
        </Button>
      </div>

      {/* Plans List */}
      <Card>
        <CardHeader>
          <CardTitle>{t('contributions.plans.allPlans')} ({plans.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {plans.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>{t('contributions.plans.noPlansYet')}</p>
              <p className="text-sm mt-2">{t('contributions.plans.createFirstPlan')}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('contributions.plans.planName')}</TableHead>
                  <TableHead>{t('contributions.plans.amount')}</TableHead>
                  <TableHead>{t('contributions.plans.period')}</TableHead>
                  <TableHead>{t('contributions.plans.startDate')}</TableHead>
                  <TableHead>{t('contributions.plans.status')}</TableHead>
                  <TableHead>{t('contributions.plans.autoGenerate')}</TableHead>
                  <TableHead className="text-right">{t('contributions.plans.actions')}</TableHead>
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
                          {t('contributions.plans.active')}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <XCircle className="w-3 h-3 mr-1" />
                          {t('contributions.plans.inactive')}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {plan.auto_generate ? (
                        <Badge variant="outline" className="text-blue-600">
                          {t('contributions.plans.yes')}
                        </Badge>
                      ) : (
                        <Badge variant="outline">{t('contributions.plans.no')}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedPlan(plan);
                            setShowViewDialog(true);
                          }}
                          className="text-blue-600 hover:text-blue-700"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        {plan.is_active ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeactivate(plan.id)}
                          >
                            {t('contributions.plans.deactivate')}
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleActivate(plan.id)}
                            className="text-green-600 hover:text-green-700"
                          >
                            {t('contributions.plans.activate')}
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

      {/* View Plan Dialog */}
      <ViewPlanDialog
        open={showViewDialog}
        onOpenChange={setShowViewDialog}
        plan={selectedPlan}
      />
    </div>
  );
}

