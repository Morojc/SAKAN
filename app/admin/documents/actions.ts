'use server'

import { auth } from '@/lib/auth'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

interface ReviewDocumentParams {
  submissionId: string
  userId: string
  action: 'approve' | 'reject'
  residenceId?: number
  rejectionReason?: string
}

export async function reviewDocument({
  submissionId,
  userId,
  action,
  residenceId,
  rejectionReason,
}: ReviewDocumentParams) {
  console.log('[Admin Review] Reviewing document:', { submissionId, userId, action, residenceId })

  try {
    const session = await auth()
    const adminId = session?.user?.id

    if (!adminId) {
      return {
        success: false,
        error: 'Non authentifié',
      }
    }

    const supabase = createSupabaseAdminClient()

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

    if (action === 'approve') {
      if (!residenceId) {
        return {
          success: false,
          error: 'Une résidence doit être sélectionnée pour approuver',
        }
      }

      // Check if residence is already assigned to another syndic
      const { data: residence } = await supabase
        .from('residences')
        .select('id, syndic_user_id')
        .eq('id', residenceId)
        .maybeSingle()

      if (!residence) {
        return {
          success: false,
          error: 'Résidence introuvable',
        }
      }

      if (residence.syndic_user_id && residence.syndic_user_id !== userId) {
        return {
          success: false,
          error: 'Cette résidence est déjà assignée à un autre syndic',
        }
      }

      // Update document submission
      const { error: submissionError } = await supabase
        .from('syndic_document_submissions')
        .update({
          status: 'approved',
          reviewed_by: adminId,
          reviewed_at: new Date().toISOString(),
          assigned_residence_id: residenceId,
        })
        .eq('id', submissionId)

      if (submissionError) {
        console.error('[Admin Review] Error updating submission:', submissionError)
        return {
          success: false,
          error: 'Erreur lors de la mise à jour du document',
        }
      }

      // Update residence with syndic_user_id
      const { error: residenceError } = await supabase
        .from('residences')
        .update({ syndic_user_id: userId })
        .eq('id', residenceId)

      if (residenceError) {
        console.error('[Admin Review] Error updating residence:', residenceError)
        return {
          success: false,
          error: 'Erreur lors de l\'assignation de la résidence',
        }
      }

      // Update profile: mark as verified and assign residence
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          verified: true,
          residence_id: residenceId,
        })
        .eq('id', userId)

      if (profileError) {
        console.error('[Admin Review] Error updating profile:', profileError)
        return {
          success: false,
          error: 'Erreur lors de la mise à jour du profil',
        }
      }

      console.log('[Admin Review] Document approved and residence assigned:', { userId, residenceId })
    } else {
      // Reject
      if (!rejectionReason?.trim()) {
        return {
          success: false,
          error: 'Une raison de rejet est requise',
        }
      }

      // Update document submission
      const { error: submissionError } = await supabase
        .from('syndic_document_submissions')
        .update({
          status: 'rejected',
          reviewed_by: adminId,
          reviewed_at: new Date().toISOString(),
          rejection_reason: rejectionReason,
        })
        .eq('id', submissionId)

      if (submissionError) {
        console.error('[Admin Review] Error updating submission:', submissionError)
        return {
          success: false,
          error: 'Erreur lors de la mise à jour du document',
        }
      }

      // Update profile: mark as not verified
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ verified: false })
        .eq('id', userId)

      if (profileError) {
        console.error('[Admin Review] Error updating profile:', profileError)
        return {
          success: false,
          error: 'Erreur lors de la mise à jour du profil',
        }
      }

      console.log('[Admin Review] Document rejected:', { userId, reason: rejectionReason })
    }

    // Revalidate paths
    revalidatePath('/admin/documents')
    revalidatePath('/admin')

    return {
      success: true,
    }
  } catch (error: any) {
    console.error('[Admin Review] Error:', error)
    return {
      success: false,
      error: error.message || 'Une erreur est survenue',
    }
  }
}

