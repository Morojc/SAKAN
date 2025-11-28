import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

/**
 * POST /api/residents/verify
 * Verifies a resident using their verification token
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

    const supabase = createSupabaseAdminClient();

    // Find profile with this verification token
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, verified, verification_token_expires_at, full_name')
      .eq('verification_token', token)
      .maybeSingle();

    if (profileError) {
      console.error('[Verify Resident] Error finding profile:', profileError);
      return NextResponse.json({
        success: false,
        error: 'Error verifying token',
      }, { status: 500 });
    }

    if (!profile) {
      return NextResponse.json({
        success: false,
        error: 'Invalid verification token',
      }, { status: 404 });
    }

    // Check if already verified
    if (profile.verified) {
      return NextResponse.json({
        success: true,
        message: 'Your account is already verified',
        alreadyVerified: true,
      });
    }

    // Check if token has expired
    if (profile.verification_token_expires_at) {
      const expiresAt = new Date(profile.verification_token_expires_at);
      if (expiresAt < new Date()) {
        return NextResponse.json({
          success: false,
          error: 'Verification token has expired. Please contact your syndic to resend the verification email.',
        }, { status: 400 });
      }
    }

    // Mark as verified and clear verification token
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        verified: true,
        verification_token: null,
        verification_token_expires_at: null,
      })
      .eq('id', profile.id);

    if (updateError) {
      console.error('[Verify Resident] Error updating profile:', updateError);
      return NextResponse.json({
        success: false,
        error: 'Failed to verify account',
      }, { status: 500 });
    }

    console.log(`[Verify Resident] Profile ${profile.id} verified successfully`);

    return NextResponse.json({
      success: true,
      message: 'Your account has been verified successfully! You can now sign in.',
    });
  } catch (error: any) {
    console.error('[Verify Resident] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error',
    }, { status: 500 });
  }
}

/**
 * GET /api/residents/verify
 * Checks verification status by token (for the verification page)
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ 
        success: false,
        error: 'Verification token is required' 
      }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    // Find profile with this verification token
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, verified, verification_token_expires_at, full_name')
      .eq('verification_token', token)
      .maybeSingle();

    if (profileError) {
      console.error('[Verify Resident] Error finding profile:', profileError);
      return NextResponse.json({
        success: false,
        error: 'Error checking token',
      }, { status: 500 });
    }

    if (!profile) {
      return NextResponse.json({
        success: false,
        error: 'Invalid verification token',
        tokenValid: false,
      });
    }

    // Get email from users table
    let residentEmail = null;
    const { data: userData } = await supabase
      .from('users')
      .select('email')
      .eq('id', profile.id)
      .maybeSingle();
    residentEmail = userData?.email || null;

    // Check if token has expired
    let tokenExpired = false;
    if (profile.verification_token_expires_at) {
      const expiresAt = new Date(profile.verification_token_expires_at);
      tokenExpired = expiresAt < new Date();
    }

    return NextResponse.json({
      success: true,
      tokenValid: !tokenExpired,
      alreadyVerified: profile.verified,
      tokenExpired,
      residentName: profile.full_name,
      residentEmail: residentEmail,
    });
  } catch (error: any) {
    console.error('[Verify Resident] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error',
    }, { status: 500 });
  }
}

