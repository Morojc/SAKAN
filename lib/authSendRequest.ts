import { Resend } from 'resend';
import config from "@/config"

interface Theme {
	brandColor?: string;
	buttonText?: string;
}

interface SendVerificationRequestParams {
	identifier: string;
	url: string;
	provider: {
		apiKey: string;
		from: string;
	};
	theme: Theme;
}

/**
 * Get test email address for verification emails
 * See: https://resend.com/docs/dashboard/emails/send-test-emails
 */
function getTestEmailAddress(originalTo: string, testMode?: 'delivered' | 'bounced' | 'complained'): string {
	const isDevelopment = process.env.NODE_ENV === 'development';
	const useTestEmails = process.env.USE_RESEND_TEST_EMAILS === 'true' || isDevelopment;
	
	if (!useTestEmails) {
		return originalTo;
	}

	// Extract label from original email (if any) or use a default
	const emailLabel = originalTo.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
	const testType = testMode || process.env.RESEND_TEST_MODE || 'delivered';
	
	// Use Resend test email addresses with labeling support
	return `${testType}+${emailLabel || 'auth'}@resend.dev`;
}

export async function sendVerificationRequest(params: SendVerificationRequestParams) {
	const { identifier: to, url } = params
	
	console.log('--- MOCK VERIFICATION EMAIL SENT ---');
	console.log(`To: ${to}`);
	console.log(`Magic Link: ${url}`);
	console.log('------------------------------------');
	return; // Early return to skip sending actual email

	/* Original logic preserved for future use
	const { identifier: to, provider, url, theme } = params
	const { host } = new URL(url)
	
	// ... rest of the code ...
	*/
}

export function html({ url, host, theme, isTestMode, testEmail }: { url: string; host: string; theme: Theme; isTestMode?: boolean; testEmail?: string }) {
	const escapedHost = host.replace(/\./g, "&#8203;.")

	const brandColor = theme?.brandColor || "#346df1"
	const color = {
		background: "#f9f9f9",
		text: "#444",
		mainBackground: "#fff",
		buttonBackground: brandColor,
		buttonBorder: brandColor,
		buttonText: theme?.buttonText || "#fff",
	}

	return `
<body style="background: ${color.background};">
  <table width="100%" border="0" cellspacing="20" cellpadding="0"
    style="background: ${color.mainBackground}; max-width: 600px; margin: auto; border-radius: 10px;">
    <tr>
      <td align="center"
        style="padding: 10px 0px; font-size: 22px; font-family: Helvetica, Arial, sans-serif; color: ${color.text};">
        Sign in to <strong>${config.metadata.title}</strong>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding: 20px 0;">
        <table border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td align="center" style="border-radius: 5px;" bgcolor="${color.buttonBackground}"><a href="${url}"
                target="_blank"
                style="font-size: 18px; font-family: Helvetica, Arial, sans-serif; color: ${color.buttonText}; text-decoration: none; border-radius: 5px; padding: 10px 20px; border: 1px solid ${color.buttonBorder}; display: inline-block; font-weight: bold;">Sign
                in</a></td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td align="center"
        style="padding: 0px 0px 10px 0px; font-size: 16px; line-height: 22px; font-family: Helvetica, Arial, sans-serif; color: ${color.text};">
        If you did not request this email you can safely ignore it.
        ${isTestMode ? `<p style="color: #f59e0b; font-weight: bold; margin-top: 10px;">⚠️ TEST MODE: This email was sent to a Resend test address (${testEmail})</p>` : ''}
      </td>
    </tr>
  </table>
</body>
`
}

// Email Text body (fallback for email clients that don't render HTML, e.g. feature phones)
export function text({ url, host }: { url: string; host: string }) {
	return `Sign in to ${host}\n${url}\n\n`
}