'use server';

import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { addDays } from 'date-fns';
import { sendResidentWelcomeEmail, sendResidentRejectionEmail } from '@/lib/email/registration';

export interface RegistrationRequest {
  id: number;
  residence_id: number;
  full_name: string;
  email: string;
  phone_number: string;
  apartment_number: string;
  id_number: string;
  id_document_url: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_at: string | null;
  reviewed_by: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export async function getRegistrationRequests(status?: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: 'Unauthorized' };
  }

  const supabase = await createSupabaseAdminClient();

  // Get syndic's residence
  const { data: residence } = await supabase
    .from('residences')
    .select('id')
    .eq('syndic_user_id', session.user.id)
    .single();

  if (!residence) {
    return { error: 'Residence not found' };
  }

  let query = supabase
    .from('resident_registration_requests')
    .select('*')
    .eq('residence_id', residence.id)
    .order('created_at', { ascending: false });

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching registration requests:', error);
    return { error: error.message };
  }

  return { data: data as RegistrationRequest[] };
}

function generateSixDigitCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function approveRegistrationRequest(requestId: number) {
  const session = await auth();
  if (!session?.user) {
    return { error: 'Unauthorized' };
  }

  const supabase = await createSupabaseAdminClient();

  // Get request details
  const { data: request, error: requestError } = await supabase
    .from('resident_registration_requests')
    .select('*, residences:residence_id(name, address)')
    .eq('id', requestId)
    .single();

  if (requestError || !request) {
    return { error: 'Request not found' };
  }

  if (request.status !== 'pending') {
    return { error: 'Request has already been reviewed' };
  }

  // Check for duplicate email in same residence (only verified residents)
  const { data: existingResident } = await supabase
    .from('profile_residences')
    .select('profile_id, profiles:profile_id(id, email)')
    .eq('residence_id', request.residence_id)
    .eq('verified', true);

  if (existingResident && existingResident.some((pr: any) => pr.profiles?.email === request.email)) {
    return { error: 'This email is already registered as a verified resident in this residence' };
  }

  // Check for duplicate apartment
  const { data: existingApartment } = await supabase
    .from('profile_residences')
    .select('id')
    .eq('residence_id', request.residence_id)
    .eq('apartment_number', request.apartment_number)
    .eq('verified', true)
    .single();

  if (existingApartment) {
    return { error: 'This apartment is already occupied' };
  }

  // Generate onboarding code
  const onboardingCode = generateSixDigitCode();
  const expiresAt = addDays(new Date(), 7);

  // Check if user already exists in auth.users
  let authUserId: string;
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const existingUser = existingUsers?.users.find((u) => u.email === request.email);

  if (existingUser) {
    // User exists in auth, use their ID
    authUserId = existingUser.id;
    
    // Ensure user exists in users table (NextAuth table)
    const { data: existingUserRecord } = await supabase
      .from('users')
      .select('id')
      .eq('id', authUserId)
      .single();

    if (!existingUserRecord) {
      // Create user record in users table
      const { error: userError } = await supabase
        .from('users')
        .insert({
          id: authUserId,
          email: request.email,
          name: request.full_name,
        });

      if (userError) {
        console.error('Error creating user record:', userError);
        return { error: 'Failed to create user record' };
      }
    }
    
    // Check if profile exists, create if it doesn't
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', authUserId)
      .single();

    if (!existingProfile) {
      // Profile doesn't exist, create it
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authUserId,
          full_name: request.full_name,
          phone_number: request.phone_number,
          role: 'resident',
          resident_onboarding_code: onboardingCode,
          resident_onboarding_code_expires_at: expiresAt.toISOString(),
          email_verified: false,
          verified: false,
        });

      if (profileError) {
        console.error('Error creating profile:', profileError);
        return { error: 'Failed to create user profile' };
      }
    }
  } else {
    // User doesn't exist, create new user in auth.users
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: request.email,
      email_confirm: false,
      user_metadata: {
        full_name: request.full_name,
      },
    });

    if (authError || !authUser.user) {
      console.error('Error creating auth user:', authError);
      return { error: 'Failed to create user account' };
    }

    authUserId = authUser.user.id;

    // Create user record in users table (NextAuth table)
    const { error: userError } = await supabase
      .from('users')
      .insert({
        id: authUserId,
        email: request.email,
        name: request.full_name,
      });

    if (userError) {
      console.error('Error creating user record:', userError);
      // Clean up auth user
      await supabase.auth.admin.deleteUser(authUserId);
      return { error: 'Failed to create user record' };
    }

    // Create profile for new user
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: authUserId,
        full_name: request.full_name,
        phone_number: request.phone_number,
        role: 'resident',
        resident_onboarding_code: onboardingCode,
        resident_onboarding_code_expires_at: expiresAt.toISOString(),
        email_verified: false,
        verified: false,
      });

    if (profileError) {
      console.error('Error creating profile:', profileError);
      // Clean up
      await supabase.from('users').delete().eq('id', authUserId);
      await supabase.auth.admin.deleteUser(authUserId);
      return { error: 'Failed to create user profile' };
    }
  }

  // Check if profile_residence entry already exists
  const { data: existingProfileResidence } = await supabase
    .from('profile_residences')
    .select('id')
    .eq('profile_id', authUserId)
    .eq('residence_id', request.residence_id)
    .single();

  if (existingProfileResidence) {
    // Entry exists, update it with new apartment number if needed
    const { error: prError } = await supabase
      .from('profile_residences')
      .update({
        apartment_number: request.apartment_number,
        verified: false,
      })
      .eq('id', existingProfileResidence.id);

    if (prError) {
      console.error('Error updating profile_residence:', prError);
      return { error: 'Failed to assign residence' };
    }
  } else {
    // Create new profile_residence entry
    const { error: prError } = await supabase
      .from('profile_residences')
      .insert({
        profile_id: authUserId,
        residence_id: request.residence_id,
        apartment_number: request.apartment_number,
        verified: false,
      });

    if (prError) {
      console.error('Error creating profile_residence:', prError);
      // Only clean up if this was a newly created user
      if (!existingUser) {
        await supabase.from('profiles').delete().eq('id', authUserId);
        await supabase.auth.admin.deleteUser(authUserId);
      }
      return { error: 'Failed to assign residence' };
    }
  }

  // Update request status
  const { error: updateError } = await supabase
    .from('resident_registration_requests')
    .update({
      status: 'approved',
      reviewed_at: new Date().toISOString(),
      reviewed_by: session.user.id,
    })
    .eq('id', requestId);

  if (updateError) {
    console.error('Error updating request:', updateError);
  }

  // Send welcome email with onboarding code
  try {
    await sendResidentWelcomeEmail(
      request.email,
      request.full_name,
      (request.residences as any).name,
      request.apartment_number,
      onboardingCode,
      expiresAt
    );
  } catch (emailError) {
    console.error('Error sending welcome email:', emailError);
    // Don't fail the approval if email fails
  }

  revalidatePath('/app/registration-requests');
  return { success: true, message: 'Registration approved successfully!' };
}

export async function rejectRegistrationRequest(requestId: number, reason: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: 'Unauthorized' };
  }

  if (!reason || reason.trim().length < 10) {
    return { error: 'Rejection reason must be at least 10 characters' };
  }

  const supabase = await createSupabaseAdminClient();

  // Get request details
  const { data: request, error: requestError } = await supabase
    .from('resident_registration_requests')
    .select('*, residences:residence_id(name)')
    .eq('id', requestId)
    .single();

  if (requestError || !request) {
    return { error: 'Request not found' };
  }

  if (request.status !== 'pending') {
    return { error: 'Request has already been reviewed' };
  }

  // Update request status
  const { error: updateError } = await supabase
    .from('resident_registration_requests')
    .update({
      status: 'rejected',
      reviewed_at: new Date().toISOString(),
      reviewed_by: session.user.id,
      rejection_reason: reason,
    })
    .eq('id', requestId);

  if (updateError) {
    console.error('Error updating request:', updateError);
    return { error: 'Failed to reject request' };
  }

  // Send rejection email
  try {
    await sendResidentRejectionEmail(
      request.email,
      request.full_name,
      (request.residences as any).name,
      reason
    );
  } catch (emailError) {
    console.error('Error sending rejection email:', emailError);
    // Don't fail the rejection if email fails
  }

  revalidatePath('/app/registration-requests');
  return { success: true, message: 'Registration rejected' };
}

export async function getRequestStats() {
  const session = await auth();
  if (!session?.user) {
    return { error: 'Unauthorized' };
  }

  const supabase = await createSupabaseAdminClient();

  // Get syndic's residence
  const { data: residence } = await supabase
    .from('residences')
    .select('id')
    .eq('syndic_user_id', session.user.id)
    .single();

  if (!residence) {
    return { error: 'Residence not found' };
  }

  // Get counts
  const { count: pendingCount } = await supabase
    .from('resident_registration_requests')
    .select('*', { count: 'exact', head: true })
    .eq('residence_id', residence.id)
    .eq('status', 'pending');

  const { count: approvedCount } = await supabase
    .from('resident_registration_requests')
    .select('*', { count: 'exact', head: true })
    .eq('residence_id', residence.id)
    .eq('status', 'approved');

  const { count: rejectedCount } = await supabase
    .from('resident_registration_requests')
    .select('*', { count: 'exact', head: true })
    .eq('residence_id', residence.id)
    .eq('status', 'rejected');

  return {
    data: {
      pending: pendingCount || 0,
      approved: approvedCount || 0,
      rejected: rejectedCount || 0,
      total: (pendingCount || 0) + (approvedCount || 0) + (rejectedCount || 0),
    },
  };
}

