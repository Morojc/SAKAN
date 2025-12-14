import { NextRequest, NextResponse } from 'next/server';
import { getMobileUser } from '@/lib/auth/mobile';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

/**
 * CORS headers for mobile API
 */
function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

/**
 * Handle OPTIONS request for CORS preflight
 */
export async function OPTIONS() {
  return NextResponse.json({}, { headers: getCorsHeaders() });
}

/**
 * Mobile API: Fees
 * GET /api/mobile/fees - Get all fees
 * POST /api/mobile/fees - Create fee
 */

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
      return NextResponse.json(
        { success: false, error: 'User has no residence assigned' },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const user_id = searchParams.get('user_id'); // Filter by specific user
    const status = searchParams.get('status');

    // Fetch fees
    let feesQuery = supabase
      .from('fees')
      .select(`
        *,
        profiles:user_id (
          id,
          full_name,
          email
        ),
        residences:residence_id (
          id,
          name
        )
      `)
      .eq('residence_id', residenceId);

    // Role-based filtering: residents only see their own fees
    if (userProfile.role === 'resident') {
      feesQuery = feesQuery.eq('user_id', userId);
    } else if (user_id) {
      feesQuery = feesQuery.eq('user_id', user_id);
    }

    if (status) {
      feesQuery = feesQuery.eq('status', status);
    }

    const { data: fees, error: feesError } = await feesQuery.order('due_date', { ascending: false });

    if (feesError) {
      return NextResponse.json(
        { success: false, error: feesError.message },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    // Transform fees
    const feesWithNames = (fees || []).map((fee: any) => ({
      ...fee,
      user_name: fee.profiles?.full_name || 'Unknown',
      user_email: fee.profiles?.email || null,
      residence_name: fee.residences?.name || 'Unknown',
    }));

    return NextResponse.json(
      { success: true, data: feesWithNames },
      { headers: getCorsHeaders() }
    );
  } catch (error: any) {
    console.error('[Mobile API] Fees GET error:', error);
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

    const supabase = createSupabaseAdminClient();
    const userId = mobileUser.id;

    // Get user profile to verify syndic role
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

    // Only syndics can create fees
    if (userProfile.role !== 'syndic') {
      return NextResponse.json(
        { success: false, error: 'Only syndics can create fees' },
        { status: 403, headers: getCorsHeaders() }
      );
    }

    // Get residence ID
    const { data: residence } = await supabase
      .from('residences')
      .select('id')
      .eq('syndic_user_id', userId)
      .maybeSingle();

    if (!residence) {
      return NextResponse.json(
        { success: false, error: 'User has no residence assigned' },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    const body = await request.json();

    // Validate required fields
    if (!body.user_id || !body.title || !body.amount || !body.due_date) {
      return NextResponse.json(
        { success: false, error: 'user_id, title, amount, and due_date are required' },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    // Validate amount
    if (Number(body.amount) <= 0) {
      return NextResponse.json(
        { success: false, error: 'Amount must be greater than 0' },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    // Create fee directly in database
    const { data: newFee, error: createError } = await supabase
      .from('fees')
      .insert({
        user_id: body.user_id,
        residence_id: residence.id,
        title: body.title,
        amount: body.amount,
        due_date: body.due_date,
        status: body.status || 'unpaid',
      })
      .select()
      .single();

    if (createError) {
      console.error('[Mobile API] Fees POST: Error creating fee:', createError);
      return NextResponse.json(
        { success: false, error: createError.message || 'Failed to create fee' },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    return NextResponse.json(
      { success: true, data: newFee },
      { status: 201, headers: getCorsHeaders() }
    );
  } catch (error: any) {
    console.error('[Mobile API] Fees POST error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

