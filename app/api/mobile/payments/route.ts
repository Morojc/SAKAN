import { NextRequest, NextResponse } from 'next/server';
import { getMobileUser } from '@/lib/auth/mobile';
import { createCashPayment, getBalances, getResidents } from '@/app/actions/payments';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

/**
 * Mobile API: Payments
 * GET /api/mobile/payments - Get all payments (resident-specific)
 * POST /api/mobile/payments - Create payment (syndic only)
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
      console.error('[Mobile API] Payments: No mobile user found');
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401, headers: getCorsHeaders() }
      );
    }

    const supabase = createSupabaseAdminClient();
    const userId = mobileUser.id;

    console.log('[Mobile API] Payments: Fetching payments for user:', userId);

    // Get user profile
    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('role, id')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      console.error('[Mobile API] Payments: Profile error:', profileError);
      return NextResponse.json(
        { success: false, error: `Failed to fetch user profile: ${profileError.message}` },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    if (!userProfile) {
      console.error('[Mobile API] Payments: Profile not found for user:', userId);
      return NextResponse.json(
        { success: false, error: 'User profile not found. Please contact your syndic.' },
        { status: 400, headers: getCorsHeaders() }
      );
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
      console.error('[Mobile API] Payments: No residence found for user:', userId);
      return NextResponse.json(
        { success: false, error: 'User has no residence assigned. Please contact your syndic.' },
        { status: 400, headers: getCorsHeaders() }
      );
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
      console.error('[Mobile API] Payments: Error fetching payments:', paymentsError);
      return NextResponse.json(
        { success: false, error: paymentsError.message },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    // Transform payments
    const paymentsWithNames = (payments || []).map((payment: any) => ({
      ...payment,
      user_name: payment.profiles?.full_name || 'Unknown',
      residence_name: payment.residences?.name || 'Unknown',
      fee_title: payment.fees?.title || null,
    }));

    console.log('[Mobile API] Payments: Returning', paymentsWithNames.length, 'payments');

    return NextResponse.json(
      { success: true, data: paymentsWithNames },
      { headers: getCorsHeaders() }
    );
  } catch (error: any) {
    console.error('[Mobile API] Payments GET error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const mobileUser = await getMobileUser(request);
    if (!mobileUser?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401, headers: getCorsHeaders() }
      );
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
      return NextResponse.json(result, { status: 400, headers: getCorsHeaders() });
    }

    return NextResponse.json(result, { status: 201, headers: getCorsHeaders() });
  } catch (error: any) {
    console.error('[Mobile API] Payments POST error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

