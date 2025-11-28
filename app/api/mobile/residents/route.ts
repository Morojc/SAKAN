import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createResident } from '@/app/app/residents/actions';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

/**
 * Mobile API: Residents
 * GET /api/mobile/residents - Get all residents
 * POST /api/mobile/residents - Create resident
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

    // Only syndics can view all residents
    if (userProfile.role !== 'syndic') {
      return NextResponse.json({ success: false, error: 'Only syndics can view all residents' }, { status: 403 });
    }

    // Get residence ID
    const { data: residence } = await supabase
      .from('residences')
      .select('id')
      .eq('syndic_user_id', userId)
      .maybeSingle();

    if (!residence) {
      return NextResponse.json({ success: false, error: 'User has no residence assigned' }, { status: 400 });
    }

    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search');
    const role = searchParams.get('role');

    // Fetch residents
    const { data: residentLinks, error: linksError } = await supabase
      .from('profile_residences')
      .select(`
        profile_id,
        apartment_number,
        verified,
        profiles:profile_id (
          id,
          full_name,
          email,
          phone_number,
          role
        )
      `)
      .eq('residence_id', residence.id);

    if (linksError) {
      return NextResponse.json({ success: false, error: linksError.message }, { status: 400 });
    }

    // Transform and filter
    let residents = (residentLinks || [])
      .map((link: any) => ({
        id: link.profile_id,
        full_name: link.profiles?.full_name || 'Unknown',
        email: link.profiles?.email || '',
        phone_number: link.profiles?.phone_number || null,
        apartment_number: link.apartment_number || null,
        role: link.profiles?.role || 'resident',
        verified: link.verified || false,
      }))
      .filter((r: any) => r.role !== 'syndic'); // Exclude syndic

    // Filter by role
    if (role && role !== 'all') {
      residents = residents.filter((r: any) => r.role === role);
    }

    // Filter by search
    if (search) {
      const searchLower = search.toLowerCase();
      residents = residents.filter(
        (r: any) =>
          r.full_name.toLowerCase().includes(searchLower) ||
          r.email.toLowerCase().includes(searchLower) ||
          r.apartment_number?.toLowerCase().includes(searchLower)
      );
    }

    return NextResponse.json({ success: true, data: residents });
  } catch (error: any) {
    console.error('[Mobile API] Residents GET error:', error);
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
    const result = await createResident(body);

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error('[Mobile API] Residents POST error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

