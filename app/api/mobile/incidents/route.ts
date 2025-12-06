import { NextRequest, NextResponse } from 'next/server';
import { getMobileUser } from '@/lib/auth/mobile';
import { createIncident } from '@/app/app/incidents/actions';
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
async function getUserResidenceId(userId: string, userRole: string, supabase: any): Promise<number | null> {
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

    const residenceId = await getUserResidenceId(userId, userProfile.role, supabase);
    if (!residenceId) {
      return NextResponse.json(
        { success: false, error: 'User has no residence assigned' },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');

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
    if (userProfile.role === 'resident') {
      incidentsQuery = incidentsQuery.eq('user_id', userId);
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

    // Get residence ID
    const residenceId = await getUserResidenceId(userId, userProfile.role, supabase);
    if (!residenceId) {
      console.error('[Mobile API] Incidents POST: No residence found for user:', userId);
      return NextResponse.json(
        { success: false, error: 'User has no residence assigned' },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    const body = await request.json();

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

