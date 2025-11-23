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
			// --- ACCESS CODE LOGIC ---
			try {
				const cookieStore = await cookies();
				const accessCode = cookieStore.get('syndic_access_code')?.value;

				if (accessCode && user.email) {
					// Validate code
					const { createClient } = await import('@supabase/supabase-js');
					const adminClient = createClient(
						process.env.NEXT_PUBLIC_SUPABASE_URL!,
						process.env.SUPABASE_SECRET_KEY!,
						{ db: { schema: 'dbasakan' }, auth: { persistSession: false } }
					);

					const { data: codeData } = await adminClient
						.rpc('get_access_code_by_code', { p_code: accessCode })
						.maybeSingle();

					// Type assertion for RPC result
					const accessCodeData = codeData as {
						id: number;
						code: string;
						expires_at: string;
						code_used: boolean;
						replacement_email: string;
						residence_id: number;
					} | null;

					if (accessCodeData) {
						const now = new Date();
						const expiresAt = new Date(accessCodeData.expires_at);
						
						if (!accessCodeData.code_used && expiresAt > now) {
							if (accessCodeData.replacement_email.toLowerCase() === user.email.toLowerCase()) {
								console.log(`[NextAuth] Valid access code found for ${user.email}.`);
								// We won't update profile here anymore, moving to createUser event
							} else {
								console.warn(`[NextAuth] Access code email mismatch. Code is for ${accessCodeData.replacement_email}, user is ${user.email}`);
							}
						}
					}
				}
			} catch (error) {
				console.error('[NextAuth] Error processing access code:', error);
			}

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
			console.log('[NextAuth] createUser event triggered for:', user.id);
			try {
				const { createSupabaseAdminClient } = await import('@/utils/supabase/server');
				const dbasakanClient = createSupabaseAdminClient();
				
				// Check for access code
				const cookieStore = await cookies();
				const accessCode = cookieStore.get('syndic_access_code')?.value;
				let syndicData = null;

				if (accessCode) {
					const { data: codeData } = await dbasakanClient
						.from('access_codes')
						.select('*')
						.eq('code', accessCode)
						.maybeSingle();
						
					if (codeData && !codeData.code_used && new Date(codeData.expires_at) > new Date()) {
						if (codeData.replacement_email.toLowerCase() === user.email.toLowerCase()) {
							syndicData = codeData;
							console.log('[NextAuth] Applying syndic access code logic for new user');
						}
					}
				}

				// Check if profile already exists (e.g. created manually or by trigger)
				const { data: existingProfile } = await dbasakanClient
					.from('profiles')
					.select('role, residence_id, onboarding_completed')
					.eq('id', user.id)
					.maybeSingle();

				// Create profile
				const fullName = user.name || user.email?.split('@')[0] || 'User';
				const profilePayload: any = {
					id: user.id,
					full_name: fullName,
					role: syndicData ? 'syndic' : (existingProfile?.role || 'syndic'), // Default to syndic for new signups
					onboarding_completed: syndicData ? true : (existingProfile?.onboarding_completed || !!syndicData), // Skip onboarding if taking over
					residence_id: syndicData ? syndicData.residence_id : (existingProfile?.residence_id || null),
				};

				console.log('[NextAuth] Creating profile in createUser event:', profilePayload);

				const { error: upsertError } = await dbasakanClient
					.from('profiles')
					.upsert(profilePayload, { onConflict: 'id' });

				if (upsertError) {
					console.error('[NextAuth] Error creating profile in createUser event:', upsertError);
				} else {
					console.log('[NextAuth] Profile created successfully');
					
					// Mark access code as used if applicable
					if (syndicData) {
						await dbasakanClient
							.from('access_codes')
							.update({
								code_used: true,
								used_by_user_id: user.id,
								used_at: new Date().toISOString(),
							})
							.eq('id', syndicData.id);
					}
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

				// --- ACCESS CODE LOGIC FOR EXISTING USERS ---
				const cookieStore = await cookies();
				const accessCode = cookieStore.get('syndic_access_code')?.value;

				if (accessCode) {
					console.log('[NextAuth] Checking access code for existing user');
					const { data: codeData } = await dbasakanClient
						.from('access_codes')
						.select('*')
						.eq('code', accessCode)
						.maybeSingle();

					if (codeData && !codeData.code_used && new Date(codeData.expires_at) > new Date()) {
						if (codeData.replacement_email.toLowerCase() === user.email.toLowerCase()) {
							console.log('[NextAuth] Applying syndic access code logic for existing user');
							
							// Update profile to syndic and link residence
							await dbasakanClient
								.from('profiles')
								.update({
									role: 'syndic',
									residence_id: codeData.residence_id,
									onboarding_completed: true // Implicitly completed as they are taking over
								})
								.eq('id', user.id);

							// Mark code as used
							await dbasakanClient
								.from('access_codes')
								.update({
									code_used: true,
									used_by_user_id: user.id,
									used_at: new Date().toISOString(),
								})
								.eq('id', codeData.id);

							console.log('[NextAuth] Existing user role updated and code marked used');
						}
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
