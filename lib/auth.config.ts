import NextAuth, { NextAuthConfig } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import { CustomSupabaseAdapter } from "@/lib/custom-supabase-adapter"
import Resend from "next-auth/providers/resend"
import { sendVerificationRequest } from "@/lib/authSendRequest"
import config from "@/config"
//read https://github.com/nextauthjs/next-auth/issues/8357O

const authConfig = {
	secret: process.env.AUTH_SECRET,
	// trustHost allows NextAuth to trust the host header (useful for ngrok, reverse proxies)
	// This prevents issues with https://localhost:3000 when the protocol is incorrectly detected
	trustHost: true,
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
					//@ts-ignore - Ignoring type check here as sendVerificationRequest expects slightly different parameter structure than what Next-Auth provides
					sendVerificationRequest({ identifier: email, url, provider, theme })
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
		async signIn({ user, account, profile }) {
			// After user is created/authenticated, ensure profile exists in dbasakan.profiles
			if (user?.id) {
				try {
					// Create a client specifically configured for dbasakan schema
					const { createClient } = await import('@supabase/supabase-js');
					const dbasakanClient = createClient(
						process.env.NEXT_PUBLIC_SUPABASE_URL!,
						process.env.SUPABASE_SECRET_KEY!,
						{
							db: { schema: 'dbasakan' },
							auth: { persistSession: false },
						}
					);
					
					// Check if profile already exists
					const { data: existingProfile, error: checkError } = await dbasakanClient
						.from('profiles')
						.select('id')
						.eq('id', user.id)
						.maybeSingle();
					
					// Create profile if it doesn't exist
					if (!existingProfile) {
						const fullName = user.name || user.email?.split('@')[0] || 'User';
						
						const { error: insertError } = await dbasakanClient
							.from('profiles')
							.insert({
								id: user.id,
								full_name: fullName,
								role: 'resident', // default role
								// residence_id can be null initially - user will be assigned later
							});
						
						if (insertError) {
							console.error('[NextAuth] Error creating profile:', insertError);
							// Don't block sign-in if profile creation fails
							// The database trigger will handle it as fallback
						} else {
							console.log('[NextAuth] Profile created for user:', user.id);
						}
					}
				} catch (error) {
					console.error('[NextAuth] Error in signIn callback:', error);
					// Don't block sign-in - allow user to proceed
					// The database trigger will handle profile creation as fallback
				}
			}
			return true; // Allow sign-in to proceed
		},
		async session({ session, user }) {
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
} satisfies NextAuthConfig

export const { auth } = NextAuth(authConfig)

export default authConfig