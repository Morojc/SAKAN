import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { auth } from '@/lib/auth';

// GET /api/fees/[id]
// Get a specific fee by ID
export async function GET(
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
    const supabase = createSupabaseAdminClient();

    // Fetch the fee
    const { data: fee, error } = await supabase
      .from('fees')
      .select(`
        *,
        profiles!fees_user_id_fkey(full_name)
      `)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('[GET /api/fees/[id]] Error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    if (!fee) {
      return NextResponse.json(
        { success: false, error: 'Fee not found' },
        { status: 404 }
      );
    }

    // Check authorization - user must be syndic of the residence
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .maybeSingle();

    if (profile?.role === 'syndic') {
      const { data: residence } = await supabase
        .from('residences')
        .select('syndic_user_id')
        .eq('id', fee.residence_id)
        .maybeSingle();

      if (!residence || residence.syndic_user_id !== session.user.id) {
        return NextResponse.json(
          { success: false, error: 'Access denied' },
          { status: 403 }
        );
      }
    } else if (profile?.role !== 'syndic') {
      // Residents can only view their own fees
      if (fee.user_id !== session.user.id) {
        return NextResponse.json(
          { success: false, error: 'Access denied' },
          { status: 403 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      data: fee,
    });
  } catch (error: any) {
    console.error('[GET /api/fees/[id]] Exception:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/fees/[id]
// Update a fee (Syndic only)
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
    const body = await request.json();
    const { title, amount, due_date, status, description, fee_type, reason } = body;

    const supabase = createSupabaseAdminClient();

    // 1. Verify user is syndic
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .maybeSingle();

    if (profile?.role !== 'syndic') {
      return NextResponse.json(
        { success: false, error: 'Only syndics can update fees' },
        { status: 403 }
      );
    }

    // 2. Fetch the fee to verify it exists and get residence_id
    const { data: existingFee, error: fetchError } = await supabase
      .from('fees')
      .select('id, residence_id')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) {
      console.error('[PUT /api/fees/[id]] Error fetching fee:', fetchError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch fee' },
        { status: 500 }
      );
    }

    if (!existingFee) {
      return NextResponse.json(
        { success: false, error: 'Fee not found' },
        { status: 404 }
      );
    }

    // 3. Verify user is syndic of the residence
    const { data: residence } = await supabase
      .from('residences')
      .select('syndic_user_id')
      .eq('id', existingFee.residence_id)
      .maybeSingle();

    if (!residence || residence.syndic_user_id !== session.user.id) {
      return NextResponse.json(
        { success: false, error: 'Only the syndic of this residence can update fees' },
        { status: 403 }
      );
    }

    // 4. Build update object (only allow title and reason to be updated)
    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (reason !== undefined) updateData.reason = reason;
    
    // Reject attempts to update other fields
    if (amount !== undefined || due_date !== undefined || status !== undefined || 
        description !== undefined || fee_type !== undefined) {
      return NextResponse.json(
        { success: false, error: 'Only title and reason can be updated. Other fields are locked to maintain financial integrity.' },
        { status: 400 }
      );
    }

    // 5. Update the fee
    const { data: updatedFee, error: updateError } = await supabase
      .from('fees')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('[PUT /api/fees/[id]] Error updating fee:', updateError);
      return NextResponse.json(
        { success: false, error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updatedFee,
      message: 'Fee updated successfully',
    });
  } catch (error: any) {
    console.error('[PUT /api/fees/[id]] Exception:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/fees/[id]
// Delete a fee (Syndic only)
export async function DELETE(
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
    const supabase = createSupabaseAdminClient();

    // 1. Verify user is syndic
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .maybeSingle();

    if (profile?.role !== 'syndic') {
      return NextResponse.json(
        { success: false, error: 'Only syndics can delete fees' },
        { status: 403 }
      );
    }

    // 2. Fetch the fee to verify it exists and get residence_id
    const { data: existingFee, error: fetchError } = await supabase
      .from('fees')
      .select('id, residence_id, status')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) {
      console.error('[DELETE /api/fees/[id]] Error fetching fee:', fetchError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch fee' },
        { status: 500 }
      );
    }

    if (!existingFee) {
      return NextResponse.json(
        { success: false, error: 'Fee not found' },
        { status: 404 }
      );
    }

    // 3. Verify user is syndic of the residence
    const { data: residence } = await supabase
      .from('residences')
      .select('syndic_user_id')
      .eq('id', existingFee.residence_id)
      .maybeSingle();

    if (!residence || residence.syndic_user_id !== session.user.id) {
      return NextResponse.json(
        { success: false, error: 'Only the syndic of this residence can delete fees' },
        { status: 403 }
      );
    }

    // 4. Check if fee has related payments - prevent deletion if payments exist
    const { data: relatedPayments, error: paymentsError } = await supabase
      .from('payments')
      .select('id')
      .eq('fee_id', id)
      .limit(1);

    if (paymentsError) {
      console.error('[DELETE /api/fees/[id]] Error checking payments:', paymentsError);
      return NextResponse.json(
        { success: false, error: 'Failed to check for related payments' },
        { status: 500 }
      );
    }

    if (relatedPayments && relatedPayments.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Cannot delete fee: This fee has related payments. Please remove the payments first or contact support.' 
        },
        { status: 400 }
      );
    }

    // 5. Delete the fee
    const { error: deleteError } = await supabase
      .from('fees')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('[DELETE /api/fees/[id]] Error deleting fee:', deleteError);
      return NextResponse.json(
        { success: false, error: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Fee deleted successfully',
    });
  } catch (error: any) {
    console.error('[DELETE /api/fees/[id]] Exception:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

