import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getBalances } from '@/app/actions/payments';

/**
 * Mobile API: Get balances
 * GET /api/mobile/payments/balances?residence_id={id}
 */

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const residence_id = searchParams.get('residence_id');

    const result = await getBalances(residence_id ? BigInt(residence_id) : undefined);

    if (result.error) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: {
        cashOnHand: result.cashOnHand,
        bankBalance: result.bankBalance,
      },
    });
  } catch (error: any) {
    console.error('[Mobile API] Payments balances GET error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

