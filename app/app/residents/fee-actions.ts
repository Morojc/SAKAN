'use server';

import { auth } from '@/lib/auth';
import { getSupabaseClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { getUserResidenceId } from '@/lib/residence-utils';

/**
 * Fee Server Actions
 * Handles CRUD operations for fees
 */

interface CreateFeeData {
  user_id: string;
  residence_id: number;
  title: string;
  amount: number;
  due_date: string; // ISO date string
  status?: 'unpaid' | 'paid' | 'overdue';
}

interface UpdateFeeData {
  id: number;
  title?: string;
  amount?: number;
  due_date?: string;
  status?: 'unpaid' | 'paid' | 'overdue';
}

/**
 * Create a new fee
 */
export async function createFee(data: CreateFeeData) {
  console.log('[Fee Actions] Creating fee:', data);

  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      throw new Error('User not authenticated');
    }

    // Validation
    if (!data.user_id || !data.residence_id || !data.title || !data.amount || !data.due_date) {
      return {
        success: false,
        error: 'Missing required fields: user_id, residence_id, title, amount, and due_date are required',
      };
    }

    // Validate amount
    if (Number(data.amount) <= 0) {
      return {
        success: false,
        error: 'Amount must be greater than 0',
      };
    }

    // Validate due date
    const dueDate = new Date(data.due_date);
    if (isNaN(dueDate.getTime())) {
      return {
        success: false,
        error: 'Invalid due date format',
      };
    }

    const supabase = await getSupabaseClient();

    // Get user's residence_id to verify ownership
    const residenceId = await getUserResidenceId(supabase, userId);

    if (!residenceId) {
      return {
        success: false,
        error: 'User has no residence assigned',
      };
    }

    // Verify the residence_id matches user's residence
    if (data.residence_id !== residenceId) {
      return {
        success: false,
        error: 'You can only create fees for your own residence',
      };
    }

    // Create fee
    const { data: fee, error: feeError } = await supabase
      .from('fees')
      .insert({
        user_id: data.user_id,
        residence_id: data.residence_id,
        title: data.title.trim(),
        amount: Number(data.amount),
        due_date: data.due_date,
        status: data.status || 'unpaid',
      })
      .select()
      .single();

    if (feeError) {
      console.error('[Fee Actions] Error creating fee:', feeError);
      return {
        success: false,
        error: feeError.message || 'Failed to create fee',
      };
    }

    console.log('[Fee Actions] Fee created successfully:', fee.id);

    // Revalidate residents page
    revalidatePath('/app/residents');

    return {
      success: true,
      fee,
    };
  } catch (error: any) {
    console.error('[Fee Actions] Error creating fee:', error);
    return {
      success: false,
      error: error.message || 'Failed to create fee',
    };
  }
}

/**
 * Update an existing fee
 */
export async function updateFee(data: UpdateFeeData) {
  console.log('[Fee Actions] Updating fee:', data.id);

  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      throw new Error('User not authenticated');
    }

    if (!data.id) {
      return {
        success: false,
        error: 'Fee ID is required',
      };
    }

    const supabase = await getSupabaseClient();

    // Get user's residence_id to verify ownership
    const residenceId = await getUserResidenceId(supabase, userId);

    if (!residenceId) {
      return {
        success: false,
        error: 'User has no residence assigned',
      };
    }

    // Verify fee belongs to user's residence
    const { data: existingFee, error: fetchError } = await supabase
      .from('fees')
      .select('residence_id')
      .eq('id', data.id)
      .single();

    if (fetchError || !existingFee) {
      return {
        success: false,
        error: 'Fee not found',
      };
    }

    if (existingFee.residence_id !== residenceId) {
      return {
        success: false,
        error: 'You can only update fees from your own residence',
      };
    }

    // Build update object
    const updateData: any = {};
    if (data.title) updateData.title = data.title.trim();
    if (data.amount !== undefined) {
      if (Number(data.amount) <= 0) {
        return {
          success: false,
          error: 'Amount must be greater than 0',
        };
      }
      updateData.amount = Number(data.amount);
    }
    if (data.due_date) {
      const dueDate = new Date(data.due_date);
      if (isNaN(dueDate.getTime())) {
        return {
          success: false,
          error: 'Invalid due date format',
        };
      }
      updateData.due_date = data.due_date;
    }
    if (data.status) updateData.status = data.status;

    // Update fee
    const { data: fee, error: feeError } = await supabase
      .from('fees')
      .update(updateData)
      .eq('id', data.id)
      .eq('residence_id', residenceId) // Additional security: ensure we only update fees from user's residence
      .select()
      .single();

    if (feeError) {
      console.error('[Fee Actions] Error updating fee:', feeError);
      return {
        success: false,
        error: feeError.message || 'Failed to update fee',
      };
    }

    console.log('[Fee Actions] Fee updated successfully:', fee.id);

    // Revalidate residents page
    revalidatePath('/app/residents');

    return {
      success: true,
      fee,
    };
  } catch (error: any) {
    console.error('[Fee Actions] Error updating fee:', error);
    return {
      success: false,
      error: error.message || 'Failed to update fee',
    };
  }
}

/**
 * Delete a fee
 */
export async function deleteFee(feeId: number) {
  console.log('[Fee Actions] Deleting fee:', feeId);

  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      throw new Error('User not authenticated');
    }

    if (!feeId) {
      return {
        success: false,
        error: 'Fee ID is required',
      };
    }

    const supabase = await getSupabaseClient();

    // Get user's residence_id to verify ownership
    const residenceId = await getUserResidenceId(supabase, userId);

    if (!residenceId) {
      return {
        success: false,
        error: 'User has no residence assigned',
      };
    }

    // Verify fee belongs to user's residence
    const { data: existingFee, error: fetchError } = await supabase
      .from('fees')
      .select('residence_id')
      .eq('id', feeId)
      .single();

    if (fetchError || !existingFee) {
      return {
        success: false,
        error: 'Fee not found',
      };
    }

    if (existingFee.residence_id !== residenceId) {
      return {
        success: false,
        error: 'You can only delete fees from your own residence',
      };
    }

    // Delete fee
    const { error: deleteError } = await supabase
      .from('fees')
      .delete()
      .eq('id', feeId)
      .eq('residence_id', residenceId); // Additional security: ensure we only delete fees from user's residence

    if (deleteError) {
      console.error('[Fee Actions] Error deleting fee:', deleteError);
      return {
        success: false,
        error: deleteError.message || 'Failed to delete fee',
      };
    }

    console.log('[Fee Actions] Fee deleted successfully:', feeId);

    // Revalidate residents page
    revalidatePath('/app/residents');

    return {
      success: true,
    };
  } catch (error: any) {
    console.error('[Fee Actions] Error deleting fee:', error);
    return {
      success: false,
      error: error.message || 'Failed to delete fee',
    };
  }
}

/**
 * Get all fees for the user's residence
 */
export async function getAllFees() {
  console.log('[Fee Actions] Getting all fees');

  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      throw new Error('User not authenticated');
    }

    const supabase = await getSupabaseClient();

    // Get user's residence ID
    const residenceId = await getUserResidenceId(supabase, userId);

    if (!residenceId) {
      return {
        success: false,
        error: 'User is not assigned to a residence',
      };
    }

    // Fetch all fees for the residence with resident details
    // Join through user_id to get apartment number from profile_residences
    const { data, error } = await supabase
      .from('fees')
      .select(`
        *,
        profiles:user_id(full_name)
      `)
      .eq('residence_id', residenceId)
      .order('due_date', { ascending: false });

    if (error) {
      console.error('[Fee Actions] Error fetching fees:', error);
      return {
        success: false,
        error: 'Failed to fetch fees: ' + error.message,
      };
    }

    // Manually fetch apartment numbers for each fee
    const feesWithApartments = await Promise.all(
      (data || []).map(async (fee) => {
        const { data: profileResidence } = await supabase
          .from('profile_residences')
          .select('apartment_number')
          .eq('profile_id', fee.user_id)
          .eq('residence_id', residenceId)
          .single();

        return {
          ...fee,
          apartment_number: profileResidence?.apartment_number || 'N/A',
        };
      })
    );

    console.log('[Fee Actions] Fees fetched successfully:', feesWithApartments?.length);
    return {
      success: true,
      data: feesWithApartments || [],
    };
  } catch (error: any) {
    console.error('[Fee Actions] Unexpected error:', error);
    return {
      success: false,
      error: error.message || 'An unexpected error occurred',
    };
  }
}