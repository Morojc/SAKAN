'use server'

import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getAdminId } from '@/lib/admin-auth'

interface CreateResidenceData {
  name: string
  address: string
  city: string
  bank_account_rib?: string
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

    // Create residence
    const { data: residence, error: residenceError } = await supabase
      .from('residences')
      .insert({
        name: data.name.trim(),
        address: data.address.trim(),
        city: data.city.trim(),
        bank_account_rib: data.bank_account_rib?.trim() || null,
        syndic_user_id: null, // Will be assigned when approving syndic documents
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

