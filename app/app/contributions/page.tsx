'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Upload,
  Download,
  Loader2,
  Search,
  FileDown,
  Settings,
  Plus,
  PlusCircle,
  Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useI18n } from '@/lib/i18n/client';
import type { ContributionStatusMatrix } from '@/types/financial.types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function ContributionsPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [statusMatrix, setStatusMatrix] = useState<ContributionStatusMatrix[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [searchTerm, setSearchTerm] = useState('');
  const [residenceId, setResidenceId] = useState<number | null>(null);
  const [activePlan, setActivePlan] = useState<{ 
    id: number;
    period_type: string; 
    plan_name: string;
    start_date: string;
    end_date: string | null;
  } | null>(null);
  const [showPlanDialog, setShowPlanDialog] = useState(false);
  const [availablePlans, setAvailablePlans] = useState<any[]>([]);
  const [pendingPeriod, setPendingPeriod] = useState<{ start: string; end: string } | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  const loadUserResidence = async () => {
    try {
      // Load user profile to get role
      const profileResponse = await fetch('/api/current-user-profile');
      const profileResult = await profileResponse.json();
      
      if (profileResult.success && profileResult.data?.role) {
        setUserRole(profileResult.data.role);
      }

      const response = await fetch('/api/user/residence');
      const result = await response.json();

      if (result.success && result.data?.residence_id) {
        setResidenceId(result.data.residence_id);
      } else {
        console.error('[Contributions] No residence found:', result);
        // Don't show error toast immediately, let the user see the empty state or loading
        // If it persists, the API will log it.
        // Fallback: Try to get residence from residences table (if syndic)
        // Note: The API update should handle this now, but keeping fallback just in case
      }
    } catch (error: any) {
      console.error('[Contributions] Exception loading residence:', error);
      toast.error('Failed to load residence information');
    }
  };

  const loadActivePlan = async () => {
    if (!residenceId) return;
    
    try {
      const response = await fetch(`/api/contributions/plans?residenceId=${residenceId}`);
      const result = await response.json();
      
      if (result.success && result.data) {
        const active = result.data.find((p: any) => p.is_active);
        if (active) {
          setActivePlan({ 
            id: active.id,
            period_type: active.period_type, 
            plan_name: active.plan_name,
            start_date: active.start_date,
            end_date: active.end_date,
          });
        } else {
          setActivePlan(null);
        }
      }
    } catch (error: any) {
      console.error('Error loading active plan:', error);
    }
  };

  const loadContributionStatus = async () => {
    if (!residenceId) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/contributions/status?residenceId=${residenceId}&year=${selectedYear}`);
      
      if (!response.ok) {
        throw new Error('Failed to load contribution status');
      }

      const result = await response.json();
      
      if (result.success) {
        setStatusMatrix(result.data || []);
      } else {
        toast.error(result.error || 'Failed to load contribution status');
      }
    } catch (error: any) {
      console.error('Error loading contribution status:', error);
      toast.error(error.message || 'Failed to load contribution status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUserResidence();
  }, []);

  useEffect(() => {
    if (residenceId) {
      loadActivePlan();
      loadContributionStatus();
    }
  }, [selectedYear, residenceId]);

  // Filter data by search term
  const filteredData = statusMatrix.filter(
    (row) =>
      row.apartment_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.resident_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Helper function to format date as YYYY-MM-DD without timezone issues
  const formatDateLocal = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Helper function to calculate current period based on plan's start_date
  const calculatePeriodFromPlan = (plan: { start_date: string; period_type: string }, referenceDate: Date = new Date()) => {
    // Parse plan start date - use local date parsing to avoid timezone issues
    const [planYearStr, planMonthStr, planDayStr] = plan.start_date.split('-');
    const planYear = parseInt(planYearStr, 10);
    const planMonth = parseInt(planMonthStr, 10) - 1; // Convert to 0-based month
    const planDay = parseInt(planDayStr, 10);
    
    // Create plan start date in local timezone
    const planStartDate = new Date(planYear, planMonth, planDay);
    planStartDate.setHours(0, 0, 0, 0);
    
    const currentDate = new Date(referenceDate);
    currentDate.setHours(0, 0, 0, 0); // Normalize to start of day
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();
    
    // If current date is before plan start, always use the first period
    if (currentDate < planStartDate) {
      if (plan.period_type === 'monthly') {
        return {
          start: formatDateLocal(new Date(planYear, planMonth, 1)),
          end: formatDateLocal(new Date(planYear, planMonth + 1, 0)),
        };
      } else if (plan.period_type === 'quarterly') {
        const planQuarter = Math.floor(planMonth / 3);
        return {
          start: formatDateLocal(new Date(planYear, planQuarter * 3, 1)),
          end: formatDateLocal(new Date(planYear, (planQuarter + 1) * 3, 0)),
        };
      } else if (plan.period_type === 'semi_annual') {
        const planHalfYear = Math.floor(planMonth / 6);
        return {
          start: formatDateLocal(new Date(planYear, planHalfYear * 6, 1)),
          end: formatDateLocal(new Date(planYear, (planHalfYear + 1) * 6, 0)),
        };
      } else if (plan.period_type === 'annual') {
        const periodEnd = new Date(planYear + 1, planMonth, planDay);
        periodEnd.setDate(periodEnd.getDate() - 1);
        return {
          start: formatDateLocal(planStartDate),
          end: formatDateLocal(periodEnd),
        };
      }
    }
    
    let periodStart: Date;
    let periodEnd: Date;
    
    if (plan.period_type === 'monthly') {
      // For monthly plans, periods are full months (1st to last day)
      // Calculate which month period we're in based on plan's start month
      const monthsSincePlanStart = (currentYear - planYear) * 12 + (currentMonth - planMonth);
      
      // Current period is the period containing today
      // Period 0 is the month containing plan start, period 1 is the next month, etc.
      // Ensure periodIndex is never negative (can't generate periods before plan starts)
      const periodIndex = Math.max(0, monthsSincePlanStart);
      
      // Calculate period start: first day of the month containing plan start + periodIndex months
      periodStart = new Date(planYear, planMonth + periodIndex, 1);
      periodStart.setHours(0, 0, 0, 0); // Normalize to start of day
      // Period end: last day of the same month
      periodEnd = new Date(planYear, planMonth + periodIndex + 1, 0);
      periodEnd.setHours(0, 0, 0, 0); // Normalize to start of day
      
      // Double-check: ensure period start is not before plan start date
      if (periodStart.getTime() < planStartDate.getTime()) {
        periodStart = new Date(planYear, planMonth, 1); // First day of plan start month
        periodStart.setHours(0, 0, 0, 0);
        periodEnd = new Date(planYear, planMonth + 1, 0); // Last day of plan start month
        periodEnd.setHours(0, 0, 0, 0);
      }
    } else if (plan.period_type === 'quarterly') {
      // Find which quarter the plan starts in (0-3)
      const planQuarter = Math.floor(planMonth / 3);
      // Find which quarter we're currently in
      const currentQuarter = Math.floor(currentMonth / 3);
      
      // Calculate quarters since plan start
      const quartersSincePlanStart = (currentYear - planYear) * 4 + (currentQuarter - planQuarter);
      
      // Ensure periodIndex is never negative
      const periodIndex = Math.max(0, quartersSincePlanStart);
      // Calculate period start: first day of the first month of the quarter containing plan start + periodIndex quarters
      periodStart = new Date(planYear, planQuarter * 3 + periodIndex * 3, 1);
      periodStart.setHours(0, 0, 0, 0); // Normalize to start of day
      // Period end: last day of the quarter
      periodEnd = new Date(planYear, (planQuarter + 1) * 3 + periodIndex * 3, 0);
      periodEnd.setHours(0, 0, 0, 0); // Normalize to start of day
      
      // Double-check: ensure period start is not before plan start date
      if (periodStart.getTime() < planStartDate.getTime()) {
        periodStart = new Date(planYear, planQuarter * 3, 1); // First day of plan start quarter
        periodStart.setHours(0, 0, 0, 0);
        periodEnd = new Date(planYear, (planQuarter + 1) * 3, 0); // Last day of plan start quarter
        periodEnd.setHours(0, 0, 0, 0);
      }
    } else if (plan.period_type === 'semi_annual') {
      // Find which half-year the plan starts in (0 or 1)
      const planHalfYear = Math.floor(planMonth / 6);
      // Find which half-year we're currently in
      const currentHalfYear = Math.floor(currentMonth / 6);
      
      // Calculate half-years since plan start
      const halfYearsSincePlanStart = (currentYear - planYear) * 2 + (currentHalfYear - planHalfYear);
      
      // Ensure periodIndex is never negative
      const periodIndex = Math.max(0, halfYearsSincePlanStart);
      // Calculate period start: first day of the first month of the half-year containing plan start + periodIndex half-years
      periodStart = new Date(planYear, planHalfYear * 6 + periodIndex * 6, 1);
      periodStart.setHours(0, 0, 0, 0); // Normalize to start of day
      // Period end: last day of the half-year
      periodEnd = new Date(planYear, (planHalfYear + 1) * 6 + periodIndex * 6, 0);
      periodEnd.setHours(0, 0, 0, 0); // Normalize to start of day
      
      // Double-check: ensure period start is not before plan start date
      if (periodStart.getTime() < planStartDate.getTime()) {
        periodStart = new Date(planYear, planHalfYear * 6, 1); // First day of plan start half-year
        periodStart.setHours(0, 0, 0, 0);
        periodEnd = new Date(planYear, (planHalfYear + 1) * 6, 0); // Last day of plan start half-year
        periodEnd.setHours(0, 0, 0, 0);
      }
    } else if (plan.period_type === 'annual') {
      // Annual periods: each period is one year from plan start
      const yearsSincePlanStart = currentYear - planYear;
      // Ensure periodIndex is never negative
      const periodIndex = Math.max(0, yearsSincePlanStart);
      
      periodStart = new Date(planYear + periodIndex, planMonth, planDay);
      periodStart.setHours(0, 0, 0, 0); // Normalize to start of day
      periodEnd = new Date(planYear + periodIndex + 1, planMonth, planDay);
      periodEnd.setDate(periodEnd.getDate() - 1); // Last day before next period starts
      periodEnd.setHours(0, 0, 0, 0); // Normalize to start of day
      
      // Double-check: ensure period start is not before plan start date
      if (periodStart.getTime() < planStartDate.getTime()) {
        periodStart = new Date(planStartDate); // Plan start date
        periodStart.setHours(0, 0, 0, 0);
        periodEnd = new Date(planYear + 1, planMonth, planDay);
        periodEnd.setDate(periodEnd.getDate() - 1); // Last day before next period
        periodEnd.setHours(0, 0, 0, 0);
      }
    } else {
      // Default to monthly (fallback)
      const month = currentMonth + 1;
      periodStart = new Date(currentYear, currentMonth, 1);
      periodStart.setHours(0, 0, 0, 0);
      periodEnd = new Date(currentYear, month, 0);
      periodEnd.setHours(0, 0, 0, 0);
    }
    
    // Final validation: ensure period start is not before plan start
    // This is a critical safety check to prevent timezone-related date shifts
    if (periodStart.getTime() < planStartDate.getTime()) {
      console.warn('[calculatePeriodFromPlan] Period start was before plan start, correcting:', {
        calculated_period_start: formatDateLocal(periodStart),
        plan_start_date: formatDateLocal(planStartDate),
        period_type: plan.period_type,
        plan_year: planYear,
        plan_month: planMonth,
        current_year: currentYear,
        current_month: currentMonth,
      });
      
      // Use first period based on plan start
      if (plan.period_type === 'monthly') {
        periodStart = new Date(planYear, planMonth, 1);
        periodEnd = new Date(planYear, planMonth + 1, 0);
      } else if (plan.period_type === 'quarterly') {
        const planQuarter = Math.floor(planMonth / 3);
        periodStart = new Date(planYear, planQuarter * 3, 1);
        periodEnd = new Date(planYear, (planQuarter + 1) * 3, 0);
      } else if (plan.period_type === 'semi_annual') {
        const planHalfYear = Math.floor(planMonth / 6);
        periodStart = new Date(planYear, planHalfYear * 6, 1);
        periodEnd = new Date(planYear, (planHalfYear + 1) * 6, 0);
      } else if (plan.period_type === 'annual') {
        periodStart = new Date(planStartDate);
        const periodEndDate = new Date(planYear + 1, planMonth, planDay);
        periodEndDate.setDate(periodEndDate.getDate() - 1);
        periodEnd = periodEndDate;
      }
      periodStart.setHours(0, 0, 0, 0);
      periodEnd.setHours(0, 0, 0, 0);
    }
    
    return {
      start: formatDateLocal(periodStart),
      end: formatDateLocal(periodEnd),
    };
  };

  const handleGenerateContributions = async (selectedPlanId?: number) => {
    if (!residenceId) {
      toast.error('Residence ID not loaded. Please refresh the page.');
      return;
    }

    if (!activePlan) {
      toast.error('No active contribution plan found. Please create and activate a plan first.');
      return;
    }

    // Calculate period based on plan's start_date
    const period = calculatePeriodFromPlan(activePlan);
    const periodStart = period.start;
    const periodEnd = period.end;

    // Validate that period start is not before plan start
    const planStartDate = new Date(activePlan.start_date);
    const periodStartDate = new Date(periodStart);
    
    if (periodStartDate < planStartDate) {
      console.error('[Contributions] Period calculation error:', {
        plan_start_date: activePlan.start_date,
        calculated_period_start: periodStart,
        current_date: new Date().toISOString().split('T')[0],
      });
      toast.error(`Period calculation error: Period start (${periodStart}) is before plan start (${activePlan.start_date}). Please contact support.`);
      return;
    }

    console.log('[Contributions] Generating period:', {
      plan_start_date: activePlan.start_date,
      plan_period_type: activePlan.period_type,
      calculated_period_start: periodStart,
      calculated_period_end: periodEnd,
      current_date: new Date().toISOString().split('T')[0],
    });

    try {
      const response = await fetch('/api/contributions/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          residence_id: residenceId,
          period_start: periodStart,
          period_end: periodEnd,
          plan_id: selectedPlanId,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success(result.message || 'Contributions generated successfully');
        loadContributionStatus();
        setShowPlanDialog(false);
        setAvailablePlans([]);
      } else {
        // Check if contributions already exist - show available plans
        if (result.already_applied || (result.error && result.error.includes('already exist'))) {
          // Fetch available plans
          const plansResponse = await fetch(
            `/api/contributions/available-plans?residenceId=${residenceId}&periodStart=${periodStart}&periodEnd=${periodEnd}`
          );
          const plansResult = await plansResponse.json();
          
          if (plansResult.success && plansResult.data && plansResult.data.length > 0) {
            setAvailablePlans(plansResult.data);
            setPendingPeriod({ start: periodStart, end: periodEnd });
            setShowPlanDialog(true);
          } else {
            toast.error('Contributions already exist for this period and no other plans are available.');
          }
        } else if (result.error && result.error.includes('No active contribution plan')) {
          toast.error(
            <div>
              No active contribution plan found. 
              <button 
                onClick={() => router.push('/app/contributions/plans')}
                className="underline ml-2 font-bold"
              >
                Create Plan
              </button>
            </div>,
            { duration: 5000 }
          );
        } else {
          toast.error(result.error || 'Failed to generate contributions');
        }
      }
    } catch (error: any) {
      console.error('Error generating contributions:', error);
      toast.error('Failed to generate contributions');
    }
  };

  const handleSelectPlan = (planId: number) => {
    handleGenerateContributions(planId);
  };

  const handleDeleteContribution = async (contributionId: number, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent navigation to payments page
    
    if (!confirm('Are you sure you want to delete this contribution? This action cannot be undone if the contribution has no related payments.')) {
      return;
    }

    try {
      const response = await fetch(`/api/contributions/${contributionId}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Contribution deleted successfully');
        loadContributionStatus();
      } else {
        toast.error(result.error || 'Failed to delete contribution');
      }
    } catch (error: any) {
      console.error('Error deleting contribution:', error);
      toast.error('Failed to delete contribution');
    }
  };

  if (loading && !statusMatrix.length) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const monthNames = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'];
  const quarterNames = ['Q1 (Jan-Mar)', 'Q2 (Avr-Juin)', 'Q3 (Juil-Sept)', 'Q4 (Oct-Déc)'];
  const yearShort = selectedYear.toString().slice(-2);

  // Get column headers based on period type
  // Keys must match what the status API returns
  const getColumnHeaders = () => {
    if (activePlan?.period_type === 'quarterly') {
      return quarterNames.map((q, idx) => ({ 
        key: `Q${idx + 1}-${yearShort}`, // Match API format: "Q1-25"
        label: q 
      }));
    } else if (activePlan?.period_type === 'semi_annual') {
      return [
        { key: `H1-${yearShort}`, label: 'H1 (Jan-Juin)' }, // Match API format: "H1-25"
        { key: `H2-${yearShort}`, label: 'H2 (Juil-Déc)' }  // Match API format: "H2-25"
      ];
    } else if (activePlan?.period_type === 'annual') {
      return [{ key: selectedYear.toString(), label: selectedYear.toString() }]; // Match API format: "2025"
    } else {
      // Monthly (default) - keys already match: "janv-25"
      return monthNames.map((month) => ({ 
        key: `${month}-${yearShort}`, 
        label: `${month}-${yearShort}` 
      }));
    }
  };

  const columnHeaders = getColumnHeaders();

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('contributions.contributionStatus')}</h1>
          <p className="text-muted-foreground mt-1">
            {t('contributions.viewAndManageContributions')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            onClick={() => handleGenerateContributions()}
            className="bg-green-600 hover:bg-green-700 text-white"
            disabled={!activePlan}
          >
            <PlusCircle className="w-4 h-4 mr-2" />
            {activePlan?.period_type === 'quarterly' ? 'Generate This Quarter' :
             activePlan?.period_type === 'semi_annual' ? 'Generate This Half-Year' :
             activePlan?.period_type === 'annual' ? 'Generate This Year' :
             'Generate This Month'}
          </Button>
          <Button 
            variant="outline" 
            onClick={() => router.push('/app/contributions/plans')}
          >
            <Settings className="w-4 h-4 mr-2" />
            {t('contributions.settings')}
          </Button>
          <Button variant="outline">
            <FileDown className="w-4 h-4 mr-2" />
            {t('contributions.export')}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label htmlFor="search">{t('contributions.search')}</Label>
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="search"
                  type="text"
                  placeholder={t('contributions.searchPlaceholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-40">
              <Label htmlFor="year">{t('contributions.year')}</Label>
              <select
                id="year"
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-md"
              >
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('contributions.totalApartments')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredData.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('contributions.fullyPaid')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {filteredData.filter((row) => row.outstanding_months === 0).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('contributions.withOutstanding')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {filteredData.filter((row) => row.outstanding_months > 0).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('contributions.totalOutstanding')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {filteredData.reduce((sum, row) => sum + row.outstanding_months, 0)} {t('contributions.months')}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Contribution Status Table */}
      <Card>
        <CardHeader>
          <CardTitle>SITUATION DES COTISATIONS - {selectedYear}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border px-4 py-3 text-left font-semibold sticky left-0 bg-gray-50 z-10">
                    {t('contributions.apartment')}
                  </th>
                  <th className="border px-4 py-3 text-left font-semibold">{t('contributions.resident')}</th>
                  <th className="border px-4 py-3 text-center font-semibold">{t('contributions.report')}</th>
                  {columnHeaders.map((col) => (
                    <th key={col.key} className="border px-2 py-3 text-center font-semibold">
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredData.map((row, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="border px-4 py-3 font-medium sticky left-0 bg-white z-10">
                      {row.apartment_number}
                    </td>
                    <td className="border px-4 py-3">{row.resident_name}</td>
                    <td className="border px-4 py-3 text-center">
                      {row.outstanding_months > 0 && (
                        <span className="text-red-600 font-medium">
                          {row.outstanding_months.toString().padStart(2, '0')} Mois
                        </span>
                      )}
                    </td>
                    {columnHeaders.map((col) => {
                      // The status API returns period keys that match the column keys
                      // For quarterly: "Q1-25", "Q2-25", etc.
                      // For semi-annual: "H1-25", "H2-25"
                      // For annual: "2025"
                      // For monthly: "janv-25", "févr-25", etc.
                      const status = row.months[col.key] || null;
                      const contributionId = row.contribution_ids?.[col.key];

                      return (
                        <td
                          key={col.key}
                          className={`border px-2 py-3 text-center relative group ${
                            status === 'pending' || status === 'overdue' 
                              ? 'bg-red-100 cursor-pointer hover:bg-red-200' 
                              : status === 'paid' 
                              ? 'bg-green-50' 
                              : status === 'partial'
                              ? 'bg-yellow-50 cursor-pointer hover:bg-yellow-100'
                              : 'bg-gray-50'
                          }`}
                          title={
                            status === 'paid'
                              ? 'Paid'
                              : status === 'pending'
                              ? 'Unpaid - Click to record payment'
                              : status === 'partial'
                              ? 'Partially paid'
                              : status === 'overdue'
                              ? 'Overdue'
                              : `No contribution for this ${activePlan?.period_type === 'quarterly' ? 'quarter' : activePlan?.period_type === 'semi_annual' ? 'half-year' : activePlan?.period_type === 'annual' ? 'year' : 'month'}`
                          }
                          onClick={() => {
                            if (status === 'pending' || status === 'partial' || status === 'overdue') {
                              router.push(`/app/payments?apartmentNumber=${row.apartment_number}`);
                            }
                          }}
                        >
                          {status === 'paid' && <span className="font-bold text-green-700">✓</span>}
                          {status === 'partial' && <span className="font-bold text-yellow-700">½</span>}
                          {(status === 'pending' || status === 'overdue') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                            >
                              <Plus className="w-4 h-4" />
                            </Button>
                          )}
                          {contributionId && userRole === 'syndic' && status !== null && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="absolute top-1 right-1 h-5 w-5 p-0 opacity-0 group-hover:opacity-100 hover:bg-red-100 hover:text-red-700"
                              onClick={(e) => handleDeleteContribution(contributionId, e)}
                              title="Delete contribution (only if no payments)"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredData.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              No data found. Try adjusting your search or filters.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Available Plans Dialog */}
      <Dialog open={showPlanDialog} onOpenChange={setShowPlanDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Plan to Apply</DialogTitle>
            <DialogDescription>
              Contributions already exist for the active plan. Select another plan to apply for this period.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {availablePlans.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No available plans found for this period.
              </p>
            ) : (
              availablePlans.map((plan) => (
                <Card key={plan.id} className="cursor-pointer hover:bg-gray-50" onClick={() => handleSelectPlan(plan.id)}>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold">{plan.plan_name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {plan.period_type.charAt(0).toUpperCase() + plan.period_type.slice(1)} • {plan.amount_per_period} MAD
                        </p>
                        {plan.is_active && (
                          <span className="text-xs text-green-600 font-medium">Active</span>
                        )}
                      </div>
                      <Button size="sm" onClick={(e) => { e.stopPropagation(); handleSelectPlan(plan.id); }}>
                        Apply
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPlanDialog(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
