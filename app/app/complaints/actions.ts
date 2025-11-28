'use server';

import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

/**
 * Complaints Server Actions
 * Handles CRUD operations for resident complaints
 */

type ComplaintReason = 'noise' | 'trash' | 'behavior' | 'parking' | 'pets' | 'property_damage' | 'other';
type ComplaintStatus = 'submitted' | 'reviewed' | 'resolved';
type ComplaintPrivacy = 'private' | 'anonymous';

interface CreateComplaintData {
  complained_about_id: string;
  reason: ComplaintReason;
  privacy: ComplaintPrivacy;
  title: string;
  description: string;
  residence_id: number;
}

interface UpdateComplaintStatusData {
  id: number;
  status: ComplaintStatus;
  resolution_notes?: string;
}

/**
 * Helper to get the current user's residence ID
 */
async function getUserResidenceId(userId: string, userRole: string, supabase: any): Promise<number | null> {
  if (userRole === 'syndic') {
    const { data } = await supabase
      .from('residences')
      .select('id')
      .eq('syndic_user_id', userId)
      .maybeSingle();
    return data?.id || null;
  } else if (userRole === 'guard') {
    const { data } = await supabase
      .from('residences')
      .select('id')
      .eq('guard_user_id', userId)
      .maybeSingle();
    return data?.id || null;
  } else if (userRole === 'resident') {
    const { data } = await supabase
      .from('profile_residences')
      .select('residence_id')
      .eq('profile_id', userId)
      .limit(1)
      .maybeSingle();
    return data?.residence_id || null;
  }
  return null;
}

/**
 * Create a new complaint
 * Only residents can create complaints
 */
export async function createComplaint(data: CreateComplaintData) {
  console.log('[Complaints Actions] Creating complaint:', data);

  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return {
        success: false,
        error: 'User not authenticated',
      };
    }

    // Validation
    if (!data.title || !data.description || !data.complained_about_id || !data.reason || !data.residence_id) {
      return {
        success: false,
        error: 'Missing required fields: title, description, complained_about_id, reason, and residence_id are required',
      };
    }

    const adminSupabase = createSupabaseAdminClient();

    // Get user profile to determine role
    const { data: userProfile, error: profileError } = await adminSupabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();

    if (profileError || !userProfile) {
      return {
        success: false,
        error: 'Failed to fetch user profile',
      };
    }

    // Only residents can create complaints
    if (userProfile.role !== 'resident') {
      return {
        success: false,
        error: 'Only residents can create complaints',
      };
    }

    // Verify user has access to the residence
    const userResidenceId = await getUserResidenceId(userId, userProfile.role, adminSupabase);
    
    if (!userResidenceId || userResidenceId !== data.residence_id) {
      return {
        success: false,
        error: 'You do not have permission to create complaints for this residence',
      };
    }

    // Validate that complained_about_id is a resident in the same residence
    const { data: complainedAboutProfile, error: complainedAboutError } = await adminSupabase
      .from('profile_residences')
      .select('profile_id, residence_id')
      .eq('profile_id', data.complained_about_id)
      .eq('residence_id', data.residence_id)
      .maybeSingle();

    if (complainedAboutError || !complainedAboutProfile) {
      return {
        success: false,
        error: 'The person you are complaining about is not a resident in this residence',
      };
    }

    // Ensure complainant and complained_about are different
    if (userId === data.complained_about_id) {
      return {
        success: false,
        error: 'You cannot file a complaint against yourself',
      };
    }

    // Get complained-about profile to verify they are a resident
    const { data: complainedAboutUserProfile } = await adminSupabase
      .from('profiles')
      .select('role')
      .eq('id', data.complained_about_id)
      .maybeSingle();

    if (!complainedAboutUserProfile || complainedAboutUserProfile.role !== 'resident') {
      return {
        success: false,
        error: 'You can only file complaints against residents',
      };
    }

    // Create complaint
    const { data: complaint, error } = await adminSupabase
      .from('complaints')
      .insert({
        title: data.title.trim(),
        description: data.description.trim(),
        residence_id: data.residence_id,
        complainant_id: userId,
        complained_about_id: data.complained_about_id,
        reason: data.reason,
        privacy: data.privacy || 'private',
        status: 'submitted' as ComplaintStatus,
      })
      .select()
      .single();

    if (error) {
      console.error('[Complaints Actions] Error creating complaint:', error);
      return {
        success: false,
        error: error.message || 'Failed to create complaint',
      };
    }

    console.log('[Complaints Actions] Complaint created successfully:', complaint?.id);

    // Send notification to syndic
    try {
      const { data: residence } = await adminSupabase
        .from('residences')
        .select('syndic_user_id')
        .eq('id', data.residence_id)
        .maybeSingle();

      if (residence?.syndic_user_id) {
        const { data: complainantProfile } = await adminSupabase
          .from('profiles')
          .select('full_name')
          .eq('id', userId)
          .maybeSingle();

        const { data: complainedAboutProfile } = await adminSupabase
          .from('profiles')
          .select('full_name')
          .eq('id', data.complained_about_id)
          .maybeSingle();

        await adminSupabase
          .from('notifications')
          .insert({
            user_id: residence.syndic_user_id,
            type: 'warning',
            title: 'New Complaint Filed',
            message: `${complainantProfile?.full_name || 'A resident'} filed a complaint about ${complainedAboutProfile?.full_name || 'a resident'}`,
            residence_id: data.residence_id,
            action_data: {
              complaint_id: complaint.id,
              type: 'complaint',
            },
          });
      }
    } catch (notifError) {
      console.warn('[Complaints Actions] Failed to send notification to syndic:', notifError);
      // Don't fail the complaint creation if notification fails
    }

    // Send notification to complained-about resident (respecting privacy)
    try {
      if (data.privacy === 'private') {
        // Private complaint: show complainant name
        const { data: complainantProfile } = await adminSupabase
          .from('profiles')
          .select('full_name')
          .eq('id', userId)
          .maybeSingle();

        await adminSupabase
          .from('notifications')
          .insert({
            user_id: data.complained_about_id,
            type: 'warning',
            title: 'Complaint Filed Against You',
            message: `${complainantProfile?.full_name || 'A resident'} filed a complaint about you: ${data.title}`,
            residence_id: data.residence_id,
            action_data: {
              complaint_id: complaint.id,
              type: 'complaint',
            },
          });
      } else {
        // Anonymous complaint: don't show complainant name
        await adminSupabase
          .from('notifications')
          .insert({
            user_id: data.complained_about_id,
            type: 'warning',
            title: 'Anonymous Complaint Filed',
            message: `An anonymous complaint has been filed about you: ${data.title}`,
            residence_id: data.residence_id,
            action_data: {
              complaint_id: complaint.id,
              type: 'complaint',
            },
          });
      }
    } catch (notifError) {
      console.warn('[Complaints Actions] Failed to send notification to complained-about resident:', notifError);
      // Don't fail the complaint creation if notification fails
    }

    revalidatePath('/app/complaints');
    
    return {
      success: true,
      data: complaint,
    };

  } catch (error: any) {
    console.error('[Complaints Actions] Unexpected error:', error);
    return {
      success: false,
      error: error.message || 'An unexpected error occurred',
    };
  }
}

/**
 * Get complaints with role-based filtering
 * Residents: See their own complaints + complaints against them (with privacy respect)
 * Syndics: See all complaints in residence
 */
export async function getComplaints(filters?: {
  status?: ComplaintStatus;
  residence_id?: number;
}) {
  console.log('[Complaints Actions] Fetching complaints:', filters);

  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return {
        success: false,
        error: 'User not authenticated',
      };
    }

    const adminSupabase = createSupabaseAdminClient();

    // Get user profile to determine role
    const { data: userProfile, error: profileError } = await adminSupabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();

    if (profileError || !userProfile) {
      return {
        success: false,
        error: 'Failed to fetch user profile',
      };
    }

    const userRole = userProfile.role;
    let residenceId = filters?.residence_id;

    // If no residence_id provided, get from user's role
    if (!residenceId) {
      residenceId = await getUserResidenceId(userId, userRole, adminSupabase);
    }

    if (!residenceId) {
      return {
        success: true,
        data: [],
      };
    }

    // Build query
    let query = adminSupabase
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
        )
      `)
      .eq('residence_id', residenceId);

    // Role-based filtering
    if (userRole === 'resident') {
      // Residents can see their own complaints or complaints against them
      query = query.or(`complainant_id.eq.${userId},complained_about_id.eq.${userId}`);
    }
    // Syndics can see all complaints in their residence (no additional filter)

    // Status filter
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    // Order by created_at descending
    query = query.order('created_at', { ascending: false });

    const { data: complaints, error } = await query;

    if (error) {
      console.error('[Complaints Actions] Error fetching complaints:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch complaints',
      };
    }

    console.log('[Complaints Actions] Found', complaints?.length || 0, 'complaints');
    
    return {
      success: true,
      data: complaints || [],
    };

  } catch (error: any) {
    console.error('[Complaints Actions] Unexpected error:', error);
    return {
      success: false,
      error: error.message || 'An unexpected error occurred',
    };
  }
}

/**
 * Get a single complaint by ID
 */
export async function getComplaintById(id: number) {
  console.log('[Complaints Actions] Fetching complaint:', id);

  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return {
        success: false,
        error: 'User not authenticated',
      };
    }

    const adminSupabase = createSupabaseAdminClient();

    // Get user profile to determine role
    const { data: userProfile } = await adminSupabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();

    if (!userProfile) {
      return {
        success: false,
        error: 'Failed to fetch user profile',
      };
    }

    const userRole = userProfile.role;
    const userResidenceId = await getUserResidenceId(userId, userRole, adminSupabase);

    // Fetch complaint with joins
    const { data: complaint, error } = await adminSupabase
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
        )
      `)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('[Complaints Actions] Error fetching complaint:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch complaint',
      };
    }

    if (!complaint) {
      return {
        success: false,
        error: 'Complaint not found',
      };
    }

    // Verify access
    // Syndics can view all complaints in their residence
    if (userRole === 'syndic' && complaint.residence_id === userResidenceId) {
      return {
        success: true,
        data: complaint,
      };
    }

    // Residents can view if they are the complainant or complained-about
    if (userRole === 'resident' && 
        (complaint.complainant_id === userId || complaint.complained_about_id === userId)) {
      return {
        success: true,
        data: complaint,
      };
    }

    return {
      success: false,
      error: 'You do not have permission to view this complaint',
    };

  } catch (error: any) {
    console.error('[Complaints Actions] Unexpected error:', error);
    return {
      success: false,
      error: error.message || 'An unexpected error occurred',
    };
  }
}

/**
 * Update complaint status (syndics only)
 */
export async function updateComplaintStatus(data: UpdateComplaintStatusData) {
  console.log('[Complaints Actions] Updating complaint status:', data.id);

  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return {
        success: false,
        error: 'User not authenticated',
      };
    }

    if (!data.id) {
      return {
        success: false,
        error: 'Complaint ID is required',
      };
    }

    const adminSupabase = createSupabaseAdminClient();

    // Get user profile to determine role
    const { data: userProfile, error: profileError } = await adminSupabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();

    if (profileError || !userProfile) {
      return {
        success: false,
        error: 'Failed to fetch user profile',
      };
    }

    // Only syndics can update complaint status
    if (userProfile.role !== 'syndic') {
      return {
        success: false,
        error: 'Only syndics can update complaint status',
      };
    }

    // Get existing complaint to verify residence
    const { data: existingComplaint, error: fetchError } = await adminSupabase
      .from('complaints')
      .select('residence_id, complainant_id, complained_about_id, status')
      .eq('id', data.id)
      .single();

    if (fetchError || !existingComplaint) {
      return {
        success: false,
        error: 'Complaint not found',
      };
    }

    // Verify permissions
    const userResidenceId = await getUserResidenceId(userId, userProfile.role, adminSupabase);
    
    if (!userResidenceId || userResidenceId !== existingComplaint.residence_id) {
      return {
        success: false,
        error: 'You do not have permission to update this complaint',
      };
    }

    // Build update object
    const updateData: any = {
      status: data.status,
      reviewed_by: userId,
    };

    // Set reviewed_at when status changes from submitted
    if (existingComplaint.status === 'submitted' && data.status !== 'submitted') {
      updateData.reviewed_at = new Date().toISOString();
    }

    // Set resolved_at when status is resolved
    if (data.status === 'resolved') {
      updateData.resolved_at = new Date().toISOString();
    } else if (existingComplaint.status === 'resolved' && data.status !== 'resolved') {
      // Clear resolved_at if status changed from resolved
      updateData.resolved_at = null;
    }

    // Add resolution notes if provided
    if (data.resolution_notes !== undefined) {
      updateData.resolution_notes = data.resolution_notes || null;
    }

    // Update complaint
    const { data: complaint, error } = await adminSupabase
      .from('complaints')
      .update(updateData)
      .eq('id', data.id)
      .select()
      .single();

    if (error) {
      console.error('[Complaints Actions] Error updating complaint:', error);
      return {
        success: false,
        error: error.message || 'Failed to update complaint',
      };
    }

    console.log('[Complaints Actions] Complaint updated successfully:', complaint?.id);

    // Send notifications to both parties when status changes
    try {
      const statusMessages: Record<ComplaintStatus, string> = {
        submitted: 'has been submitted',
        reviewed: 'is being reviewed',
        resolved: 'has been resolved',
      };

      // Notify complainant
      await adminSupabase
        .from('notifications')
        .insert({
          user_id: existingComplaint.complainant_id,
          type: data.status === 'resolved' ? 'success' : 'info',
          title: 'Complaint Status Updated',
          message: `Your complaint "${complaint.title}" ${statusMessages[data.status]}`,
          residence_id: existingComplaint.residence_id,
          action_data: {
            complaint_id: complaint.id,
            type: 'complaint',
          },
        });

      // Notify complained-about resident
      await adminSupabase
        .from('notifications')
        .insert({
          user_id: existingComplaint.complained_about_id,
          type: data.status === 'resolved' ? 'success' : 'info',
          title: 'Complaint Status Updated',
          message: `The complaint about you "${complaint.title}" ${statusMessages[data.status]}`,
          residence_id: existingComplaint.residence_id,
          action_data: {
            complaint_id: complaint.id,
            type: 'complaint',
          },
        });
    } catch (notifError) {
      console.warn('[Complaints Actions] Failed to send notifications:', notifError);
      // Don't fail the update if notification fails
    }

    revalidatePath('/app/complaints');
    
    return {
      success: true,
      data: complaint,
    };

  } catch (error: any) {
    console.error('[Complaints Actions] Unexpected error:', error);
    return {
      success: false,
      error: error.message || 'An unexpected error occurred',
    };
  }
}

/**
 * Get residents in the same residence for complaint form
 */
export async function getResidentsForComplaint(residenceId: number) {
  console.log('[Complaints Actions] Fetching residents for complaint form:', residenceId);

  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return {
        success: false,
        error: 'User not authenticated',
      };
    }

    const adminSupabase = createSupabaseAdminClient();

    // Get user profile
    const { data: userProfile } = await adminSupabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();

    if (!userProfile || userProfile.role !== 'resident') {
      return {
        success: false,
        error: 'Only residents can file complaints',
      };
    }

    // Verify user is in the same residence
    const userResidenceId = await getUserResidenceId(userId, userProfile.role, adminSupabase);
    
    if (!userResidenceId || userResidenceId !== residenceId) {
      return {
        success: false,
        error: 'You do not have permission to access this residence',
      };
    }

    // Get all residents in the same residence (excluding the current user)
    const { data: residentLinks, error: linksError } = await adminSupabase
      .from('profile_residences')
      .select(`
        profile_id,
        apartment_number,
        profiles:profile_id (
          id,
          full_name,
          role
        )
      `)
      .eq('residence_id', residenceId)
      .neq('profile_id', userId);

    if (linksError) {
      console.error('[Complaints Actions] Error fetching residents:', linksError);
      return {
        success: false,
        error: linksError.message || 'Failed to fetch residents',
      };
    }

    // Filter to only residents (not guards or syndics)
    const residents = (residentLinks || [])
      .filter((link: any) => link.profiles?.role === 'resident')
      .map((link: any) => ({
        id: link.profile_id,
        full_name: link.profiles?.full_name || 'Unknown',
        apartment_number: link.apartment_number || null,
      }));

    console.log('[Complaints Actions] Found', residents.length, 'residents');
    
    return {
      success: true,
      data: residents,
    };

  } catch (error: any) {
    console.error('[Complaints Actions] Unexpected error:', error);
    return {
      success: false,
      error: error.message || 'An unexpected error occurred',
    };
  }
}

