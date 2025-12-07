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
 * Mobile API: Get User Roles and Residences
 * GET /api/mobile/profile/roles
 * 
 * Returns available roles and residences for the authenticated user
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
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, full_name')
      .eq('id', userId)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch user profile' },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    // Fetch user's available roles and residences
    let syndicResidence = null;
    let residentResidences: any[] = [];
    const availableRoles: string[] = [];

    // Check if user is a syndic
    const { data: syndicRes } = await supabase
      .from('residences')
      .select('id, name, address, city')
      .eq('syndic_user_id', userId)
      .maybeSingle();

    if (syndicRes) {
      syndicResidence = {
        id: syndicRes.id,
        name: syndicRes.name,
        address: syndicRes.address,
        city: syndicRes.city,
      };
      availableRoles.push('syndic');
    }

    // Check if user is a resident in any residence
    const { data: residentLinks } = await supabase
      .from('profile_residences')
      .select(`
        residence_id,
        apartment_number,
        verified,
        residences (
          id,
          name,
          address,
          city
        )
      `)
      .eq('profile_id', userId);

    if (residentLinks && residentLinks.length > 0) {
      availableRoles.push('resident');
      residentResidences = residentLinks.map((link: any) => ({
        residenceId: link.residence_id,
        apartmentNumber: link.apartment_number,
        verified: link.verified,
        residence: link.residences ? {
          id: link.residences.id,
          name: link.residences.name,
          address: link.residences.address,
          city: link.residences.city,
        } : null,
      }));
    }

    // Determine default role (prefer syndic if available, otherwise resident)
    const defaultRole = availableRoles.includes('syndic') ? 'syndic' : 
                        availableRoles.includes('resident') ? 'resident' : 
                        profile.role || 'resident';

    return NextResponse.json({
      success: true,
      roles: {
        primaryRole: profile.role,
        defaultRole: defaultRole,
        availableRoles: availableRoles,
        syndicResidence: syndicResidence,
        residentResidences: residentResidences,
      },
    }, { headers: getCorsHeaders() });
  } catch (error: any) {
    console.error('[Mobile API] Error fetching roles:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

