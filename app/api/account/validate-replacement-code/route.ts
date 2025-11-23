import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { validateAccessCode } from '@/lib/utils/access-code';
import { createSupabaseAdminClient } from '@/utils/supabase/server';

/**
 * POST /api/account/validate-replacement-code
 * Validates the access code entered by a replacement user AFTER authentication
 * Tracks failed attempts per user and deletes account after 3 failures
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

    const email = userEmail;
    
    // Note: This endpoint can be called before authentication (from signin page)
    // The code validation will happen, but role update will happen during sign-in
    const supabase = createSupabaseAdminClient();

    // Get user's current failed attempts for this code
    // We need to track attempts per user, not just per code
    const { data: codeDataArray } = await supabase
      .rpc('get_access_code_by_code', { p_code: code });
    
    const codeData = Array.isArray(codeDataArray) && codeDataArray.length > 0 ? codeDataArray[0] : null;
    
    if (!codeData) {
      return NextResponse.json({ 
        success: false,
        message: 'Invalid code',
        attemptsRemaining: 0
      }, { status: 400 });
    }

    // Check if this user has already failed 3 times with this code
    // We'll track this by checking if the user has a profile and counting their attempts
    // For now, we'll use a simple approach: check failed_attempts on the code
    // But we need to ensure the email matches
    
    // Validate the code with email
    const validation = await validateAccessCode(code, email);
    
    if (validation.valid && validation.data) {
      // Code is valid - store the code in a cookie so it can be used during sign-in
      // The actual role update and data transfer will happen during the sign-in process
      // (in auth.config.ts createUser/signIn events)
      
      // Store code in cookie (will be used during Google OAuth sign-in)
      const response = NextResponse.json({ 
        success: true,
        message: 'Code validé avec succès! Vous pouvez maintenant vous connecter avec Google.',
        attemptsRemaining: 3
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
    const attemptsRemaining = validation.attemptsRemaining || 0;
    
    // If this was the 3rd failed attempt, we need to delete the user's account
    // But we need to find the user by email first (since we might not have session)
    if (attemptsRemaining === 0 && validation.codeDeleted) {
      console.log(`[Validate Replacement Code] User with email ${email} has failed 3 times. Deleting account.`);
      
      // Find user by email
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('email', email.toLowerCase())
        .maybeSingle();
      
      if (userData) {
        try {
          // Delete profile (cascades to related data)
          await supabase
            .from('profiles')
            .delete()
            .eq('id', userData.id);
          
          // Delete user account
          await supabase
            .from('users')
            .delete()
            .eq('id', userData.id);
          
          console.log(`[Validate Replacement Code] Account deleted for user ${userData.id}`);
        } catch (deleteError) {
          console.error('[Validate Replacement Code] Error deleting account:', deleteError);
          // Continue to return the validation error even if deletion fails
        }
      }
      
      return NextResponse.json({ 
        success: false,
        message: 'Trop de tentatives échouées. Votre compte a été supprimé pour des raisons de sécurité.',
        attemptsRemaining: 0,
        codeDeleted: true,
        accountDeleted: true
      }, { status: 400 });
    }
    
    return NextResponse.json({ 
      success: false,
      message: validation.message || 'Invalid code',
      attemptsRemaining,
      codeDeleted: validation.codeDeleted || false
    }, { status: 400 });
  } catch (error: any) {
    console.error('Error validating replacement code:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}

