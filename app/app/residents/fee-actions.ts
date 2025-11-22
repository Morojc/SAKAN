'use server';

import { auth } from '@/lib/auth';
import { getSupabaseClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

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

    // Delete fee
    const { error: deleteError } = await supabase
      .from('fees')
      .delete()
      .eq('id', feeId);

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

