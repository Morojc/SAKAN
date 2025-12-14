import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { sendResidentOnboardingOTP } from '@/lib/email/verification';

/**
 * CORS headers for mobile API
 */
function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

/**
 * Handle OPTIONS request for CORS preflight
 */
export async function OPTIONS() {
  return NextResponse.json({}, { headers: getCorsHeaders() });
}

/**
 * Mobile API: Resend OTP Code for Resident Authentication
 * POST /api/mobile/auth/resend-otp
 * 
 * This endpoint allows residents to request a new OTP code to be sent to their email
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    // Validation
    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return NextResponse.json(
        { success: false, error: 'Invalid email format' },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    const supabase = createSupabaseAdminClient();

    // Find user by email
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: 'User not found with this email' },
        { status: 404, headers: getCorsHeaders() }
      );
    }

    // Get profile to check if user is a resident
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json(
        { success: false, error: 'Profile not found' },
        { status: 404, headers: getCorsHeaders() }
      );
    }

    // Check if user is a resident (has profile_residences link)
    const { data: residenceLink } = await supabase
      .from('profile_residences')
      .select('residence_id')
      .eq('profile_id', user.id)
      .limit(1)
      .maybeSingle();

    if (!residenceLink) {
      return NextResponse.json(
        { success: false, error: 'User is not registered as a resident. Please contact your syndic.' },
        { status: 403, headers: getCorsHeaders() }
      );
    }

    // Generate new OTP code
    const otpCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15); // 15 minutes expiration

    // Update profile with new OTP code
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        resident_onboarding_code: otpCode,
        resident_onboarding_code_expires_at: expiresAt.toISOString(),
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('[Mobile Auth] Error updating OTP code:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to generate new code' },
        { status: 500, headers: getCorsHeaders() }
      );
    }

    // Get residence info for email
    const { data: residence } = await supabase
      .from('residences')
      .select('name')
      .eq('id', residenceLink.residence_id)
      .maybeSingle();

    const { data: profileResidence } = await supabase
      .from('profile_residences')
      .select('apartment_number')
      .eq('profile_id', user.id)
      .eq('residence_id', residenceLink.residence_id)
      .maybeSingle();

    // Send email with new OTP code
    try {
      await sendResidentOnboardingOTP(
        user.email,
        otpCode,
        profile.full_name || 'Resident',
        residence?.name,
        profileResidence?.apartment_number,
      );
    } catch (emailError) {
      console.error('[Mobile Auth] Error sending email:', emailError);
      // Don't fail the request if email fails - code is still generated
      // User can contact syndic if email doesn't arrive
    }

    console.log('[Mobile Auth] OTP code resent to:', user.email);

    return NextResponse.json({
      success: true,
      message: 'A new verification code has been sent to your email.',
      expiresAt: expiresAt.toISOString(),
    }, { headers: getCorsHeaders() });
  } catch (error: any) {
    console.error('[Mobile Auth] Error resending OTP:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

