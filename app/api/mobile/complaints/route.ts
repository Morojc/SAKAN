import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  createComplaint,
  getComplaints,
  getComplaintById,
  updateComplaintStatus,
  getResidentsForComplaint,
  // TODO: Implement these functions for evidence upload feature
  // uploadComplaintEvidence,
  // addComplaintEvidence,
  // getComplaintEvidence,
} from '@/app/app/complaints/actions';

/**
 * Mobile API: Complaints
 * GET /api/mobile/complaints - Get all complaints
 * POST /api/mobile/complaints - Create complaint
 * GET /api/mobile/complaints/[id] - Get complaint by ID
 * PATCH /api/mobile/complaints/[id] - Update complaint status
 */

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const residence_id = searchParams.get('residence_id');

    const filters: any = {};
    if (status) filters.status = status;
    if (residence_id) filters.residence_id = parseInt(residence_id);

    const result = await getComplaints(Object.keys(filters).length > 0 ? filters : undefined);

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Mobile API] Complaints GET error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const result = await createComplaint(body);

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error('[Mobile API] Complaints POST error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

