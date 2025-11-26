'use server'

import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getAdminId } from '@/lib/admin-auth'

interface CreateResidenceData {
  name: string
  address: string
  city: string
  bank_account_rib?: string
  syndic_user_id?: string
}

export async function createResidence(data: CreateResidenceData) {
  console.log('[Admin Residences] Creating residence:', data)

  try {
    // Verify admin authentication
    const adminId = await getAdminId()
    
    if (!adminId) {
      return {
        success: false,
        error: 'Non authentifié',
      }
    }

    const supabase = createSupabaseAdminClient()

    // Validate input
    if (!data.name?.trim()) {
      return {
        success: false,
        error: 'Le nom de la résidence est requis',
      }
    }

    if (!data.address?.trim()) {
      return {
        success: false,
        error: 'L\'adresse est requise',
      }
    }

    if (!data.city?.trim()) {
      return {
        success: false,
        error: 'La ville est requise',
      }
    }

    // Verify user is an active admin
    const { data: admin } = await supabase
      .from('admins')
      .select('id, is_active')
      .eq('id', adminId)
      .eq('is_active', true)
      .maybeSingle()

    if (!admin) {
      return {
        success: false,
        error: 'Accès refusé - vous n\'êtes pas administrateur',
      }
    }

    // Validate syndic if provided
    if (data.syndic_user_id) {
      const { data: syndic } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('id', data.syndic_user_id)
        .eq('role', 'syndic')
        .maybeSingle()

      if (!syndic) {
        return {
          success: false,
          error: 'Le syndic sélectionné n\'existe pas ou n\'est pas valide',
        }
      }

      // Check if syndic is already assigned to another residence
      const { data: existingResidence } = await supabase
        .from('residences')
        .select('id, name')
        .eq('syndic_user_id', data.syndic_user_id)
        .maybeSingle()

      if (existingResidence) {
        return {
          success: false,
          error: `Ce syndic est déjà assigné à la résidence "${existingResidence.name}"`,
        }
      }
    }

    // Create residence
    const { data: residence, error: residenceError } = await supabase
      .from('residences')
      .insert({
        name: data.name.trim(),
        address: data.address.trim(),
        city: data.city.trim(),
        bank_account_rib: data.bank_account_rib?.trim() || null,
        syndic_user_id: data.syndic_user_id || null,
      })
      .select()
      .single()

    if (residenceError) {
      console.error('[Admin Residences] Error creating residence:', residenceError)
      return {
        success: false,
        error: residenceError.message || 'Erreur lors de la création de la résidence',
      }
    }

    console.log('[Admin Residences] Residence created successfully:', residence.id)
    
    // If a syndic was assigned, update their profile to mark as verified
    if (data.syndic_user_id) {
      const { error: profileUpdateError } = await supabase
        .from('profiles')
        .update({
          verified: true,
        })
        .eq('id', data.syndic_user_id)

      if (profileUpdateError) {
        console.error('[Admin Residences] Error updating syndic profile:', profileUpdateError)
        // Don't fail the whole operation, but log it
      } else {
        console.log('[Admin Residences] Syndic profile verified:', data.syndic_user_id)
      }
    }
    
    // Revalidate paths
    revalidatePath('/admin/residences')
    revalidatePath('/admin')

    return {
      success: true,
      residence,
    }
  } catch (error: any) {
    console.error('[Admin Residences] Error:', error)
    return {
      success: false,
      error: error.message || 'Une erreur est survenue',
    }
  }
}

