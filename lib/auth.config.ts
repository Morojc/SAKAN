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
			console.log('[NextAuth] createUser event triggered for:', user.id, 'email:', user.email);
			try {
				const { createSupabaseAdminClient } = await import('@/utils/supabase/server');
				const dbasakanClient = createSupabaseAdminClient();
				
				// Check for verification token by email (more reliable than cookies during OAuth flow)
				if (user.email) {
					console.log('[NextAuth createUser] Checking for verification token by email:', user.email);
					
					// First, find user by email to get the user ID
					const { data: userWithEmail, error: userError } = await dbasakanClient
						.from('users')
						.select('id, email')
						.eq('email', user.email.toLowerCase())
						.maybeSingle();
					
					if (userError) {
						console.error('[NextAuth createUser] Error finding user by email:', userError);
					}
					
					let profileWithToken = null;
					
					if (userWithEmail) {
						// Now find profile with verification token for this user ID
						const { data: profile, error: profileError } = await dbasakanClient
							.from('profiles')
							.select('id, verified, verification_token, verification_token_expires_at, residence_id, full_name, role')
							.eq('id', userWithEmail.id)
							.not('verification_token', 'is', null)
							.maybeSingle();
						
						if (profileError) {
							console.error('[NextAuth createUser] Error finding profile with verification token:', profileError);
						} else {
							profileWithToken = profile;
						}
					}
					
					if (profileWithToken && profileWithToken.verification_token) {
						console.log('[NextAuth createUser] Found profile with verification token:', profileWithToken.id, 'verified:', profileWithToken.verified);
						
						// Check if token has expired
						let tokenExpired = false;
						if (profileWithToken.verification_token_expires_at) {
							const expiresAt = new Date(profileWithToken.verification_token_expires_at);
							tokenExpired = expiresAt < new Date();
							console.log('[NextAuth createUser] Token expires at:', expiresAt, 'Current time:', new Date(), 'Expired:', tokenExpired);
						}
						
						if (!tokenExpired && !profileWithToken.verified) {
							console.log(`[NextAuth createUser] Verifying profile ${profileWithToken.id} for user ${user.email} (${user.id})`);
							
							// If IDs don't match (which is expected when Google OAuth creates a new user),
							// we need to transfer the profile data to the new user ID
							if (profileWithToken.id !== user.id) {
								console.log(`[NextAuth createUser] Profile ID (${profileWithToken.id}) doesn't match user ID (${user.id}), transferring profile...`);
								
								// Delete the old placeholder profile and user
								await dbasakanClient
									.from('profiles')
									.delete()
									.eq('id', profileWithToken.id);
								await dbasakanClient
									.from('users')
									.delete()
									.eq('id', profileWithToken.id);
								
								console.log(`[NextAuth createUser] Old placeholder user and profile deleted.`);
							}
							
							// Create or update profile with verified status using the authenticated user's ID
							const fullName = user.name || profileWithToken.full_name || user.email?.split('@')[0] || 'User';
							const { error: upsertError } = await dbasakanClient
								.from('profiles')
								.upsert({
									id: user.id, // Use the authenticated user's ID
									full_name: fullName,
									verified: true,
									verification_token: null,
									verification_token_expires_at: null,
									residence_id: profileWithToken.residence_id,
									role: profileWithToken.role || 'resident', // Preserve role or default to resident
								}, {
									onConflict: 'id'
								});
							
							if (upsertError) {
								console.error('[NextAuth createUser] Error upserting profile during verification:', upsertError);
							} else {
								console.log(`[NextAuth createUser] Profile ${user.id} verified and updated successfully.`);
								
								// Wait and verify the update worked
								await new Promise(resolve => setTimeout(resolve, 100));
								const { data: verifiedProfile } = await dbasakanClient
									.from('profiles')
									.select('id, verified, residence_id')
									.eq('id', user.id)
									.maybeSingle();
								
								console.log(`[NextAuth createUser] Verification check - Profile ID: ${verifiedProfile?.id}, Verified: ${verifiedProfile?.verified}, Residence ID: ${verifiedProfile?.residence_id}`);
								
								if (!verifiedProfile?.verified) {
									console.error(`[NextAuth createUser] WARNING: Profile verification failed! Retrying...`);
									await dbasakanClient
										.from('profiles')
										.update({ verified: true })
										.eq('id', user.id);
								}
							}
							
							// Skip the rest of the createUser logic since we've handled verification
							return;
						} else if (tokenExpired) {
							console.warn('[NextAuth createUser] Verification token has expired.');
						} else if (profileWithToken.verified) {
							console.log('[NextAuth createUser] Profile already verified.');
						}
					} else {
						console.log('[NextAuth createUser] No profile with verification token found for email:', user.email);
					}
				}
				
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
						console.log('[NextAuth] User is a replacement email but no valid code found, checking existing profile');
						// Check if profile already exists to preserve residence_id
						const { data: existingProfile } = await dbasakanClient
							.from('profiles')
							.select('id, residence_id')
							.eq('id', user.id)
							.maybeSingle();
						
						if (!existingProfile) {
							// Create a basic profile with resident role - will be updated when code is validated
							const fullName = user.name || user.email?.split('@')[0] || 'User';
							await dbasakanClient
								.from('profiles')
								.insert({
									id: user.id,
									full_name: fullName,
									role: 'resident', // Will be updated to syndic when code is validated
									onboarding_completed: false,
									residence_id: null,
								});
						} else {
							// Profile exists - preserve residence_id, only update role if needed
							if (existingProfile.residence_id) {
								console.log('[NextAuth] Preserving existing residence_id:', existingProfile.residence_id);
							}
						}
						return; // Don't process further
					}
				}

				// Check if profile already exists (e.g. created manually or by trigger)
				const { data: existingProfile } = await dbasakanClient
					.from('profiles')
					.select('role, residence_id, onboarding_completed, verified')
					.eq('id', user.id)
					.maybeSingle();

				// Determine if this is a truly new signup (not added by syndic)
				// If profile doesn't exist or exists but not verified and no residence_id, it's a new signup
				const isNewSignup = !existingProfile || (!existingProfile.verified && !existingProfile.residence_id);

				// Create profile for new signups (default to syndic)
				const fullName = user.name || user.email?.split('@')[0] || 'User';
				const profilePayload: any = {
					id: user.id,
					full_name: fullName,
					role: existingProfile?.role || 'syndic', // Default to syndic for new signups
					onboarding_completed: existingProfile?.onboarding_completed || false,
					residence_id: existingProfile?.residence_id || null,
					verified: existingProfile?.verified !== undefined ? existingProfile.verified : false, // Set to false for new signups
				};

				console.log('[NextAuth] Creating profile in createUser event:', profilePayload);
				console.log('[NextAuth] Is new signup:', isNewSignup);

				const { error: upsertError } = await dbasakanClient
					.from('profiles')
					.upsert(profilePayload, { onConflict: 'id' });

				if (upsertError) {
					console.error('[NextAuth] Error creating profile in createUser event:', upsertError);
				} else {
					console.log('[NextAuth] Profile created successfully');
					
					// For new signups, generate and send verification code
					if (isNewSignup && user.email && !existingProfile?.verified) {
						try {
							console.log('[NextAuth] New signup detected, generating verification code...');
							const { createAccessCode } = await import('@/lib/utils/access-code');
							const { sendResidentVerificationCodeEmail } = await import('@/lib/utils/email');
							
							// Create access code for verification
							// For verify_resident, residence_id can be NULL if user doesn't have a residence yet
							const accessCodeData = await createAccessCode(
								user.id, // Original user (themselves for new signups)
								user.email, // Their own email
								profilePayload.residence_id || null, // Can be NULL for new signups
								'verify_resident'
							);
							
							// Send verification code email
							await sendResidentVerificationCodeEmail({
								to: user.email,
								name: fullName,
								code: accessCodeData.code,
							});
							
							console.log('[NextAuth] Verification code sent to new user:', user.email);
						} catch (emailError: any) {
							console.error('[NextAuth] Error sending verification code to new user:', emailError);
							// Don't fail the signup if email fails
						}
					}
				}
			} catch (error) {
				console.error('[NextAuth] Error in createUser event:', error);
			}
		},
		async signIn({ user, isNewUser }: { user: any; isNewUser?: boolean }) {
			// Handle verification token for both new and existing users
			try {
				const { createSupabaseAdminClient } = await import('@/utils/supabase/server');
				const dbasakanClient = createSupabaseAdminClient();
				
				// Check for verification token by email (more reliable than cookies during OAuth flow)
				if (user.email) {
					console.log('[NextAuth signIn] Checking for verification token by email:', user.email);
					
					// First, find user by email to get the user ID
					const { data: userWithEmail, error: userError } = await dbasakanClient
						.from('users')
						.select('id, email')
						.eq('email', user.email.toLowerCase())
						.maybeSingle();
					
					if (userError) {
						console.error('[NextAuth signIn] Error finding user by email:', userError);
					}
					
					let profileWithToken = null;
					
					if (userWithEmail) {
						// Now find profile with verification token for this user ID
						const { data: profile, error: profileError } = await dbasakanClient
							.from('profiles')
							.select('id, verified, verification_token, verification_token_expires_at, residence_id, full_name, role')
							.eq('id', userWithEmail.id)
							.not('verification_token', 'is', null)
							.maybeSingle();
						
						if (profileError) {
							console.error('[NextAuth signIn] Error finding profile with verification token:', profileError);
						} else {
							profileWithToken = profile;
						}
					}
					
					if (profileWithToken && profileWithToken.verification_token) {
						console.log('[NextAuth signIn] Found profile with verification token:', profileWithToken.id, 'verified:', profileWithToken.verified);
						
						// Check if token has expired
						let tokenExpired = false;
						if (profileWithToken.verification_token_expires_at) {
							const expiresAt = new Date(profileWithToken.verification_token_expires_at);
							tokenExpired = expiresAt < new Date();
							console.log('[NextAuth signIn] Token expires at:', expiresAt, 'Current time:', new Date(), 'Expired:', tokenExpired);
						}
						
						if (!tokenExpired && !profileWithToken.verified) {
							console.log(`[NextAuth signIn] Verifying profile ${profileWithToken.id} for user ${user.email} (${user.id})`);
							
							// If IDs don't match (which is expected when Google OAuth creates a new user),
							// we need to transfer the profile data to the new user ID
							if (profileWithToken.id !== user.id) {
								console.log(`[NextAuth signIn] Profile ID (${profileWithToken.id}) doesn't match user ID (${user.id}), transferring profile...`);
								
								// Check if a profile already exists for the new user ID
								const { data: existingProfileForNewUser } = await dbasakanClient
									.from('profiles')
									.select('id')
									.eq('id', user.id)
									.maybeSingle();
								
								if (existingProfileForNewUser) {
									console.log(`[NextAuth signIn] Profile already exists for user ${user.id}, updating it...`);
									// Update existing profile
									const fullName = user.name || profileWithToken.full_name || user.email?.split('@')[0] || 'User';
									const { error: updateError } = await dbasakanClient
										.from('profiles')
										.update({
											full_name: fullName,
											verified: true,
											verification_token: null,
											verification_token_expires_at: null,
											residence_id: profileWithToken.residence_id,
											role: profileWithToken.role || 'resident',
										})
										.eq('id', user.id);
									
									if (updateError) {
										console.error('[NextAuth signIn] Error updating existing profile:', updateError);
									} else {
										console.log(`[NextAuth signIn] Existing profile ${user.id} updated and verified`);
									}
								} else {
									// Create new profile with the authenticated user's ID
									const fullName = user.name || profileWithToken.full_name || user.email?.split('@')[0] || 'User';
									const { error: insertError } = await dbasakanClient
										.from('profiles')
										.insert({
											id: user.id,
											full_name: fullName,
											verified: true,
											verification_token: null,
											verification_token_expires_at: null,
											residence_id: profileWithToken.residence_id,
											role: profileWithToken.role || 'resident',
										});
									
									if (insertError) {
										console.error('[NextAuth signIn] Error creating new profile:', insertError);
									} else {
										console.log(`[NextAuth signIn] New profile ${user.id} created and verified`);
									}
								}
								
								// Delete the old placeholder profile
								await dbasakanClient
									.from('profiles')
									.delete()
									.eq('id', profileWithToken.id);
								
								console.log(`[NextAuth signIn] Old placeholder profile ${profileWithToken.id} deleted`);
								
								// Also delete the old placeholder user if it exists
								await dbasakanClient
									.from('users')
									.delete()
									.eq('id', profileWithToken.id);
								
								console.log(`[NextAuth signIn] Old placeholder user ${profileWithToken.id} deleted`);
							} else {
								// IDs match, just update the existing profile
								const fullName = user.name || profileWithToken.full_name || user.email?.split('@')[0] || 'User';
								const { error: updateError } = await dbasakanClient
									.from('profiles')
									.update({
										full_name: fullName,
										verified: true,
										verification_token: null,
										verification_token_expires_at: null,
										residence_id: profileWithToken.residence_id,
										role: profileWithToken.role || 'resident',
									})
									.eq('id', user.id);
								
								if (updateError) {
									console.error('[NextAuth signIn] Error updating profile:', updateError);
								} else {
									console.log(`[NextAuth signIn] Profile ${user.id} verified successfully`);
								}
							}
							
							// Wait a moment to ensure database write is complete
							await new Promise(resolve => setTimeout(resolve, 100));
							
							// Verify the update worked - retry a few times in case of timing issues
							let verifiedProfile = null;
							for (let i = 0; i < 3; i++) {
								const { data: profile } = await dbasakanClient
									.from('profiles')
									.select('id, verified, residence_id')
									.eq('id', user.id)
									.maybeSingle();
								
								if (profile?.verified) {
									verifiedProfile = profile;
									break;
								}
								await new Promise(resolve => setTimeout(resolve, 200));
							}
							
							console.log(`[NextAuth signIn] Verification check - Profile ID: ${verifiedProfile?.id}, Verified: ${verifiedProfile?.verified}, Residence ID: ${verifiedProfile?.residence_id}`);
							
							if (!verifiedProfile?.verified) {
								console.error(`[NextAuth signIn] WARNING: Profile verification failed! Profile ID: ${verifiedProfile?.id}, Verified: ${verifiedProfile?.verified}`);
								// Try one more time with a direct update
								await dbasakanClient
									.from('profiles')
									.update({ verified: true })
									.eq('id', user.id);
								console.log(`[NextAuth signIn] Retried verification update for ${user.id}`);
							}
							
							// Profile verified, continue with sign-in
							return true;
						} else if (tokenExpired) {
							console.warn('[NextAuth signIn] Verification token has expired');
						} else if (profileWithToken.verified) {
							console.log('[NextAuth signIn] Profile already verified');
						}
					} else {
						console.log('[NextAuth signIn] No profile with verification token found for email:', user.email);
					}
				}
			} catch (error) {
				console.error('[NextAuth signIn] Error handling verification token:', error);
			}
			
			// Only handle existing users who might be missing a profile OR transferring role
			if (isNewUser) return true; 
			
			console.log('[NextAuth] signIn event (existing user):', user.id);
			try {
				const { createSupabaseAdminClient } = await import('@/utils/supabase/server');
				const dbasakanClient = createSupabaseAdminClient();
				const cookieStore = await cookies();

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
								.insert({
									id: user.id,
									full_name: fullName,
									role: 'resident', // Will be updated to syndic when code is validated
									onboarding_completed: false,
									residence_id: null,
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
