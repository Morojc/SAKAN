import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { auth } from '@/lib/auth';

/**
 * POST /api/verify-email-code
 * Verifies the email verification code
 */
export async function POST(req: Request) {
	try {
		const session = await auth();
		if (!session?.user?.id) {
			return NextResponse.json({ 
				success: false,
				error: 'Not authenticated' 
			}, { status: 401 });
		}

		const body = await req.json();
		const { code } = body;

		// Convert to uppercase and validate alphanumeric
		const normalizedCode = code.toUpperCase().trim();
		if (!normalizedCode || typeof normalizedCode !== 'string' || normalizedCode.length !== 6 || !/^[A-Z0-9]{6}$/.test(normalizedCode)) {
			return NextResponse.json({ 
				success: false,
				error: 'Invalid verification code format. Code must be 6 alphanumeric characters.' 
			}, { status: 400 });
		}

		const supabase = createSupabaseAdminClient();

		// Find profile with this verification code
		const { data: profile, error: profileError } = await supabase
			.from('profiles')
			.select('id, email_verification_code, email_verification_code_expires_at, email_verified')
			.eq('id', session.user.id)
			.maybeSingle();

		if (profileError) {
			console.error('[Verify Email Code] Error finding profile:', profileError);
			return NextResponse.json({
				success: false,
				error: 'Error verifying code',
			}, { status: 500 });
		}

		if (!profile) {
			return NextResponse.json({
				success: false,
				error: 'Profile not found',
			}, { status: 404 });
		}

		// Check if already verified
		if (profile.email_verified) {
			return NextResponse.json({
				success: true,
				message: 'Email already verified',
				alreadyVerified: true,
			});
		}

		// Check if code matches (case-insensitive comparison)
		if (profile.email_verification_code?.toUpperCase() !== normalizedCode) {
			return NextResponse.json({
				success: false,
				error: 'Invalid verification code',
			}, { status: 400 });
		}

		// Check if code has expired
		if (profile.email_verification_code_expires_at) {
			const expiresAt = new Date(profile.email_verification_code_expires_at);
			if (expiresAt < new Date()) {
				return NextResponse.json({
					success: false,
					error: 'Verification code has expired. Please request a new code.',
				}, { status: 400 });
			}
		}

		// Mark as verified and clear verification code
		const { error: updateError } = await supabase
			.from('profiles')
			.update({
				email_verified: true,
				email_verification_code: null,
				email_verification_code_expires_at: null,
			})
			.eq('id', session.user.id);

		if (updateError) {
			console.error('[Verify Email Code] Error updating profile:', updateError);
			return NextResponse.json({
				success: false,
				error: 'Error updating verification status',
			}, { status: 500 });
		}

		return NextResponse.json({
			success: true,
			message: 'Email verified successfully',
		});
	} catch (error: any) {
		console.error('[Verify Email Code] Error:', error);
		return NextResponse.json({
			success: false,
			error: error.message || 'Internal server error',
		}, { status: 500 });
	}
}

/**
 * POST /api/verify-email-code/resend
 * Resends the verification code
 */
export async function PUT(_req: Request) {
	try {
		const session = await auth();
		if (!session?.user?.id || !session?.user?.email) {
			return NextResponse.json({ 
				success: false,
				error: 'Not authenticated' 
			}, { status: 401 });
		}

		const supabase = createSupabaseAdminClient();

		// Get user profile
		const { data: profile, error: profileError } = await supabase
			.from('profiles')
			.select('id, full_name, email_verified')
			.eq('id', session.user.id)
			.maybeSingle();

		if (profileError || !profile) {
			return NextResponse.json({
				success: false,
				error: 'Profile not found',
			}, { status: 404 });
		}

		// Check if already verified
		if (profile.email_verified) {
			return NextResponse.json({
				success: true,
				message: 'Email already verified',
				alreadyVerified: true,
			});
		}

		// Generate new verification code
		const { generateVerificationCode, sendVerificationCode } = await import('@/lib/email/verification');
		const verificationCode = generateVerificationCode();
		const expiresAt = new Date();
		expiresAt.setMinutes(expiresAt.getMinutes() + 15); // 15 minutes expiration

		// Update profile with new code
		const { error: updateError } = await supabase
			.from('profiles')
			.update({
				email_verification_code: verificationCode,
				email_verification_code_expires_at: expiresAt.toISOString(),
			})
			.eq('id', session.user.id);

		if (updateError) {
			console.error('[Resend Code] Error updating profile:', updateError);
			return NextResponse.json({
				success: false,
				error: 'Error generating new code',
			}, { status: 500 });
		}

		// Send verification code email
		await sendVerificationCode(session.user.email, verificationCode, profile.full_name);

		return NextResponse.json({
			success: true,
			message: 'Verification code sent successfully',
		});
	} catch (error: any) {
		console.error('[Resend Code] Error:', error);
		return NextResponse.json({
			success: false,
			error: error.message || 'Internal server error',
		}, { status: 500 });
	}
}

