import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { validateAccessCode, markCodeAsUsed } from '@/lib/utils/access-code';
import { createSupabaseAdminClient } from '@/utils/supabase/server';

/**
 * POST /api/residents/validate-code
 * Validates the verification code entered by a resident and marks their profile as verified
 */
export async function POST(req: Request) {
  try {
    const session = await auth();
    
    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { code } = await req.json();

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Verification code is required' }, { status: 400 });
    }

    // Validate the access code
    const validation = await validateAccessCode(code, session.user.email);

    if (!validation.valid || !validation.data) {
      console.log('[Validate Resident Code] Code validation failed:', validation.message);
      return NextResponse.json({ 
        success: false,
        error: validation.message || 'Invalid verification code',
        valid: false 
      }, { status: 400 });
    }

    const codeData = validation.data;
    const supabase = createSupabaseAdminClient();

    console.log('[Validate Resident Code] Code validated successfully:', {
      action_type: codeData.action_type,
      replacement_email: codeData.replacement_email,
      user_email: session.user.email
    });

    // Verify this code is for resident verification and matches the user's email
    if (codeData.action_type !== 'verify_resident') {
      console.log('[Validate Resident Code] Wrong action type:', codeData.action_type);
      return NextResponse.json({ 
        success: false,
        error: 'This code is not for resident verification' 
      }, { status: 400 });
    }

    if (codeData.replacement_email.toLowerCase() !== session.user.email.toLowerCase()) {
      console.log('[Validate Resident Code] Email mismatch:', {
        code_email: codeData.replacement_email,
        user_email: session.user.email
      });
      return NextResponse.json({ 
        success: false,
        error: 'This verification code does not belong to your email address' 
      }, { status: 403 });
    }

    // Note: validateAccessCode already checks if code is used and expired, so we can proceed

    // Mark profile as verified
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ verified: true })
      .eq('id', session.user.id);

    if (updateError) {
      console.error('[Validate Resident Code] Error updating profile:', updateError);
      return NextResponse.json({ 
        success: false,
        error: 'Failed to verify account' 
      }, { status: 500 });
    }

    // Mark code as used
    await markCodeAsUsed(code, session.user.id);

    console.log(`[Validate Resident Code] Profile ${session.user.id} verified successfully`);

    return NextResponse.json({
      success: true,
      message: 'Your account has been verified successfully!',
    });
  } catch (error: any) {
    console.error('[Validate Resident Code] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error',
    }, { status: 500 });
  }
}

