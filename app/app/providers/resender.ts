import { Resend } from 'resend';
import config from '@/config';

interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
}

interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Get Resend client instance
 * Reuses the same instance for better performance
 * Follows the Resend SDK pattern: const resend = new Resend('re_xxxxxxxxx');
 */
let resendClient: Resend | null = null;

function getResendClient(): Resend {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('Resend API key not found. Please set RESEND_API_KEY in your environment variables.');
    }
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}


/**
 * Send email using Resend
 * 
 * @param params - Email parameters
 * @returns Promise with send result
 * 
 * @example
 * ```ts
 * const result = await sendEmail({
 *   to: 'user@example.com',
 *   subject: 'Welcome!',
 *   html: '<h1>Welcome to our app</h1>',
 * });
 * 
 * if (result.success) {
 *   console.log('Email sent:', result.messageId);
 * } else {
 *   console.error('Failed to send email:', result.error);
 * }
 * ```
 */
/**
 * Send email using Resend
 * Follows the Resend SDK pattern exactly:
 * 
 * @example
 * ```ts
 * const resend = new Resend('re_xxxxxxxxx');
 * await resend.emails.send({
 *   from: 'Acme <onboarding@resend.dev>',
 *   to: ['delivered@resend.dev'],
 *   subject: 'hello world',
 *   html: '<p>it works!</p>',
 * });
 * ```
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    
    if (!apiKey) {
      console.warn('[Resend] Missing API key. Logging email instead.');
      console.log('--- EMAIL (NOT SENT) ---');
      console.log(`To: ${Array.isArray(params.to) ? params.to.join(', ') : params.to}`);
      console.log(`Subject: ${params.subject}`);
      console.log(`HTML: ${params.html}`);
      console.log('------------------------');
      return {
        success: false,
        error: 'Resend API key not configured',
      };
    }

    // Follow Resend SDK pattern: const resend = new Resend('re_xxxxxxxxx');
    const resend = getResendClient();
    
    // Prepare email parameters following the SDK pattern
    // Use the from parameter directly if provided, otherwise use EMAIL_FROM env var
    // For unverified domains, use just the email without name (e.g., "onboarding@resend.dev")
    const from = params.from || process.env.EMAIL_FROM || 'onboarding@resend.dev';

    // Log the email details for debugging
    console.log('[Resend] Sending email:', {
      from,
      to: params.to,
      subject: params.subject,
      htmlLength: params.html.length,
    });

    // Follow Resend SDK pattern: await resend.emails.send({...})
    // Only include html, not text - html contains the full template
    // Use recipient email directly from params (no transformation)
    const { data, error } = await resend.emails.send({
      from,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });

    if (error) {
      console.error('[Resend] Error sending email:', error);
      return {
        success: false,
        error: error.message || 'Failed to send email',
      };
    }

    console.log(`[Resend] Email sent successfully to: ${Array.isArray(params.to) ? params.to.join(', ') : params.to}`);

    return {
      success: true,
      messageId: data?.id,
    };
  } catch (error: any) {
    console.error('[Resend] Exception sending email:', error);
    return {
      success: false,
      error: error.message || 'Unknown error occurred',
    };
  }
}
