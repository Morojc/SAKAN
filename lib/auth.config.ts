import NextAuth, { NextAuthConfig } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import { CustomSupabaseAdapter } from "@/lib/custom-supabase-adapter"
import Resend from "next-auth/providers/resend"
import { sendVerificationRequest } from "@/lib/authSendRequest"
import config from "@/config"
import { cookies } from "next/headers"

const authConfig = {
	secret: process.env.AUTH_SECRET,
	trustHost: true,
    pages: {
        signIn: '/auth/signin',
    },
	providers: [
		GoogleProvider({
			allowDangerousEmailAccountLinking: true,
			clientId: process.env.AUTH_GOOGLE_ID!,
			clientSecret: process.env.AUTH_GOOGLE_SECRET!,
		}),
		...(config.emailProvider === "resend" ? [
			Resend({
				apiKey: process.env.AUTH_RESEND_KEY,
				from: process.env.EMAIL_FROM,
				sendVerificationRequest: async function ({ identifier: email, url, provider, theme }) {
					console.log('--- MOCK VERIFICATION EMAIL SENT ---');
					console.log(`To: ${email}`);
					console.log(`Magic Link: ${url}`);
					console.log('------------------------------------');
					return;
					
					/* Original logic preserved
					//@ts-ignore
					sendVerificationRequest({ identifier: email, url, provider, theme })
					*/
				}
			})
		] : []),
	],
	adapter: CustomSupabaseAdapter({
		url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
		secret: process.env.SUPABASE_SECRET_KEY!,
		schema: 'dbasakan',
	}),
	callbacks: {
		async signIn({ user, account, profile }: { user: any; account: any; profile?: any }): Promise<boolean> {
			// Access code validation happens in createUser/signIn events
			// This callback just allows the sign-in to proceed
			return true;
		},
		async session({ session, user }: { session: any; user: any }) {
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
			// For replacement users, we don't validate the code here
			// They will be redirected to /app/validate-code after authentication
			// The code validation happens in that page
			console.log('[NextAuth] createUser event triggered for:', user.id);
			try {
				const { createSupabaseAdminClient } = await import('@/utils/supabase/server');
				const dbasakanClient = createSupabaseAdminClient();
				
				// Check for access code in cookie (set during code validation on signin page)
				const cookieStore = await cookies();
				const accessCode = cookieStore.get('syndic_access_code')?.value;
				
				if (accessCode && user.email) {
					console.log('[NextAuth] Access code found in cookie for new user, validating...');
					
					// Use validateAccessCode to check code and email match
					const { validateAccessCode, markCodeAsUsed } = await import('@/lib/utils/access-code');
					const validation = await validateAccessCode(accessCode, user.email);
					
					if (validation.valid && validation.data) {
						console.log(`[NextAuth] Valid access code found for ${user.email}. Role will be set to syndic.`);
						
						// If action_type is 'change_role', transfer data from original syndic to this user
						if (validation.data.action_type === 'change_role') {
							console.log(`[NextAuth] Transferring syndic data from ${validation.data.original_user_id} to ${user.id}`);
							const { transferSyndicData } = await import('@/lib/utils/account-transfer');
							await transferSyndicData(validation.data.original_user_id, user.id);
							
							// Change original syndic's role to resident
							await dbasakanClient
								.from('profiles')
								.update({ role: 'resident' })
								.eq('id', validation.data.original_user_id);
							
							console.log(`[NextAuth] Data transferred and original syndic role changed to resident`);
						}
						
						// Mark code as used
						await markCodeAsUsed(accessCode, user.id);
						
						// Clear the cookie
						cookieStore.set('syndic_access_code', '', { maxAge: 0 });
						
						// Create profile with syndic role and residence
						const fullName = user.name || user.email?.split('@')[0] || 'User';
						await dbasakanClient
							.from('profiles')
							.upsert({
								id: user.id,
								full_name: fullName,
								role: 'syndic',
								residence_id: validation.data.residence_id,
								onboarding_completed: true, // Implicitly completed as they are taking over
							}, {
								onConflict: 'id'
							});
						
						console.log('[NextAuth] Profile created with syndic role and code marked used');
						return; // Don't process further
					} else {
						console.warn(`[NextAuth] Access code validation failed: ${validation.message}`);
						// Clear cookie if validation failed
						cookieStore.set('syndic_access_code', '', { maxAge: 0 });
					}
				}
				
				// Check if user is a replacement email (but no code in cookie)
				// This means they haven't validated the code yet
				if (user.email) {
					const { checkIfReplacementEmail } = await import('@/lib/utils/access-code');
					const codeData = await checkIfReplacementEmail(user.email);
					
					if (codeData) {
						console.log('[NextAuth] User is a replacement email but no valid code found, creating resident profile');
						// Create a basic profile with resident role - will be updated when code is validated
						const fullName = user.name || user.email?.split('@')[0] || 'User';
						await dbasakanClient
							.from('profiles')
							.upsert({
								id: user.id,
								full_name: fullName,
								role: 'resident', // Will be updated to syndic when code is validated
								onboarding_completed: false,
								residence_id: null,
							}, {
								onConflict: 'id'
							});
						return; // Don't process further
					}
				}

				// Check if profile already exists (e.g. created manually or by trigger)
				const { data: existingProfile } = await dbasakanClient
					.from('profiles')
					.select('role, residence_id, onboarding_completed')
					.eq('id', user.id)
					.maybeSingle();

				// Create profile for new signups (default to syndic)
				const fullName = user.name || user.email?.split('@')[0] || 'User';
				const profilePayload: any = {
					id: user.id,
					full_name: fullName,
					role: existingProfile?.role || 'syndic', // Default to syndic for new signups
					onboarding_completed: existingProfile?.onboarding_completed || false,
					residence_id: existingProfile?.residence_id || null,
				};

				console.log('[NextAuth] Creating profile in createUser event:', profilePayload);

				const { error: upsertError } = await dbasakanClient
					.from('profiles')
					.upsert(profilePayload, { onConflict: 'id' });

				if (upsertError) {
					console.error('[NextAuth] Error creating profile in createUser event:', upsertError);
				} else {
					console.log('[NextAuth] Profile created successfully');
				}
			} catch (error) {
				console.error('[NextAuth] Error in createUser event:', error);
			}
		},
		async signIn({ user, isNewUser }: { user: any; isNewUser?: boolean }) {
			// Only handle existing users who might be missing a profile OR transferring role
			if (isNewUser) return; 
			
			console.log('[NextAuth] signIn event (existing user):', user.id);
			try {
				const { createSupabaseAdminClient } = await import('@/utils/supabase/server');
				const dbasakanClient = createSupabaseAdminClient();

				// Check if user is a replacement email - if so, don't process here
				// They will be redirected to /app/validate-code by the layout
				if (user.email) {
					const { checkIfReplacementEmail } = await import('@/lib/utils/access-code');
					const codeData = await checkIfReplacementEmail(user.email);
					
					if (codeData) {
						console.log('[NextAuth] User is a replacement email, skipping automatic validation');
						// Don't process code here - let the validate-code page handle it
						// Just ensure profile exists with resident role
						const { data: existingProfile } = await dbasakanClient
							.from('profiles')
							.select('id, role')
							.eq('id', user.id)
							.maybeSingle();
						
						if (!existingProfile) {
							// Create a basic profile with resident role - will be updated when code is validated
							const fullName = user.name || user.email?.split('@')[0] || 'User';
							await dbasakanClient
								.from('profiles')
								.upsert({
									id: user.id,
									full_name: fullName,
									role: 'resident', // Will be updated to syndic when code is validated
									onboarding_completed: false,
									residence_id: null,
								}, {
									onConflict: 'id'
								});
						} else if (existingProfile.role === 'syndic') {
							// If user already has syndic role but is a replacement_email, 
							// it means they haven't validated the code yet, so keep them as resident
							// (This shouldn't happen normally, but handle it just in case)
							await dbasakanClient
								.from('profiles')
								.update({ role: 'resident' })
								.eq('id', user.id);
						}
						return; // Don't process further - let validate-code page handle it
					}
				}

				// --- ACCESS CODE LOGIC FOR EXISTING USERS (legacy support) ---
				const cookieStore = await cookies();
				const accessCode = cookieStore.get('syndic_access_code')?.value;

				if (accessCode && user.email) {
					console.log('[NextAuth] Validating access code for existing user (legacy)');
					
					// Use validateAccessCode to check code and email match, and track attempts
					const { validateAccessCode, markCodeAsUsed } = await import('@/lib/utils/access-code');
					const validation = await validateAccessCode(accessCode, user.email);
					
					if (validation.valid && validation.data) {
						console.log(`[NextAuth] Valid access code found for existing user ${user.email}. Updating role to syndic.`);
						
						// If action_type is 'change_role', transfer data from original syndic to this user
						if (validation.data.action_type === 'change_role') {
							console.log(`[NextAuth] Transferring syndic data from ${validation.data.original_user_id} to ${user.id}`);
							const { transferSyndicData } = await import('@/lib/utils/account-transfer');
							await transferSyndicData(validation.data.original_user_id, user.id);
							
							// Change original syndic's role to resident
							await dbasakanClient
								.from('profiles')
								.update({ role: 'resident' })
								.eq('id', validation.data.original_user_id);
							
							console.log(`[NextAuth] Data transferred and original syndic role changed to resident`);
						}
						
						// Update profile to syndic and link residence
						await dbasakanClient
							.from('profiles')
							.update({
								role: 'syndic',
								residence_id: validation.data.residence_id,
								onboarding_completed: true // Implicitly completed as they are taking over
							})
							.eq('id', user.id);

						// Mark code as used (validateAccessCode already handled failed attempts)
						await markCodeAsUsed(accessCode, user.id);

						// Clear the cookie
						cookieStore.set('syndic_access_code', '', { maxAge: 0 });
						
						console.log('[NextAuth] Existing user role updated to syndic and code marked used');
					} else {
						console.warn(`[NextAuth] Access code validation failed for existing user: ${validation.message}`);
						// Clear cookie if validation failed
						cookieStore.set('syndic_access_code', '', { maxAge: 0 });
					}
				}
				// -------------------------------------------

				const { data: existingProfile } = await dbasakanClient
					.from('profiles')
					.select('id')
					.eq('id', user.id)
					.maybeSingle();

				if (!existingProfile) {
					console.log('[NextAuth] Profile missing for existing user, creating now...');
					const fullName = user.name || user.email?.split('@')[0] || 'User';
					await dbasakanClient
						.from('profiles')
						.upsert({
							id: user.id,
							full_name: fullName,
							role: 'syndic',
							onboarding_completed: false,
							residence_id: null,
						}, { onConflict: 'id' });
				}
			} catch (error) {
				console.error('[NextAuth] Error in signIn event:', error);
			}
		}
	}
} as NextAuthConfig

export const { auth } = NextAuth(authConfig)

export default authConfig
