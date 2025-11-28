import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { updateResident, deleteResident } from '@/app/app/residents/actions';

/**
 * Mobile API: Resident by ID
 * GET /api/mobile/residents/[id] - Get resident details
 * PATCH /api/mobile/residents/[id] - Update resident
 * DELETE /api/mobile/residents/[id] - Delete resident
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

    const id = params.id;

    // For now, redirect to the list endpoint with filtering
    // In a full implementation, we'd have a getResidentById function
    return NextResponse.json({ success: false, error: 'Use GET /api/mobile/residents and filter by ID' }, { status: 501 });
  } catch (error: any) {
    console.error('[Mobile API] Resident GET error:', error);
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

    const id = params.id;

    const body = await request.json();
    const result = await updateResident({
      id,
      ...body,
    });

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Mobile API] Resident PATCH error:', error);
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

    const id = params.id;

    const result = await deleteResident(id);

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Mobile API] Resident DELETE error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

