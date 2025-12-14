import { NextRequest, NextResponse } from 'next/server';
import { getMobileUser } from '@/lib/auth/mobile';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

/**
 * CORS headers for mobile API
 */
function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
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
 * Mobile API: Resident by ID
 * GET /api/mobile/residents/[id] - Get resident details
 * PATCH /api/mobile/residents/[id] - Update resident
 * DELETE /api/mobile/residents/[id] - Delete resident
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const mobileUser = await getMobileUser(request);
    if (!mobileUser?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401, headers: getCorsHeaders() }
      );
    }

    const supabase = createSupabaseAdminClient();
    const id = (await params).id;

    // Get resident from profile_residences
    const { data: residentLink, error: linkError } = await supabase
      .from('profile_residences')
      .select(`
        profile_id,
        apartment_number,
        verified,
        profiles:profile_id (
          id,
          full_name,
          phone_number,
          role
        )
      `)
      .eq('profile_id', id)
      .maybeSingle();

    if (linkError) {
      return NextResponse.json(
        { success: false, error: linkError.message },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    if (!residentLink) {
      return NextResponse.json(
        { success: false, error: 'Resident not found' },
        { status: 404, headers: getCorsHeaders() }
      );
    }

    // Get email from users table
    const { data: user } = await supabase
      .from('users')
      .select('id, email')
      .eq('id', id)
      .maybeSingle();

    // residentLink.profiles is now an array from the select('profiles(*)')
    const profile = Array.isArray(residentLink.profiles) ? residentLink.profiles[0] : residentLink.profiles;
    
    const resident = {
      id: residentLink.profile_id,
      full_name: profile?.full_name || 'Unknown',
      email: user?.email || '',
      phone_number: profile?.phone_number || null,
      apartment_number: residentLink.apartment_number || null,
      role: profile?.role || 'resident',
      verified: residentLink.verified || false,
    };

    return NextResponse.json(
      { success: true, data: resident },
      { headers: getCorsHeaders() }
    );
  } catch (error: any) {
    console.error('[Mobile API] Resident GET error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const searchParams = request.nextUrl.searchParams;
    const requestedRole = searchParams.get('role') as 'syndic' | 'resident' | null;

    // Determine the effective role: use requested role if provided, otherwise use profile role
    const effectiveRole = requestedRole || userProfile.role;

    // Only syndics can update residents (must be in syndic mode)
    if (effectiveRole !== 'syndic') {
      return NextResponse.json(
        { success: false, error: 'Only syndics can update residents. Please switch to syndic mode.' },
        { status: 403, headers: getCorsHeaders() }
      );
    }

    const id = (await params).id;
    const body = await request.json();

    // Update profile if provided
    if (body.full_name != null || body.phone_number != null) {
      const profileUpdate: any = {};
      if (body.full_name != null) profileUpdate.full_name = body.full_name;
      if (body.phone_number != null) profileUpdate.phone_number = body.phone_number;

      const { error: profileUpdateError } = await supabase
        .from('profiles')
        .update(profileUpdate)
        .eq('id', id);

      if (profileUpdateError) {
        console.error('[Mobile API] Residents PATCH: Error updating profile:', profileUpdateError);
        return NextResponse.json(
          { success: false, error: profileUpdateError.message || 'Failed to update resident' },
          { status: 400, headers: getCorsHeaders() }
        );
      }
    }

    // Update profile_residences if apartment_number provided
    if (body.apartment_number != null) {
      const { error: linkUpdateError } = await supabase
        .from('profile_residences')
        .update({ apartment_number: body.apartment_number })
        .eq('profile_id', id);

      if (linkUpdateError) {
        console.error('[Mobile API] Residents PATCH: Error updating profile_residences:', linkUpdateError);
        return NextResponse.json(
          { success: false, error: linkUpdateError.message || 'Failed to update resident' },
          { status: 400, headers: getCorsHeaders() }
        );
      }
    }

    return NextResponse.json(
      { success: true },
      { headers: getCorsHeaders() }
    );
  } catch (error: any) {
    console.error('[Mobile API] Resident PATCH error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const searchParams = request.nextUrl.searchParams;
    const requestedRole = searchParams.get('role') as 'syndic' | 'resident' | null;

    // Determine the effective role: use requested role if provided, otherwise use profile role
    const effectiveRole = requestedRole || userProfile.role;

    console.log('[Mobile API] Residents DELETE: Role:', requestedRole, 'Profile role:', userProfile.role);

    // Only syndics can delete residents (must be in syndic mode)
    if (effectiveRole !== 'syndic') {
      console.error('[Mobile API] Residents DELETE: User is not in syndic mode. Effective role:', effectiveRole);
      return NextResponse.json(
        { success: false, error: 'Only syndics can delete residents. Please switch to syndic mode.' },
        { status: 403, headers: getCorsHeaders() }
      );
    }

    const id = (await params).id;

    // Get residence ID to ensure we only delete from the syndic's residence
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

    // Delete from profile_residences (this removes the resident from the residence)
    const { error: deleteError } = await supabase
      .from('profile_residences')
      .delete()
      .eq('profile_id', id)
      .eq('residence_id', residence.id);

    if (deleteError) {
      console.error('[Mobile API] Residents DELETE: Error deleting resident:', deleteError);
      return NextResponse.json(
        { success: false, error: deleteError.message || 'Failed to delete resident' },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    return NextResponse.json(
      { success: true },
      { headers: getCorsHeaders() }
    );
  } catch (error: any) {
    console.error('[Mobile API] Resident DELETE error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

