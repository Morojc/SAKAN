import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Generate a 6-character alphanumeric verification code
 */
export function generateVerificationCode(): string {
	const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excludes confusing characters (0, O, I, 1)
	let code = '';
	for (let i = 0; i < 6; i++) {
		code += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return code;
}

/**
 * Send email verification code to user
 */
export async function sendVerificationCode(email: string, code: string, userName?: string): Promise<void> {
	const fromEmail = process.env.EMAIL_FROM || 'onboarding@resend.dev';

	try {
		await resend.emails.send({
			from: fromEmail,
			to: email, // Send to actual user email address
			subject: 'Code de vérification SAKAN',
			html: `
				<!DOCTYPE html>
				<html>
				<head>
					<meta charset="utf-8">
					<meta name="viewport" content="width=device-width, initial-scale=1.0">
					<title>Code de vérification</title>
				</head>
				<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
					<div style="background-color: #f8f9fa; border-radius: 8px; padding: 30px; border: 1px solid #e9ecef;">
						<h1 style="color: #2563eb; margin-top: 0;">Code de vérification</h1>
						<p>Bonjour ${userName || 'Utilisateur'},</p>
						<p>Vous avez demandé un code de vérification pour accéder à votre compte SAKAN.</p>
						<div style="background-color: #ffffff; border: 2px dashed #2563eb; border-radius: 6px; padding: 20px; text-align: center; margin: 20px 0;">
							<div style="font-size: 32px; font-weight: bold; color: #2563eb; letter-spacing: 8px; font-family: 'Courier New', monospace;">
								${code}
							</div>
						</div>
						<p style="color: #666; font-size: 14px;">Ce code alphanumérique est valide pendant 15 minutes.</p>
						<p style="color: #666; font-size: 14px;">Le code contient des lettres majuscules et des chiffres.</p>
						<p style="color: #666; font-size: 14px;">Si vous n'avez pas demandé ce code, veuillez ignorer cet email.</p>
						<hr style="border: none; border-top: 1px solid #e9ecef; margin: 30px 0;">
						<div style="background-color: #e9ecef; border-radius: 4px; padding: 12px; margin-top: 20px;">
							<p style="color: #666; font-size: 11px; margin: 0; line-height: 1.8;">
								<strong>De:</strong> ${fromEmail}<br>
								<strong>À:</strong> ${email}
							</p>
						</div>
					</div>
				</body>
				</html>
			`,
		});

		console.log(`[Email] Verification code sent to ${email} from ${fromEmail}`);
	} catch (error) {
		console.error('[Email] Error sending verification code:', error);
		throw new Error('Failed to send verification code email');
	}
}

/**
 * Send resident onboarding OTP email
 * This is sent when a syndic adds a new resident
 */
export async function sendResidentOnboardingOTP(
	email: string, 
	code: string, 
	residentName: string,
	residenceName?: string,
	apartmentNumber?: string
): Promise<void> {
	const fromEmail = process.env.EMAIL_FROM || 'onboarding@resend.dev';

	try {
		await resend.emails.send({
			from: fromEmail,
			to: email,
			subject: 'Bienvenue sur SAKAN - Code d\'authentification',
			html: `
				<!DOCTYPE html>
				<html>
				<head>
					<meta charset="utf-8">
					<meta name="viewport" content="width=device-width, initial-scale=1.0">
					<title>Bienvenue sur SAKAN</title>
				</head>
				<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
					<div style="background-color: #f8f9fa; border-radius: 8px; padding: 30px; border: 1px solid #e9ecef;">
						<h1 style="color: #2563eb; margin-top: 0;">Bienvenue sur SAKAN !</h1>
						<p>Bonjour <strong>${residentName}</strong>,</p>
						<p>Vous avez été ajouté(e) comme résident${residenceName ? ` de ${residenceName}` : ''}${apartmentNumber ? ` (Appartement ${apartmentNumber})` : ''}.</p>
						<p>Pour accéder à votre compte sur l'application mobile SAKAN, utilisez le code d'authentification ci-dessous :</p>
						<div style="background-color: #ffffff; border: 2px dashed #2563eb; border-radius: 6px; padding: 20px; text-align: center; margin: 20px 0;">
							<div style="font-size: 32px; font-weight: bold; color: #2563eb; letter-spacing: 8px; font-family: 'Courier New', monospace;">
								${code}
							</div>
						</div>
						<p style="color: #666; font-size: 14px;"><strong>Instructions :</strong></p>
						<ol style="color: #666; font-size: 14px; padding-left: 20px;">
							<li>Téléchargez l'application mobile SAKAN</li>
							<li>Ouvrez l'application et sélectionnez "Authentification par code"</li>
							<li>Entrez votre email : <strong>${email}</strong></li>
							<li>Entrez le code ci-dessus</li>
						</ol>
						<p style="color: #d32f2f; font-size: 14px; font-weight: bold;">⚠️ Ce code est valide pendant 15 minutes uniquement.</p>
						<p style="color: #666; font-size: 14px;">Si vous n'avez pas demandé cet accès, veuillez contacter votre syndic.</p>
						<hr style="border: none; border-top: 1px solid #e9ecef; margin: 30px 0;">
						<div style="background-color: #e9ecef; border-radius: 4px; padding: 12px; margin-top: 20px;">
							<p style="color: #666; font-size: 11px; margin: 0; line-height: 1.8;">
								<strong>De:</strong> ${fromEmail}<br>
								<strong>À:</strong> ${email}
							</p>
						</div>
					</div>
				</body>
				</html>
			`,
		});

		console.log(`[Email] Resident onboarding OTP sent to ${email} for ${residentName}`);
	} catch (error) {
		console.error('[Email] Error sending resident onboarding OTP:', error);
		throw new Error('Failed to send resident onboarding OTP email');
	}
}

