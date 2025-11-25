'use server'

import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function deleteSyndic(syndicId: string) {
  console.log('[Admin Delete Syndic] Starting deletion for syndic:', syndicId)

  try {
    const supabase = createSupabaseAdminClient()

    // 1. Get all document submissions for this syndic
    const { data: submissions, error: submissionsError } = await supabase
      .from('syndic_document_submissions')
      .select('document_url, id_card_url')
      .eq('user_id', syndicId)

    if (submissionsError) {
      console.error('[Admin Delete Syndic] Error fetching submissions:', submissionsError)
      return {
        success: false,
        error: 'Erreur lors de la récupération des documents',
      }
    }

    // 2. Delete files from storage
    if (submissions && submissions.length > 0) {
      const filesToDelete: string[] = []
      
      for (const submission of submissions) {
        if (submission.document_url) {
          // Extract file path from URL
          const url = new URL(submission.document_url)
          const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/SAKAN\/(.+)/)
          if (pathMatch && pathMatch[1]) {
            filesToDelete.push(pathMatch[1])
          }
        }
        if (submission.id_card_url) {
          const url = new URL(submission.id_card_url)
          const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/SAKAN\/(.+)/)
          if (pathMatch && pathMatch[1]) {
            filesToDelete.push(pathMatch[1])
          }
        }
      }

      if (filesToDelete.length > 0) {
        console.log('[Admin Delete Syndic] Deleting files from storage:', filesToDelete)
        const { error: storageError } = await supabase.storage
          .from('SAKAN')
          .remove(filesToDelete)

        if (storageError) {
          console.error('[Admin Delete Syndic] Error deleting files:', storageError)
          // Continue anyway - we'll delete the database records
        }
      }
    }

    // 3. Delete document submissions
    const { error: deleteSubmissionsError } = await supabase
      .from('syndic_document_submissions')
      .delete()
      .eq('user_id', syndicId)

    if (deleteSubmissionsError) {
      console.error('[Admin Delete Syndic] Error deleting submissions:', deleteSubmissionsError)
      return {
        success: false,
        error: 'Erreur lors de la suppression des documents',
      }
    }

    // 4. Get residence_id if assigned
    const { data: profile } = await supabase
      .from('profiles')
      .select('residence_id')
      .eq('id', syndicId)
      .maybeSingle()

    // 5. If residence assigned, unassign it
    if (profile?.residence_id) {
      const { error: residenceError } = await supabase
        .from('residences')
        .update({ syndic_user_id: null })
        .eq('id', profile.residence_id)

      if (residenceError) {
        console.error('[Admin Delete Syndic] Error unassigning residence:', residenceError)
        // Continue anyway
      }
    }

    // 6. Delete from profiles
    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', syndicId)

    if (profileError) {
      console.error('[Admin Delete Syndic] Error deleting profile:', profileError)
      return {
        success: false,
        error: 'Erreur lors de la suppression du profil',
      }
    }

    // 7. Delete from users table (dbasakan schema)
    const { error: userError } = await supabase
      .from('users')
      .delete()
      .eq('id', syndicId)

    if (userError) {
      console.error('[Admin Delete Syndic] Error deleting user:', userError)
      return {
        success: false,
        error: 'Erreur lors de la suppression de l\'utilisateur',
      }
    }

    console.log('[Admin Delete Syndic] Successfully deleted syndic:', syndicId)

    // Revalidate paths
    revalidatePath('/admin/syndics')
    revalidatePath('/admin/documents')
    revalidatePath('/admin')

    return {
      success: true,
    }
  } catch (error: any) {
    console.error('[Admin Delete Syndic] Error:', error)
    return {
      success: false,
      error: error.message || 'Une erreur est survenue',
    }
  }
}

