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
 * Mobile API: Residents
 * GET /api/mobile/residents - Get all residents
 * POST /api/mobile/residents - Create resident
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

    const searchParams = request.nextUrl.searchParams;
    const requestedRole = searchParams.get('role') as 'syndic' | 'resident' | null; // Current role from mobile app

    console.log('[Mobile API] Residents: Role:', requestedRole, 'Profile role:', userProfile.role);

    // CRITICAL: Verify user is actually a syndic (check database, not just role parameter)
    const { data: residence } = await supabase
      .from('residences')
      .select('id')
      .eq('syndic_user_id', userId)
      .maybeSingle();

    // Only syndics can view all residents - verify they are actually a syndic
    if (!residence) {
      console.error('[Mobile API] Residents: User is not a syndic. User ID:', userId);
      return NextResponse.json(
        { success: false, error: 'Only syndics can view all residents. You do not have syndic privileges.' },
        { status: 403, headers: getCorsHeaders() }
      );
    }

    // Determine the effective role: use requested role if provided, otherwise use profile role
    // But since we've verified they're a syndic, we can safely use 'syndic'
    const effectiveRole = 'syndic'; // Force to syndic since we've verified they are one

    if (!residence) {
      console.error('[Mobile API] Residents: User is not a syndic of any residence:', userId);
      return NextResponse.json(
        { success: false, error: 'User is not a syndic of any residence' },
        { status: 403, headers: getCorsHeaders() }
      );
    }

    console.log('[Mobile API] Residents: Syndic viewing residents for residence:', residence.id);

    const search = searchParams.get('search');
    // Use 'role_filter' for filtering residents by their role (resident, guard, etc.)
    // 'role' is reserved for the current user's role context (syndic/resident)
    const roleFilter = searchParams.get('role_filter');

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
          phone_number,
          role
        )
      `)
      .eq('residence_id', residence.id);

    if (linksError) {
      return NextResponse.json(
        { success: false, error: linksError.message },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    // Get user emails from users table
    const profileIds = (residentLinks || []).map((link: any) => link.profile_id).filter(Boolean);
    let userEmails: Map<string, string> = new Map();
    
    if (profileIds.length > 0) {
      const { data: usersData } = await supabase
        .from('users')
        .select('id, email')
        .in('id', profileIds);
      
      if (usersData) {
        userEmails = new Map(usersData.map((u: any) => [u.id, u.email || '']));
      }
    }

    // Transform and filter
    let residents = (residentLinks || [])
      .map((link: any) => ({
        id: link.profile_id,
        full_name: link.profiles?.full_name || 'Unknown',
        email: userEmails.get(link.profile_id) || '',
        phone_number: link.profiles?.phone_number || null,
        apartment_number: link.apartment_number || null,
        role: link.profiles?.role || 'resident',
        verified: link.verified || false,
      }))
      .filter((r: any) => r.role !== 'syndic'); // Exclude syndic

    // Filter by role
    if (roleFilter && roleFilter !== 'all') {
      residents = residents.filter((r: any) => r.role === roleFilter);
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

    return NextResponse.json(
      { success: true, data: residents },
      { headers: getCorsHeaders() }
    );
  } catch (error: any) {
    console.error('[Mobile API] Residents GET error:', error);
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

    const searchParams = request.nextUrl.searchParams;
    const requestedRole = searchParams.get('role') as 'syndic' | 'resident' | null;

    // Determine the effective role: use requested role if provided, otherwise use profile role
    const effectiveRole = requestedRole || userProfile.role;

    // Only syndics can create residents (must be in syndic mode)
    if (effectiveRole !== 'syndic') {
      console.error('[Mobile API] Residents POST: User is not in syndic mode. Effective role:', effectiveRole);
      return NextResponse.json(
        { success: false, error: 'Only syndics can create residents. Please switch to syndic mode.' },
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
    
    // Validation
    if (!body.full_name || !body.email || !body.apartment_number) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: full_name, email, and apartment_number are required' },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email format' },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    // Check if user with this email already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', body.email.trim().toLowerCase())
      .maybeSingle();

    let finalUserId: string;

    if (existingUser) {
      // Use existing user
      finalUserId = existingUser.id;
    } else {
      // Create new user
      finalUserId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      const { error: userError } = await supabase
        .from('users')
        .insert({
          id: finalUserId,
          email: body.email.trim().toLowerCase(),
          name: body.full_name.trim(),
        });

      if (userError) {
        console.error('[Mobile API] Residents POST: Error creating user:', userError);
        return NextResponse.json(
          { success: false, error: 'Failed to create user account' },
          { status: 400, headers: getCorsHeaders() }
        );
      }
    }

    // Check if profile exists, create or update it
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', finalUserId)
      .maybeSingle();

    const role = body.role || 'resident';

    if (!existingProfile) {
      // Create profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: finalUserId,
          full_name: body.full_name.trim(),
          phone_number: body.phone_number?.trim() || null,
          role: role,
        });

      if (profileError) {
        console.error('[Mobile API] Residents POST: Error creating profile:', profileError);
        return NextResponse.json(
          { success: false, error: 'Failed to create profile' },
          { status: 400, headers: getCorsHeaders() }
        );
      }
    } else {
      // Update profile if needed
      const updateData: any = {};
      if (body.full_name) updateData.full_name = body.full_name.trim();
      if (body.phone_number) updateData.phone_number = body.phone_number.trim();

      if (Object.keys(updateData).length > 0) {
        const { error: profileUpdateError } = await supabase
          .from('profiles')
          .update(updateData)
          .eq('id', finalUserId);

        if (profileUpdateError) {
          console.error('[Mobile API] Residents POST: Error updating profile:', profileUpdateError);
        }
      }
    }

    // Check if apartment number is already taken
    const { data: existingApartment } = await supabase
      .from('profile_residences')
      .select('profile_id')
      .eq('residence_id', residence.id)
      .eq('apartment_number', body.apartment_number.trim())
      .maybeSingle();

    if (existingApartment && existingApartment.profile_id !== finalUserId) {
      return NextResponse.json(
        { success: false, error: `Apartment ${body.apartment_number} is already taken` },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    // Check if user is already a resident in this residence
    const { data: existingLink } = await supabase
      .from('profile_residences')
      .select('id')
      .eq('profile_id', finalUserId)
      .eq('residence_id', residence.id)
      .maybeSingle();

    if (existingLink) {
      // Update existing link
      const { error: updateError } = await supabase
        .from('profile_residences')
        .update({
          apartment_number: body.apartment_number.trim(),
        })
        .eq('id', existingLink.id);

      if (updateError) {
        console.error('[Mobile API] Residents POST: Error updating profile_residences:', updateError);
        return NextResponse.json(
          { success: false, error: 'Failed to update resident' },
          { status: 400, headers: getCorsHeaders() }
        );
      }

      return NextResponse.json(
        { success: true, data: { id: finalUserId, ...body } },
        { status: 200, headers: getCorsHeaders() }
      );
    }

    // Create profile_residences link
    const { data: newResident, error: createError } = await supabase
      .from('profile_residences')
      .insert({
        profile_id: finalUserId,
        residence_id: residence.id,
        apartment_number: body.apartment_number.trim(),
        verified: false,
      })
      .select()
      .single();

    if (createError) {
      console.error('[Mobile API] Residents POST: Error creating profile_residences:', createError);
      return NextResponse.json(
        { success: false, error: createError.message || 'Failed to create resident' },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    return NextResponse.json(
      { success: true, data: { id: finalUserId, ...body } },
      { status: 201, headers: getCorsHeaders() }
    );
  } catch (error: any) {
    console.error('[Mobile API] Residents POST error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

