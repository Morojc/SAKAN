import NextAuth, { NextAuthConfig } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import { CustomSupabaseAdapter } from "@/lib/custom-supabase-adapter"

const authConfig = {
	secret: process.env.AUTH_SECRET,
	trustHost: true,
    pages: {
        signIn: '/auth/signin',
    },
	cookies: {
		pkceCodeVerifier: {
			name: `${process.env.NODE_ENV === 'production' ? '__Secure-' : ''}authjs.pkce.code_verifier`,
			options: {
				httpOnly: true,
				sameSite: 'lax',
				path: '/',
				secure: process.env.NODE_ENV === 'production',
			},
		},
		sessionToken: {
			name: `${process.env.NODE_ENV === 'production' ? '__Secure-' : ''}authjs.session-token`,
			options: {
				httpOnly: true,
				sameSite: 'lax',
				path: '/',
				secure: process.env.NODE_ENV === 'production',
			},
		},
	},
	providers: [
		GoogleProvider({
			allowDangerousEmailAccountLinking: true,
			clientId: process.env.AUTH_GOOGLE_ID!,
			clientSecret: process.env.AUTH_GOOGLE_SECRET!,
		}),
	],
	adapter: CustomSupabaseAdapter({
		url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
		secret: process.env.SUPABASE_SECRET_KEY!,
		schema: 'dbasakan',
	}),
	callbacks: {
		async signIn({ }: { user: any; account: any; profile?: any }): Promise<boolean> {
			return true;
		},
		async session({ session, user }: { session: any; user: any }) {
			// Add user.id to the session
			if (session?.user) {
				session.user.id = user.id
			}

            // Fetch residence info based on role
            const { createSupabaseAdminClient } = await import('@/lib/supabase/server');
            const supabase = createSupabaseAdminClient();
            
            // Get user role
            const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', user.id)
                .maybeSingle();
            
            if (profile) {
                session.user.role = profile.role;
                
                let residenceId = null;
                
                if (profile.role === 'syndic') {
                    const { data: residence } = await supabase
                        .from('residences')
                        .select('id')
                        .eq('syndic_user_id', user.id)
                        .maybeSingle();
                    residenceId = residence?.id;
                } else if (profile.role === 'guard') {
                    const { data: residence } = await supabase
                        .from('residences')
                        .select('id')
                        .eq('guard_user_id', user.id)
                        .maybeSingle();
                    residenceId = residence?.id;
                } else if (profile.role === 'resident') {
                    const { data: pr } = await supabase
                        .from('profile_residences')
                        .select('residence_id')
                        .eq('profile_id', user.id)
                        .limit(1)
                        .maybeSingle();
                    residenceId = pr?.residence_id;
                }
                
                session.user.residenceId = residenceId;
            }

			const signingSecret = process.env.SUPABASE_JWT_SECRET

			if (signingSecret) {
				const payload = {
					aud: "authenticated",
					exp: Math.floor(new Date(session.expires).getTime() / 1000),
					sub: user.id,
					email: user.email,
					role: "authenticated",
				}

				const secretKey = new TextEncoder().encode(signingSecret)
				const jose = await import('jose')
				session.supabaseAccessToken = await new jose.SignJWT(payload)
					.setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
					.sign(secretKey)
			}
			return session
		},
	},
	events: {
		async createUser({ user }: { user: any }) {
			console.log('[NextAuth] createUser event triggered for:', user.id, 'email:', user.email);
			try {
				const { createSupabaseAdminClient } = await import('@/lib/supabase/server');
				const dbasakanClient = createSupabaseAdminClient();
				
				// Check if profile already exists (e.g. created manually or by trigger)
				const { data: existingProfile } = await dbasakanClient
					.from('profiles')
					.select('role, onboarding_completed, verified, email_verified')
					.eq('id', user.id)
					.maybeSingle();

				// Create profile for new signups (default to syndic)
				const fullName = user.name || user.email?.split('@')[0] || 'User';
				const isNewSyndic = !existingProfile; // New user signup (defaults to syndic role)
				
				// For new syndics: require email verification and document verification
				// For existing profiles: preserve their verification status
				const profilePayload: any = {
					id: user.id,
					full_name: fullName,
					role: existingProfile?.role || 'syndic', // Default to syndic for new signups
					onboarding_completed: existingProfile?.onboarding_completed || false,
					verified: existingProfile?.verified !== undefined ? existingProfile.verified : false, // Require verification for new signups
					email_verified: existingProfile?.email_verified !== undefined ? existingProfile.email_verified : false, // Require email verification
				};

				console.log('[NextAuth] Creating profile in createUser event:', profilePayload);

				const { error: upsertError } = await dbasakanClient
					.from('profiles')
					.upsert(profilePayload, { onConflict: 'id' });

				if (upsertError) {
					console.error('[NextAuth] Error creating profile in createUser event:', upsertError);
				} else {
					console.log('[NextAuth] Profile created successfully');
					
					// Generate and send email verification code for new syndics
					if (isNewSyndic && user.email) {
						try {
							const { generateVerificationCode, sendVerificationCode } = await import('@/lib/email/verification');
							const verificationCode = generateVerificationCode();
							const expiresAt = new Date();
							expiresAt.setMinutes(expiresAt.getMinutes() + 15); // 15 minutes expiration
							
							// Store verification code in profile
							await dbasakanClient
								.from('profiles')
								.update({
									email_verification_code: verificationCode,
									email_verification_code_expires_at: expiresAt.toISOString(),
								})
								.eq('id', user.id);
							
							// Send verification code email
							await sendVerificationCode(user.email, verificationCode, fullName);
							console.log('[NextAuth] Email verification code generated and sent');
						} catch (error) {
							console.error('[NextAuth] Error generating/sending verification code:', error);
							// Don't fail the signup if email fails, user can request resend
						}
					}
				}
			} catch (error) {
				console.error('[NextAuth] Error in createUser event:', error);
			}
		},
		async signIn({ user, isNewUser }: { user: any; isNewUser?: boolean }) {
			// Only handle existing users who might be missing a profile
			if (isNewUser) return true; 
			
			console.log('[NextAuth] signIn event (existing user):', user.id);
			try {
				const { createSupabaseAdminClient } = await import('@/lib/supabase/server');
				const dbasakanClient = createSupabaseAdminClient();

				const { data: existingProfile } = await dbasakanClient
					.from('profiles')
					.select('id, role, full_name, verified')
					.eq('id', user.id)
					.maybeSingle();

				if (!existingProfile) {
					console.log('[NextAuth] Profile missing for existing user, creating now...');
					const fullName = user.name || user.email?.split('@')[0] || 'User';
					await dbasakanClient
						.from('profiles')
						.insert({
							id: user.id,
							full_name: fullName,
							role: 'syndic',
							onboarding_completed: false,
						});
				} else {
					// Profile exists - preserve important fields
					// Only update fields that might have changed from Google OAuth
					const updateData: any = {};
					
					// Update name if it changed (from Google profile)
					if (user.name && user.name !== existingProfile.full_name) {
						updateData.full_name = user.name;
					}
					
					// Only update if there are changes to make
					if (Object.keys(updateData).length > 0) {
						console.log('[NextAuth] Updating existing profile fields:', Object.keys(updateData));
						await dbasakanClient
							.from('profiles')
							.update(updateData)
							.eq('id', user.id);
					} else {
						console.log('[NextAuth] Profile exists, preserving all fields');
					}
				}
			} catch (error) {
				console.error('[NextAuth] Error in signIn event:', error);
			}
		}
	}
} as NextAuthConfig

export const { auth } = NextAuth(authConfig)

export default authConfig
