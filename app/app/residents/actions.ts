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
    if (!data.full_name || !data.email || !data.residence_id) {
      return {
        success: false,
        error: 'Missing required fields: full_name, email, and residence_id are required',
      };
    }

    // Validate apartment number based on role
    if (!data.apartment_number || !data.apartment_number.trim()) {
      return {
        success: false,
        error: 'Apartment number is required',
      };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      return {
        success: false,
        error: 'Invalid email format',
      };
    }

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
      .select('id, email')
      .eq('email', data.email.trim().toLowerCase())
      .maybeSingle();
    
    // Check if existing user is a syndic - if so, allow them to be added as resident
    // (their syndic role will be preserved automatically)
    let isExistingSyndic = false;
    if (existingUser) {
      const { data: existingProfile } = await adminSupabase
        .from('profiles')
        .select('role')
        .eq('id', existingUser.id)
        .maybeSingle();
      isExistingSyndic = existingProfile?.role === 'syndic';
    }

    // Note: Role validation is not needed here because:
    // 1. The dropdown only allows 'resident' or 'guard' (not 'syndic')
    // 2. Existing syndics can be added as residents - their role will be preserved automatically
    // 3. Syndics can be residents in OTHER residences (not the one they manage)
    // They are assigned to residences as syndics via residences.syndic_user_id (1:1)
    // But can also be residents via profile_residences (M:N) in different residences

    // Default to 'resident' if no role provided or invalid role
    // Note: For existing users (especially syndics), their role will be preserved automatically
    const finalRole = (data.role === 'resident' || data.role === 'guard') ? data.role : 'resident';

    // Validate apartment number: Cannot be "0" for residents, only guards can use "0"
    if (finalRole === 'resident' && data.apartment_number.trim() === '0') {
      return {
        success: false,
        error: 'Apartment number cannot be 0 for residents. Only guards can use apartment number 0.',
      };
    }

    // Check if syndic is adding themselves
    // Compare both by user ID and by email (case-insensitive) for better detection
    const currentUserEmail = session?.user?.email?.toLowerCase();
    const enteredEmail = data.email.trim().toLowerCase();
    const isSyndicAddingSelf = (existingUser?.id === userId) || (currentUserEmail === enteredEmail);

    // If email exists, check the user's role and residence assignments
    if (existingUser) {
      // Check if the existing user is a syndic
      const { data: existingProfile } = await adminSupabase
        .from('profiles')
        .select('id, role')
        .eq('id', existingUser.id)
        .maybeSingle();

      // Check if apartment number is already reserved by another user in this residence
      // Each apartment can only be assigned to one user per residence
      const apartmentNumber = data.apartment_number?.trim() || null;
      
      if (apartmentNumber) {
        // Check if this apartment is already taken by another user
        const { data: existingApartmentReservation } = await adminSupabase
          .from('profile_residences')
          .select('id, profile_id, apartment_number')
          .eq('residence_id', data.residence_id)
          .eq('apartment_number', apartmentNumber)
          .maybeSingle();

        if (existingApartmentReservation && existingApartmentReservation.profile_id !== existingUser.id) {
          // Get the name of the user who already has this apartment
          const { data: existingResidentProfile } = await adminSupabase
            .from('profiles')
            .select('full_name')
            .eq('id', existingApartmentReservation.profile_id)
            .maybeSingle();

          const residentName = existingResidentProfile?.full_name || 'another resident';
          return {
            success: false,
            error: `Apartment ${apartmentNumber} is already reserved by ${residentName} in this residence. Each apartment can only be assigned to one user.`,
          };
        }
      }

      // Check if user is already a resident in this residence with the same apartment number
      // This check prevents adding the same user to the same apartment multiple times
      // Users can be in the same residence multiple times, but only once per apartment number
      // (The unique constraint on (profile_id, residence_id, apartment_number) also enforces this at DB level)
      const { data: existingResidentLink } = await adminSupabase
        .from('profile_residences')
        .select('id, apartment_number')
        .eq('profile_id', existingUser.id)
        .eq('residence_id', data.residence_id)
        .eq('apartment_number', apartmentNumber)
        .maybeSingle();

      if (existingResidentLink) {
        // Check if this is a syndic trying to be added to their own residence
        if (existingProfile?.role === 'syndic') {
          const { data: managedResidence } = await adminSupabase
            .from('residences')
            .select('id')
            .eq('syndic_user_id', existingUser.id)
            .eq('id', data.residence_id)
            .maybeSingle();

          if (managedResidence) {
            return {
              success: false,
              error: apartmentNumber 
                ? `This syndic is already a resident in apartment ${apartmentNumber} of this residence. Each apartment can only have one entry per user.`
                : 'This syndic is already a resident in this residence without an apartment number. A user can only have one entry without an apartment number per residence.',
            };
          }
        }
        return {
          success: false,
          error: apartmentNumber
            ? `This user is already a resident of apartment ${apartmentNumber} in this residence. Each apartment can only have one entry per user.`
            : 'This user is already a resident of this residence without an apartment number. A user can only have one entry without an apartment number per residence.',
        };
      }

      // Allow existing users to be added as residents in different residences
      // A resident can be added by different syndics in different residences
      // The only restrictions that apply:
      // 1. Cannot add the same user to the same apartment in the same residence (checked above)
      // 2. Apartment number cannot be already taken by another user in the same residence (checked above)
      // 3. Syndics can be added as residents while preserving their syndic role
      // 4. If user already exists and is verified, no OTP email will be sent (handled later)
    }

    let finalUserId: string;

    // Special handling for syndic adding themselves
    if (isSyndicAddingSelf) {
      // Syndic is adding themselves - use their current user ID directly
      // Do NOT create new user or profile - just add to profile_residences
      finalUserId = userId;
      console.log('[Residents Actions] Syndic adding themselves - using current user ID:', finalUserId);
    } else if (existingUser) {
      // Email belongs to an existing user (could be a syndic being added to a different residence)
      // Allow it - syndics can be residents in other residences while keeping their syndic role
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
      // Note: A trigger will auto-create a profile with role 'syndic', but we'll override it with the selected role
    }
    
    // Track if this is a newly created user (not existing)
    const isNewUser = !existingUser;

    // OTP logic:
    // - Always send OTP when adding a resident to a NEW residence (even if they exist in other residences)
    // - Only skip OTP if syndic is adding themselves
    // If a syndic adds an existing resident to a new residence, OTP must be sent for confirmation

    // For syndic adding themselves, skip all profile creation/update logic
    // Just add entry to profile_residences table
    if (isSyndicAddingSelf) {
      // Syndic adding themselves - verify profile exists
      const { data: existingProfile } = await adminSupabase
        .from('profiles')
        .select('id, role')
        .eq('id', finalUserId)
        .maybeSingle();

      if (!existingProfile) {
        return {
          success: false,
          error: 'Cannot add yourself as resident: profile not found. Please contact support.',
        };
      }

      // Only update phone number if provided
      if (data.phone_number?.trim()) {
        const { error: profileError } = await adminSupabase
          .from('profiles')
          .update({ phone_number: data.phone_number.trim() })
          .eq('id', finalUserId);

        if (profileError) {
          console.error('[Residents Actions] Error updating phone number:', profileError);
          return { success: false, error: 'Failed to update phone number' };
        }
        console.log('[Residents Actions] Syndic adding themselves - updated phone number only');
      } else {
        console.log('[Residents Actions] Syndic adding themselves - skipping profile update, only adding to profile_residences');
      }
    } else {
      // Normal flow - handle profile creation/update for new or existing users
      const { data: existingProfile } = await adminSupabase
        .from('profiles')
        .select('id, verified, role, onboarding_completed, email_verified')
        .eq('id', finalUserId)
        .maybeSingle();

      // Check if user already exists in another residence
      // If so, only allow apartment number update (don't update profile fields)
      let existsInOtherResidence = false;
      if (existingUser) {
        const { data: otherResidences } = await adminSupabase
          .from('profile_residences')
          .select('residence_id')
          .eq('profile_id', finalUserId)
          .neq('residence_id', data.residence_id);
        
        if (otherResidences && otherResidences.length > 0) {
          existsInOtherResidence = true;
          console.log('[Residents Actions] User exists in other residence - only updating apartment number, skipping profile update');
        }
      }

      // Only update profile if user doesn't exist in another residence
      if (!existsInOtherResidence) {
        // Determine the role to use
        // For new users: Always use the dropdown role (ignore trigger-created 'syndic' role)
        // For existing users: Preserve their original role (syndic or resident) - cannot be changed
        let roleToUse: string;
        if (isNewUser) {
          // New user - always use the role selected from dropdown
          // The trigger may have created a profile with 'syndic' role, but we override it
          roleToUse = finalRole;
        } else if (existingProfile?.role === 'syndic' && existingUser) {
          // An existing syndic being added to another residence - preserve their syndic role
          roleToUse = 'syndic';
        } else if (existingProfile?.role === 'resident' && existingUser) {
          // An existing resident being added to another residence - preserve their resident role
          // Do not allow changing resident role to guard or any other role
          roleToUse = 'resident';
        } else {
          // Existing user with other role - use the role selected from dropdown
          roleToUse = finalRole;
        }

        // Prepare profile update data for normal flow
        const profileUpdateData: any = {
          id: finalUserId,
          full_name: data.full_name.trim(),
          phone_number: data.phone_number?.trim() || null,
          role: roleToUse,
        };
        
        // Handle verification status for normal flow
        profileUpdateData.verified = existingProfile?.verified !== undefined ? existingProfile.verified : true;
        profileUpdateData.email_verified = existingProfile?.email_verified !== undefined ? existingProfile.email_verified : false;
        profileUpdateData.onboarding_completed = existingProfile?.onboarding_completed !== undefined ? existingProfile.onboarding_completed : false;

        // Create or update profile
        const { error: profileError } = await adminSupabase
          .from('profiles')
          .upsert(profileUpdateData, {
            onConflict: 'id'
          });

        if (profileError) {
          console.error('[Residents Actions] Error creating/updating profile:', profileError);
          return { success: false, error: 'Failed to create resident profile' };
        }
      } else {
        // User exists in another residence - preserve existing profile data
        // Only the apartment number in profile_residences will be updated
        console.log('[Residents Actions] User exists in other residence - preserving profile data, only updating apartment number');
      }
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
      const apartmentNumber = data.apartment_number?.trim() || null;
      
      // Check if apartment number is already reserved by another user in this residence
      // Each apartment can only be assigned to one user per residence
      if (apartmentNumber) {
        const { data: existingApartmentReservation } = await adminSupabase
          .from('profile_residences')
          .select('id, profile_id, apartment_number')
          .eq('residence_id', data.residence_id)
          .eq('apartment_number', apartmentNumber)
          .maybeSingle();

        if (existingApartmentReservation && existingApartmentReservation.profile_id !== finalUserId) {
          // Get the name of the user who already has this apartment
          const { data: existingResidentProfile } = await adminSupabase
            .from('profiles')
            .select('full_name')
            .eq('id', existingApartmentReservation.profile_id)
            .maybeSingle();

          const residentName = existingResidentProfile?.full_name || 'another resident';
          return {
            success: false,
            error: `Apartment ${apartmentNumber} is already reserved by ${residentName} in this residence. Each apartment can only be assigned to one user.`,
          };
        }
      }

      // Check if already in residence with the same apartment number
      // Users can be in the same residence multiple times, but only once per apartment number
      const { data: existingLink } = await adminSupabase
        .from('profile_residences')
        .select('id, apartment_number')
        .eq('profile_id', finalUserId)
        .eq('residence_id', data.residence_id)
        .eq('apartment_number', apartmentNumber)
        .maybeSingle();

      if (existingLink) {
        return { 
          success: false, 
          error: apartmentNumber
            ? `User is already a resident of apartment ${apartmentNumber} in this residence. Each apartment can only have one entry per user.`
            : 'User is already a resident of this residence without an apartment number. A user can only have one entry without an apartment number per residence.'
        };
      }

      // Send OTP email when:
      // 1. Syndic is NOT adding themselves
      // 2. User is being added to a NEW residence (even if they exist in other residences)
      // If a syndic adds an existing resident to a new residence, OTP must be sent for confirmation
      if (!isSyndicAddingSelf) {
        // Generate OTP code for resident authentication
        const { generateVerificationCode, sendResidentOnboardingOTP } = await import('@/lib/email/verification');
        const otpCode = generateVerificationCode();
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 15); // 15 minutes expiration

        // Update profile with resident onboarding OTP code (separate from email verification code)
        const { error: otpUpdateError } = await adminSupabase
          .from('profiles')
          .update({
            resident_onboarding_code: otpCode,
            resident_onboarding_code_expires_at: expiresAt.toISOString(),
            // Note: email_verified remains unchanged - resident onboarding OTP is separate
          })
          .eq('id', finalUserId);

        if (otpUpdateError) {
          console.error('[Residents Actions] Error setting OTP code:', otpUpdateError);
          // Continue anyway, but log the error
        }

        // Get residence name for email
        const { data: residenceData } = await adminSupabase
          .from('residences')
          .select('name')
          .eq('id', data.residence_id)
          .single();

        // Send OTP email to resident
        try {
          await sendResidentOnboardingOTP(
            data.email,
            otpCode,
            data.full_name,
            residenceData?.name,
            data.apartment_number
          );
          console.log('[Residents Actions] OTP email sent to resident:', data.email);
        } catch (emailError: any) {
          console.error('[Residents Actions] Error sending OTP email:', emailError);
          // Don't fail the resident creation if email fails, but log it
          // The resident can request a new code later
        }
      } else {
        // Skip OTP email only if syndic is adding themselves
        if (isSyndicAddingSelf) {
          console.log('[Residents Actions] Syndic adding themselves - skipping OTP email, auto-verified');
        }
      }

      // Add resident entry to profile_residences table
      // For syndic adding themselves:
      //   - Profile role stays 'syndic' in profiles table (unchanged)
      //   - Entry added to profile_residences table as resident
      //   - Unique constraint on (profile_id, residence_id, apartment_number) prevents duplicates per apartment
      const { error: linkError } = await adminSupabase
        .from('profile_residences')
        .insert({
          profile_id: finalUserId,
          residence_id: data.residence_id,
          apartment_number: data.apartment_number.trim(),
          verified: isSyndicAddingSelf ? true : false // Auto-verify only if syndic adding themselves, otherwise wait for OTP verification
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

    // Check if resident exists in other residences
    // If so, only allow apartment number update (don't update profile fields)
    let existsInOtherResidence = false;
    const { data: otherResidences } = await adminSupabase
        .from('profile_residences')
        .select('residence_id')
        .eq('profile_id', data.id)
        .neq('residence_id', managedResidenceId);
    
    if (otherResidences && otherResidences.length > 0) {
        existsInOtherResidence = true;
        console.log('[Residents Actions] User exists in other residence - only updating apartment number, skipping profile update');
    }

    // Only update profile fields if user doesn't exist in other residences
    if (!existsInOtherResidence) {
        // Update User Email
        if (data.email) {
          // Check if the new email already exists and belongs to someone else
          const { data: existingUserWithEmail } = await adminSupabase
            .from('users')
            .select('id')
            .eq('email', data.email)
            .maybeSingle();

          // If email exists and doesn't belong to the resident being updated or the syndic, reject it
          if (existingUserWithEmail && existingUserWithEmail.id !== data.id && existingUserWithEmail.id !== userId) {
            return {
              success: false,
              error: 'This email is already registered to another user. Please use a different email address.',
            };
          }

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
    } else {
        console.log('[Residents Actions] Skipping profile update - resident exists in other residences');
    }

    // Update Residence Link (Apartment Number)
    if (data.apartment_number) {
        const newApartmentNumber = data.apartment_number.trim();
        
        // Check if the new apartment number is already reserved by another user
        const { data: existingApartmentReservation } = await adminSupabase
            .from('profile_residences')
            .select('id, profile_id, apartment_number')
            .eq('residence_id', managedResidenceId)
            .eq('apartment_number', newApartmentNumber)
            .maybeSingle();

        if (existingApartmentReservation && existingApartmentReservation.profile_id !== data.id) {
            // Get the name of the user who already has this apartment
            const { data: existingResidentProfile } = await adminSupabase
                .from('profiles')
                .select('full_name')
                .eq('id', existingApartmentReservation.profile_id)
                .maybeSingle();

            const residentName = existingResidentProfile?.full_name || 'another resident';
            return {
                success: false,
                error: `Apartment ${newApartmentNumber} is already reserved by ${residentName} in this residence. Each apartment can only be assigned to one user.`,
            };
        }

        const { error: linkError } = await adminSupabase
            .from('profile_residences')
            .update({ apartment_number: newApartmentNumber })
            .eq('profile_id', data.id)
            .eq('residence_id', managedResidenceId);
        
        if (linkError) {
            console.error('[Residents Actions] Error updating apartment number:', linkError);
            return { success: false, error: 'Failed to update apartment number' };
        }
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

        // Check if resident is a syndic managing this residence
        // If so, only remove from profile_residences - don't delete their account
        const { data: managedResidence } = await adminSupabase
            .from('residences')
            .select('syndic_user_id')
            .eq('id', managedResidenceId)
            .maybeSingle();

        if (managedResidence?.syndic_user_id === residentId) {
            console.log('[Residents Actions] Resident is a syndic managing this residence - only removing from profile_residences, not deleting account');
            revalidatePath('/app/residents');
            return { success: true };
        }

        // Check if resident is a syndic managing ANY other residence
        // If so, only remove from profile_residences - don't delete their account
        if (residentProfile.role === 'syndic') {
            const { data: otherManagedResidence } = await adminSupabase
                .from('residences')
                .select('id')
                .eq('syndic_user_id', residentId)
                .maybeSingle();

            if (otherManagedResidence) {
                console.log('[Residents Actions] Resident is a syndic managing another residence - only removing from profile_residences, not deleting account');
                revalidatePath('/app/residents');
                return { success: true };
            }
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
 * Bulk delete residents
 * Deletes multiple residents at once
 */
export async function bulkDeleteResidents(residentIds: string[]) {
  console.log('[Residents Actions] Bulk deleting residents:', residentIds);

  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) throw new Error('User not authenticated');

    if (!residentIds || residentIds.length === 0) {
      return { success: false, error: 'No residents selected for deletion' };
    }

    const adminSupabase = createSupabaseAdminClient();
    const managedResidenceId = await getManagedResidenceId(userId, adminSupabase);

    if (!managedResidenceId) {
      return { success: false, error: 'Unauthorized' };
    }

    const results = {
      success: [] as string[],
      failed: [] as { id: string; error: string }[],
    };

    // Delete each resident sequentially to handle errors properly
    for (const residentId of residentIds) {
      try {
        // Get resident's profile to check role
        const { data: residentProfile, error: profileError } = await adminSupabase
          .from('profiles')
          .select('id, role')
          .eq('id', residentId)
          .maybeSingle();

        if (profileError || !residentProfile) {
          results.failed.push({ id: residentId, error: 'Resident not found' });
          continue;
        }

        // Prevent deleting syndics (unless it's the current user's own account)
        if (residentProfile.role === 'syndic' && residentId !== userId) {
          results.failed.push({ id: residentId, error: 'Cannot delete syndic accounts' });
          continue;
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
            results.failed.push({ id: residentId, error: 'Failed to remove resident from residence' });
            continue;
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
            results.success.push(residentId);
            continue;
          }
        }

        // Create dbasakan client for comprehensive cleanup
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

        // Delete user-related data
        await dbasakanClient.from('profile_residences').delete().eq('profile_id', residentId);
        await dbasakanClient.from('notifications').delete().eq('user_id', residentId);
        await dbasakanClient.from('poll_votes').delete().eq('user_id', residentId);
        if (userEmail) {
          await dbasakanClient.from('verification_tokens').delete().eq('identifier', userEmail);
        }

        // Nullify references
        await dbasakanClient.from('announcements').update({ created_by: null }).eq('created_by', residentId);
        await dbasakanClient.from('expenses').update({ created_by: null }).eq('created_by', residentId);
        await dbasakanClient.from('polls').update({ created_by: null }).eq('created_by', residentId);
        await dbasakanClient.from('balance_snapshots').update({ created_by: null }).eq('created_by', residentId);
        await dbasakanClient.from('payments').update({ verified_by: null }).eq('verified_by', residentId);
        await dbasakanClient.from('incidents').update({ assigned_to: null }).eq('assigned_to', residentId);

        // Delete data where user is required
        await dbasakanClient.from('deliveries').delete().eq('logged_by', residentId);
        await dbasakanClient.from('deliveries').delete().eq('recipient_id', residentId);
        await dbasakanClient.from('payments').delete().eq('user_id', residentId);
        await dbasakanClient.from('fees').delete().eq('user_id', residentId);
        await dbasakanClient.from('incidents').delete().eq('user_id', residentId);
        await dbasakanClient.from('access_logs').delete().eq('generated_by', residentId);
        await dbasakanClient.from('access_logs').update({ scanned_by: null }).eq('scanned_by', residentId);

        // Delete document submissions and files
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

        // Delete stripe customer if exists
        await adminSupabase.from('stripe_customers').delete().eq('user_id', residentId);

        // Delete profile
        await dbasakanClient.from('profiles').delete().eq('id', residentId);

        // Delete from users
        const { error: deleteUserError } = await dbasakanClient.from('users').delete().eq('id', residentId);
        if (deleteUserError) {
          await adminSupabase.from('users').delete().eq('id', residentId);
        }

        // Delete accounts and sessions
        await dbasakanClient.from('accounts').delete().eq('user_id', residentId);
        await dbasakanClient.from('sessions').delete().eq('user_id', residentId);

        results.success.push(residentId);
      } catch (error: any) {
        console.error(`[Residents Actions] Error deleting resident ${residentId}:`, error);
        results.failed.push({ id: residentId, error: error.message || 'Failed to delete' });
      }
    }

    revalidatePath('/app/residents');

    if (results.failed.length > 0) {
      return {
        success: results.success.length > 0,
        error: `Failed to delete ${results.failed.length} resident(s)`,
        results,
      };
    }

    return {
      success: true,
      message: `Successfully deleted ${results.success.length} resident(s)`,
      results,
    };
  } catch (error: any) {
    console.error('[Residents Actions] Error in bulk delete:', error);
    return { success: false, error: error.message || 'Failed to delete residents' };
  }
}

/**
 * Bulk create residents from array
 * Used for Excel import
 */
export async function bulkCreateResidents(residents: CreateResidentData[]) {
  console.log('[Residents Actions] Bulk creating residents:', residents.length);

  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      throw new Error('User not authenticated');
    }

    if (!residents || residents.length === 0) {
      return {
        success: false,
        error: 'No residents provided',
      };
    }

    const adminSupabase = createSupabaseAdminClient();
    const managedResidenceId = await getManagedResidenceId(userId, adminSupabase);

    if (!managedResidenceId) {
      return {
        success: false,
        error: 'You are not authorized to add residents to any residence.',
      };
    }

    const results = {
      success: [] as any[],
      failed: [] as { data: CreateResidentData; error: string }[],
    };

    // Process each resident sequentially to avoid conflicts
    for (let i = 0; i < residents.length; i++) {
      const residentData = residents[i];
      try {
        // Ensure residence_id matches the managed residence
        const finalResidentData = {
          ...residentData,
          residence_id: managedResidenceId,
        };

        // Call createResident directly (it's already a server action)
        const result = await createResident(finalResidentData);

        if (result.success && result.resident) {
          results.success.push(result.resident);
        } else {
          results.failed.push({
            data: residentData,
            error: result.error || 'Failed to create resident',
          });
        }
      } catch (error: any) {
        console.error(`[Residents Actions] Error creating resident ${i + 1} in bulk:`, error);
        results.failed.push({
          data: residentData,
          error: error.message || 'Failed to create resident',
        });
      }
    }

    revalidatePath('/app/residents');

    return {
      success: results.success.length > 0,
      results,
      message: `Successfully created ${results.success.length} of ${residents.length} residents`,
    };
  } catch (error: any) {
    console.error('[Residents Actions] Error in bulk create:', error);
    return {
      success: false,
      error: error.message || 'Failed to create residents',
    };
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
