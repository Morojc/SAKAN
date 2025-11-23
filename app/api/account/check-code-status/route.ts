import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { checkAccessCodeStatus } from '@/lib/utils/access-code';

/**
 * GET /api/account/check-code-status
 * Checks the status of an access code
 * Used by the original syndic to check if the replacement user has successfully used the code
 */
export async function GET(req: Request) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Code is required' }, { status: 400 });
    }

    const status = await checkAccessCodeStatus(code);
    
    return NextResponse.json(status);
  } catch (error: any) {
    console.error('Error checking code status:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}

