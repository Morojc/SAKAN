import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { auth } from '@/lib/auth';
import type { MonthlyReport, AnnualReport } from '@/types/financial.types';

// GET /api/financial/reports?residenceId=1&type=monthly&year=2025&month=1
// GET /api/financial/reports?residenceId=1&type=annual&year=2025
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const residenceId = searchParams.get('residenceId');
    const reportType = searchParams.get('type') || 'monthly';
    const year = searchParams.get('year');
    const month = searchParams.get('month');

    if (!residenceId || !year) {
      return NextResponse.json(
        { success: false, error: 'Residence ID and year are required' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();

    // Check if user is syndic
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .maybeSingle();

    if (profile?.role !== 'syndic') {
      return NextResponse.json(
        { success: false, error: 'Only syndics can view financial reports' },
        { status: 403 }
      );
    }

    if (reportType === 'monthly') {
      if (!month) {
        return NextResponse.json(
          { success: false, error: 'Month is required for monthly reports' },
          { status: 400 }
        );
      }

      const yearNum = parseInt(year);
      const monthNum = parseInt(month);
      const startDate = `${yearNum}-${monthNum.toString().padStart(2, '0')}-01`;
      const endDate = new Date(yearNum, monthNum, 0).toISOString().split('T')[0];

      // Get opening balance (last snapshot before this month)
      const { data: openingSnapshot } = await supabase
        .from('balance_snapshots')
        .select('*')
        .eq('residence_id', residenceId)
        .lt('snapshot_date', startDate)
        .order('snapshot_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Get contributions collected
      const { data: contributions } = await supabase
        .from('payments')
        .select('amount')
        .eq('residence_id', residenceId)
        .eq('payment_type', 'contribution')
        .eq('status', 'verified')
        .gte('paid_at', startDate)
        .lte('paid_at', `${endDate}T23:59:59`);

      // Get fees collected
      const { data: fees } = await supabase
        .from('payments')
        .select('amount')
        .eq('residence_id', residenceId)
        .in('payment_type', ['fee', 'fine'])
        .eq('status', 'verified')
        .gte('paid_at', startDate)
        .lte('paid_at', `${endDate}T23:59:59`);

      // Get expenses
      const { data: expenses } = await supabase
        .from('expenses')
        .select(`
          *,
          expense_categories(name)
        `)
        .eq('residence_id', residenceId)
        .eq('status', 'paid')
        .gte('expense_date', startDate)
        .lte('expense_date', endDate);

      // Get outstanding contributions
      const { data: outstandingContributions } = await supabase
        .from('contributions')
        .select('amount_due, amount_paid')
        .eq('residence_id', residenceId)
        .in('status', ['pending', 'partial', 'overdue']);

      // Get outstanding fees
      const { data: outstandingFees } = await supabase
        .from('fees')
        .select('amount')
        .eq('residence_id', residenceId)
        .eq('status', 'unpaid');

      const totalContributionsCollected = contributions?.reduce((sum, p) => sum + p.amount, 0) || 0;
      const totalFeesCollected = fees?.reduce((sum, p) => sum + p.amount, 0) || 0;
      const totalIncome = totalContributionsCollected + totalFeesCollected;
      const totalExpenses = expenses?.reduce((sum, e) => sum + e.amount, 0) || 0;
      const netChange = totalIncome - totalExpenses;
      const openingBalance = openingSnapshot?.total_balance || 0;
      const closingBalance = openingBalance + netChange;
      const outstandingContributionsTotal = outstandingContributions?.reduce(
        (sum, c) => sum + (c.amount_due - (c.amount_paid || 0)),
        0
      ) || 0;
      const outstandingFeesTotal = outstandingFees?.reduce((sum, f) => sum + f.amount, 0) || 0;

      // Expense breakdown by category
      const expenseBreakdown: Record<string, number> = {};
      expenses?.forEach((expense: any) => {
        const categoryName = expense.expense_categories?.name || 'Uncategorized';
        expenseBreakdown[categoryName] = (expenseBreakdown[categoryName] || 0) + expense.amount;
      });

      const breakdown = Object.entries(expenseBreakdown).map(([category, amount]) => ({
        category,
        amount,
        percentage: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0,
      }));

      const report: MonthlyReport = {
        residence_id: parseInt(residenceId),
        year: yearNum,
        month: monthNum,
        opening_balance: openingBalance,
        closing_balance: closingBalance,
        total_income: totalIncome,
        total_expenses: totalExpenses,
        net_change: netChange,
        contributions_collected: totalContributionsCollected,
        fees_collected: totalFeesCollected,
        outstanding_contributions: outstandingContributionsTotal,
        outstanding_fees: outstandingFeesTotal,
        expense_breakdown: breakdown,
      };

      return NextResponse.json({
        success: true,
        data: report,
      });
    } else if (reportType === 'annual') {
      const yearNum = parseInt(year);
      const startDate = `${yearNum}-01-01`;
      const endDate = `${yearNum}-12-31`;

      // Get opening balance
      const { data: openingSnapshot } = await supabase
        .from('balance_snapshots')
        .select('*')
        .eq('residence_id', residenceId)
        .lt('snapshot_date', startDate)
        .order('snapshot_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Get monthly breakdown
      const monthlyReports: MonthlyReport[] = [];
      for (let m = 1; m <= 12; m++) {
        const monthStart = `${yearNum}-${m.toString().padStart(2, '0')}-01`;
        const monthEnd = new Date(yearNum, m, 0).toISOString().split('T')[0];

        const [contributions, fees, expenses] = await Promise.all([
          supabase
            .from('payments')
            .select('amount')
            .eq('residence_id', residenceId)
            .eq('payment_type', 'contribution')
            .eq('status', 'verified')
            .gte('paid_at', monthStart)
            .lte('paid_at', `${monthEnd}T23:59:59`),
          supabase
            .from('payments')
            .select('amount')
            .eq('residence_id', residenceId)
            .in('payment_type', ['fee', 'fine'])
            .eq('status', 'verified')
            .gte('paid_at', monthStart)
            .lte('paid_at', `${monthEnd}T23:59:59`),
          supabase
            .from('expenses')
            .select('amount')
            .eq('residence_id', residenceId)
            .eq('status', 'paid')
            .gte('expense_date', monthStart)
            .lte('expense_date', monthEnd),
        ]);

        const monthIncome = (contributions.data?.reduce((s, p) => s + p.amount, 0) || 0) +
          (fees.data?.reduce((s, p) => s + p.amount, 0) || 0);
        const monthExpenses = expenses.data?.reduce((s, e) => s + e.amount, 0) || 0;

        monthlyReports.push({
          residence_id: parseInt(residenceId),
          year: yearNum,
          month: m,
          opening_balance: m === 1 ? (openingSnapshot?.total_balance || 0) : 0,
          closing_balance: 0,
          total_income: monthIncome,
          total_expenses: monthExpenses,
          net_change: monthIncome - monthExpenses,
          contributions_collected: contributions.data?.reduce((s, p) => s + p.amount, 0) || 0,
          fees_collected: fees.data?.reduce((s, p) => s + p.amount, 0) || 0,
          outstanding_contributions: 0,
          outstanding_fees: 0,
          expense_breakdown: [],
        });
      }

      // Calculate cumulative balances
      let runningBalance = openingSnapshot?.total_balance || 0;
      monthlyReports.forEach((report) => {
        report.opening_balance = runningBalance;
        runningBalance += report.net_change;
        report.closing_balance = runningBalance;
      });

      // Get expense breakdown by category for the year
      const { data: allExpenses } = await supabase
        .from('expenses')
        .select(`
          amount,
          expense_categories(name)
        `)
        .eq('residence_id', residenceId)
        .eq('status', 'paid')
        .gte('expense_date', startDate)
        .lte('expense_date', endDate);

      const categoryBreakdown: Record<string, number> = {};
      allExpenses?.forEach((expense: any) => {
        const categoryName = expense.expense_categories?.name || 'Uncategorized';
        categoryBreakdown[categoryName] = (categoryBreakdown[categoryName] || 0) + expense.amount;
      });

      const totalExpenses = Object.values(categoryBreakdown).reduce((s, a) => s + a, 0);
      const expenseByCategory = Object.entries(categoryBreakdown).map(([category, amount]) => ({
        category,
        amount,
        percentage: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0,
      }));

      const totalIncome = monthlyReports.reduce((s, r) => s + r.total_income, 0);
      const totalExpensesYear = monthlyReports.reduce((s, r) => s + r.total_expenses, 0);

      const report: AnnualReport = {
        residence_id: parseInt(residenceId),
        year: yearNum,
        opening_balance: openingSnapshot?.total_balance || 0,
        closing_balance: runningBalance,
        total_income: totalIncome,
        total_expenses: totalExpensesYear,
        net_change: totalIncome - totalExpensesYear,
        monthly_breakdown: monthlyReports,
        expense_by_category: expenseByCategory,
      };

      return NextResponse.json({
        success: true,
        data: report,
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid report type' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('[GET /api/financial/reports] Exception:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

