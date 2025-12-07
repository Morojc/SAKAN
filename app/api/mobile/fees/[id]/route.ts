import { NextRequest, NextResponse } from 'next/server';
import { getMobileUser } from '@/lib/auth/mobile';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

/**
 * CORS headers for mobile API
 */
function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
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
 * Mobile API: Fee by ID
 * GET /api/mobile/fees/[id] - Get fee details
 * PATCH /api/mobile/fees/[id] - Update fee
 * DELETE /api/mobile/fees/[id] - Delete fee
 */

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const mobileUser = await getMobileUser(request);
    if (!mobileUser?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401, headers: getCorsHeaders() }
      );
    }

    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ success: false, error: 'Invalid fee ID' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid fee ID' },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    const { data: fee, error: feeError } = await supabase
      .from('fees')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (feeError) {
      return NextResponse.json(
        { success: false, error: feeError.message },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    if (!fee) {
      return NextResponse.json(
        { success: false, error: 'Fee not found' },
        { status: 404, headers: getCorsHeaders() }
      );
    }

    return NextResponse.json(
      { success: true, data: fee },
      { headers: getCorsHeaders() }
    );
  } catch (error: any) {
    console.error('[Mobile API] Fee GET error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Only syndics can update fees
    if (userProfile.role !== 'syndic') {
      return NextResponse.json(
        { success: false, error: 'Only syndics can update fees' },
        { status: 403, headers: getCorsHeaders() }
      );
    }

    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid fee ID' },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    const body = await request.json();

    // Update fee directly in database
    const updateData: any = {};
    if (body.title != null) updateData.title = body.title;
    if (body.amount != null) updateData.amount = body.amount;
    if (body.due_date != null) updateData.due_date = body.due_date;
    if (body.status != null) updateData.status = body.status;

    const { data: updatedFee, error: updateError } = await supabase
      .from('fees')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('[Mobile API] Fees PATCH: Error updating fee:', updateError);
      return NextResponse.json(
        { success: false, error: updateError.message || 'Failed to update fee' },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    return NextResponse.json(
      { success: true, data: updatedFee },
      { headers: getCorsHeaders() }
    );
  } catch (error: any) {
    console.error('[Mobile API] Fee PATCH error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Only syndics can delete fees
    if (userProfile.role !== 'syndic') {
      return NextResponse.json(
        { success: false, error: 'Only syndics can delete fees' },
        { status: 403, headers: getCorsHeaders() }
      );
    }

    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid fee ID' },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    // Delete fee directly from database
    const { error: deleteError } = await supabase
      .from('fees')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('[Mobile API] Fees DELETE: Error deleting fee:', deleteError);
      return NextResponse.json(
        { success: false, error: deleteError.message || 'Failed to delete fee' },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    return NextResponse.json(
      { success: true },
      { headers: getCorsHeaders() }
    );
  } catch (error: any) {
    console.error('[Mobile API] Fee DELETE error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

