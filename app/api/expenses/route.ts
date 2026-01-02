import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { auth } from '@/lib/auth';
import type { CreateExpenseDTO, Expense } from '@/types/financial.types';

// GET /api/expenses?residenceId=1&status=approved&categoryId=2
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
    const status = searchParams.get('status');
    const categoryId = searchParams.get('categoryId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!residenceId) {
      return NextResponse.json(
        { success: false, error: 'Residence ID is required' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();

    let query = supabase
      .from('expenses')
      .select(`
        *,
        expense_categories(name, color),
        approver:profiles!expenses_approved_by_fkey(full_name),
        creator:profiles!expenses_created_by_fkey(full_name)
      `)
      .eq('residence_id', residenceId);

    if (status) {
      query = query.eq('status', status);
    }

    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }

    if (startDate) {
      query = query.gte('expense_date', startDate);
    }

    if (endDate) {
      query = query.lte('expense_date', endDate);
    }

    query = query.order('expense_date', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error('[GET /api/expenses] Error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Transform data
    const expenses = data.map((item: any) => ({
      ...item,
      category_name: item.expense_categories?.name,
      category_color: item.expense_categories?.color,
      approver_name: item.approver?.full_name,
      creator_name: item.creator?.full_name,
    }));

    return NextResponse.json({
      success: true,
      data: expenses as Expense[],
    });
  } catch (error: any) {
    console.error('[GET /api/expenses] Exception:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/expenses
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: CreateExpenseDTO = await request.json();

    // Validate required fields
    if (!body.residence_id || !body.title || !body.description || !body.amount || !body.expense_date) {
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
        { success: false, error: 'Only syndics can create expenses' },
        { status: 403 }
      );
    }

    const { data, error } = await supabase
      .from('expenses')
      .insert({
        ...body,
        created_by: session.user.id,
        status: 'draft',
      })
      .select()
      .single();

    if (error) {
      console.error('[POST /api/expenses] Error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data as Expense,
      message: 'Expense created successfully',
    });
  } catch (error: any) {
    console.error('[POST /api/expenses] Exception:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

