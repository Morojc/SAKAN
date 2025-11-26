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
 * Helper to get the current user's managed residence ID
 */
async function getManagedResidenceId(userId: string, supabase: any) {
  // Check if syndic
  const { data: syndicResidence } = await supabase
    .from('residences')
    .select('id')
    .eq('syndic_user_id', userId)
    .maybeSingle();
  
  if (syndicResidence) return syndicResidence.id;

  // Check if guard
  const { data: guardResidence } = await supabase
    .from('residences')
    .select('id')
    .eq('guard_user_id', userId)
    .maybeSingle();

  if (guardResidence) return guardResidence.id;

  return null;
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

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      return {
        success: false,
        error: 'Invalid email format',
      };
    }

    // Validate role - only 'resident' or 'guard' are allowed when adding via this form
    // Syndics cannot be added as residents - they must be assigned to residences via syndic_user_id
    if (data.role === 'syndic') {
      return {
        success: false,
        error: 'Cannot add a resident with syndic role. Only one syndic per residence is allowed.',
      };
    }

    // Default to 'resident' if no role provided or invalid role
    const finalRole = (data.role === 'resident' || data.role === 'guard') ? data.role : 'resident';

    const adminSupabase = createSupabaseAdminClient();

    // Verify permissions: Current user must be the manager (syndic) of the target residence
    const managedResidenceId = await getManagedResidenceId(userId, adminSupabase);
    
    if (!managedResidenceId || managedResidenceId !== data.residence_id) {
        return {
          success: false,
        error: 'You are not authorized to add residents to this residence.',
        };
    }

    // Check if user with this email already exists
    const { data: existingUser } = await adminSupabase
      .from('users')
      .select('id')
      .eq('email', data.email)
      .maybeSingle();

    let finalUserId: string;

    if (existingUser) {
      finalUserId = existingUser.id;
      console.log('[Residents Actions] Using existing user:', finalUserId);
    } else {
      // Create new user
      finalUserId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      const { error: userError } = await adminSupabase
        .from('users')
        .insert({
          id: finalUserId,
          email: data.email,
          name: data.full_name,
        });

      if (userError) {
        console.error('[Residents Actions] Error creating user:', userError);
        return { success: false, error: 'Failed to create user account' };
      }
    }

    // Ensure profile exists with 'resident' role
    const { data: existingProfile } = await adminSupabase
      .from('profiles')
      .select('id, verified, role')
      .eq('id', finalUserId)
      .maybeSingle();

    // Use upsert to handle both new profiles and existing profiles (from trigger)
    // Set role based on what was selected in the form (resident or guard)
    const { error: profileError } = await adminSupabase
      .from('profiles')
      .upsert({
        id: finalUserId,
        full_name: data.full_name.trim(),
        phone_number: data.phone_number?.trim() || null,
        role: finalRole, // Use the role selected in the form (resident or guard)
        verified: existingProfile?.verified !== undefined ? existingProfile.verified : true, // Preserve existing verified status or auto-verify new
        onboarding_completed: existingProfile?.onboarding_completed !== undefined ? existingProfile.onboarding_completed : false,
      }, {
        onConflict: 'id'
      });

    if (profileError) {
      console.error('[Residents Actions] Error creating/updating profile:', profileError);
      return { success: false, error: 'Failed to create resident profile' };
    }

    // Handle role-specific assignment
    if (finalRole === 'guard') {
      // Guards are assigned via residences.guard_user_id (1:1 relationship)
      // Check if residence already has a guard
      const { data: existingResidence } = await adminSupabase
        .from('residences')
        .select('id, guard_user_id')
        .eq('id', data.residence_id)
          .single();
        
      if (existingResidence?.guard_user_id) {
          return {
            success: false,
          error: 'This residence already has a guard assigned. Only one guard per residence is allowed.',
        };
      }

      // Assign guard to residence
      const { error: guardError } = await adminSupabase
        .from('residences')
        .update({ guard_user_id: finalUserId })
        .eq('id', data.residence_id);

      if (guardError) {
        console.error('[Residents Actions] Error assigning guard:', guardError);
        return { success: false, error: 'Failed to assign guard to residence' };
      }
    } else {
      // Residents are assigned via profile_residences (M:N relationship)
      // Check if already in residence
      const { data: existingLink } = await adminSupabase
        .from('profile_residences')
        .select('id')
        .eq('profile_id', finalUserId)
        .eq('residence_id', data.residence_id)
        .maybeSingle();

      if (existingLink) {
        return { success: false, error: 'User is already a resident of this residence.' };
      }

      const { error: linkError } = await adminSupabase
        .from('profile_residences')
        .insert({
          profile_id: finalUserId,
          residence_id: data.residence_id,
          apartment_number: data.apartment_number.trim(),
          verified: true
        });

      if (linkError) {
        console.error('[Residents Actions] Error linking resident:', linkError);
        return { success: false, error: 'Failed to assign resident to residence' };
      }
    }

    revalidatePath('/app/residents');

    // Fetch complete profile data to return for optimistic update
    const { data: fullProfile } = await adminSupabase
        .from('profiles')
        .select('id, full_name, phone_number, role, created_at')
        .eq('id', finalUserId)
        .single();
    
    const { data: residence } = await adminSupabase
        .from('residences')
        .select('id, name, address')
        .eq('id', data.residence_id)
        .single();

    // For guards, apartment_number is not applicable (they're assigned via guard_user_id)
    // For residents, apartment_number is from profile_residences
    const returnedResident = {
        ...fullProfile,
        apartment_number: finalRole === 'guard' ? null : data.apartment_number,
        residence_id: data.residence_id,
        residences: residence ? [residence] : []
    };

    return {
      success: true,
      resident: returnedResident,
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

    if (!userId) throw new Error('User not authenticated');
    if (!data.id) return { success: false, error: 'Resident ID is required' };

    const adminSupabase = createSupabaseAdminClient();

    // Verify permissions
    const managedResidenceId = await getManagedResidenceId(userId, adminSupabase);
    if (!managedResidenceId) {
        return { success: false, error: 'You do not manage any residence.' };
    }

    // Verify target user is in this residence
    const { data: link } = await adminSupabase
        .from('profile_residences')
        .select('id')
        .eq('profile_id', data.id)
        .eq('residence_id', managedResidenceId)
        .maybeSingle();
    
    if (!link) {
        return { success: false, error: 'Resident not found in your residence.' };
    }

    // Update User Email
    if (data.email) {
      const { error: userError } = await adminSupabase
        .from('users')
            .update({ email: data.email, name: data.full_name })
        .eq('id', data.id);
        if (userError) console.error('Error updating email:', userError);
    }

    // Update Profile (Global info)
    const profileUpdates: any = {};
    if (data.full_name) profileUpdates.full_name = data.full_name.trim();
    if (data.phone_number !== undefined) profileUpdates.phone_number = data.phone_number?.trim() || null;
    if (data.role) profileUpdates.role = data.role;

    if (Object.keys(profileUpdates).length > 0) {
        await adminSupabase.from('profiles').update(profileUpdates).eq('id', data.id);
    }

    // Update Residence Link (Apartment Number)
    if (data.apartment_number) {
        await adminSupabase
            .from('profile_residences')
            .update({ apartment_number: data.apartment_number.trim() })
            .eq('profile_id', data.id)
            .eq('residence_id', managedResidenceId);
    }

    revalidatePath('/app/residents');

    // Fetch complete resident data to return for optimistic update
    const { data: fullProfile } = await adminSupabase
      .from('profiles')
        .select('id, full_name, phone_number, role, created_at')
      .eq('id', data.id)
      .single();

    // Get apartment number (either updated or existing)
    let apartmentNumber = data.apartment_number;
    if (!apartmentNumber) {
        const { data: pr } = await adminSupabase
            .from('profile_residences')
            .select('apartment_number')
            .eq('profile_id', data.id)
            .eq('residence_id', managedResidenceId)
            .single();
        apartmentNumber = pr?.apartment_number;
    }

    const { data: residence } = await adminSupabase
        .from('residences')
        .select('id, name, address')
        .eq('id', managedResidenceId)
        .single();

    const returnedResident = {
        ...fullProfile,
        apartment_number: apartmentNumber,
        residence_id: managedResidenceId,
        residences: residence ? [residence] : []
    };

    return {
      success: true,
        resident: returnedResident
    };

  } catch (error: any) {
    console.error('[Residents Actions] Error updating resident:', error);
    return { success: false, error: error.message || 'Failed to update resident' };
  }
}

/**
 * Delete a resident
 * Removes them from the residence and deletes their account from the database
 */
export async function deleteResident(residentId: string) {
  console.log('[Residents Actions] Deleting resident:', residentId);

  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) throw new Error('User not authenticated');

    const adminSupabase = createSupabaseAdminClient();
    const managedResidenceId = await getManagedResidenceId(userId, adminSupabase);

    if (!managedResidenceId) {
        return { success: false, error: 'Unauthorized' };
    }

    // Get resident's profile to check role
    const { data: residentProfile, error: profileError } = await adminSupabase
        .from('profiles')
        .select('id, role')
        .eq('id', residentId)
        .maybeSingle();

    if (profileError) {
        console.error('[Residents Actions] Error fetching resident profile:', profileError);
        return { success: false, error: 'Failed to fetch resident information' };
    }

    if (!residentProfile) {
        return { success: false, error: 'Resident not found' };
    }

    // Check if resident is a guard assigned to this residence
    if (residentProfile.role === 'guard') {
        const { data: residence } = await adminSupabase
            .from('residences')
            .select('guard_user_id')
            .eq('id', managedResidenceId)
      .single();

        if (residence?.guard_user_id === residentId) {
            // Unlink guard from residence
            await adminSupabase
                .from('residences')
                .update({ guard_user_id: null })
                .eq('id', managedResidenceId);
        }
    } else {
        // For residents: Remove from profile_residences for this residence
        const { error: linkError } = await adminSupabase
            .from('profile_residences')
            .delete()
            .eq('profile_id', residentId)
            .eq('residence_id', managedResidenceId);

        if (linkError) {
            console.error('[Residents Actions] Error removing resident link:', linkError);
            return { success: false, error: 'Failed to remove resident from residence' };
        }

        // Check if resident is in other residences
        const { data: otherResidences } = await adminSupabase
            .from('profile_residences')
            .select('id')
            .eq('profile_id', residentId)
            .neq('residence_id', managedResidenceId);

        // If resident is in other residences, don't delete their account
        if (otherResidences && otherResidences.length > 0) {
            console.log('[Residents Actions] Resident is in other residences, only removing from this residence');
            revalidatePath('/app/residents');
            return { success: true };
        }
    }

    // Create dbasakan client for comprehensive cleanup (same as account deletion)
    const { createClient } = await import('@supabase/supabase-js');
    const dbasakanClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SECRET_KEY!,
        {
            db: { schema: 'dbasakan' },
            auth: { persistSession: false },
        }
    );

    // Get user email for cleanup
    const { data: userData } = await dbasakanClient
        .from('users')
        .select('email')
        .eq('id', residentId)
        .maybeSingle();

    const userEmail = userData?.email || null;

    // Delete user-related data (similar to account deletion but for residents)
    console.log('[Residents Actions] Deleting resident account and all related data:', residentId);

    // 1. Delete dependent data where user is the "subject"
    await dbasakanClient.from('profile_residences').delete().eq('profile_id', residentId);
    await dbasakanClient.from('notifications').delete().eq('user_id', residentId);
    await dbasakanClient.from('poll_votes').delete().eq('user_id', residentId);
    if (userEmail) {
        await dbasakanClient.from('verification_tokens').delete().eq('identifier', userEmail);
    }

    // 2. Nullify references where user was creator/actor
    await dbasakanClient.from('announcements').update({ created_by: null }).eq('created_by', residentId);
    await dbasakanClient.from('expenses').update({ created_by: null }).eq('created_by', residentId);
    await dbasakanClient.from('polls').update({ created_by: null }).eq('created_by', residentId);
    await dbasakanClient.from('balance_snapshots').update({ created_by: null }).eq('created_by', residentId);
    await dbasakanClient.from('payments').update({ verified_by: null }).eq('verified_by', residentId);
    await dbasakanClient.from('incidents').update({ assigned_to: null }).eq('assigned_to', residentId);

    // 3. Delete data where user is required (NOT NULL FK)
    await dbasakanClient.from('deliveries').delete().eq('logged_by', residentId);
    await dbasakanClient.from('deliveries').delete().eq('recipient_id', residentId);
    await dbasakanClient.from('payments').delete().eq('user_id', residentId);
    await dbasakanClient.from('fees').delete().eq('user_id', residentId);
    await dbasakanClient.from('incidents').delete().eq('user_id', residentId);
    await dbasakanClient.from('access_logs').delete().eq('generated_by', residentId);
    await dbasakanClient.from('access_logs').update({ scanned_by: null }).eq('scanned_by', residentId);

    // 4. Delete document submissions and files
    const { data: submissions } = await dbasakanClient
        .from('syndic_document_submissions')
        .select('document_url, id_card_url')
        .eq('user_id', residentId);

    if (submissions && submissions.length > 0) {
        const filesToDelete: string[] = [];
        for (const submission of submissions) {
            if (submission.document_url) {
                const documentPath = submission.document_url.split('/syndic-documents/')[1];
                if (documentPath) filesToDelete.push(`syndic-documents/${documentPath}`);
            }
            if (submission.id_card_url) {
                const idCardPath = submission.id_card_url.split('/syndic-documents/')[1];
                if (idCardPath) filesToDelete.push(`syndic-documents/${idCardPath}`);
            }
        }

        if (filesToDelete.length > 0) {
            await adminSupabase.storage.from('SAKAN').remove(filesToDelete);
        }

        await dbasakanClient.from('syndic_document_submissions').delete().eq('user_id', residentId);
    }

    // 5. Delete stripe customer if exists
    await adminSupabase.from('stripe_customers').delete().eq('user_id', residentId);

    // 6. Delete profile
    await dbasakanClient.from('profiles').delete().eq('id', residentId);

    // 7. Delete from users (NextAuth)
    const { error: deleteUserError } = await dbasakanClient.from('users').delete().eq('id', residentId);
    if (deleteUserError) {
        console.error('[Residents Actions] Error deleting from dbasakan.users:', deleteUserError);
        // Fallback to public schema
        await adminSupabase.from('users').delete().eq('id', residentId);
    }

    // 8. Delete accounts and sessions (using dbasakan client)
    await dbasakanClient.from('accounts').delete().eq('user_id', residentId);
    await dbasakanClient.from('sessions').delete().eq('user_id', residentId);

    console.log('[Residents Actions] Resident account deleted successfully:', residentId);

    revalidatePath('/app/residents');
    return { success: true };

  } catch (error: any) {
    console.error('[Residents Actions] Error deleting resident:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get residences for dropdown
 */
export async function getResidences() {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) throw new Error('User not authenticated');

    const adminSupabase = createSupabaseAdminClient();
    const managedResidenceId = await getManagedResidenceId(userId, adminSupabase);

    if (!managedResidenceId) {
        return { success: true, residences: [] };
    }

    const { data: residence } = await adminSupabase
      .from('residences')
      .select('id, name, address, city')
        .eq('id', managedResidenceId)
        .single();

    return {
      success: true,
        residences: residence ? [residence] : []
    };

  } catch (error: any) {
    console.error('[Residents Actions] Error fetching residences:', error);
    return { success: false, residences: [] };
  }
}
