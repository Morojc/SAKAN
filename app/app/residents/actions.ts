'use server';

import { auth } from '@/lib/auth';
import { getSupabaseClient, createSupabaseAdminClient } from '@/utils/supabase/server';
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

    const supabase = await getSupabaseClient();
    const adminSupabase = createSupabaseAdminClient();

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
        const { data: profile, error: profileError } = await adminSupabase
          .from('profiles')
          .update({
            full_name: data.full_name,
            phone_number: data.phone_number && data.phone_number.trim() ? data.phone_number.trim() : null,
            apartment_number: data.apartment_number,
            residence_id: data.residence_id,
            role: data.role || 'resident',
          })
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

    // Create profile (only if it doesn't already exist)
    // Use admin client directly to avoid RLS infinite recursion issues
    // When creating profiles for new users, RLS policies can cause recursion
    const { data: profile, error: profileError } = await adminSupabase
      .from('profiles')
      .insert({
        id: finalUserId,
        full_name: data.full_name.trim(),
        phone_number: data.phone_number && data.phone_number.trim() ? data.phone_number.trim() : null,
        apartment_number: data.apartment_number.trim(),
        residence_id: data.residence_id,
        role: data.role || 'resident',
      })
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
      console.error('[Residents Actions] Error creating profile:', profileError);
      
      // If it's a duplicate key error, the profile might have been created between our check and insert
      // Try to fetch and return the existing profile
      if (profileError.code === '23505') {
        console.log('[Residents Actions] Duplicate key detected, fetching existing profile');
        const { data: existingProfile, error: fetchError } = await adminSupabase
          .from('profiles')
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
          .eq('id', finalUserId)
          .single();
        
        if (!fetchError && existingProfile) {
          console.log('[Residents Actions] Found existing profile, returning it');
          revalidatePath('/app/residents');
          return {
            success: true,
            resident: existingProfile,
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
    if (data.residence_id !== undefined) updateData.residence_id = data.residence_id;
    if (data.role !== undefined) updateData.role = data.role;

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

    // Get the resident being deleted to check their role
    // Use admin client to bypass RLS and avoid infinite recursion
    const { data: residentToDelete, error: residentError } = await adminSupabase
      .from('profiles')
      .select('id, role, full_name')
      .eq('id', residentId)
      .single();

    if (residentError || !residentToDelete) {
      console.error('[Residents Actions] Error fetching resident:', residentError);
      return {
        success: false,
        error: 'Resident not found',
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
    const { error: deleteError } = await adminSupabase
      .from('profiles')
      .delete()
      .eq('id', residentId);

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
 * Get all residences for dropdown
 */
export async function getResidences() {
  console.log('[Residents Actions] Fetching residences');

  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      throw new Error('User not authenticated');
    }

    const supabase = await getSupabaseClient();

    const { data: residences, error } = await supabase
      .from('residences')
      .select('id, name, address, city')
      .order('name', { ascending: true });

    if (error) {
      console.error('[Residents Actions] Error fetching residences:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch residences',
        residences: [],
      };
    }

    console.log('[Residents Actions] Fetched', residences?.length || 0, 'residences');

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

