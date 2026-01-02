import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { auth } from '@/lib/auth';
import type { BulkFeeDTO } from '@/types/financial.types';

// POST /api/fees/bulk
// Create fees for multiple apartments (US-03: Create exceptional fees)
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: BulkFeeDTO = await request.json();

    if (!body.residence_id || !body.apartment_numbers || !body.title || !body.amount || !body.due_date) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!Array.isArray(body.apartment_numbers) || body.apartment_numbers.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one apartment number is required' },
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
        { success: false, error: 'Only syndics can create bulk fees' },
        { status: 403 }
      );
    }

    // Get all profile_residences for the specified apartments
    const { data: profileResidences, error: prError } = await supabase
      .from('profile_residences')
      .select('id, profile_id, apartment_number')
      .eq('residence_id', body.residence_id)
      .in('apartment_number', body.apartment_numbers)
      .eq('verified', true);

    if (prError) {
      console.error('[POST /api/fees/bulk] Error fetching profile residences:', prError);
      return NextResponse.json(
        { success: false, error: prError.message },
        { status: 500 }
      );
    }

    if (!profileResidences || profileResidences.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No verified residents found for the specified apartments' },
        { status: 404 }
      );
    }

    // Calculate amount per apartment (can be equal distribution or custom)
    const amountPerApartment = body.amount / profileResidences.length;

    // Create fees for each apartment
    const feesToInsert = profileResidences.map((pr) => ({
      residence_id: body.residence_id,
      user_id: pr.profile_id,
      profile_residence_id: pr.id,
      apartment_number: pr.apartment_number,
      title: body.title,
      description: body.description,
      fee_type: body.fee_type || 'one_time',
      amount: amountPerApartment,
      due_date: body.due_date,
      reason: body.reason,
      status: 'unpaid',
      created_by: session.user.id,
    }));

    const { data: createdFees, error: insertError } = await supabase
      .from('fees')
      .insert(feesToInsert)
      .select();

    if (insertError) {
      console.error('[POST /api/fees/bulk] Error creating fees:', insertError);
      return NextResponse.json(
        { success: false, error: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        fees: createdFees,
        count: createdFees.length,
        total_amount: body.amount,
      },
      message: `Successfully created ${createdFees.length} fees`,
    });
  } catch (error: any) {
    console.error('[POST /api/fees/bulk] Exception:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

