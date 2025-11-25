'use server';

import { auth } from '@/lib/auth';
import { getSupabaseClient, createSupabaseAdminClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

/**
 * Residents Server Actions
 * Handles CRUD operations for residents
 */

interface CreateResidentData {
  full_name: string;
  email: string;
  phone_number?: string;
  apartment_number: string;
  residence_id: number;
  role?: 'syndic' | 'resident' | 'guard';
}

interface UpdateResidentData {
  id: string;
  full_name?: string;
  email?: string;
  phone_number?: string;
  apartment_number?: string;
  residence_id?: number;
  role?: 'syndic' | 'resident' | 'guard';
}

/**
 * Create a new resident
 */
export async function createResident(data: CreateResidentData) {
  console.log('[Residents Actions] Creating resident:', data);

  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      throw new Error('User not authenticated');
    }

    // Validation
    if (!data.full_name || !data.email || !data.apartment_number || !data.residence_id) {
      return {
        success: false,
        error: 'Missing required fields: full_name, email, apartment_number, and residence_id are required',
      };
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      return {
        success: false,
        error: 'Invalid email format',
      };
    }

    // Ensure role is not 'syndic' when adding a resident
    const finalRole = (data.role && data.role !== 'syndic') ? data.role : 'resident';
    if (data.role === 'syndic') {
      return {
        success: false,
        error: 'Cannot add a resident with syndic role. Only one syndic per residence is allowed.',
      };
    }

    const supabase = await getSupabaseClient();
    const adminSupabase = createSupabaseAdminClient();

    // Fetch current user's role and residence_id to enforce permissions
    const { data: currentUserProfile } = await adminSupabase
      .from('profiles')
      .select('role, residence_id')
      .eq('id', userId)
      .single();

    // If current user is a syndic, enforce residence_id to be their own
    if (currentUserProfile?.role === 'syndic') {
      if (!currentUserProfile.residence_id) {
        return {
          success: false,
          error: 'You must have a residence assigned to add residents.',
        };
      }
      // Override residence_id with the syndic's residence_id
      data.residence_id = currentUserProfile.residence_id;
      console.log('[Residents Actions] Enforcing syndic residence_id:', data.residence_id);
    }

    // Note: finalRole is guaranteed to be 'resident' or 'guard', never 'syndic'
    // (enforced above with validation)

    // Check if user with this email already exists
    // Use admin client to check users table (bypasses RLS)
    const { data: existingUser } = await adminSupabase
      .from('users')
      .select('id')
      .eq('email', data.email)
      .maybeSingle();

    let finalUserId: string;

    if (existingUser) {
      // Use existing user ID
      finalUserId = existingUser.id;
      console.log('[Residents Actions] Using existing user:', finalUserId);
      
      // Check if profile already exists for this user
      const { data: existingProfile } = await adminSupabase
        .from('profiles')
        .select('id')
        .eq('id', finalUserId)
        .maybeSingle();
      
      if (existingProfile) {
        console.log('[Residents Actions] Profile already exists, updating instead of creating');
        
        // Profile exists, update it instead of creating a new one
        // Auto-verify residents
        const { data: currentProfile } = await adminSupabase
          .from('profiles')
          .select('verified')
          .eq('id', finalUserId)
          .maybeSingle();

        const updateData: any = {
          full_name: data.full_name,
          phone_number: data.phone_number && data.phone_number.trim() ? data.phone_number.trim() : null,
          apartment_number: data.apartment_number,
          residence_id: data.residence_id,
          role: finalRole,
        };

        // Only update verification if not already verified
        if (!currentProfile?.verified) {
          updateData.verified = true;
        }

        // Note: finalRole is guaranteed to be 'resident' or 'guard', never 'syndic'
        const { data: profile, error: profileError } = await adminSupabase
          .from('profiles')
          .update(updateData)
          .eq('id', finalUserId)
          .select(`
            id,
            full_name,
            apartment_number,
            phone_number,
            role,
            created_at,
            residence_id,
            residences (
              id,
              name,
              address
            )
          `)
          .single();

        if (profileError) {
          console.error('[Residents Actions] Error updating profile:', profileError);
          return {
            success: false,
            error: profileError.message || 'Failed to update resident profile',
          };
        }

        console.log('[Residents Actions] Resident profile updated successfully:', profile?.id);
        
        // Revalidate residents page
        revalidatePath('/app/residents');
        
        return {
          success: true,
          resident: profile,
          message: 'Resident updated successfully.',
        };
      }
    } else {
      // Generate a new unique user ID (using timestamp and random string)
      // For NextAuth, we need a text ID
      finalUserId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

      // Create new user in NextAuth users table using admin client to bypass RLS
      const { data: userData, error: userError } = await adminSupabase
        .from('users')
        .insert({
          id: finalUserId,
          email: data.email,
          name: data.full_name,
        })
        .select()
        .single();

      if (userError) {
        console.error('[Residents Actions] Error creating user:', userError);
        return {
          success: false,
          error: userError.message || 'Failed to create user account',
        };
      }

      console.log('[Residents Actions] New user created:', finalUserId);
    }

    // Create profile - managed entirely by code, not database triggers
    // Use admin client directly to avoid RLS infinite recursion issues
    const { data: profile, error: profileError } = await adminSupabase
      .from('profiles')
      .insert({
        id: finalUserId,
        full_name: data.full_name.trim(),
        phone_number: data.phone_number && data.phone_number.trim() ? data.phone_number.trim() : null,
        apartment_number: data.apartment_number.trim(),
        residence_id: data.residence_id,
        role: finalRole,
        verified: true, // Auto-verify residents
      })
      .select(`
        id,
        full_name,
        apartment_number,
        phone_number,
        role,
        created_at,
        residence_id,
        verified,
        residences (
          id,
          name,
          address
        )
      `)
      .single();

    if (profileError) {
      console.error('[Residents Actions] Error creating profile:', profileError);
      
      // If it's a duplicate key error, profile might have been created by NextAuth callback
      // or in a race condition - update it with the correct role and data
      if (profileError.code === '23505') {
        console.log('[Residents Actions] Duplicate key detected, profile already exists. Updating with correct role and data.');
        
        // Check if already verified
        const { data: existingProfile } = await adminSupabase
          .from('profiles')
          .select('verified')
          .eq('id', finalUserId)
          .maybeSingle();

        const updateData: any = {
          full_name: data.full_name.trim(),
          phone_number: data.phone_number && data.phone_number.trim() ? data.phone_number.trim() : null,
          apartment_number: data.apartment_number.trim(),
          residence_id: data.residence_id,
          role: finalRole, // Ensure role is set correctly (not 'syndic')
        };

        // Auto-verify residents
        updateData.verified = true;

        const { data: updatedProfile, error: updateError } = await adminSupabase
          .from('profiles')
          .update(updateData)
          .eq('id', finalUserId)
          .select(`
            id,
            full_name,
            apartment_number,
            phone_number,
            role,
            created_at,
            residence_id,
            residences (
              id,
              name,
              address
            )
          `)
          .single();
        
        if (!updateError && updatedProfile) {
          console.log('[Residents Actions] Profile updated successfully with correct role:', updatedProfile.role);
          
          revalidatePath('/app/residents');
          return {
            success: true,
            resident: updatedProfile,
            message: 'Resident updated successfully.',
          };
        } else if (updateError) {
          console.error('[Residents Actions] Error updating profile:', updateError);
          return {
            success: false,
            error: updateError.message || 'Failed to update resident profile',
          };
        }
      }
      
      return {
        success: false,
        error: profileError.message || 'Failed to create resident profile',
      };
    }

    console.log('[Residents Actions] Resident created successfully:', profile?.id);

    // Revalidate residents page
    revalidatePath('/app/residents');

    return {
      success: true,
      resident: profile,
      message: 'Resident added successfully.',
    };
  } catch (error: any) {
    console.error('[Residents Actions] Error creating resident:', error);
    return {
      success: false,
      error: error.message || 'Failed to create resident',
    };
  }
}

/**
 * Update an existing resident
 */
export async function updateResident(data: UpdateResidentData) {
  console.log('[Residents Actions] Updating resident:', data.id);

  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      throw new Error('User not authenticated');
    }

    if (!data.id) {
      return {
        success: false,
        error: 'Resident ID is required',
      };
    }

    const supabase = await getSupabaseClient();
    const adminSupabase = createSupabaseAdminClient();

    // Get current user's residence_id to verify ownership
    const { data: currentUserProfile } = await adminSupabase
      .from('profiles')
      .select('residence_id, role')
      .eq('id', userId)
      .single();

    if (!currentUserProfile?.residence_id) {
      return {
        success: false,
        error: 'You must have a residence assigned to update residents',
      };
    }

    // Verify the resident being updated belongs to the user's residence
    const { data: targetResident } = await adminSupabase
      .from('profiles')
      .select('residence_id, role')
      .eq('id', data.id)
      .single();

    if (!targetResident) {
      return {
        success: false,
        error: 'Resident not found',
      };
    }

    // Syndics can only update residents from their own residence
    if (currentUserProfile.role === 'syndic' && targetResident.residence_id !== currentUserProfile.residence_id) {
      return {
        success: false,
        error: 'You can only update residents from your own residence',
      };
    }

    // Validate email if provided
    if (data.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.email)) {
        return {
          success: false,
          error: 'Invalid email format',
        };
      }

      // Update user email if provided - use admin client to bypass RLS
      const { error: userError } = await adminSupabase
        .from('users')
        .update({ email: data.email, name: data.full_name || undefined })
        .eq('id', data.id);

      if (userError) {
        console.error('[Residents Actions] Error updating user:', userError);
        // Continue even if user update fails
      }
    }

    // Build update object - ensure all fields are updated properly
    const updateData: any = {};
    if (data.full_name !== undefined) updateData.full_name = data.full_name.trim();
    if (data.phone_number !== undefined) {
      // Convert empty string to null for phone_number
      updateData.phone_number = data.phone_number && data.phone_number.trim() ? data.phone_number.trim() : null;
    }
    if (data.apartment_number !== undefined) updateData.apartment_number = data.apartment_number.trim();
    // Check if user is a syndic before allowing residence_id changes
    const { data: currentProfile } = await adminSupabase
      .from('profiles')
      .select('role, residence_id')
      .eq('id', data.id)
      .maybeSingle();
    
    const isSyndic = currentProfile?.role === 'syndic';
    
    // Prevent syndics from changing their residence_id (one syndic = one residence)
    if (isSyndic && data.residence_id !== undefined && data.residence_id !== currentProfile?.residence_id) {
      return {
        success: false,
        error: 'Un syndic ne peut pas changer de résidence. Un syndic ne peut gérer qu\'une seule résidence.',
      };
    }
    
    if (data.residence_id !== undefined) updateData.residence_id = data.residence_id;
    
    // Validate role: prevent setting role to 'syndic' if there's already a syndic in the residence
    // But allow preserving syndic role if the user is already a syndic
    if (data.role !== undefined) {
      // Use the profile we already fetched above
      const isCurrentlySyndic = isSyndic;
      
      // Only validate if trying to SET role to syndic (not preserving it)
      if (data.role === 'syndic' && !isCurrentlySyndic) {
        // Get the residence_id (either from update data or from existing profile)
        const residenceIdToCheck = data.residence_id || currentProfile?.residence_id;
        
        if (residenceIdToCheck) {
          const { data: existingSyndic } = await adminSupabase
            .from('profiles')
            .select('id')
            .eq('residence_id', residenceIdToCheck)
            .eq('role', 'syndic')
            .neq('id', data.id) // Exclude current user
            .maybeSingle();
          
          if (existingSyndic) {
            return {
              success: false,
              error: 'This residence already has a syndic. Only one syndic per residence is allowed.',
            };
          }
        }
      }
      
      // Allow updating role (including preserving syndic role)
      updateData.role = data.role;
    }

    // Update profile - use admin client to bypass RLS and avoid infinite recursion
    const { data: profile, error: profileError } = await adminSupabase
      .from('profiles')
      .update(updateData)
      .eq('id', data.id)
      .select(`
        id,
        full_name,
        apartment_number,
        phone_number,
        role,
        created_at,
        residence_id,
        residences (
          id,
          name,
          address
        )
      `)
      .single();

    if (profileError) {
      console.error('[Residents Actions] Error updating profile:', profileError);
      return {
        success: false,
        error: profileError.message || 'Failed to update resident',
      };
    }

    console.log('[Residents Actions] Resident updated successfully:', profile.id);

    // Revalidate residents page
    revalidatePath('/app/residents');

    return {
      success: true,
      resident: profile,
    };
  } catch (error: any) {
    console.error('[Residents Actions] Error updating resident:', error);
    return {
      success: false,
      error: error.message || 'Failed to update resident',
    };
  }
}

/**
 * Delete a resident
 * Prevents deletion of syndic accounts unless it's the user's own account
 */
export async function deleteResident(residentId: string) {
  console.log('[Residents Actions] Deleting resident:', residentId);

  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      throw new Error('User not authenticated');
    }

    if (!residentId) {
      return {
        success: false,
        error: 'Resident ID is required',
      };
    }

    const supabase = await getSupabaseClient();
    const adminSupabase = createSupabaseAdminClient();

    // Get current user's residence_id to verify ownership
    const { data: currentUserProfile } = await adminSupabase
      .from('profiles')
      .select('residence_id, role')
      .eq('id', userId)
      .single();

    if (!currentUserProfile?.residence_id) {
      return {
        success: false,
        error: 'You must have a residence assigned to delete residents',
      };
    }

    // Get the resident being deleted to check their role and residence
    // Use admin client to bypass RLS and avoid infinite recursion
    const { data: residentToDelete, error: residentError } = await adminSupabase
      .from('profiles')
      .select('id, role, full_name, residence_id')
      .eq('id', residentId)
      .single();

    if (residentError || !residentToDelete) {
      console.error('[Residents Actions] Error fetching resident:', residentError);
      return {
        success: false,
        error: 'Resident not found',
      };
    }

    // Syndics can only delete residents from their own residence
    if (currentUserProfile.role === 'syndic' && residentToDelete.residence_id !== currentUserProfile.residence_id) {
      return {
        success: false,
        error: 'You can only delete residents from your own residence',
      };
    }

    // Check if the resident being deleted is a syndic
    if (residentToDelete.role === 'syndic') {
      // Only allow deletion if it's the user's own account
      if (residentId !== userId) {
        console.log('[Residents Actions] Attempt to delete syndic account blocked:', {
          currentUser: userId,
          targetResident: residentId,
          targetRole: residentToDelete.role,
        });
        return {
          success: false,
          error: 'Cannot delete syndic accounts. Syndics can only delete their own account.',
        };
      }
      // Allow deletion of own account with warning
      console.log('[Residents Actions] User deleting their own syndic account:', userId);
    }

    // Delete profile (this will cascade to related records due to foreign key constraints)
    // Use admin client to bypass RLS and avoid infinite recursion
    // For syndics, ensure we only delete from their residence
    let deleteQuery = adminSupabase
      .from('profiles')
      .delete()
      .eq('id', residentId);
    
    // Additional security: if user is syndic, ensure residence matches
    if (currentUserProfile.role === 'syndic') {
      deleteQuery = deleteQuery.eq('residence_id', currentUserProfile.residence_id);
    }
    
    const { error: deleteError } = await deleteQuery;

    if (deleteError) {
      console.error('[Residents Actions] Error deleting profile:', deleteError);
      return {
        success: false,
        error: deleteError.message || 'Failed to delete resident',
      };
    }

    console.log('[Residents Actions] Resident deleted successfully:', residentId);

    // Revalidate residents page
    revalidatePath('/app/residents');

    return {
      success: true,
    };
  } catch (error: any) {
    console.error('[Residents Actions] Error deleting resident:', error);
    return {
      success: false,
      error: error.message || 'Failed to delete resident',
    };
  }
}

/**
 * Get residences for dropdown - only returns the user's own residence
 */
export async function getResidences() {
  console.log('[Residents Actions] Fetching residences');

  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      throw new Error('User not authenticated');
    }

    // Use admin client to bypass RLS policy recursion issues
    const supabase = createSupabaseAdminClient();

    // Get user's profile to get their residence_id
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('residence_id')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      console.error('[Residents Actions] Error fetching user profile:', profileError);
      return {
        success: false,
        error: profileError.message || 'Failed to fetch user profile',
        residences: [],
      };
    }

    if (!profile?.residence_id) {
      console.warn('[Residents Actions] User has no residence_id');
      return {
        success: true,
        residences: [],
      };
    }

    // Fetch only the user's residence
    const { data: residences, error } = await supabase
      .from('residences')
      .select('id, name, address, city')
      .eq('id', profile.residence_id)
      .order('name', { ascending: true });

    if (error) {
      console.error('[Residents Actions] Error fetching residences:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch residences',
        residences: [],
      };
    }

    console.log('[Residents Actions] Fetched', residences?.length || 0, 'residences for residence_id:', profile.residence_id);

    return {
      success: true,
      residences: residences || [],
    };
  } catch (error: any) {
    console.error('[Residents Actions] Error fetching residences:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch residences',
      residences: [],
    };
  }
}

