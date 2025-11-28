import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createCashPayment, getBalances, getResidents } from '@/app/actions/payments';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

/**
 * Mobile API: Payments
 * GET /api/mobile/payments - Get all payments
 * POST /api/mobile/payments - Create payment
 * GET /api/mobile/payments/balances - Get balances
 * GET /api/mobile/payments/residents - Get residents for payment
 */

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createSupabaseAdminClient();
    const userId = session.user.id;

    // Get user profile
    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('role, id')
      .eq('id', userId)
      .maybeSingle();

    if (profileError || !userProfile) {
      return NextResponse.json({ success: false, error: 'Failed to fetch user profile' }, { status: 400 });
    }

    // Get residence ID
    let residenceId = null;
    if (userProfile.role === 'syndic') {
      const { data: res } = await supabase.from('residences').select('id').eq('syndic_user_id', userId).maybeSingle();
      residenceId = res?.id;
    } else if (userProfile.role === 'guard') {
      const { data: res } = await supabase.from('residences').select('id').eq('guard_user_id', userId).maybeSingle();
      residenceId = res?.id;
    } else {
      const { data: pr } = await supabase.from('profile_residences').select('residence_id').eq('profile_id', userId).limit(1).maybeSingle();
      residenceId = pr?.residence_id;
    }

    if (!residenceId) {
      return NextResponse.json({ success: false, error: 'User has no residence assigned' }, { status: 400 });
    }

    const searchParams = request.nextUrl.searchParams;
    const method = searchParams.get('method');
    const status = searchParams.get('status');
    const userIdFilter = searchParams.get('user_id'); // For residents to see only their payments

    // Fetch payments
    let paymentsQuery = supabase
      .from('payments')
      .select(`
        *,
        profiles:user_id (
          id,
          full_name
        ),
        residences:residence_id (
          id,
          name
        ),
        fees:fee_id (
          id,
          title,
          amount
        )
      `)
      .eq('residence_id', residenceId);

    // Role-based filtering
    if (userProfile.role === 'resident') {
      paymentsQuery = paymentsQuery.eq('user_id', userId);
    } else if (userIdFilter) {
      paymentsQuery = paymentsQuery.eq('user_id', userIdFilter);
    }

    if (method) {
      paymentsQuery = paymentsQuery.eq('method', method);
    }

    if (status) {
      paymentsQuery = paymentsQuery.eq('status', status);
    }

    const { data: payments, error: paymentsError } = await paymentsQuery.order('paid_at', { ascending: false });

    if (paymentsError) {
      return NextResponse.json({ success: false, error: paymentsError.message }, { status: 400 });
    }

    // Transform payments
    const paymentsWithNames = (payments || []).map((payment: any) => ({
      ...payment,
      user_name: payment.profiles?.full_name || 'Unknown',
      residence_name: payment.residences?.name || 'Unknown',
      fee_title: payment.fees?.title || null,
    }));

    return NextResponse.json({ success: true, data: paymentsWithNames });
  } catch (error: any) {
    console.error('[Mobile API] Payments GET error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    
    // Convert number to bigint if needed (for feeId and residenceId)
    // Note: createCashPayment only supports cash payments currently
    const paymentData: any = {
      userId: body.userId,
      amount: body.amount,
    };
    
    if (body.feeId !== undefined) {
      paymentData.feeId = typeof body.feeId === 'number' ? BigInt(body.feeId) : body.feeId;
    }
    
    if (body.residenceId !== undefined) {
      paymentData.residenceId = typeof body.residenceId === 'number' ? BigInt(body.residenceId) : body.residenceId;
    }
    
    const result = await createCashPayment(paymentData);

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error('[Mobile API] Payments POST error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

