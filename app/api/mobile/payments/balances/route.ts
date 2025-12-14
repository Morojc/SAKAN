import { NextRequest, NextResponse } from 'next/server';
import { getMobileUser } from '@/lib/auth/mobile';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { getBalances } from '@/app/actions/payments';

/**
 * Mobile API: Get balances
 * GET /api/mobile/payments/balances
 * Returns resident-specific payment balances and status
 */

function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: getCorsHeaders() });
}

export async function GET(request: NextRequest) {
  try {
    const mobileUser = await getMobileUser(request);
    if (!mobileUser?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401, headers: getCorsHeaders() }
      );
    }

    const supabase = createSupabaseAdminClient();
    const userId = mobileUser.id;

    // Get user profile
    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('role, id')
      .eq('id', userId)
      .maybeSingle();

    if (profileError || !userProfile) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch user profile' },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    // If resident, return resident-specific balances
    if (userProfile.role === 'resident') {
      // Get residence ID
      const { data: prLink } = await supabase
        .from('profile_residences')
        .select('residence_id')
        .eq('profile_id', userId)
        .limit(1)
        .maybeSingle();

      if (!prLink) {
        return NextResponse.json(
          { success: false, error: 'User has no residence assigned' },
          { status: 400, headers: getCorsHeaders() }
        );
      }

      const residenceId = prLink.residence_id;

      // Get fees for this resident
      const { data: fees, error: feesError } = await supabase
        .from('fees')
        .select('amount, status')
        .eq('user_id', userId)
        .eq('residence_id', residenceId);

      if (feesError) {
        return NextResponse.json(
          { success: false, error: feesError.message },
          { status: 400, headers: getCorsHeaders() }
        );
      }

      // Calculate balances
      const totalOwed = (fees || []).reduce((sum: number, fee: any) => {
        if (fee.status === 'unpaid' || fee.status === 'overdue') {
          return sum + Number(fee.amount);
        }
        return sum;
      }, 0);

      const pendingAmount = (fees || []).reduce((sum: number, fee: any) => {
        if (fee.status === 'unpaid') {
          return sum + Number(fee.amount);
        }
        return sum;
      }, 0);

      const overdueAmount = (fees || []).reduce((sum: number, fee: any) => {
        if (fee.status === 'overdue') {
          return sum + Number(fee.amount);
        }
        return sum;
      }, 0);

      // Get payments
      const { data: payments } = await supabase
        .from('payments')
        .select('amount')
        .eq('user_id', userId)
        .eq('residence_id', residenceId)
        .eq('status', 'completed');

      const totalPaid = (payments || []).reduce((sum: number, p: any) => sum + Number(p.amount), 0);

      return NextResponse.json(
        {
          success: true,
          data: {
            totalOwed,
            pendingAmount,
            overdueAmount,
            totalPaid,
            feesCount: fees?.length || 0,
            pendingCount: fees?.filter((f: any) => f.status === 'unpaid').length || 0,
            overdueCount: fees?.filter((f: any) => f.status === 'overdue').length || 0,
          },
        },
        { headers: getCorsHeaders() }
      );
    }

    // For non-residents, use existing balances function
    const searchParams = request.nextUrl.searchParams;
    const residence_id = searchParams.get('residence_id');

    const result = await getBalances(residence_id ? BigInt(residence_id) : undefined);

    if (result.error) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          cashOnHand: result.cashOnHand,
          bankBalance: result.bankBalance,
        },
      },
      { headers: getCorsHeaders() }
    );
  } catch (error: any) {
    console.error('[Mobile API] Payments balances GET error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

