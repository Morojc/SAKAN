'use server';

import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

/**
 * Expenses Server Actions
 * Handles CRUD operations for expenses
 */

interface CreateExpenseData {
  description: string;
  category: string;
  amount: number;
  expense_date: string; // ISO date string
  residence_id: number;
  attachment_url?: string;
}

interface UpdateExpenseData {
  id: number;
  description?: string;
  category?: string;
  amount?: number;
  expense_date?: string;
  attachment_url?: string;
}

/**
 * Helper to get the current user's managed residence ID
 */
async function getManagedResidenceId(userId: string, supabase: any) {
  // Check if syndic
  const { data: syndicResidence } = await supabase
    .from('residences')
    .select('id')
    .eq('syndic_user_id', userId)
    .maybeSingle();
  
  if (syndicResidence) return syndicResidence.id;

  // Check if guard
  const { data: guardResidence } = await supabase
    .from('residences')
    .select('id')
    .eq('guard_user_id', userId)
    .maybeSingle();

  if (guardResidence) return guardResidence.id;

  return null;
}

/**
 * Create a new expense
 */
export async function createExpense(data: CreateExpenseData) {
  console.log('[Expenses Actions] Creating expense:', data);

  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return {
        success: false,
        error: 'User not authenticated',
      };
    }

    // Validation
    if (!data.description || !data.category || !data.amount || !data.expense_date || !data.residence_id) {
      return {
        success: false,
        error: 'Missing required fields: description, category, amount, expense_date, and residence_id are required',
      };
    }

    if (data.amount <= 0) {
      return {
        success: false,
        error: 'Amount must be greater than 0',
      };
    }

    const adminSupabase = createSupabaseAdminClient();

    // Verify permissions: Current user must be the manager (syndic) of the target residence
    const managedResidenceId = await getManagedResidenceId(userId, adminSupabase);
    
    if (!managedResidenceId || managedResidenceId !== data.residence_id) {
      return {
        success: false,
        error: 'You do not have permission to create expenses for this residence',
      };
    }

    // Create expense
    const { data: expense, error } = await adminSupabase
      .from('expenses')
      .insert({
        description: data.description,
        category: data.category,
        amount: data.amount,
        expense_date: data.expense_date,
        residence_id: data.residence_id,
        created_by: userId,
        attachment_url: data.attachment_url || null,
      })
      .select()
      .single();

    if (error) {
      console.error('[Expenses Actions] Error creating expense:', error);
      return {
        success: false,
        error: error.message || 'Failed to create expense',
      };
    }

    console.log('[Expenses Actions] Expense created successfully:', expense?.id);
    revalidatePath('/app/expenses');
    
    return {
      success: true,
      data: expense,
    };

  } catch (error: any) {
    console.error('[Expenses Actions] Unexpected error:', error);
    return {
      success: false,
      error: error.message || 'An unexpected error occurred',
    };
  }
}

/**
 * Update an existing expense
 */
export async function updateExpense(data: UpdateExpenseData) {
  console.log('[Expenses Actions] Updating expense:', data.id);

  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return {
        success: false,
        error: 'User not authenticated',
      };
    }

    if (!data.id) {
      return {
        success: false,
        error: 'Expense ID is required',
      };
    }

    const adminSupabase = createSupabaseAdminClient();

    // Get existing expense to verify residence
    const { data: existingExpense, error: fetchError } = await adminSupabase
      .from('expenses')
      .select('residence_id')
      .eq('id', data.id)
      .single();

    if (fetchError || !existingExpense) {
      return {
        success: false,
        error: 'Expense not found',
      };
    }

    // Verify permissions
    const managedResidenceId = await getManagedResidenceId(userId, adminSupabase);
    
    if (!managedResidenceId || managedResidenceId !== existingExpense.residence_id) {
      return {
        success: false,
        error: 'You do not have permission to update this expense',
      };
    }

    // Build update object with only provided fields
    const updateData: any = {};
    if (data.description !== undefined) updateData.description = data.description;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.amount !== undefined) {
      if (data.amount <= 0) {
        return {
          success: false,
          error: 'Amount must be greater than 0',
        };
      }
      updateData.amount = data.amount;
    }
    if (data.expense_date !== undefined) updateData.expense_date = data.expense_date;
    if (data.attachment_url !== undefined) updateData.attachment_url = data.attachment_url;

    // Update expense
    const { data: expense, error } = await adminSupabase
      .from('expenses')
      .update(updateData)
      .eq('id', data.id)
      .select()
      .single();

    if (error) {
      console.error('[Expenses Actions] Error updating expense:', error);
      return {
        success: false,
        error: error.message || 'Failed to update expense',
      };
    }

    console.log('[Expenses Actions] Expense updated successfully:', expense?.id);
    revalidatePath('/app/expenses');
    
    return {
      success: true,
      data: expense,
    };

  } catch (error: any) {
    console.error('[Expenses Actions] Unexpected error:', error);
    return {
      success: false,
      error: error.message || 'An unexpected error occurred',
    };
  }
}

/**
 * Delete an expense
 */
export async function deleteExpense(expenseId: number) {
  console.log('[Expenses Actions] Deleting expense:', expenseId);

  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return {
        success: false,
        error: 'User not authenticated',
      };
    }

    if (!expenseId) {
      return {
        success: false,
        error: 'Expense ID is required',
      };
    }

    const adminSupabase = createSupabaseAdminClient();

    // Get existing expense to verify residence
    const { data: existingExpense, error: fetchError } = await adminSupabase
      .from('expenses')
      .select('residence_id')
      .eq('id', expenseId)
      .single();

    if (fetchError || !existingExpense) {
      return {
        success: false,
        error: 'Expense not found',
      };
    }

    // Verify permissions
    const managedResidenceId = await getManagedResidenceId(userId, adminSupabase);
    
    if (!managedResidenceId || managedResidenceId !== existingExpense.residence_id) {
      return {
        success: false,
        error: 'You do not have permission to delete this expense',
      };
    }

    // Delete expense
    const { error } = await adminSupabase
      .from('expenses')
      .delete()
      .eq('id', expenseId);

    if (error) {
      console.error('[Expenses Actions] Error deleting expense:', error);
      return {
        success: false,
        error: error.message || 'Failed to delete expense',
      };
    }

    console.log('[Expenses Actions] Expense deleted successfully:', expenseId);
    revalidatePath('/app/expenses');
    
    return {
      success: true,
    };

  } catch (error: any) {
    console.error('[Expenses Actions] Unexpected error:', error);
    return {
      success: false,
      error: error.message || 'An unexpected error occurred',
    };
  }
}

/**
 * Upload expense attachment to Supabase storage
 */
export async function uploadExpenseAttachment(formData: FormData): Promise<{ success: boolean; url?: string; error?: string }> {
  console.log('[Expenses Actions] Uploading expense attachment');

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return {
        success: false,
        error: 'Not authenticated',
      };
    }

    const file = formData.get('file') as File;
    
    if (!file) {
      return {
        success: false,
        error: 'No file provided',
      };
    }

    // Validate file type (PDF, images)
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    
    if (!allowedTypes.includes(file.type)) {
      return {
        success: false,
        error: 'Invalid file type. Please upload a PDF or image file.',
      };
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return {
        success: false,
        error: 'File size too large. Maximum size is 10MB.',
      };
    }

    const supabase = createSupabaseAdminClient();

    // Upload file
    const fileExt = file.name.split('.').pop();
    const fileName = `${session.user.id}/expense-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `expenses/${fileName}`;

    const arrayBuffer = await file.arrayBuffer();
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('SAKAN')
      .upload(filePath, arrayBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('[Expenses Actions] Storage error:', uploadError);
      return {
        success: false,
        error: 'Failed to upload file. Please try again.',
      };
    }

    const { data: urlData } = supabase.storage
      .from('SAKAN')
      .getPublicUrl(filePath);

    console.log('[Expenses Actions] File uploaded successfully:', urlData.publicUrl);
    
    return {
      success: true,
      url: urlData.publicUrl,
    };

  } catch (error: any) {
    console.error('[Expenses Actions] Unexpected error uploading file:', error);
    return {
      success: false,
      error: error.message || 'Failed to upload file',
    };
  }
}

