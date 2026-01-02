import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { auth } from '@/lib/auth';

// POST /api/payments/allocate
// Allocates a payment to one or more outstanding contributions/fees
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { payment_id, allocations } = body;

    if (!payment_id || !allocations || !Array.isArray(allocations) || allocations.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Payment ID and allocations array are required' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();

    // Check if user is syndic
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .maybeSingle();

    if (profile?.role !== 'syndic') {
      return NextResponse.json(
        { success: false, error: 'Only syndics can allocate payments' },
        { status: 403 }
      );
    }

    // Get payment details
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('*')
      .eq('id', payment_id)
      .single();

    if (paymentError || !payment) {
      return NextResponse.json(
        { success: false, error: 'Payment not found' },
        { status: 404 }
      );
    }

    if (payment.status !== 'verified') {
      return NextResponse.json(
        { success: false, error: 'Only verified payments can be allocated' },
        { status: 400 }
      );
    }

    // Calculate total allocation amount
    const totalAllocated = allocations.reduce((sum: number, alloc: any) => sum + alloc.amount, 0);
    
    if (totalAllocated > payment.amount) {
      return NextResponse.json(
        { success: false, error: 'Total allocation amount exceeds payment amount' },
        { status: 400 }
      );
    }

    // Process allocations
    const results = [];
    let remainingAmount = payment.amount;

    for (const allocation of allocations) {
      const { type, id, amount } = allocation;

      if (amount <= 0 || amount > remainingAmount) {
        continue;
      }

      if (type === 'contribution') {
        // Allocate to contribution
        const { data: contribution, error: contribError } = await supabase
          .from('contributions')
          .select('*')
          .eq('id', id)
          .single();

        if (contribError || !contribution) {
          continue;
        }

        const newAmountPaid = (contribution.amount_paid || 0) + amount;
        const newStatus = newAmountPaid >= contribution.amount_due 
          ? 'paid' 
          : newAmountPaid > 0 
            ? 'partial' 
            : contribution.status;

        await supabase
          .from('contributions')
          .update({
            amount_paid: newAmountPaid,
            status: newStatus,
            paid_date: newStatus === 'paid' ? new Date().toISOString().split('T')[0] : contribution.paid_date,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);

        // Update payment link if not already linked
        if (!payment.contribution_id) {
          await supabase
            .from('payments')
            .update({ contribution_id: id })
            .eq('id', payment_id);
        }

        results.push({ type: 'contribution', id, amount, success: true });
        remainingAmount -= amount;

      } else if (type === 'fee') {
        // Allocate to fee
        const { data: fee, error: feeError } = await supabase
          .from('fees')
          .select('*')
          .eq('id', id)
          .single();

        if (feeError || !fee) {
          continue;
        }

        await supabase
          .from('fees')
          .update({
            status: 'paid',
            paid_date: new Date().toISOString().split('T')[0],
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);

        // Update payment link if not already linked
        if (!payment.fee_id) {
          await supabase
            .from('payments')
            .update({ fee_id: id })
            .eq('id', payment_id);
        }

        results.push({ type: 'fee', id, amount, success: true });
        remainingAmount -= amount;
      }
    }

    // Handle overpayment (credit)
    if (remainingAmount > 0) {
      // Store as credit in notes or create a credit record
      await supabase
        .from('payments')
        .update({
          notes: payment.notes 
            ? `${payment.notes}\n\nCredit: ${remainingAmount.toFixed(2)} MAD`
            : `Credit: ${remainingAmount.toFixed(2)} MAD`,
        })
        .eq('id', payment_id);
    }

    return NextResponse.json({
      success: true,
      data: {
        allocations: results,
        remaining_credit: remainingAmount,
        message: 'Payment allocated successfully',
      },
    });
  } catch (error: any) {
    console.error('[POST /api/payments/allocate] Exception:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

