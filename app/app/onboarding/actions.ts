'use server';

import { getSupabaseClient, createSupabaseAdminClient } from '@/lib/supabase/server';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

interface CreateResidenceData {
  name: string;
  address: string;
  city: string;
  bank_account_rib?: string;
}

/**
 * Create a new residence during onboarding
 */
export async function createResidence(data: CreateResidenceData) {
  console.log('[Onboarding Actions] Creating residence:', data);

  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return {
        success: false,
        error: 'User not authenticated',
      };
    }

    // Validate input
    if (!data.name?.trim()) {
      return {
        success: false,
        error: 'Le nom de la résidence est requis',
      };
    }

    if (!data.address?.trim()) {
      return {
        success: false,
        error: 'L\'adresse est requise',
      };
    }

    if (!data.city?.trim()) {
      return {
        success: false,
        error: 'La ville est requise',
      };
    }

    // Use admin client to bypass RLS policies that might cause infinite recursion
    // This is especially important for profile updates which have RLS policies
    // that query the profiles table itself
    const adminSupabase = createSupabaseAdminClient();

    // Check if syndic already has a residence (one syndic = one residence)
    const { data: existingProfile } = await adminSupabase
      .from('profiles')
      .select('id, residence_id, role')
      .eq('id', userId)
      .maybeSingle();

    if (existingProfile?.residence_id) {
      return {
        success: false,
        error: 'Vous avez déjà une résidence assignée. Un syndic ne peut gérer qu\'une seule résidence.',
      };
    }

    // Also check if there's already a residence with this syndic_user_id
    const { data: existingResidence } = await adminSupabase
      .from('residences')
      .select('id')
      .eq('syndic_user_id', userId)
      .maybeSingle();

    if (existingResidence) {
      return {
        success: false,
        error: 'Vous avez déjà une résidence assignée. Un syndic ne peut gérer qu\'une seule résidence.',
      };
    }

    // Create residence
    const { data: residence, error: residenceError } = await adminSupabase
      .from('residences')
      .insert({
        name: data.name.trim(),
        address: data.address.trim(),
        city: data.city.trim(),
        bank_account_rib: data.bank_account_rib?.trim() || null,
        syndic_user_id: userId,
      })
      .select()
      .single();

    if (residenceError) {
      console.error('[Onboarding Actions] Error creating residence:', residenceError);
      return {
        success: false,
        error: residenceError.message || 'Failed to create residence',
      };
    }

    // Update user profile with residence_id and mark onboarding as complete
    // Always use admin client to avoid RLS infinite recursion
    const { error: profileError } = await adminSupabase
      .from('profiles')
      .update({
        residence_id: residence.id,
        onboarding_completed: true,
      })
      .eq('id', userId);

    if (profileError) {
      console.error('[Onboarding Actions] Error updating profile:', profileError);
      return {
        success: false,
        error: 'Residence created but failed to update profile: ' + profileError.message,
      };
    }

    console.log('[Onboarding Actions] Residence created successfully:', residence.id);
    revalidatePath('/app');
    
    return {
      success: true,
      residence,
    };
  } catch (error: any) {
    console.error('[Onboarding Actions] Error:', error);
    return {
      success: false,
      error: error.message || 'Failed to create residence',
    };
  }
}

