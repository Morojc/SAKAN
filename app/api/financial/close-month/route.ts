import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { auth } from '@/lib/auth';

// POST /api/financial/close-month
// Closes a financial period (month) and creates a balance snapshot
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { residence_id, year, month, cash_balance, bank_balance, notes } = body;

    if (!residence_id || !year || !month) {
      return NextResponse.json(
        { success: false, error: 'Residence ID, year, and month are required' },
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
        { success: false, error: 'Only syndics can close financial periods' },
        { status: 403 }
      );
    }

    // Check if period is already closed
    const periodStart = `${year}-${month.toString().padStart(2, '0')}-01`;
    const periodEnd = new Date(year, month, 0).toISOString().split('T')[0];

    const { data: existingSnapshot } = await supabase
      .from('balance_snapshots')
      .select('id')
      .eq('residence_id', residence_id)
      .eq('period_start', periodStart)
      .maybeSingle();

    if (existingSnapshot) {
      return NextResponse.json(
        { success: false, error: 'This period has already been closed' },
        { status: 400 }
      );
    }

    // Calculate financial metrics
    const { data: contributions } = await supabase
      .from('payments')
      .select('amount')
      .eq('residence_id', residence_id)
      .eq('payment_type', 'contribution')
      .eq('status', 'verified')
      .gte('paid_at', periodStart)
      .lte('paid_at', `${periodEnd}T23:59:59`);

    const { data: fees } = await supabase
      .from('payments')
      .select('amount')
      .eq('residence_id', residence_id)
      .in('payment_type', ['fee', 'fine'])
      .eq('status', 'verified')
      .gte('paid_at', periodStart)
      .lte('paid_at', `${periodEnd}T23:59:59`);

    const { data: expenses } = await supabase
      .from('expenses')
      .select('amount')
      .eq('residence_id', residence_id)
      .eq('status', 'paid')
      .gte('expense_date', periodStart)
      .lte('expense_date', periodEnd);

    const { data: outstandingContributions } = await supabase
      .from('contributions')
      .select('amount_due, amount_paid')
      .eq('residence_id', residence_id)
      .in('status', ['pending', 'partial', 'overdue']);

    const { data: outstandingFees } = await supabase
      .from('fees')
      .select('amount')
      .eq('residence_id', residence_id)
      .eq('status', 'unpaid');

    const totalContributionsCollected = contributions?.reduce((sum, p) => sum + p.amount, 0) || 0;
    const totalFeesCollected = fees?.reduce((sum, p) => sum + p.amount, 0) || 0;
    const totalExpenses = expenses?.reduce((sum, e) => sum + e.amount, 0) || 0;
    const netChange = (totalContributionsCollected + totalFeesCollected) - totalExpenses;
    const outstandingContributionsTotal = outstandingContributions?.reduce(
      (sum, c) => sum + (c.amount_due - (c.amount_paid || 0)),
      0
    ) || 0;
    const outstandingFeesTotal = outstandingFees?.reduce((sum, f) => sum + f.amount, 0) || 0;

    // Get previous balance
    const { data: previousSnapshot } = await supabase
      .from('balance_snapshots')
      .select('total_balance')
      .eq('residence_id', residence_id)
      .lt('snapshot_date', periodStart)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    const previousBalance = previousSnapshot?.total_balance || 0;
    const calculatedBalance = previousBalance + netChange;

    // Use provided balances or calculated
    const finalCashBalance = cash_balance ?? (calculatedBalance * 0.3); // Estimate if not provided
    const finalBankBalance = bank_balance ?? (calculatedBalance * 0.7); // Estimate if not provided

    // Create balance snapshot
    const { data: snapshot, error: snapshotError } = await supabase
      .from('balance_snapshots')
      .insert({
        residence_id,
        snapshot_date: periodEnd,
        cash_balance: finalCashBalance,
        bank_balance: finalBankBalance,
        period_start: periodStart,
        period_end: periodEnd,
        total_contributions_collected: totalContributionsCollected,
        total_fees_collected: totalFeesCollected,
        total_expenses: totalExpenses,
        net_change: netChange,
        outstanding_contributions: outstandingContributionsTotal,
        outstanding_fees: outstandingFeesTotal,
        notes: notes || `Monthly closing for ${year}-${month.toString().padStart(2, '0')}`,
        created_by: session.user.id,
      })
      .select()
      .single();

    if (snapshotError) {
      console.error('[POST /api/financial/close-month] Error:', snapshotError);
      return NextResponse.json(
        { success: false, error: snapshotError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: snapshot,
      message: `Period ${year}-${month.toString().padStart(2, '0')} closed successfully`,
    });
  } catch (error: any) {
    console.error('[POST /api/financial/close-month] Exception:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

