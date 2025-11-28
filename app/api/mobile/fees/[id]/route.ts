import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { updateFee, deleteFee } from '@/app/app/residents/fee-actions';

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
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ success: false, error: 'Invalid fee ID' }, { status: 400 });
    }

    // For now, redirect to the list endpoint with filtering
    // In a full implementation, we'd have a getFeeById function
    return NextResponse.json({ success: false, error: 'Use GET /api/mobile/fees and filter by ID' }, { status: 501 });
  } catch (error: any) {
    console.error('[Mobile API] Fee GET error:', error);
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
      return NextResponse.json({ success: false, error: 'Invalid fee ID' }, { status: 400 });
    }

    const body = await request.json();
    const result = await updateFee({
      id,
      ...body,
    });

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Mobile API] Fee PATCH error:', error);
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
      return NextResponse.json({ success: false, error: 'Invalid fee ID' }, { status: 400 });
    }

    const result = await deleteFee(id);

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Mobile API] Fee DELETE error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

