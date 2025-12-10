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

    const searchParams = request.nextUrl.searchParams;
    const method = searchParams.get('method');
    const status = searchParams.get('status');
    const userIdFilter = searchParams.get('user_id'); // For syndics to filter by resident
    const requestedRole = searchParams.get('role') as 'syndic' | 'resident' | null; // Current role from mobile app
    const requestedResidenceId = searchParams.get('residence_id'); // Selected residence when in resident mode

    console.log('[Mobile API] Payments: Role:', requestedRole, 'Residence ID:', requestedResidenceId);

    // Validate user's actual roles
    let hasSyndicRole = false;
    let hasResidentRole = false;
    
    // Check if user is actually a syndic
    const { data: syndicCheck } = await supabase
      .from('residences')
      .select('id')
      .eq('syndic_user_id', userId)
      .maybeSingle();
    hasSyndicRole = !!syndicCheck;
    
    // Check if user is actually a resident
    const { data: residentCheck } = await supabase
      .from('profile_residences')
      .select('profile_id')
      .eq('profile_id', userId)
      .limit(1)
      .maybeSingle();
    hasResidentRole = !!residentCheck;
    
    // Determine the effective role: validate requested role against actual roles
    let effectiveRole = requestedRole || userProfile.role;
    
    // CRITICAL: If user requested syndic but doesn't actually have it, force resident role
    if (effectiveRole === 'syndic' && !hasSyndicRole) {
      console.warn('[Mobile API] Payments: User requested syndic role but doesn\'t have it. Forcing resident role.');
      effectiveRole = 'resident';
    }
    
    // If user requested resident but doesn't have it, this is an error
    if (effectiveRole === 'resident' && !hasResidentRole) {
      return NextResponse.json(
        { success: false, error: 'User is not registered as a resident' },
        { status: 403, headers: getCorsHeaders() }
      );
    }

    // Determine residence ID based on role
    let residenceId: number | null = null;
    let isResidentInResidence = false;

    if (effectiveRole === 'resident') {
      // User is viewing as resident - check profile_residences table
      if (requestedResidenceId) {
        // Verify user is actually a resident in the requested residence
        const parsedResidenceId = parseInt(requestedResidenceId, 10);
        if (!isNaN(parsedResidenceId)) {
          const { data: profileResidence } = await supabase
            .from('profile_residences')
            .select('residence_id')
            .eq('profile_id', userId)
            .eq('residence_id', parsedResidenceId)
            .maybeSingle();
          
          if (profileResidence) {
            residenceId = parsedResidenceId;
            isResidentInResidence = true;
            console.log('[Mobile API] Payments: User is a resident in residence:', residenceId);
          } else {
            console.error('[Mobile API] Payments: User is not a resident in requested residence:', parsedResidenceId);
            return NextResponse.json(
              { success: false, error: 'You are not a resident in this residence.' },
              { status: 403, headers: getCorsHeaders() }
            );
          }
        }
      } else {
        // Get first residence from profile_residences
        const { data: pr } = await supabase
          .from('profile_residences')
          .select('residence_id')
          .eq('profile_id', userId)
          .limit(1)
          .maybeSingle();
        
        if (pr) {
          residenceId = pr.residence_id;
          isResidentInResidence = true;
        }
      }
    } else if (effectiveRole === 'syndic') {
      // User is viewing as syndic - get syndic's residence
      const { data: res } = await supabase
        .from('residences')
        .select('id')
        .eq('syndic_user_id', userId)
        .maybeSingle();
      
      if (res) {
        residenceId = res.id;
        console.log('[Mobile API] Payments: User is a syndic of residence:', residenceId);
      }
    } else if (userProfile.role === 'guard') {
      // User is a guard
      const { data: res } = await supabase
        .from('residences')
        .select('id')
        .eq('guard_user_id', userId)
        .maybeSingle();
      
      if (res) {
        residenceId = res.id;
      }
    }

    if (!residenceId) {
      console.error('[Mobile API] Payments: No residence found for user:', userId, 'Role:', effectiveRole);
      return NextResponse.json(
        { success: false, error: 'User has no residence assigned. Please contact your syndic.' },
        { status: 400, headers: getCorsHeaders() }
      );
    }

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
    // If viewing as resident, only show payments for this user in this residence
    if (effectiveRole === 'resident' && isResidentInResidence) {
      paymentsQuery = paymentsQuery.eq('user_id', userId);
      console.log('[Mobile API] Payments: Filtering payments for resident user:', userId, 'in residence:', residenceId);
    } else if (effectiveRole === 'syndic') {
      // Syndic can see all payments, or filter by specific user if requested
      if (userIdFilter) {
        paymentsQuery = paymentsQuery.eq('user_id', userIdFilter);
        console.log('[Mobile API] Payments: Syndic filtering by user:', userIdFilter);
      } else {
        console.log('[Mobile API] Payments: Syndic viewing all payments for residence:', residenceId);
      }
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

