import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { auth } from '@/lib/auth';
import type { CreateExpenseCategoryDTO, ExpenseCategory } from '@/types/financial.types';

// GET /api/expenses/categories?residenceId=1
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const residenceId = searchParams.get('residenceId');

    if (!residenceId) {
      return NextResponse.json(
        { success: false, error: 'Residence ID is required' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from('expense_categories')
      .select('*')
      .eq('residence_id', residenceId)
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('[GET /api/expenses/categories] Error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data as ExpenseCategory[],
    });
  } catch (error: any) {
    console.error('[GET /api/expenses/categories] Exception:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/expenses/categories
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: CreateExpenseCategoryDTO = await request.json();

    // Validate required fields
    if (!body.residence_id || !body.name) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();

    // Check if user is syndic
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (profile?.role !== 'syndic') {
      return NextResponse.json(
        { success: false, error: 'Only syndics can create expense categories' },
        { status: 403 }
      );
    }

    const { data, error } = await supabase
      .from('expense_categories')
      .insert(body)
      .select()
      .single();

    if (error) {
      console.error('[POST /api/expenses/categories] Error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data as ExpenseCategory,
      message: 'Expense category created successfully',
    });
  } catch (error: any) {
    console.error('[POST /api/expenses/categories] Exception:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

