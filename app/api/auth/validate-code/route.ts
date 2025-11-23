import { NextResponse } from 'next/server';
import { validateAccessCode } from '@/lib/utils/access-code';

/**
 * GET /api/auth/validate-code
 * Validates an access code before sign-in
 * This is called by the sign-in page to verify the code
 * Note: Email validation happens during actual sign-in in auth.config.ts
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.json({ 
      valid: false, 
      message: 'Code is required',
      attemptsRemaining: 0
    }, { status: 400 });
  }

  try {
    // Validate code without email check (email will be verified during sign-in)
    const result = await validateAccessCode(code);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error validating code:', error);
    return NextResponse.json({ 
      valid: false, 
      message: 'Internal server error',
      attemptsRemaining: 0
    }, { status: 500 });
  }
}

