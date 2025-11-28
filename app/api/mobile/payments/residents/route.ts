import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getResidents } from '@/app/actions/payments';

/**
 * Mobile API: Get residents for payment
 * GET /api/mobile/payments/residents?residence_id={id}
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

    const result = await getResidents(BigInt(residence_id));

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result.residents });
  } catch (error: any) {
    console.error('[Mobile API] Payments residents GET error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

