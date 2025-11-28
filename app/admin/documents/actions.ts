'use server'

import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getAdminId } from '@/lib/admin-auth'

interface ReviewDocumentParams {
  submissionId: string
  userId: string
  action: 'approve' | 'reject' | 'pending'
  residenceId?: number
  rejectionReason?: string
  newResidence?: {
    name: string
    address: string
    city: string
    bank_account_rib?: string
  }
}

export async function reviewDocument({
  submissionId,
  userId,
  action,
  residenceId,
  rejectionReason,
  newResidence,
}: ReviewDocumentParams) {
  console.log('[Admin Review] Reviewing document:', { submissionId, userId, action, residenceId })

  try {
    // Verify admin authentication
    const adminId = await getAdminId()
    
    if (!adminId) {
      return {
        success: false,
        error: 'Non authentifié',
      }
    }

    console.log('[Admin Review] Admin authenticated:', adminId)
    
    const supabase = createSupabaseAdminClient()

    if (action === 'approve') {
      // Check if syndic already has a residence assigned
      const { data: existingResidence, error: residenceCheckError } = await supabase
        .from('residences')
        .select('id, name, address, city')
        .eq('syndic_user_id', userId)
        .maybeSingle()

      if (residenceCheckError) {
        console.error('[Admin Review] Error checking existing residence:', residenceCheckError)
        return {
          success: false,
          error: 'Erreur lors de la vérification de la résidence',
        }
      }

      let finalResidenceId: number

      if (existingResidence) {
        // Syndic already has a residence
        console.log('[Admin Review] Syndic already has residence:', {
          residenceId: existingResidence.id,
          name: existingResidence.name,
          userId
        })

        // If new residence data is provided, update the existing residence
        if (newResidence?.name && newResidence?.address && newResidence?.city) {
          console.log('[Admin Review] Updating existing residence with new data:', newResidence)
          const { error: updateResidenceError } = await supabase
            .from('residences')
            .update({
              name: newResidence.name,
              address: newResidence.address,
              city: newResidence.city,
              bank_account_rib: newResidence.bank_account_rib || null,
            })
            .eq('id', existingResidence.id)

          if (updateResidenceError) {
            console.error('[Admin Review] Error updating existing residence:', updateResidenceError)
            return {
              success: false,
              error: 'Erreur lors de la mise à jour de la résidence existante',
            }
          }
        }

        finalResidenceId = existingResidence.id

        // Update document submission
        const { error: submissionError } = await supabase
          .from('syndic_document_submissions')
          .update({
            status: 'approved',
            reviewed_by: adminId,
            reviewed_at: new Date().toISOString(),
            assigned_residence_id: finalResidenceId,
          })
          .eq('id', submissionId)

        if (submissionError) {
          console.error('[Admin Review] Error updating submission:', submissionError)
          return {
            success: false,
            error: 'Erreur lors de la mise à jour du document',
          }
        }

        // Update profile: mark as verified
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            verified: true,
          })
          .eq('id', userId)

        if (profileError) {
          console.error('[Admin Review] Error updating profile:', profileError)
          return {
            success: false,
            error: 'Erreur lors de la mise à jour du profil',
          }
        }

        console.log('[Admin Review] Document approved, using existing residence:', { userId, residenceId: finalResidenceId })
      } else {
        // Syndic doesn't have a residence - create new one
        // Validate new residence data
        if (!newResidence?.name || !newResidence?.address || !newResidence?.city) {
          return {
            success: false,
            error: 'Les informations de la résidence sont requises',
          }
        }

        // Create new residence
        console.log('[Admin Review] Creating residence for syndic:', userId, 'with data:', newResidence)
        
        const { data: createdResidence, error: residenceCreateError } = await supabase
          .from('residences')
          .insert({
            name: newResidence.name,
            address: newResidence.address,
            city: newResidence.city,
            bank_account_rib: newResidence.bank_account_rib || null,
            syndic_user_id: userId,
          })
          .select()
          .single()

        if (residenceCreateError || !createdResidence) {
          console.error('[Admin Review] Error creating residence:', residenceCreateError)
          return {
            success: false,
            error: 'Erreur lors de la création de la résidence',
          }
        }

        console.log('[Admin Review] Residence created successfully:', {
          residenceId: createdResidence.id,
          name: createdResidence.name,
          syndic_user_id: createdResidence.syndic_user_id
        })

        finalResidenceId = createdResidence.id

        // Update document submission
        const { error: submissionError } = await supabase
          .from('syndic_document_submissions')
          .update({
            status: 'approved',
            reviewed_by: adminId,
            reviewed_at: new Date().toISOString(),
            assigned_residence_id: finalResidenceId,
          })
          .eq('id', submissionId)

        if (submissionError) {
          console.error('[Admin Review] Error updating submission:', submissionError)
          return {
            success: false,
            error: 'Erreur lors de la mise à jour du document',
          }
        }

        // Update profile: mark as verified
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            verified: true,
          })
          .eq('id', userId)

        if (profileError) {
          console.error('[Admin Review] Error updating profile:', profileError)
          return {
            success: false,
            error: 'Erreur lors de la mise à jour du profil',
          }
        }

        console.log('[Admin Review] Document approved, residence created and assigned:', { userId, residenceId: finalResidenceId })
      }
    } else if (action === 'reject') {
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
    } else if (action === 'pending') {
      // Set back to pending
      const { error: submissionError } = await supabase
        .from('syndic_document_submissions')
        .update({
          status: 'pending',
          reviewed_by: null,
          reviewed_at: null,
          rejection_reason: null,
          assigned_residence_id: null,
        })
        .eq('id', submissionId)

      if (submissionError) {
        console.error('[Admin Review] Error updating submission:', submissionError)
        return {
          success: false,
          error: 'Erreur lors de la mise à jour du document',
        }
      }

      // Update profile: remove verification
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ 
          verified: false,
        })
        .eq('id', userId)

      if (profileError) {
        console.error('[Admin Review] Error updating profile:', profileError)
        return {
          success: false,
          error: 'Erreur lors de la mise à jour du profil',
        }
      }

      console.log('[Admin Review] Document set back to pending:', { userId })
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

