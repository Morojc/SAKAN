import { NextRequest, NextResponse } from 'next/server';
import { getMobileUser } from '@/lib/auth/mobile';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

/**
 * CORS headers helper
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

/**
 * Helper to get user's residence ID
 */
async function _getUserResidenceId(userId: string, userRole: string, supabase: any): Promise<number | null> {
  if (userRole === 'syndic') {
    const { data } = await supabase.from('residences').select('id').eq('syndic_user_id', userId).maybeSingle();
    return data?.id || null;
  } else if (userRole === 'guard') {
    const { data } = await supabase.from('residences').select('id').eq('guard_user_id', userId).maybeSingle();
    return data?.id || null;
  } else if (userRole === 'resident') {
    const { data } = await supabase.from('profile_residences').select('residence_id').eq('profile_id', userId).limit(1).maybeSingle();
    return data?.residence_id || null;
  }
  return null;
}

/**
 * Mobile API: Incidents
 * GET /api/mobile/incidents - Get all incidents
 * POST /api/mobile/incidents - Create incident
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
    const status = searchParams.get('status');
    const requestedRole = searchParams.get('role') as 'syndic' | 'resident' | null; // Current role from mobile app
    const requestedResidenceId = searchParams.get('residence_id'); // Selected residence when in resident mode

    console.log('[Mobile API] Incidents: Role:', requestedRole, 'Residence ID:', requestedResidenceId);

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
    
    // Determine effective role: validate requested role against actual roles
    let effectiveRole = requestedRole || userProfile.role;
    
    // CRITICAL: If user requested syndic but doesn't actually have it, force resident role
    if (effectiveRole === 'syndic' && !hasSyndicRole) {
      console.warn('[Mobile API] Incidents: User requested syndic role but doesn\'t have it. Forcing resident role.');
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
            console.log('[Mobile API] Incidents: User is a resident in residence:', residenceId);
          } else {
            console.error('[Mobile API] Incidents: User is not a resident in requested residence:', parsedResidenceId);
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
        console.log('[Mobile API] Incidents: User is a syndic of residence:', residenceId);
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
      console.error('[Mobile API] Incidents: No residence found for user:', userId, 'Role:', effectiveRole);
      return NextResponse.json(
        { success: false, error: 'User has no residence assigned' },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    // Fetch incidents with joins
    let incidentsQuery = supabase
      .from('incidents')
      .select(`
        *,
        reporter:user_id (
          id,
          full_name
        ),
        assignee:assigned_to (
          id,
          full_name
        ),
        residences:residence_id (
          id,
          name,
          address
        )
      `)
      .eq('residence_id', residenceId);

    // Role-based filtering
    // If viewing as resident, only show incidents for this user in this residence
    if (effectiveRole === 'resident' && isResidentInResidence) {
      incidentsQuery = incidentsQuery.eq('user_id', userId);
      console.log('[Mobile API] Incidents: Filtering incidents for resident user:', userId, 'in residence:', residenceId);
    } else if (effectiveRole === 'syndic') {
      // Syndic can see all incidents for the residence
      console.log('[Mobile API] Incidents: Syndic viewing all incidents for residence:', residenceId);
    }

    // Status filter
    if (status) {
      incidentsQuery = incidentsQuery.eq('status', status);
    }

    const { data: incidents, error: incidentsError } = await incidentsQuery.order('created_at', { ascending: false });

    if (incidentsError) {
      return NextResponse.json(
        { success: false, error: incidentsError.message },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    // Transform incidents
    const incidentsWithNames = (incidents || []).map((incident: any) => ({
      ...incident,
      reporter_name: incident.reporter?.full_name || 'Unknown',
      assignee_name: incident.assignee?.full_name || null,
      residence_name: incident.residences?.name || 'Unknown',
    }));

    return NextResponse.json(
      { success: true, data: incidentsWithNames },
      { headers: getCorsHeaders() }
    );
  } catch (error: any) {
    console.error('[Mobile API] Incidents GET error:', error);
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
      console.error('[Mobile API] Incidents POST: No mobile user found');
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
      console.error('[Mobile API] Incidents POST: Profile error:', profileError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch user profile' },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    // Get residence ID - for POST, we need to determine residence based on role context
    // Check if user is creating as resident (from query params or body)
    const searchParams = request.nextUrl.searchParams;
    const requestedRole = searchParams.get('role') as 'syndic' | 'resident' | null;
    const requestedResidenceId = searchParams.get('residence_id');
    const body = await request.json();
    
    // Determine effective role
    const effectiveRole = requestedRole || userProfile.role;
    
    let residenceId: number | null = null;
    
    if (effectiveRole === 'resident') {
      // User is creating as resident - get residence from profile_residences
      if (requestedResidenceId) {
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
        }
      }
    } else if (effectiveRole === 'syndic') {
      // User is creating as syndic - get syndic's residence
      const { data: res } = await supabase
        .from('residences')
        .select('id')
        .eq('syndic_user_id', userId)
        .maybeSingle();
      
      if (res) {
        residenceId = res.id;
      }
    }
    
    if (!residenceId) {
      console.error('[Mobile API] Incidents POST: No residence found for user:', userId, 'Role:', effectiveRole);
      return NextResponse.json(
        { success: false, error: 'User has no residence assigned' },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    // Validate required fields
    if (!body.title || !body.description) {
      return NextResponse.json(
        { success: false, error: 'Title and description are required' },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    // Create incident directly in database
    const { data: incident, error: incidentError } = await supabase
      .from('incidents')
      .insert({
        title: body.title,
        description: body.description,
        user_id: userId,
        residence_id: residenceId,
        status: 'open',
        photo_url: body.photo_url || null,
      })
      .select()
      .single();

    if (incidentError) {
      console.error('[Mobile API] Incidents POST: Error creating incident:', incidentError);
      return NextResponse.json(
        { success: false, error: incidentError.message || 'Failed to create incident' },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    console.log('[Mobile API] Incidents POST: Incident created successfully:', incident.id);

    return NextResponse.json(
      { success: true, data: incident },
      { status: 201, headers: getCorsHeaders() }
    );
  } catch (error: any) {
    console.error('[Mobile API] Incidents POST error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

