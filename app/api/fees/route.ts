import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { auth } from '@/lib/auth';

// GET /api/fees
// Get all fees for the current user's residence
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const residenceIdParam = searchParams.get('residenceId');

    const supabase = createSupabaseAdminClient();

    // 1. Determine user's residence ID
    // Check if user is syndic or resident
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .maybeSingle();

    let residenceId: number | null = null;

    if (profile?.role === 'syndic') {
      const { data: res } = await supabase
        .from('residences')
        .select('id')
        .eq('syndic_user_id', session.user.id)
        .maybeSingle();
      residenceId = res?.id || null;
    } else if (profile?.role === 'guard') {
      const { data: res } = await supabase
        .from('residences')
        .select('id')
        .eq('guard_user_id', session.user.id)
        .maybeSingle();
      residenceId = res?.id || null;
    } else {
      // Resident
      const { data: pr } = await supabase
        .from('profile_residences')
        .select('residence_id')
        .eq('profile_id', session.user.id)
        .limit(1)
        .maybeSingle();
      residenceId = pr?.residence_id || null;
    }

    if (!residenceId) {
      return NextResponse.json(
        { success: false, error: 'User is not assigned to a residence' },
        { status: 403 }
      );
    }

    // If residenceIdParam is provided, verify it matches
    if (residenceIdParam && parseInt(residenceIdParam) !== residenceId) {
      // Syndics can only access their own residence data
      return NextResponse.json(
        { success: false, error: 'Access denied to this residence' },
        { status: 403 }
      );
    }

    // 2. Fetch fees
    const { data, error } = await supabase
      .from('fees')
      .select(`
        *,
        profiles!fees_user_id_fkey(full_name)
      `)
      .eq('residence_id', residenceId)
      .order('due_date', { ascending: false });

    if (error) {
      console.error('[GET /api/fees] Error fetching fees:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // 3. Enhance with apartment numbers
    const feesWithApartments = await Promise.all(
      (data || []).map(async (fee) => {
        // Try to get apartment number from profile_residences
        const { data: pr } = await supabase
          .from('profile_residences')
          .select('apartment_number')
          .eq('profile_id', fee.user_id)
          .eq('residence_id', residenceId)
          .maybeSingle();

        return {
          ...fee,
          apartment_number: pr?.apartment_number || fee.apartment_number || 'N/A',
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: feesWithApartments,
    });
  } catch (error: any) {
    console.error('[GET /api/fees] Exception:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/fees
// Create a new fee (Syndic only)
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
    const { user_id, residence_id, title, amount, due_date, status } = body;

    // Validation
    if (!user_id || !residence_id || !title || !amount || !due_date) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();

    // 1. Verify user is syndic of the residence
    const { data: residence } = await supabase
      .from('residences')
      .select('syndic_user_id')
      .eq('id', residence_id)
      .maybeSingle();

    if (!residence || residence.syndic_user_id !== session.user.id) {
      return NextResponse.json(
        { success: false, error: 'Only the syndic of this residence can create fees' },
        { status: 403 }
      );
    }

    // 2. Look up profile_residence info for better data linkage
    const { data: pr } = await supabase
      .from('profile_residences')
      .select('id, apartment_number')
      .eq('profile_id', user_id)
      .eq('residence_id', residence_id)
      .maybeSingle();

    // 3. Create fee
    const { data: fee, error } = await supabase
      .from('fees')
      .insert({
        user_id,
        residence_id,
        title,
        amount,
        due_date,
        status: status || 'unpaid',
        created_by: session.user.id,
        fee_type: 'one_time',
        profile_residence_id: pr?.id || null,
        apartment_number: pr?.apartment_number || null,
      })
      .select()
      .single();

    if (error) {
      console.error('[POST /api/fees] Database error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: fee,
      message: 'Fee created successfully',
    });
  } catch (error: any) {
    console.error('[POST /api/fees] Exception:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

