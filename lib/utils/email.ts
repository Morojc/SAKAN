import { Resend } from 'resend';
import config from "@/config";

interface SendAccessCodeEmailParams {
  to: string;
  code: string;
  actionType: 'delete_account' | 'change_role';
}

/**
 * Get test email address based on environment and test mode
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
  // Labeling allows tracking different test scenarios
  return `${testType}+${emailLabel || 'test'}@resend.dev`;
}

/**
 * Send access code email for syndic role transfer
 * 
 * Testing: Set USE_RESEND_TEST_EMAILS=true in .env.local to use Resend test emails
 * Test modes: 'delivered' | 'bounced' | 'complained'
 * Examples:
 *   - delivered+user1@resend.dev (successful delivery)
 *   - bounced+user1@resend.dev (simulate bounce)
 *   - complained+user1@resend.dev (simulate spam complaint)
 * 
 * See: https://resend.com/docs/dashboard/emails/send-test-emails
 */
export async function sendAccessCodeEmail({ to, code, actionType }: SendAccessCodeEmailParams) {
  console.log('--- MOCK EMAIL SENT ---');
  console.log(`To: ${to}`);
  console.log(`Code: ${code}`);
  console.log(`Action: ${actionType}`);
  console.log('-------------------------');
  return; // Early return to skip sending actual email

  /* Original logic preserved for future use
  const apiKey = process.env.RESEND_API_KEY || process.env.AUTH_RESEND_KEY;
  const from = process.env.EMAIL_FROM || 'onboarding@resend.dev';
  const host = process.env.NEXT_PUBLIC_APP_URL || 'https://sakan.app';

  if (!apiKey) {
    console.warn('[Email] Missing Resend API key. Logging email instead.');
    console.log('--- ACCESS CODE EMAIL ---');
    console.log(`To: ${to}`);
    console.log(`Code: ${code}`);
    console.log(`Action: ${actionType}`);
    console.log('-------------------------');
    return;
  }
  
  // ... rest of the code ...
  */
}
