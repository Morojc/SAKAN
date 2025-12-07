import { NextRequest, NextResponse } from 'next/server';
import { getMobileUser } from '@/lib/auth/mobile';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

/**
 * CORS headers for mobile API
 */
function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

/**
 * Handle OPTIONS request for CORS preflight
 */
export async function OPTIONS() {
  return NextResponse.json({}, { headers: getCorsHeaders() });
}

/**
 * Mobile API: Expense by ID
 * GET /api/mobile/expenses/[id] - Get expense details
 * PATCH /api/mobile/expenses/[id] - Update expense
 * DELETE /api/mobile/expenses/[id] - Delete expense
 */

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const mobileUser = await getMobileUser(request);
    if (!mobileUser?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401, headers: getCorsHeaders() }
      );
    }

    const supabase = createSupabaseAdminClient();
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid expense ID' },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    const { data: expense, error: expenseError } = await supabase
      .from('expenses')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (expenseError) {
      return NextResponse.json(
        { success: false, error: expenseError.message },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    if (!expense) {
      return NextResponse.json(
        { success: false, error: 'Expense not found' },
        { status: 404, headers: getCorsHeaders() }
      );
    }

    return NextResponse.json(
      { success: true, data: expense },
      { headers: getCorsHeaders() }
    );
  } catch (error: any) {
    console.error('[Mobile API] Expense GET error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const mobileUser = await getMobileUser(request);
    if (!mobileUser?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401, headers: getCorsHeaders() }
      );
    }

    const supabase = createSupabaseAdminClient();
    const userId = mobileUser.id;

    // Get user profile to verify syndic role
    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('role, id')
      .eq('id', userId)
      .maybeSingle();

    if (profileError || !userProfile) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch user profile' },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    // Only syndics can update expenses
    if (userProfile.role !== 'syndic') {
      return NextResponse.json(
        { success: false, error: 'Only syndics can update expenses' },
        { status: 403, headers: getCorsHeaders() }
      );
    }

    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid expense ID' },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    const body = await request.json();

    // Update expense directly in database
    const updateData: any = {};
    if (body.description != null) updateData.description = body.description;
    if (body.amount != null) updateData.amount = body.amount;
    if (body.category != null) updateData.category = body.category;
    if (body.expense_date != null) updateData.expense_date = body.expense_date;
    if (body.receipt_url != null) updateData.receipt_url = body.receipt_url;

    const { data: updatedExpense, error: updateError } = await supabase
      .from('expenses')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('[Mobile API] Expenses PATCH: Error updating expense:', updateError);
      return NextResponse.json(
        { success: false, error: updateError.message || 'Failed to update expense' },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    return NextResponse.json(
      { success: true, data: updatedExpense },
      { headers: getCorsHeaders() }
    );
  } catch (error: any) {
    console.error('[Mobile API] Expense PATCH error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const mobileUser = await getMobileUser(request);
    if (!mobileUser?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401, headers: getCorsHeaders() }
      );
    }

    const supabase = createSupabaseAdminClient();
    const userId = mobileUser.id;

    // Get user profile to verify syndic role
    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('role, id')
      .eq('id', userId)
      .maybeSingle();

    if (profileError || !userProfile) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch user profile' },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    // Only syndics can delete expenses
    if (userProfile.role !== 'syndic') {
      return NextResponse.json(
        { success: false, error: 'Only syndics can delete expenses' },
        { status: 403, headers: getCorsHeaders() }
      );
    }

    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid expense ID' },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    // Delete expense directly from database
    const { error: deleteError } = await supabase
      .from('expenses')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('[Mobile API] Expenses DELETE: Error deleting expense:', deleteError);
      return NextResponse.json(
        { success: false, error: deleteError.message || 'Failed to delete expense' },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    return NextResponse.json(
      { success: true },
      { headers: getCorsHeaders() }
    );
  } catch (error: any) {
    console.error('[Mobile API] Expense DELETE error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

