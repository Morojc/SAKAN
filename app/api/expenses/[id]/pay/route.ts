import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { auth } from '@/lib/auth';
import type { ExpensePaymentDTO } from '@/types/financial.types';

// PUT /api/expenses/[id]/pay
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body: ExpensePaymentDTO = await request.json();

    if (!body.payment_method) {
      return NextResponse.json(
        { success: false, error: 'Payment method is required' },
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
        { success: false, error: 'Only syndics can mark expenses as paid' },
        { status: 403 }
      );
    }

    // Update expense status to paid
    const { data, error } = await supabase
      .from('expenses')
      .update({
        status: 'paid',
        payment_method: body.payment_method,
        payment_reference: body.payment_reference,
        receipt_url: body.receipt_url,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[PUT /api/expenses/[id]/pay] Error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Trigger will automatically create transaction history

    return NextResponse.json({
      success: true,
      data,
      message: 'Expense marked as paid successfully',
    });
  } catch (error: any) {
    console.error('[PUT /api/expenses/[id]/pay] Exception:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

