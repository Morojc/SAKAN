import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

/**
 * Mobile API: Verify OTP for Resident Authentication
 * POST /api/mobile/auth/verify-otp
 * 
 * This endpoint allows residents to authenticate using the OTP code sent to their email
 * when they were added by a syndic.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, code } = body;

    // Validation
    if (!email || !code) {
      return NextResponse.json(
        { success: false, error: 'Email and code are required' },
        { status: 400 }
      );
    }

    // Normalize code to uppercase
    const normalizedCode = code.toUpperCase().trim();
    if (!normalizedCode || normalizedCode.length !== 6 || !/^[A-Z0-9]{6}$/.test(normalizedCode)) {
      return NextResponse.json(
        { success: false, error: 'Invalid code format. Code must be 6 alphanumeric characters.' },
        { status: 400 }
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
        { status: 404 }
      );
    }

    // Get profile with resident onboarding code (separate from email verification code)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, resident_onboarding_code, resident_onboarding_code_expires_at, full_name, role')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json(
        { success: false, error: 'Profile not found' },
        { status: 404 }
      );
    }

    // Check if resident onboarding code exists
    if (!profile.resident_onboarding_code) {
      return NextResponse.json(
        { success: false, error: 'No onboarding code found. Please contact your syndic to send a new code.' },
        { status: 400 }
      );
    }

    // Check if code matches (using resident onboarding code, not email verification code)
    if (profile.resident_onboarding_code.toUpperCase() !== normalizedCode) {
      return NextResponse.json(
        { success: false, error: 'Invalid verification code' },
        { status: 400 }
      );
    }

    // Check if code has expired
    if (profile.resident_onboarding_code_expires_at) {
      const expiresAt = new Date(profile.resident_onboarding_code_expires_at);
      if (expiresAt < new Date()) {
        return NextResponse.json(
          { success: false, error: 'Verification code has expired. Please contact your syndic to resend the code.' },
          { status: 400 }
        );
      }
    }

    // Mark as verified and clear resident onboarding code
    // Note: This doesn't affect email_verified (which is for authentication email verification)
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        resident_onboarding_code: null,
        resident_onboarding_code_expires_at: null,
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('[Mobile Auth] Error updating profile:', updateError);
      return NextResponse.json(
        { success: false, error: 'Error updating verification status' },
        { status: 500 }
      );
    }

    // Also update profile_residences verified status
    const { error: residenceUpdateError } = await supabase
      .from('profile_residences')
      .update({ verified: true })
      .eq('profile_id', user.id);

    if (residenceUpdateError) {
      console.error('[Mobile Auth] Error updating residence verification:', residenceUpdateError);
      // Don't fail the request, but log the error
    }

    return NextResponse.json({
      success: true,
      message: 'OTP verified successfully',
      userId: user.id,
      profile: {
        id: profile.id,
        full_name: profile.full_name,
        role: profile.role,
      },
    });
  } catch (error: any) {
    console.error('[Mobile Auth] Error verifying OTP:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

