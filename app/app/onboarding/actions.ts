'use server';

import { getSupabaseClient, createSupabaseAdminClient } from '@/utils/supabase/server';
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

    // Get Supabase client
    let supabase = await getSupabaseClient();

    // Create residence
    const { data: residence, error: residenceError } = await supabase
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
      
      // Try with admin client as fallback
      const adminSupabase = createSupabaseAdminClient();
      const { data: adminResidence, error: adminError } = await adminSupabase
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

      if (adminError) {
        return {
          success: false,
          error: adminError.message || 'Failed to create residence',
        };
      }

      // Update user profile with residence_id and mark onboarding as complete
      const { error: profileError } = await adminSupabase
        .from('profiles')
        .update({
          residence_id: adminResidence.id,
          onboarding_completed: true,
        })
        .eq('id', userId);

      if (profileError) {
        console.error('[Onboarding Actions] Error updating profile:', profileError);
        return {
          success: false,
          error: 'Residence created but failed to update profile',
        };
      }

      revalidatePath('/app');
      return {
        success: true,
        residence: adminResidence,
      };
    }

    // Update user profile with residence_id and mark onboarding as complete
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        residence_id: residence.id,
        onboarding_completed: true,
      })
      .eq('id', userId);

    if (profileError) {
      console.error('[Onboarding Actions] Error updating profile:', profileError);
      
      // Try with admin client
      const adminSupabase = createSupabaseAdminClient();
      const { error: adminProfileError } = await adminSupabase
        .from('profiles')
        .update({
          residence_id: residence.id,
          onboarding_completed: true,
        })
        .eq('id', userId);

      if (adminProfileError) {
        return {
          success: false,
          error: 'Residence created but failed to update profile',
        };
      }
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

