import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { auth } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      residenceId,
      userId,
      apartmentNumber,
      month,
      year,
      amount,
      status,
      paymentMethod,
      paymentDate,
    } = body;

    // Validation
    if (!residenceId || !userId || !apartmentNumber || !month || !year || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (month < 1 || month > 12) {
      return NextResponse.json(
        { error: 'Invalid month' },
        { status: 400 }
      );
    }

    if (year < 2020 || year > 2100) {
      return NextResponse.json(
        { error: 'Invalid year' },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseAdminClient();

    // Check if contribution already exists for this apartment-month-year
    const { data: existingFee } = await supabase
      .from('fees')
      .select('id')
      .eq('residence_id', residenceId)
      .eq('user_id', userId)
      .eq('contribution_month', month)
      .eq('contribution_year', year)
      .single();

    if (existingFee) {
      return NextResponse.json(
        { error: 'Contribution already exists for this apartment and period' },
        { status: 400 }
      );
    }

    // Create fee record
    const dueDate = new Date(year, month - 1, 1);
    const monthNames = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'];
    const monthName = monthNames[month - 1];
    const yearShort = year.toString().slice(-2);

    const { data: fee, error: feeError } = await supabase
      .from('fees')
      .insert({
        residence_id: residenceId,
        user_id: userId,
        title: `Contribution ${monthName}-${yearShort}`,
        amount,
        due_date: dueDate.toISOString().split('T')[0],
        status: status || 'unpaid',
        contribution_month: month,
        contribution_year: year,
        is_historical: false, // Manually added, not imported
      })
      .select()
      .single();

    if (feeError) {
      console.error('Error creating fee:', feeError);
      return NextResponse.json(
        { error: 'Failed to create contribution record' },
        { status: 500 }
      );
    }

    // If status is paid, create payment record
    if (status === 'paid' && fee) {
      const { error: paymentError } = await supabase
        .from('payments')
        .insert({
          residence_id: residenceId,
          user_id: userId,
          apartment_number: apartmentNumber,
          fee_id: fee.id,
          amount,
          method: paymentMethod || 'cash',
          status: 'verified',
          paid_at: paymentDate || new Date().toISOString(),
        });

      if (paymentError) {
        console.error('Error creating payment:', paymentError);
        // Don't fail the whole request, fee is already created
      }
    }

    return NextResponse.json({
      success: true,
      feeId: fee.id,
    });
  } catch (error: any) {
    console.error('Error adding manual contribution:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

