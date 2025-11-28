import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createFee } from '@/app/app/residents/fee-actions';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

/**
 * Mobile API: Fees
 * GET /api/mobile/fees - Get all fees
 * POST /api/mobile/fees - Create fee
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
      return NextResponse.json({ success: false, error: feesError.message }, { status: 400 });
    }

    // Transform fees
    const feesWithNames = (fees || []).map((fee: any) => ({
      ...fee,
      user_name: fee.profiles?.full_name || 'Unknown',
      user_email: fee.profiles?.email || null,
      residence_name: fee.residences?.name || 'Unknown',
    }));

    return NextResponse.json({ success: true, data: feesWithNames });
  } catch (error: any) {
    console.error('[Mobile API] Fees GET error:', error);
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
    const result = await createFee(body);

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error('[Mobile API] Fees POST error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

