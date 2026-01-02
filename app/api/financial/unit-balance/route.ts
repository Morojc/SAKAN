import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { auth } from '@/lib/auth';

// GET /api/financial/unit-balance?residenceId=1&apartmentNumber=A1
// GET /api/financial/unit-balance?residenceId=1&userId=xxx
// Get complete financial balance for a unit/resident
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
    const apartmentNumber = searchParams.get('apartmentNumber');
    const userId = searchParams.get('userId') || session.user.id;

    if (!residenceId) {
      return NextResponse.json(
        { success: false, error: 'Residence ID is required' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();

    // Get profile_residence_id
    let profileResidenceQuery = supabase
      .from('profile_residences')
      .select('id, apartment_number, profiles(full_name)')
      .eq('residence_id', residenceId)
      .eq('profile_id', userId);

    if (apartmentNumber) {
      profileResidenceQuery = profileResidenceQuery.eq('apartment_number', apartmentNumber);
    }

    const { data: profileResidences, error: prError } = await profileResidenceQuery.limit(1).maybeSingle();

    if (prError || !profileResidences) {
      return NextResponse.json(
        { success: false, error: 'Profile residence not found' },
        { status: 404 }
      );
    }

    const profileResidenceId = profileResidences.id;
    const actualApartmentNumber = profileResidences.apartment_number;

    // Get all contributions (paid and outstanding)
    const { data: contributions } = await supabase
      .from('contributions')
      .select('*')
      .eq('residence_id', residenceId)
      .eq('profile_residence_id', profileResidenceId)
      .order('period_start', { ascending: false });

    // Get all fees
    const { data: fees } = await supabase
      .from('fees')
      .select('*')
      .eq('residence_id', residenceId)
      .eq('user_id', userId)
      .order('due_date', { ascending: false });

    // Get all payments
    const { data: payments } = await supabase
      .from('payments')
      .select('*')
      .eq('residence_id', residenceId)
      .eq('user_id', userId)
      .eq('status', 'verified')
      .order('paid_at', { ascending: false });

    // Calculate totals
    const totalContributionsDue = contributions?.reduce((sum, c) => sum + c.amount_due, 0) || 0;
    const totalContributionsPaid = contributions?.reduce((sum, c) => sum + (c.amount_paid || 0), 0) || 0;
    const outstandingContributions = totalContributionsDue - totalContributionsPaid;

    const totalFeesDue = fees?.reduce((sum, f) => sum + f.amount, 0) || 0;
    const paidFees = fees?.filter(f => f.status === 'paid').reduce((sum, f) => sum + f.amount, 0) || 0;
    const outstandingFees = totalFeesDue - paidFees;

    const totalPayments = payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
    const totalDue = totalContributionsDue + totalFeesDue;
    const totalOutstanding = outstandingContributions + outstandingFees;
    const credit = totalPayments > totalDue ? totalPayments - totalDue : 0;

    // Get payment history (last 10)
    const recentPayments = payments?.slice(0, 10).map((p: any) => ({
      id: p.id,
      date: p.paid_at,
      amount: p.amount,
      type: p.payment_type,
      method: p.method,
      reference: p.reference_number,
    })) || [];

    // Get outstanding items
    const outstandingItems = [
      ...(contributions?.filter(c => c.status !== 'paid').map((c: any) => ({
        id: c.id,
        type: 'contribution',
        description: `Contribution ${c.period_start} to ${c.period_end}`,
        amount_due: c.amount_due,
        amount_paid: c.amount_paid || 0,
        outstanding: c.amount_due - (c.amount_paid || 0),
        due_date: c.due_date,
        status: c.status,
      })) || []),
      ...(fees?.filter(f => f.status !== 'paid').map((f: any) => ({
        id: f.id,
        type: 'fee',
        description: f.title,
        amount_due: f.amount,
        amount_paid: 0,
        outstanding: f.amount,
        due_date: f.due_date,
        status: f.status,
      })) || []),
    ].sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

    return NextResponse.json({
      success: true,
      data: {
        apartment_number: actualApartmentNumber,
        resident_name: (profileResidences as any).profiles?.full_name,
        summary: {
          total_due: totalDue,
          total_paid: totalPayments,
          total_outstanding: totalOutstanding,
          credit: credit,
          contributions: {
            total_due: totalContributionsDue,
            total_paid: totalContributionsPaid,
            outstanding: outstandingContributions,
          },
          fees: {
            total_due: totalFeesDue,
            total_paid: paidFees,
            outstanding: outstandingFees,
          },
        },
        outstanding_items: outstandingItems,
        recent_payments: recentPayments,
      },
    });
  } catch (error: any) {
    console.error('[GET /api/financial/unit-balance] Exception:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

