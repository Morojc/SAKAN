import { NextRequest, NextResponse } from 'next/server';
import { getMobileUser } from '@/lib/auth/mobile';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import {
  createComplaint,
} from '@/app/app/complaints/actions';

/**
 * Mobile API: Complaints
 * GET /api/mobile/complaints - Get all complaints (resident-specific)
 * POST /api/mobile/complaints - Create complaint
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

export async function GET(request: NextRequest) {
  try {
    const mobileUser = await getMobileUser(request);
    if (!mobileUser?.id) {
      console.error('[Mobile API] Complaints: No mobile user found');
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401, headers: getCorsHeaders() }
      );
    }

    const supabase = createSupabaseAdminClient();
    const userId = mobileUser.id;

    console.log('[Mobile API] Complaints: Fetching complaints for user:', userId);

    // Get user profile
    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('role, id')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      console.error('[Mobile API] Complaints: Profile error:', profileError);
      return NextResponse.json(
        { success: false, error: `Failed to fetch user profile: ${profileError.message}` },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    if (!userProfile) {
      console.error('[Mobile API] Complaints: Profile not found for user:', userId);
      return NextResponse.json(
        { success: false, error: 'User profile not found. Please contact your syndic.' },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const requestedRole = searchParams.get('role') as 'syndic' | 'resident' | null; // Current role from mobile app
    const requestedResidenceId = searchParams.get('residence_id'); // Selected residence when in resident mode

    console.log('[Mobile API] Complaints: Role:', requestedRole, 'Residence ID:', requestedResidenceId);

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
      console.warn('[Mobile API] Complaints: User requested syndic role but doesn\'t have it. Forcing resident role.');
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
            console.log('[Mobile API] Complaints: User is a resident in residence:', residenceId);
          } else {
            console.error('[Mobile API] Complaints: User is not a resident in requested residence:', parsedResidenceId);
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
        console.log('[Mobile API] Complaints: User is a syndic of residence:', residenceId);
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
      console.error('[Mobile API] Complaints: No residence found for user:', userId, 'Role:', effectiveRole);
      return NextResponse.json(
        { success: false, error: 'User has no residence assigned. Please contact your syndic.' },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    // Map mobile status to backend status
    let backendStatus: string | undefined;
    if (status && status !== 'all') {
      // Map mobile statuses to backend statuses
      const statusMap: Record<string, string> = {
        'pending': 'submitted',
        'under_review': 'reviewed',
        'resolved': 'resolved',
        'dismissed': 'resolved', // Backend might not have dismissed, treat as resolved
      };
      backendStatus = statusMap[status] || status;
    }

    // Build query directly (don't use getComplaints action which uses NextAuth)
    let query = supabase
      .from('complaints')
      .select(`
        *,
        complainant:complainant_id (
          id,
          full_name
        ),
        complained_about:complained_about_id (
          id,
          full_name
        ),
        reviewer:reviewed_by (
          id,
          full_name
        ),
        residences:residence_id (
          id,
          name
        )
      `)
      .eq('residence_id', residenceId);

    // Role-based filtering
    // If viewing as resident, only show complaints for this user in this residence
    if (effectiveRole === 'resident' && isResidentInResidence) {
      query = query.eq('complainant_id', userId);
      console.log('[Mobile API] Complaints: Filtering complaints for resident user:', userId, 'in residence:', residenceId);
    } else if (effectiveRole === 'syndic') {
      // Syndic can see all complaints for the residence
      console.log('[Mobile API] Complaints: Syndic viewing all complaints for residence:', residenceId);
    }

    // Status filter
    if (backendStatus) {
      query = query.eq('status', backendStatus);
    }

    // Order by created_at descending
    query = query.order('created_at', { ascending: false });

    const { data: complaints, error: complaintsError } = await query;

    if (complaintsError) {
      console.error('[Mobile API] Complaints: Error fetching complaints:', complaintsError);
      return NextResponse.json(
        { success: false, error: complaintsError.message || 'Failed to fetch complaints' },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    // Transform complaints to match mobile app expectations
    const transformedComplaints = (complaints || []).map((complaint: any) => {
      // Map backend status to mobile status
      const statusMap: Record<string, string> = {
        'submitted': 'pending',
        'reviewed': 'under_review',
        'resolved': 'resolved',
      };
      
      return {
        ...complaint,
        type: complaint.reason || 'general',
        status: statusMap[complaint.status] || complaint.status,
        user_id: complaint.complainant_id,
        user_name: complaint.complainant?.full_name || 'Unknown',
        residence_name: complaint.residences?.name || 'Unknown',
        response: complaint.resolution_notes || null,
        responded_at: complaint.resolved_at || null,
        responded_by: complaint.reviewer?.full_name || null,
      };
    });

    console.log('[Mobile API] Complaints: Returning', transformedComplaints.length, 'complaints');

    return NextResponse.json(
      { success: true, data: transformedComplaints },
      { headers: getCorsHeaders() }
    );
  } catch (error: any) {
    console.error('[Mobile API] Complaints GET error:', error);
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
      console.error('[Mobile API] Complaints POST: No mobile user found');
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401, headers: getCorsHeaders() }
      );
    }

    const supabase = createSupabaseAdminClient();
    const userId = mobileUser.id;

    // Get user profile and residence
    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('role, id')
      .eq('id', userId)
      .maybeSingle();

    if (profileError || !userProfile) {
      console.error('[Mobile API] Complaints POST: Profile error:', profileError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch user profile' },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    // Get role context from query params or body
    const searchParams = request.nextUrl.searchParams;
    const requestedRole = searchParams.get('role') as 'syndic' | 'resident' | null;
    const requestedResidenceId = searchParams.get('residence_id');
    const body = await request.json();
    
    // Determine effective role - for POST, must be resident
    const effectiveRole = requestedRole || userProfile.role;
    
    // Only residents can create complaints (even if they're also syndic, they must be in resident mode)
    if (effectiveRole !== 'resident') {
      return NextResponse.json(
        { success: false, error: 'Only residents can create complaints. Please switch to resident mode.' },
        { status: 403, headers: getCorsHeaders() }
      );
    }

    // Get residence ID from profile_residences
    let residenceId: number | null = null;
    
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
        } else {
          console.error('[Mobile API] Complaints POST: User is not a resident in requested residence:', parsedResidenceId);
          return NextResponse.json(
            { success: false, error: 'You are not a resident in this residence.' },
            { status: 403, headers: getCorsHeaders() }
          );
        }
      }
    } else {
      // Get first residence from profile_residences
      const { data: prLink } = await supabase
        .from('profile_residences')
        .select('residence_id')
        .eq('profile_id', userId)
        .limit(1)
        .maybeSingle();

      if (prLink) {
        residenceId = prLink.residence_id;
      }
    }

    if (!residenceId) {
      console.error('[Mobile API] Complaints POST: No residence found for user:', userId);
      return NextResponse.json(
        { success: false, error: 'User has no residence assigned' },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    // Get the syndic for this residence to use as complained_about_id for general complaints
    // Since complained_about_id cannot be null and cannot be the complainant, we use the syndic
    const { data: residence } = await supabase
      .from('residences')
      .select('syndic_user_id')
      .eq('id', residenceId)
      .maybeSingle();

    if (!residence?.syndic_user_id) {
      console.error('[Mobile API] Complaints POST: No syndic found for residence:', residenceId);
      return NextResponse.json(
        { success: false, error: 'No syndic found for this residence' },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    // Validate required fields
    if (!body.description) {
      return NextResponse.json(
        { success: false, error: 'Description is required' },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    // Create complaint directly in database
    // Note: complained_about_id must not be null and cannot be the complainant
    // For general complaints, we use the syndic as the complained_about_id
    // This satisfies the constraint while allowing residents to file general complaints
    const { data: complaint, error: complaintError } = await supabase
      .from('complaints')
      .insert({
        complainant_id: userId,
        complained_about_id: residence.syndic_user_id, // Use syndic for general complaints
        reason: body.type || 'other',
        privacy: 'private',
        title: body.title || body.type || 'Complaint',
        description: body.description,
        residence_id: residenceId,
        status: 'submitted',
      })
      .select()
      .single();

    if (complaintError) {
      console.error('[Mobile API] Complaints POST: Error creating complaint:', complaintError);
      return NextResponse.json(
        { success: false, error: complaintError.message || 'Failed to create complaint' },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    console.log('[Mobile API] Complaints POST: Complaint created successfully:', complaint.id);

    return NextResponse.json(
      { success: true, data: complaint },
      { status: 201, headers: getCorsHeaders() }
    );
  } catch (error: any) {
    console.error('[Mobile API] Complaints POST error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

