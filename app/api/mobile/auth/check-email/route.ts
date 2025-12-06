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
 * Mobile API: Check Email Existence for Resident Authentication
 * POST /api/mobile/auth/check-email
 * 
 * This endpoint allows mobile app to check if an email exists in the system
 * without requiring authentication. Used for resident onboarding flow.
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

    // Check if email exists in users table
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();

    if (userError) {
      console.error('[Mobile Auth] Error checking email:', userError);
      return NextResponse.json(
        { success: false, error: 'Error checking email' },
        { status: 500, headers: getCorsHeaders() }
      );
    }

    // Check if user has a profile with resident_onboarding_code
    let hasOnboardingCode = false;
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('resident_onboarding_code')
        .eq('id', user.id)
        .maybeSingle();

      hasOnboardingCode = !!profile?.resident_onboarding_code;
    }

    if (!user) {
      return NextResponse.json({
        success: false,
        exists: false,
        error: 'Email not found. Please contact your syndic.',
      }, { headers: getCorsHeaders() });
    }

    // Email exists - check if it has an onboarding code
    if (!hasOnboardingCode) {
      return NextResponse.json({
        success: false,
        exists: true,
        hasOnboardingCode: false,
        error: 'No onboarding code found. Please contact your syndic to send a new code.',
      }, { headers: getCorsHeaders() });
    }

    return NextResponse.json({
      success: true,
      exists: true,
      hasOnboardingCode: true,
      message: 'Email found. You can proceed to enter your verification code.',
    }, { headers: getCorsHeaders() });
  } catch (error: any) {
    console.error('[Mobile Auth] Error checking email:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

