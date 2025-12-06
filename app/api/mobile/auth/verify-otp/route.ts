import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

/**
 * CORS headers for mobile API
 */
function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*', // Allow all origins for mobile apps
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400', // 24 hours
  };
}

/**
 * Handle OPTIONS request for CORS preflight
 */
export async function OPTIONS() {
  return NextResponse.json({}, { headers: getCorsHeaders() });
}

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
        { status: 400, headers: getCorsHeaders() }
      );
    }

    // Normalize code to uppercase
    const normalizedCode = code.toUpperCase().trim();
    if (!normalizedCode || normalizedCode.length !== 6 || !/^[A-Z0-9]{6}$/.test(normalizedCode)) {
      return NextResponse.json(
        { success: false, error: 'Invalid code format. Code must be 6 alphanumeric characters.' },
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

    // Get profile with resident onboarding code (separate from email verification code)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, resident_onboarding_code, resident_onboarding_code_expires_at, full_name, role')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json(
        { success: false, error: 'Profile not found' },
        { status: 404, headers: getCorsHeaders() }
      );
    }

    // Check if resident onboarding code exists
    if (!profile.resident_onboarding_code) {
      return NextResponse.json(
        { success: false, error: 'No onboarding code found. Please contact your syndic to send a new code.' },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    // Check if code matches (using resident onboarding code, not email verification code)
    if (profile.resident_onboarding_code.toUpperCase() !== normalizedCode) {
      return NextResponse.json(
        { success: false, error: 'Invalid verification code' },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    // Check if code has expired
    if (profile.resident_onboarding_code_expires_at) {
      const expiresAt = new Date(profile.resident_onboarding_code_expires_at);
      if (expiresAt < new Date()) {
        return NextResponse.json(
          { success: false, error: 'Verification code has expired. Please contact your syndic to resend the code.' },
          { status: 400, headers: getCorsHeaders() }
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
        { status: 500, headers: getCorsHeaders() }
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

    // Generate a session using Supabase admin API
    // We'll create a session token that the mobile app can use
    let accessToken: string | null = null;
    let refreshToken: string | null = null;
    
    try {
      // Use admin API to create a session for the user
      // This generates a JWT token that can be used for authentication
      const { data: sessionData, error: sessionError } = await supabase.auth.admin.createUser({
        email: user.email,
        email_confirm: true,
        user_metadata: {
          full_name: profile.full_name,
          role: profile.role,
        },
      });

      if (sessionError) {
        // User might already exist, try to get existing session
        // For existing users, we'll use passwordless auth
        console.log('[Mobile Auth] User exists, will use passwordless auth');
      } else if (sessionData?.user) {
        // New user created, but we still need to generate a session
        // For existing users, we need a different approach
      }

      // Alternative: Generate a magic link and extract the session
      // But for mobile, we'll return user info and let the app handle session creation
      // The mobile app can use Supabase's passwordless authentication after OTP verification
    } catch (sessionError) {
      console.error('[Mobile Auth] Error creating session:', sessionError);
      // Continue - mobile app will handle session creation via passwordless auth
    }

    // Return success with user info
    // The mobile app will use Supabase's passwordless authentication to get a session
    // After OTP verification, the app can call signInWithOtp to get a session token
    return NextResponse.json({
      success: true,
      message: 'OTP verified successfully',
      userId: user.id,
      email: user.email,
      profile: {
        id: profile.id,
        full_name: profile.full_name,
        role: profile.role,
      },
      // Note: Mobile app should use Supabase passwordless auth to get session
      // After this verification, call: supabase.auth.signInWithOtp({ email })
    }, { headers: getCorsHeaders() });
  } catch (error: any) {
    console.error('[Mobile Auth] Error verifying OTP:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

