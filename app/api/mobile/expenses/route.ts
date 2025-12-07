import { NextRequest, NextResponse } from 'next/server';
import { getMobileUser } from '@/lib/auth/mobile';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

/**
 * CORS headers for mobile API
 */
function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
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
 * Mobile API: Expenses
 * GET /api/mobile/expenses - Get all expenses
 * POST /api/mobile/expenses - Create expense
 */

export async function GET(request: NextRequest) {
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

    // Get user profile
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
      return NextResponse.json(
        { success: false, error: 'User has no residence assigned' },
        { status: 400, headers: getCorsHeaders() }
      );
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
      return NextResponse.json(
        { success: false, error: expensesError.message },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    // Transform expenses
    const expensesWithNames = (expenses || []).map((expense: any) => ({
      ...expense,
      created_by_name: expense.profiles?.full_name || 'Unknown',
      residence_name: expense.residences?.name || 'Unknown',
    }));

    return NextResponse.json(
      { success: true, data: expensesWithNames },
      { headers: getCorsHeaders() }
    );
  } catch (error: any) {
    console.error('[Mobile API] Expenses GET error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

export async function POST(request: NextRequest) {
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

    // Only syndics can create expenses
    if (userProfile.role !== 'syndic') {
      return NextResponse.json(
        { success: false, error: 'Only syndics can create expenses' },
        { status: 403, headers: getCorsHeaders() }
      );
    }

    // Get residence ID
    const { data: residence } = await supabase
      .from('residences')
      .select('id')
      .eq('syndic_user_id', userId)
      .maybeSingle();

    if (!residence) {
      return NextResponse.json(
        { success: false, error: 'User has no residence assigned' },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    const body = await request.json();

    // Validate required fields
    if (!body.description || !body.amount || !body.category) {
      return NextResponse.json(
        { success: false, error: 'Description, amount, and category are required' },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    // Create expense directly in database
    const { data: newExpense, error: createError } = await supabase
      .from('expenses')
      .insert({
        residence_id: residence.id,
        created_by: userId,
        description: body.description,
        amount: body.amount,
        category: body.category,
        expense_date: body.expense_date || new Date().toISOString().split('T')[0],
        receipt_url: body.receipt_url || null,
      })
      .select()
      .single();

    if (createError) {
      console.error('[Mobile API] Expenses POST: Error creating expense:', createError);
      return NextResponse.json(
        { success: false, error: createError.message || 'Failed to create expense' },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    return NextResponse.json(
      { success: true, data: newExpense },
      { status: 201, headers: getCorsHeaders() }
    );
  } catch (error: any) {
    console.error('[Mobile API] Expenses POST error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

