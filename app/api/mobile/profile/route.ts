import { NextRequest, NextResponse } from 'next/server';
import { getMobileUser } from '@/lib/auth/mobile';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

/**
 * Mobile API: Profile
 * GET /api/mobile/profile - Get user profile
 * PUT /api/mobile/profile - Update user profile
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

    // Get user profile with residence info
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select(`
        id,
        full_name,
        phone,
        role,
        onboarding_completed,
        profile_residences (
          apartment_number,
          verified,
          residences (
            id,
            name,
            address,
            city
          )
        )
      `)
      .eq('id', userId)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch profile' },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    // Get user email from users table
    const { data: userData } = await supabase
      .from('users')
      .select('email, name, image')
      .eq('id', userId)
      .maybeSingle();

    // Transform profile data
    const residenceLink = Array.isArray(profile.profile_residences)
      ? profile.profile_residences[0]
      : profile.profile_residences;

    const residence = Array.isArray(residenceLink?.residences)
      ? residenceLink.residences[0]
      : residenceLink?.residences;

    return NextResponse.json(
      {
        success: true,
        data: {
          id: profile.id,
          full_name: profile.full_name,
          email: userData?.email || '',
          phone: profile.phone,
          role: profile.role,
          apartment_number: residenceLink?.apartment_number || null,
          residence: residence
            ? {
                id: residence.id,
                name: residence.name,
                address: residence.address,
                city: residence.city,
              }
            : null,
          onboarding_completed: profile.onboarding_completed || false,
        },
      },
      { headers: getCorsHeaders() }
    );
  } catch (error: any) {
    console.error('[Mobile API] Profile GET error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

export async function PUT(request: NextRequest) {
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
    const body = await request.json();

    // Only allow updating certain fields
    const updateData: any = {};
    if (body.full_name !== undefined) updateData.full_name = body.full_name;
    if (body.phone !== undefined) updateData.phone = body.phone;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid fields to update' },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    // Update profile
    const { data, error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    return NextResponse.json(
      { success: true, data },
      { headers: getCorsHeaders() }
    );
  } catch (error: any) {
    console.error('[Mobile API] Profile PUT error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

