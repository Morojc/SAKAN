import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { auth } from '@/lib/auth';
import type { SubmitPaymentDTO, Payment } from '@/types/financial.types';

// GET /api/payments?residenceId=1&status=pending&paymentType=contribution
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
    const paymentType = searchParams.get('paymentType');
    const userId = searchParams.get('userId');
    const apartmentNumber = searchParams.get('apartmentNumber');

    if (!residenceId) {
      return NextResponse.json(
        { success: false, error: 'Residence ID is required' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();

    let query = supabase
      .from('payments')
      .select(`
        *,
        profiles!payments_user_id_fkey(full_name),
        verifier:profiles!payments_verified_by_fkey(full_name)
      `)
      .eq('residence_id', residenceId);

    if (status) {
      query = query.eq('status', status);
    }

    if (paymentType) {
      query = query.eq('payment_type', paymentType);
    }

    if (userId) {
      query = query.eq('user_id', userId);
    }

    if (apartmentNumber) {
      query = query.eq('apartment_number', apartmentNumber);
    }

    query = query.order('paid_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error('[GET /api/payments] Error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Transform data
    const payments = data.map((item: any) => ({
      ...item,
      resident_name: item.profiles?.full_name || 'Unknown',
      verifier_name: item.verifier?.full_name,
    }));

    return NextResponse.json({
      success: true,
      data: payments as Payment[],
    });
  } catch (error: any) {
    console.error('[GET /api/payments] Exception:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/payments (Submit payment)
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: SubmitPaymentDTO = await request.json();

    // Validate required fields
    if (!body.residence_id || !body.payment_type || !body.amount || !body.method) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate payment links
    if (body.payment_type === 'contribution' && !body.contribution_id) {
      return NextResponse.json(
        { success: false, error: 'contribution_id is required for contribution payments' },
        { status: 400 }
      );
    }

    if ((body.payment_type === 'fee' || body.payment_type === 'fine') && !body.fee_id) {
      return NextResponse.json(
        { success: false, error: 'fee_id is required for fee/fine payments' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();

    // Use provided user_id or session user id
    const userId = body.user_id || session.user.id;

    // If status is verified and verified_by is not provided, set it to current user
    const verifiedBy = body.status === 'verified' && !body.verified_by 
      ? session.user.id 
      : body.verified_by;

    // If status is verified and paid_at is not provided, set it to now
    const paidAt = body.status === 'verified' && !body.paid_at
      ? new Date().toISOString()
      : body.paid_at;

    const { data, error } = await supabase
      .from('payments')
      .insert({
        ...body,
        user_id: userId,
        verified_by: verifiedBy || null,
        paid_at: paidAt || new Date().toISOString(), // Always set paid_at
        status: body.status || 'pending', // Use provided status or default to pending
      })
      .select()
      .single();

    if (error) {
      console.error('[POST /api/payments] Error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data as Payment,
      message: 'Payment submitted successfully',
    });
  } catch (error: any) {
    console.error('[POST /api/payments] Exception:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
