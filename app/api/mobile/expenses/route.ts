import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createExpense } from '@/app/app/expenses/actions';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

/**
 * Mobile API: Expenses
 * GET /api/mobile/expenses - Get all expenses
 * POST /api/mobile/expenses - Create expense
 */

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createSupabaseAdminClient();
    const userId = session.user.id;

    // Get user profile
    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('role, id')
      .eq('id', userId)
      .maybeSingle();

    if (profileError || !userProfile) {
      return NextResponse.json({ success: false, error: 'Failed to fetch user profile' }, { status: 400 });
    }

    // Get residence ID
    let residenceId = null;
    if (userProfile.role === 'syndic') {
      const { data: res } = await supabase.from('residences').select('id').eq('syndic_user_id', userId).maybeSingle();
      residenceId = res?.id;
    } else if (userProfile.role === 'guard') {
      const { data: res } = await supabase.from('residences').select('id').eq('guard_user_id', userId).maybeSingle();
      residenceId = res?.id;
    } else {
      const { data: pr } = await supabase.from('profile_residences').select('residence_id').eq('profile_id', userId).limit(1).maybeSingle();
      residenceId = pr?.residence_id;
    }

    if (!residenceId) {
      return NextResponse.json({ success: false, error: 'User has no residence assigned' }, { status: 400 });
    }

    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    // Fetch expenses
    let expensesQuery = supabase
      .from('expenses')
      .select(`
        *,
        profiles:created_by (
          id,
          full_name
        ),
        residences:residence_id (
          id,
          name,
          address
        )
      `)
      .eq('residence_id', residenceId);

    if (category) {
      expensesQuery = expensesQuery.eq('category', category);
    }

    if (startDate) {
      expensesQuery = expensesQuery.gte('expense_date', startDate);
    }

    if (endDate) {
      expensesQuery = expensesQuery.lte('expense_date', endDate);
    }

    const { data: expenses, error: expensesError } = await expensesQuery.order('expense_date', { ascending: false });

    if (expensesError) {
      return NextResponse.json({ success: false, error: expensesError.message }, { status: 400 });
    }

    // Transform expenses
    const expensesWithNames = (expenses || []).map((expense: any) => ({
      ...expense,
      created_by_name: expense.profiles?.full_name || 'Unknown',
      residence_name: expense.residences?.name || 'Unknown',
    }));

    return NextResponse.json({ success: true, data: expensesWithNames });
  } catch (error: any) {
    console.error('[Mobile API] Expenses GET error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const result = await createExpense(body);

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error('[Mobile API] Expenses POST error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

