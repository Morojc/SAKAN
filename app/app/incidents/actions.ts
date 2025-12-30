'use server';

import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

/**
 * Incidents Server Actions
 * Handles CRUD operations for incidents
 */

type IncidentStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

interface CreateIncidentData {
  title: string;
  description: string;
  residence_id: number;
  photo_url?: string;
}

interface UpdateIncidentData {
  id: number;
  title?: string;
  description?: string;
  status?: IncidentStatus;
  assigned_to?: string | null;
  photo_url?: string;
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
 * Create a new incident
 */
export async function createIncident(data: CreateIncidentData) {
  console.log('[Incidents Actions] Creating incident:', data);

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
    if (!data.title || !data.description || !data.residence_id) {
      return {
        success: false,
        error: 'Missing required fields: title, description, and residence_id are required',
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

    // Verify user has access to the residence
    const userResidenceId = await getUserResidenceId(userId, userProfile.role, adminSupabase);
    
    if (!userResidenceId || userResidenceId !== data.residence_id) {
      return {
        success: false,
        error: 'You do not have permission to create incidents for this residence',
      };
    }

    // Create incident
    const { data: incident, error } = await adminSupabase
      .from('incidents')
      .insert({
        title: data.title,
        description: data.description,
        residence_id: data.residence_id,
        user_id: userId,
        photo_url: data.photo_url || null,
        status: 'open' as IncidentStatus,
      })
      .select()
      .single();

    if (error) {
      console.error('[Incidents Actions] Error creating incident:', error);
      return {
        success: false,
        error: error.message || 'Failed to create incident',
      };
    }

    console.log('[Incidents Actions] Incident created successfully:', incident?.id);
    revalidatePath('/app/incidents');
    
    return {
      success: true,
      data: incident,
    };

  } catch (error: any) {
    console.error('[Incidents Actions] Unexpected error:', error);
    return {
      success: false,
      error: error.message || 'An unexpected error occurred',
    };
  }
}

/**
 * Update an existing incident
 */
export async function updateIncident(data: UpdateIncidentData) {
  console.log('[Incidents Actions] Updating incident:', data.id);

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
        error: 'Incident ID is required',
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

    // Get existing incident to verify residence
    const { data: existingIncident, error: fetchError } = await adminSupabase
      .from('incidents')
      .select('residence_id, user_id')
      .eq('id', data.id)
      .single();

    if (fetchError || !existingIncident) {
      return {
        success: false,
        error: 'Incident not found',
      };
    }

    // Verify permissions
    // Syndics can update all incidents in their residence
    // Residents can only update their own incidents
    const userResidenceId = await getUserResidenceId(userId, userProfile.role, adminSupabase);
    
    const canUpdate = 
      userProfile.role === 'syndic' && userResidenceId === existingIncident.residence_id ||
      (userProfile.role === 'resident' && existingIncident.user_id === userId);

    if (!canUpdate) {
      return {
        success: false,
        error: 'You do not have permission to update this incident',
      };
    }

    // Build update object with only provided fields
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };
    
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.status !== undefined) {
      // Only syndics can change status
      if (userProfile.role === 'syndic') {
        updateData.status = data.status;
      }
    }
    if (data.assigned_to !== undefined) {
      // Only syndics can assign incidents
      if (userProfile.role === 'syndic') {
        updateData.assigned_to = data.assigned_to;
      }
    }
    if (data.photo_url !== undefined) updateData.photo_url = data.photo_url;

    // Update incident
    const { data: incident, error } = await adminSupabase
      .from('incidents')
      .update(updateData)
      .eq('id', data.id)
      .select()
      .single();

    if (error) {
      console.error('[Incidents Actions] Error updating incident:', error);
      return {
        success: false,
        error: error.message || 'Failed to update incident',
      };
    }

    console.log('[Incidents Actions] Incident updated successfully:', incident?.id);
    revalidatePath('/app/incidents');
    
    return {
      success: true,
      data: incident,
    };

  } catch (error: any) {
    console.error('[Incidents Actions] Unexpected error:', error);
    return {
      success: false,
      error: error.message || 'An unexpected error occurred',
    };
  }
}

/**
 * Delete an incident
 */
export async function deleteIncident(incidentId: number) {
  console.log('[Incidents Actions] Deleting incident:', incidentId);

  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return {
        success: false,
        error: 'User not authenticated',
      };
    }

    if (!incidentId) {
      return {
        success: false,
        error: 'Incident ID is required',
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

    // Get existing incident to verify residence
    const { data: existingIncident, error: fetchError } = await adminSupabase
      .from('incidents')
      .select('residence_id, user_id')
      .eq('id', incidentId)
      .single();

    if (fetchError || !existingIncident) {
      return {
        success: false,
        error: 'Incident not found',
      };
    }

    // Verify permissions
    // Only syndics can delete incidents
    if (userProfile.role !== 'syndic') {
      return {
        success: false,
        error: 'Only syndics can delete incidents',
      };
    }

    const userResidenceId = await getUserResidenceId(userId, userProfile.role, adminSupabase);
    
    if (!userResidenceId || userResidenceId !== existingIncident.residence_id) {
      return {
        success: false,
        error: 'You do not have permission to delete this incident',
      };
    }

    // Delete incident
    const { error } = await adminSupabase
      .from('incidents')
      .delete()
      .eq('id', incidentId);

    if (error) {
      console.error('[Incidents Actions] Error deleting incident:', error);
      return {
        success: false,
        error: error.message || 'Failed to delete incident',
      };
    }

    console.log('[Incidents Actions] Incident deleted successfully:', incidentId);
    revalidatePath('/app/incidents');
    
    return {
      success: true,
    };

  } catch (error: any) {
    console.error('[Incidents Actions] Unexpected error:', error);
    return {
      success: false,
      error: error.message || 'An unexpected error occurred',
    };
  }
}

/**
 * Upload incident photo to Supabase storage
 */
export async function uploadIncidentPhoto(formData: FormData): Promise<{ success: boolean; url?: string; error?: string }> {
  console.log('[Incidents Actions] Uploading incident photo');

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return {
        success: false,
        error: 'Not authenticated',
      };
    }

    const file = formData.get('file') as File;
    
    if (!file) {
      return {
        success: false,
        error: 'No file provided',
      };
    }

    // Validate file type (images only)
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    
    if (!allowedTypes.includes(file.type)) {
      return {
        success: false,
        error: 'Invalid file type. Please upload an image file.',
      };
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return {
        success: false,
        error: 'File size too large. Maximum size is 10MB.',
      };
    }

    const supabase = createSupabaseAdminClient();

    // Upload file
    const fileExt = file.name.split('.').pop();
    const fileName = `${session.user.id}/incident-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `incidents/${fileName}`;

    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from('SAKAN')
      .upload(filePath, arrayBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('[Incidents Actions] Storage error:', uploadError);
      return {
        success: false,
        error: 'Failed to upload file. Please try again.',
      };
    }

    const urlData = supabase.storage
      .from('SAKAN')
      .getPublicUrl(filePath);

    // Handle both API structure: { data: { publicUrl } } and direct: { publicUrl }
    // Production builds may differ from types due to minification/bundling
    // Also handle case where urlData might be undefined
    const publicUrl = urlData?.data?.publicUrl || (urlData as any)?.publicUrl;
    
    if (!publicUrl) {
      console.error('[Incidents Actions] Failed to get public URL for file:', filePath, 'urlData:', urlData);
      return {
        success: false,
        error: 'Failed to generate file URL',
      };
    }
    
    console.log('[Incidents Actions] File uploaded successfully:', publicUrl);
    
    return {
      success: true,
      url: publicUrl,
    };

  } catch (error: any) {
    console.error('[Incidents Actions] Unexpected error uploading file:', error);
    return {
      success: false,
      error: error.message || 'Failed to upload file',
    };
  }
}

/**
 * Get available users for assignment (guards and syndics)
 */
export async function getAssignableUsers(residenceId: number) {
  console.log('[Incidents Actions] Fetching assignable users for residence:', residenceId);

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

    // Get user profile to check if syndic
    const { data: userProfile } = await adminSupabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();

    if (userProfile?.role !== 'syndic') {
      return {
        success: false,
        error: 'Only syndics can view assignable users',
      };
    }

    // Get guards and syndic for this residence
    const { data: residence } = await adminSupabase
      .from('residences')
      .select('syndic_user_id, guard_user_id')
      .eq('id', residenceId)
      .maybeSingle();

    if (!residence) {
      return {
        success: false,
        error: 'Residence not found',
      };
    }

    const userIds: string[] = [];
    if (residence.syndic_user_id) userIds.push(residence.syndic_user_id);
    if (residence.guard_user_id) userIds.push(residence.guard_user_id);

    if (userIds.length === 0) {
      return {
        success: true,
        data: [],
      };
    }

    // Get profiles
    const { data: profiles, error } = await adminSupabase
      .from('profiles')
      .select('id, full_name, role')
      .in('id', userIds)
      .in('role', ['syndic', 'guard']);

    if (error) {
      console.error('[Incidents Actions] Error fetching assignable users:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch assignable users',
      };
    }

    console.log('[Incidents Actions] Found', profiles?.length || 0, 'assignable users');
    
    return {
      success: true,
      data: profiles || [],
    };

  } catch (error: any) {
    console.error('[Incidents Actions] Unexpected error:', error);
    return {
      success: false,
      error: error.message || 'An unexpected error occurred',
    };
  }
}

