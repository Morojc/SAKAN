import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getAssignableUsers } from '@/app/app/incidents/actions';

/**
 * Mobile API: Get assignable users for incidents
 * GET /api/mobile/incidents/assignable-users?residence_id={id}
 */

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const residence_id = searchParams.get('residence_id');

    if (!residence_id) {
      return NextResponse.json(
        { success: false, error: 'residence_id is required' },
        { status: 400 }
      );
    }

    const result = await getAssignableUsers(parseInt(residence_id));

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Mobile API] Assignable users GET error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

