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

  // Check for duplicate email
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', request.email)
    .single();

  if (existingProfile) {
    return { error: 'A user with this email already exists in the system' };
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

  // Create user in auth.users (via Supabase Admin API)
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

  // Create profile
  const { error: profileError } = await supabase
    .from('profiles')
    .insert({
      id: authUser.user.id,
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
    // Clean up auth user
    await supabase.auth.admin.deleteUser(authUser.user.id);
    return { error: 'Failed to create user profile' };
  }

  // Create profile_residence entry
  const { error: prError } = await supabase
    .from('profile_residences')
    .insert({
      profile_id: authUser.user.id,
      residence_id: request.residence_id,
      apartment_number: request.apartment_number,
      verified: false,
    });

  if (prError) {
    console.error('Error creating profile_residence:', prError);
    // Clean up
    await supabase.from('profiles').delete().eq('id', authUser.user.id);
    await supabase.auth.admin.deleteUser(authUser.user.id);
    return { error: 'Failed to assign residence' };
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

