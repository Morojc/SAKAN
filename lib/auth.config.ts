import NextAuth, { NextAuthConfig } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import { CustomSupabaseAdapter } from "@/lib/custom-supabase-adapter"

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
	],
	adapter: CustomSupabaseAdapter({
		url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
		secret: process.env.SUPABASE_SECRET_KEY!,
		schema: 'dbasakan',
	}),
	callbacks: {
		async signIn({ user, account, profile }: { user: any; account: any; profile?: any }): Promise<boolean> {
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
			console.log('[NextAuth] createUser event triggered for:', user.id, 'email:', user.email);
			try {
				const { createSupabaseAdminClient } = await import('@/utils/supabase/server');
				const dbasakanClient = createSupabaseAdminClient();
				
				// Check if profile already exists (e.g. created manually or by trigger)
				const { data: existingProfile } = await dbasakanClient
					.from('profiles')
					.select('role, residence_id, onboarding_completed, verified')
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
					verified: existingProfile?.verified !== undefined ? existingProfile.verified : true, // Auto-verify for new signups
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
			// Only handle existing users who might be missing a profile
			if (isNewUser) return true; 
			
			console.log('[NextAuth] signIn event (existing user):', user.id);
			try {
				const { createSupabaseAdminClient } = await import('@/utils/supabase/server');
				const dbasakanClient = createSupabaseAdminClient();

				const { data: existingProfile } = await dbasakanClient
					.from('profiles')
					.select('id, residence_id, role, full_name, verified')
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
							residence_id: null,
						});
				} else {
					// Profile exists - preserve residence_id and other important fields
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
						console.log('[NextAuth] Profile exists, preserving all fields including residence_id:', existingProfile.residence_id);
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
