import { NextResponse } from 'next/server';
import { validateAccessCodeForUser } from '@/lib/utils/access-code';

/**
 * POST /api/account/validate-replacement-code
 * Validates the access code entered by a replacement user
 */
export async function POST(req: Request) {
  try {
    const { code, userEmail } = await req.json();

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Code is required' }, { status: 400 });
    }

    if (!userEmail || typeof userEmail !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Validate the code with email
    const validation = await validateAccessCodeForUser(code, userEmail);
    
    if (validation.valid && validation.data) {
      // Code is valid - store the code in a cookie so it can be used during sign-in
      // The actual role update and data transfer will happen during the sign-in process
      // (in auth.config.ts createUser/signIn events)
      
      // Store code in cookie (will be used during Google OAuth sign-in)
      const response = NextResponse.json({ 
        success: true,
        message: 'Code validé avec succès! Vous pouvez maintenant vous connecter avec Google.'
      });
      
      // Set cookie that will be read during sign-in
      response.cookies.set('syndic_access_code', code, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60, // 1 hour
        path: '/'
      });
      
      return response;
    }

    // Code validation failed
    return NextResponse.json({ 
      success: false,
      message: validation.message || 'Code invalide'
    }, { status: 400 });
  } catch (error: any) {
    console.error('Error validating replacement code:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}
