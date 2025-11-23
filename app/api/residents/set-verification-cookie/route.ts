import { NextResponse } from 'next/server';

/**
 * POST /api/residents/set-verification-cookie
 * Sets the verification token in an HTTP-only cookie for NextAuth to read
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { token } = body;

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ 
        success: false,
        error: 'Verification token is required' 
      }, { status: 400 });
    }

    const response = NextResponse.json({ 
      success: true,
      message: 'Verification token stored'
    });

    // Set HTTP-only cookie that NextAuth can read
    // Use 'none' for sameSite to ensure cookie is sent across redirects
    // This is necessary for OAuth flows
    response.cookies.set('verification_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 60 * 60, // 1 hour
      path: '/',
      // Don't set domain - let browser handle it
    });

    console.log('[Set Verification Cookie] Cookie set successfully for token:', token.substring(0, 10) + '...');
    console.log('[Set Verification Cookie] Cookie settings - httpOnly: true, secure:', process.env.NODE_ENV === 'production', 'sameSite:', process.env.NODE_ENV === 'production' ? 'none' : 'lax');

    return response;
  } catch (error: any) {
    console.error('[Set Verification Cookie] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error',
    }, { status: 500 });
  }
}

