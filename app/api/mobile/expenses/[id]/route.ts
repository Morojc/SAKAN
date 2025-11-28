import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { updateExpense, deleteExpense } from '@/app/app/expenses/actions';

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
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ success: false, error: 'Invalid expense ID' }, { status: 400 });
    }

    // For now, redirect to the list endpoint with filtering
    // In a full implementation, we'd have a getExpenseById function
    return NextResponse.json({ success: false, error: 'Use GET /api/mobile/expenses and filter by ID' }, { status: 501 });
  } catch (error: any) {
    console.error('[Mobile API] Expense GET error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ success: false, error: 'Invalid expense ID' }, { status: 400 });
    }

    const body = await request.json();
    const result = await updateExpense({
      id,
      ...body,
    });

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Mobile API] Expense PATCH error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ success: false, error: 'Invalid expense ID' }, { status: 400 });
    }

    const result = await deleteExpense(id);

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Mobile API] Expense DELETE error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

