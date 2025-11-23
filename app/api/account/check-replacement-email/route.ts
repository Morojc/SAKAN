import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { checkIfReplacementEmail } from '@/lib/utils/access-code';

/**
 * GET /api/account/check-replacement-email
 * Checks if an email is a replacement_email in any pending access code
 * Can be called without authentication (for signin page)
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');

    if (!email) {
      // Try to get from session if available
      const session = await auth();
      if (!session?.user?.email) {
        return NextResponse.json({ error: 'Email is required' }, { status: 400 });
      }
      const emailToCheck = session.user.email;
      const codeData = await checkIfReplacementEmail(emailToCheck);
      return NextResponse.json({ 
        isReplacementEmail: !!codeData,
        codeData: codeData || null
      });
    }

    // Check email without requiring authentication (for signin page)
    const codeData = await checkIfReplacementEmail(email);
    
    return NextResponse.json({ 
      isReplacementEmail: !!codeData,
      codeData: codeData || null
    });
  } catch (error: any) {
    console.error('Error checking replacement email:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}

