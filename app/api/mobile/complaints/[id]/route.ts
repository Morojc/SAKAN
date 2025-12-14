import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getComplaintById, updateComplaintStatus } from '@/app/app/complaints/actions';

/**
 * Mobile API: Complaint by ID
 * GET /api/mobile/complaints/[id] - Get complaint details
 * PATCH /api/mobile/complaints/[id] - Update complaint status
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id: idParam } = await params;
    const id = parseInt(idParam);
    if (isNaN(id)) {
      return NextResponse.json({ success: false, error: 'Invalid complaint ID' }, { status: 400 });
    }

    const result = await getComplaintById(id);

    if (!result.success) {
      return NextResponse.json(result, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Mobile API] Complaint GET error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id: idParam } = await params;
    const id = parseInt(idParam);
    if (isNaN(id)) {
      return NextResponse.json({ success: false, error: 'Invalid complaint ID' }, { status: 400 });
    }

    const body = await request.json();
    const result = await updateComplaintStatus({
      id,
      status: body.status,
      resolution_notes: body.resolution_notes,
    });

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Mobile API] Complaint PATCH error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

